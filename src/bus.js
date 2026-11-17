// Bus : photo de la fiche horaire → l'IA lit les heures de passage à ton arrêt.
// Aller : l'appli dit à quelle heure quitter la maison. Retour : à quelle heure quitter le lycée.
// « Avance » = combien de minutes tu veux être à l'arrêt avant que le bus passe.
import React, { useState } from 'react';
import { View, Text, Pressable, Switch, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp, Txt, Btn, Row, Label, Input, toast, ask } from './ui';
import { parseTime, dstr } from './logic';
import { S } from './store';
import { gemini, prepareImage } from './ai';

const fill = (o, d) => { Object.keys(d).forEach((k) => { if (o[k] === undefined) o[k] = d[k]; }); if (!Array.isArray(o.passages)) o.passages = []; return o; };
export const busCfg = (c) => {
  const b = c.bus || (c.bus = {});
  if (b.on === undefined) b.on = false;
  if (b.avance === undefined) b.avance = 5;
  if (!b.aller) { // reprise des anciens réglages
    b.aller = { stop: b.from || '', ligne: b.ligne || '', passages: (b.passages || []).map((p) => ({ depart: p.depart, jours: p.jours })), walk: b.walkTo ?? 5, ride: (b.duree ?? 20) + (b.walkFrom ?? 10) };
  }
  if (!b.retour) b.retour = {};
  fill(b.aller, { stop: '', ligne: '', walk: 5, ride: 25 });
  fill(b.retour, { stop: '', ligne: '', walk: 5 });
  return b;
};
const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const fromMin = (n) => String(Math.floor(n / 60)).padStart(2, '0') + 'h' + String(n % 60).padStart(2, '0');
const isoDay = (date) => { const d = date.getDay(); return d === 0 ? 7 : d; }; // 1 = lundi … 7 = dimanche
const minOf = (d) => d.getHours() * 60 + d.getMinutes();
const at = (ref, min) => { const x = new Date(ref); x.setHours(Math.floor(min / 60), min % 60, 0, 0); return x; };
export const hmLabel = (t) => t.replace(':', 'h');

function departures(dir, date) {
  const wd = String(isoDay(date));
  return (dir.passages || []).filter((p) => !p.jours || String(p.jours).includes(wd)).map((p) => toMin(p.depart)).sort((a, b) => a - b);
}
// Aller : le dernier bus qui t'amène en cours à l'heure → heure de départ de la maison
export function pickBus(b, start) {
  const a = b.aller, list = departures(a, start);
  if (!list.length) return null;
  const ok = list.filter((d) => d + a.ride <= minOf(start));
  if (!ok.length) return { tooEarly: true };
  const d = ok[ok.length - 1], prev = ok.length > 1 ? ok[ok.length - 2] : null;
  const leave = d - b.avance - a.walk;
  return { bus: d, departHome: at(start, leave), label: { bus: fromMin(d), leave: fromMin(leave), prev: prev ? fromMin(prev) : '' } };
}
// Retour : le premier bus après la fin des cours → heure de départ du lycée
export function pickReturn(b, end) {
  const r = b.retour, list = departures(r, end);
  if (!list.length) return null;
  const d = list.find((x) => x - b.avance - r.walk >= minOf(end));
  if (d === undefined) return { none: true };
  const leave = d - b.avance - r.walk;
  return { bus: d, leave: at(end, leave), label: { bus: fromMin(d), leave: fromMin(leave), end: fromMin(minOf(end)) } };
}
// Dernier cours (non annulé) d'un jour
export function lastLessonOn(day) {
  let best = null;
  Object.values(S.cache.edt || {}).forEach((w) => (w.lessons || []).forEach((l) => {
    if (l.canceled || dstr(new Date(l.start)) !== day) return;
    if (!best || l.end > best.end) best = l;
  }));
  return best;
}
export function returnPlan(c, day) {
  const b = busCfg(c);
  if (!b.on || !b.retour.passages.length) return null;
  const l = lastLessonOn(day);
  if (!l) return null;
  const r = pickReturn(b, new Date(l.end));
  return r && !r.none ? { day, lesson: l, ...r } : null;
}

