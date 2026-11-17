// Bus : on prend en photo la fiche horaire, l'IA lit les passages,
// et le réveil choisit le dernier bus qui fait arriver à l'heure au premier cours.
import React, { useState } from 'react';
import { View, Text, Pressable, Switch, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp, Txt, Btn, Row, Label, Input, toast, ask } from './ui';
import { parseTime } from './logic';
import { S } from './store';
import { gemini, prepareImage } from './ai';

export const busCfg = (c) => {
  c.bus = { on: false, ligne: '', from: '', to: '', walkTo: 5, walkFrom: 10, duree: 20, passages: [], ...(c.bus || {}) };
  return c.bus;
};
const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const fromMin = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
const isoDay = (date) => { const d = date.getDay(); return d === 0 ? 7 : d; }; // 1 = lundi … 7 = dimanche
export const hmLabel = (t) => t.replace(':', 'h');

// Passages valables ce jour-là (heures en minutes), triés
function passagesFor(b, date) {
  const wd = String(isoDay(date));
  return (b.passages || [])
    .filter((p) => !p.jours || String(p.jours).includes(wd))
    .map((p) => ({ d: toMin(p.depart), a: p.arrivee ? toMin(p.arrivee) : toMin(p.depart) + b.duree }))
    .sort((x, y) => x.d - y.d);
}
// Le dernier bus qui arrive avant (début du cours − marche arrêt→cours)
export function pickBus(b, start) {
  const list = passagesFor(b, start);
  if (!list.length) return null;
  const limit = start.getHours() * 60 + start.getMinutes() - b.walkFrom;
  const ok = list.filter((p) => p.a <= limit);
  if (!ok.length) return { tooEarly: true, first: list[0] };
  const bus = ok[ok.length - 1];
  const prev = ok.length > 1 ? ok[ok.length - 2] : null; // le bus d'avant, en secours
  const at = (min) => { const x = new Date(start); x.setHours(Math.floor(min / 60), min % 60, 0, 0); return x; };
  return {
    bus, prev,
    departHome: at(bus.d - b.walkTo),
    label: { bus: hmLabel(fromMin(bus.d)), arr: hmLabel(fromMin(bus.a)), prev: prev ? hmLabel(fromMin(prev.d)) : '' },
  };
}