const PROMPT = (stop, ligne) => `Tu lis la photo d'une fiche horaire de bus (réseau français).
${ligne ? `Ligne : ${ligne}.` : ''}
Arrêt de l'élève : « ${stop} ».
Extrais TOUTES les heures de passage du bus à CET arrêt (la ligne ou la colonne de cet arrêt), dans le sens indiqué par la fiche.
Pour chaque passage :
- "depart" : heure au format "HH:MM"
- "jours" : jours de circulation en chiffres, 1 = lundi … 7 = dimanche (ex. "12345" lundi à vendredi, "6" samedi). Lis les renvois et notes (« sauf mercredi », « période scolaire »…).
- "vacances" : true si la course ne roule QUE pendant les vacances scolaires, sinon false
Ignore les cases vides ou avec un tiret.
Réponds uniquement en JSON : {"ligne":"…","stop":"nom exact de l'arrêt lu sur la fiche","passages":[{"depart":"07:12","jours":"12345","vacances":false}],"remarque":"courte remarque utile ou chaîne vide"}`;

function clean(r) {
  const out = [], seen = new Set();
  (r.passages || []).forEach((p) => {
    if (p.vacances) return;
    const d = parseTime(String(p.depart || '').replace('h', ':'));
    if (!d) return;
    const jours = String(p.jours || '12345').replace(/[^1-7]/g, '') || '12345';
    if (seen.has(d + jours)) return; seen.add(d + jours);
    out.push({ depart: d, jours });
  });
  return out.sort((x, y) => toMin(x.depart) - toMin(y.depart));
}
const DAYS = ['L', 'Ma', 'Me', 'J', 'V', 'S', 'D'];
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

// Un sens (aller ou retour) : arrêt, photo, horaires, marche
function Direction({ dir, kind, save }) {
  const { C, runAI } = useApp();
  const [uris, setUris] = useState([]);
  const [manual, setManual] = useState('');
  const upd = (k, v, quiet) => { dir[k] = v; save(quiet); };
  const aller = kind === 'aller';

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
    if (!dir.stop.trim()) return toast("Écris d'abord le nom de ton arrêt.", 'bad');
    try {
      const r = await runAI('Lecture des horaires', async () => {
        const images = [];
        for (const u of uris) images.push(await prepareImage(u));
        return gemini({ apiKey: S.settings.apiKey, model: S.settings.model, prompt: PROMPT(dir.stop, dir.ligne), images });
      }, `Je cherche « ${dir.stop} » sur la fiche…`);
      if (!r) return;
      const list = clean(r);
      if (!list.length) return ask('Aucun horaire trouvé', "L'IA n'a pas trouvé de passage à cet arrêt. Vérifie que le nom est bien celui de la fiche, ou reprends une photo plus nette.");
      if (r.ligne && !dir.ligne) dir.ligne = String(r.ligne);
      if (r.stop) dir.stop = String(r.stop);
      upd('passages', list); setUris([]);
      toast(`🚌 ${list.length} horaires enregistrés`);
      if (r.remarque) setTimeout(() => toast('ℹ️ ' + r.remarque, 'info'), 1800);
    } catch (e) { ask('Oups', e.message); }
  };
  const addManual = () => {
    const d = parseTime(manual.trim());
    if (!d) return toast('Écris une heure, par ex. 7h12', 'bad');
    upd('passages', [...dir.passages, { depart: d, jours: '12345' }].sort((x, y) => toMin(x.depart) - toMin(y.depart)));
    setManual('');
  };
  const remove = (i) => upd('passages', dir.passages.filter((_, k) => k !== i));

  return (
    <View style={{ backgroundColor: C.bg, borderRadius: 18, padding: 12, marginTop: 12 }}>
      <Txt bold>{aller ? '🌅 Aller : de chez toi au lycée' : '🏠 Retour : du lycée à chez toi'}</Txt>
      <Label>{aller ? 'Ton arrêt près de chez toi' : 'Ton arrêt près du lycée'} (comme sur la fiche)</Label>
      <Input value={dir.stop} onChangeText={(v) => upd('stop', v, true)} placeholder={aller ? 'ex. Mulsant' : 'ex. Carnot'} />
      <Row style={{ marginTop: 8 }}><Btn kind="sec" small label="📷 Photo des horaires" onPress={() => pick(true)} /><Btn kind="sec" small label="🖼️ Galerie" onPress={() => pick(false)} /></Row>
      {uris.length > 0 && (
        <View>
          <Row style={{ marginTop: 8 }}>
            {uris.map((u, i) => <Image key={i} source={{ uri: u }} style={{ width: 52, height: 52, borderRadius: 8 }} />)}
            <Btn kind="ghost" small label="Vider" onPress={() => setUris([])} />
          </Row>
          <Btn label="✨ Lire les horaires" style={{ marginTop: 8 }} onPress={read} />
        </View>
      )}
      <Label>Passages du bus {dir.ligne ? `· ligne ${dir.ligne}` : ''}</Label>
      {dir.passages.length === 0 ? <Txt muted>Aucun pour l'instant.</Txt> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {dir.passages.map((p, i) => (
            <Pressable key={i} onLongPress={() => remove(i)} onPress={() => toast('Appui long pour supprimer', 'info')}
              style={{ backgroundColor: C.priSoft, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 }}>
              <Text style={{ color: C.priInk, fontWeight: '800' }}>{hmLabel(p.depart)}</Text>
              {p.jours !== '12345' && <Text style={{ color: C.muted, fontSize: 10 }}>{joursLabel(p.jours)}</Text>}
            </Pressable>
          ))}
        </View>
      )}
      <Row style={{ marginTop: 8, flexWrap: 'nowrap' }}>
        <Input style={{ flex: 1 }} value={manual} onChangeText={setManual} placeholder="Ajouter une heure : 7h12" onSubmitEditing={addManual} />
        <Btn kind="sec" small label="＋" onPress={addManual} />
      </Row>
      <Label>{aller ? 'Marche de chez toi à l’arrêt' : 'Marche du lycée à l’arrêt'}</Label>
      <MiniStepper value={dir.walk} onChange={(v) => upd('walk', v)} />
      {aller && (
        <View>
          <Label>Du bus jusqu'en cours (trajet + marche)</Label>
          <MiniStepper value={dir.ride} onChange={(v) => upd('ride', v)} step={5} />
        </View>
      )}
    </View>
  );
}

export function BusSettings({ cfg, set }) {
  const { C } = useApp();
  const b = busCfg(cfg);
  const save = (quiet) => set('bus', b, quiet);
  return (
    <View style={{ marginTop: 16, borderTopWidth: 1, borderColor: C.line, paddingTop: 14 }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <Txt style={{ flex: 1 }} bold>🚌 Je prends le bus</Txt>
        <Switch value={!!b.on} onValueChange={(v) => { b.on = v; save(); }} trackColor={{ true: C.pri }} />
      </Row>
      {b.on && (
        <View>
          <Txt muted style={{ marginTop: 4, fontSize: 13 }}>Prends en photo les horaires à ton arrêt : l'appli te dit à quelle heure partir de chez toi le matin, et du lycée le soir.</Txt>
          <Label>Être à l'arrêt en avance de</Label>
          <MiniStepper value={b.avance} onChange={(v) => { b.avance = v; save(); }} />
          <Direction dir={b.aller} kind="aller" save={save} />
          <Direction dir={b.retour} kind="retour" save={save} />
        </View>
      )}
    </View>
  );
}