const PROMPT = (b) => `Tu lis la photo d'une fiche horaire de bus (réseau français).
${b.ligne ? `Ligne : ${b.ligne}.` : ''}
Arrêt de départ de l'élève : « ${b.from || '?'} ».${b.to ? ` Arrêt d'arrivée : « ${b.to} ».` : ''}
Extrais TOUS les passages à l'arrêt de départ dans le sens qui va ${b.to ? `vers « ${b.to} »` : 'vers le centre / le lycée'}.
Pour chaque passage donne :
- "depart" : heure de passage à l'arrêt de départ, format "HH:MM"
- "arrivee" : heure de passage à l'arrêt d'arrivée si elle est lisible sur la même course (même colonne), sinon null
- "jours" : jours de circulation en chiffres, 1 = lundi … 7 = dimanche (ex. "12345" pour lundi à vendredi, "6" pour samedi). Lis les renvois/notes (ex. « sauf mercredi », « période scolaire »).
- "vacances" : true si la course ne circule QUE pendant les vacances scolaires, sinon false
Ignore les courses avec un tiret ou vides à l'arrêt de départ.
Réponds uniquement en JSON : {"ligne":"…","from":"nom exact de l'arrêt de départ lu sur la fiche","to":"nom exact de l'arrêt d'arrivée ou null","passages":[{"depart":"07:12","arrivee":"07:35","jours":"12345","vacances":false}],"remarque":"courte remarque utile ou chaîne vide"}`;

function clean(r) {
  const out = [];
  (r.passages || []).forEach((p) => {
    if (p.vacances) return;
    const d = parseTime(String(p.depart || '').replace('h', ':'));
    if (!d) return;
    const a = p.arrivee ? parseTime(String(p.arrivee).replace('h', ':')) : null;
    const jours = String(p.jours || '12345').replace(/[^1-7]/g, '') || '12345';
    out.push({ depart: d, arrivee: a && toMin(a) > toMin(d) ? a : null, jours });
  });
  const seen = new Set();
  return out.filter((p) => { const k = p.depart + p.jours; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => toMin(x.depart) - toMin(y.depart));
}

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const joursLabel = (j) => (j === '12345' ? 'lun→ven' : j === '1234567' ? 'tous les jours' : j === '123456' ? 'lun→sam' : String(j).split('').map((n) => DAYS[n - 1]).join(' '));

function MiniStepper({ value, onChange, step = 1, max = 120 }) {
  const { C } = useApp();
  const B = ({ d, l }) => (
    <Pressable onPress={() => onChange(Math.max(0, Math.min(max, value + d)))} hitSlop={6}
      style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.priSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.priInk, fontSize: 20, fontWeight: '900' }}>{l}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <B d={-step} l="−" />
      <Text style={{ color: C.ink, fontSize: 18, fontWeight: '900', minWidth: 70, textAlign: 'center' }}>{value} min</Text>
      <B d={step} l="+" />
    </View>
  );
}

export function BusSettings({ cfg, set }) {
  const { C, runAI } = useApp();
  const b = busCfg(cfg);
  const [uris, setUris] = useState([]);
  const [manual, setManual] = useState('');
  const upd = (k, v) => { b[k] = v; set('bus', b, k === 'from' || k === 'to'); };

  const pick = async (cam) => {
    let r;
    if (cam) {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return ask('Appareil photo', "Autorise l'appareil photo dans les réglages du téléphone.");
      r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    } else r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 4, quality: 1 });
    if (!r.canceled) setUris([...uris, ...r.assets.map((a) => a.uri)].slice(0, 4));
  };
  const read = async () => {
    if (!S.settings.apiKey) return toast("Ajoute d'abord ta clé Gemini dans ⚙️ Réglages (section IA).", 'bad');
    if (!b.from.trim()) return toast("Écris d'abord le nom de ton arrêt de départ.", 'bad');
    try {
      const r = await runAI('Lecture des horaires', async () => {
        const images = [];
        for (const u of uris) images.push(await prepareImage(u));
        return gemini({ apiKey: S.settings.apiKey, model: S.settings.model, prompt: PROMPT(b), images });
      }, 'Je cherche ton arrêt sur la fiche…');
      if (!r) return;
      const list = clean(r);
      if (!list.length) return ask('Aucun horaire trouvé', "L'IA n'a pas trouvé de passage à cet arrêt. Vérifie que le nom de l'arrêt est bien celui de la fiche, ou reprends une photo plus nette.");
      b.passages = list;
      if (r.ligne && !b.ligne) b.ligne = String(r.ligne);
      if (r.from) b.from = String(r.from);
      if (r.to && !b.to) b.to = String(r.to);
      upd('passages', list); setUris([]);
      toast(`🚌 ${list.length} horaires enregistrés`);
      if (r.remarque) setTimeout(() => toast('ℹ️ ' + r.remarque, 'info'), 1800);
    } catch (e) { ask('Oups', e.message); }
  };
  const addManual = () => {
    const m = manual.trim().match(/^(\S+)(?:\s*(?:→|->|-|>)\s*(\S+))?$/);
    const d = m && parseTime(m[1]);
    if (!d) return toast('Écris par ex. 7h12 ou 7h12 → 7h35', 'bad');
    const a = m[2] ? parseTime(m[2]) : null;
    const list = [...b.passages, { depart: d, arrivee: a, jours: '12345' }].sort((x, y) => toMin(x.depart) - toMin(y.depart));
    upd('passages', list); setManual('');
  };
  const remove = (i) => upd('passages', b.passages.filter((_, k) => k !== i));
  const hasArr = b.passages.some((p) => p.arrivee);

  return (
    <View style={{ marginTop: 16, borderTopWidth: 1, borderColor: C.line, paddingTop: 14 }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <Txt style={{ flex: 1 }} bold>🚌 Je prends le bus</Txt>
        <Switch value={!!b.on} onValueChange={(v) => upd('on', v)} trackColor={{ true: C.pri }} />
      </Row>
      {b.on && (
        <View>
          <Txt muted style={{ marginTop: 4, fontSize: 13 }}>Prends en photo la fiche horaire de ta ligne : l'appli choisira le dernier bus qui te fait arriver à l'heure.</Txt>
          <Label>Ton arrêt de départ (comme sur la fiche)</Label>
          <Input value={b.from} onChangeText={(v) => upd('from', v)} placeholder="ex. Mulsant" />
          <Label>Ton arrêt d'arrivée (facultatif)</Label>
          <Input value={b.to} onChangeText={(v) => upd('to', v)} placeholder="ex. Carnot" />
          <Label>Photo de la fiche horaire</Label>
          <Row><Btn kind="sec" label="📷 Photo" onPress={() => pick(true)} /><Btn kind="sec" label="🖼️ Galerie" onPress={() => pick(false)} /></Row>
          {uris.length > 0 && (
            <View>
              <Row style={{ marginTop: 8 }}>
                {uris.map((u, i) => <Image key={i} source={{ uri: u }} style={{ width: 56, height: 56, borderRadius: 8 }} />)}
                <Btn kind="ghost" small label="Vider" onPress={() => setUris([])} />
              </Row>
              <Btn label="✨ Lire les horaires" style={{ marginTop: 10 }} onPress={read} />
            </View>
          )}

          <Label>Horaires enregistrés {b.ligne ? `· ligne ${b.ligne}` : ''}</Label>
          {b.passages.length === 0
            ? <Txt muted>Aucun pour l'instant.</Txt>
            : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {b.passages.map((p, i) => (
                  <Pressable key={i} onLongPress={() => remove(i)} onPress={() => toast('Appui long pour supprimer', 'info')}
                    style={{ backgroundColor: C.priSoft, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 }}>
                    <Text style={{ color: C.priInk, fontWeight: '800' }}>{hmLabel(p.depart)}{p.arrivee ? ` → ${hmLabel(p.arrivee)}` : ''}</Text>
                    {p.jours !== '12345' && <Text style={{ color: C.muted, fontSize: 10 }}>{joursLabel(p.jours)}</Text>}
                  </Pressable>
                ))}
              </View>
            )}
          <Row style={{ marginTop: 8, flexWrap: 'nowrap' }}>
            <Input style={{ flex: 1 }} value={manual} onChangeText={setManual} placeholder="Ajouter : 7h12 → 7h35" onSubmitEditing={addManual} />
            <Btn kind="sec" small label="＋" onPress={addManual} />
          </Row>

          <Label>Marche de chez toi à l'arrêt</Label>
          <MiniStepper value={b.walkTo} onChange={(v) => upd('walkTo', v)} />
          <Label>De l'arrêt d'arrivée à ta salle</Label>
          <MiniStepper value={b.walkFrom} onChange={(v) => upd('walkFrom', v)} />
          {!hasArr && (
            <View>
              <Label>Durée du trajet en bus</Label>
              <MiniStepper value={b.duree} onChange={(v) => upd('duree', v)} step={5} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
