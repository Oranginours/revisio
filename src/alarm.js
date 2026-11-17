// Réveil calé sur l'emploi du temps Pronote : premier cours − trajet − préparation.
// Ex. cours à 9h00, trajet 40 min → départ 8h20, préparation 30 min → réveil 7h50.
import React, { useState } from 'react';
import { View, Text, Pressable, Platform, Switch } from 'react-native';
import { useApp, Card, Txt, Btn, Row, Label, toast } from './ui';
import { dstr, today, addDays, fmtDate } from './logic';
import { S, commit } from './store';
import { busCfg, pickBus, returnPlan, BusSettings } from './bus';

// Module natif « Reveil » (présent seulement dans un APK fabriqué après son ajout)
let Native = null;
try {
  const f = require('expo').requireOptionalNativeModule;
  if (Platform.OS === 'android' && f) Native = f('Reveil');
} catch (e) { Native = null; }
export const canSetPhoneAlarm = () => !!Native;

export const wakeCfg = () => {
  // on complète l'objet existant au lieu d'en recréer un (sinon les interrupteurs modifiaient une copie perdue)
  const r = S.settings.reveil || (S.settings.reveil = {});
  const d = { on: false, trajet: 40, prep: 30, notif: true, depart: true };
  Object.keys(d).forEach((k) => { if (r[k] === undefined) r[k] = d[k]; });
  r.on = false; // le réveil a été retiré, seul le bus reste
  return r;
};
const hm = (d) => String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');

// Premier cours (non annulé) d'un jour, d'après l'emploi du temps enregistré
export function firstLessonOn(day) {
  let best = null;
  Object.values(S.cache.edt || {}).forEach((w) => (w.lessons || []).forEach((l) => {
    if (l.canceled || dstr(new Date(l.start)) !== day) return;
    if (!best || l.start < best.start) best = l;
  }));
  return best;
}
export function wakePlan(day) {
  const c = wakeCfg();
  const l = firstLessonOn(day);
  if (!l) return null;
  const start = new Date(l.start);
  const b = busCfg(c);
  const bus = b.on && b.aller.passages.length ? pickBus(b, start) : null;
  const depart = bus && bus.departHome ? bus.departHome : new Date(start.getTime() - c.trajet * 60000);
  const wake = new Date(depart.getTime() - c.prep * 60000);
  return { day, lesson: l, start, depart, wake, bus: bus && bus.bus ? bus : null, busMiss: !!(bus && bus.tooEarly), label: { start: hm(start), depart: hm(depart), wake: hm(wake) } };
}
// Le prochain réveil à venir (dans les 7 jours)
export function nextWake(by = 'wake') {
  const now = new Date();
  for (let d = 0; d < 8; d++) {
    const p = wakePlan(addDays(today(), d));
    if (p && p[by] > now) return p;
  }
  return null;
}
const keyOf = (p) => p.day + ' ' + p.label.wake;

// Crée le réveil dans l'appli Horloge du téléphone
export function setPhoneAlarm(p) {
  if (!Native) {
    toast(Platform.OS === 'android' ? "Pour régler l'Horloge, il faut refaire l'APK une fois (demande à Claude « lance le build »)." : "Sur iPhone, une appli ne peut pas régler le réveil de l'Horloge.", 'info');
    return false;
  }
  try {
    Native.setAlarm(p.wake.getHours(), p.wake.getMinutes(), `Révisio · cours à ${p.label.start}`, true);
    wakeCfg().setFor = keyOf(p); commit();
    toast(`⏰ Réveil réglé à ${p.label.wake} dans l'Horloge`);
    return true;
  } catch (e) { toast("L'Horloge n'a pas pu régler le réveil : " + e.message, 'bad'); return false; }
}
export function showPhoneAlarms() { try { if (Native) Native.showAlarms(); } catch (e) {} }

// Carte de l'accueil : le prochain réveil
export function WakeCard() {
  const c = wakeCfg();
  const r = S.pronote ? returnPlan(c, today()) : null;
  const ret = r && r.leave > new Date() ? r : null;
  return <View>{ret && <ReturnCard r={ret} />}<MorningCard /></View>;
}
function ReturnCard({ r }) {
  const { C } = useApp();
  return (
    <Card>
      <Text style={{ color: C.muted, fontWeight: '800', fontSize: 12 }}>🏠 RETOUR CE SOIR</Text>
      <Text style={{ color: C.ink, fontSize: 40, fontWeight: '900', letterSpacing: -1 }}>{r.label.leave}</Text>
      <Text style={{ color: C.muted, fontSize: 13 }}>Fin des cours {r.label.end} · sors à {r.label.leave} pour le bus de {r.label.bus}</Text>
    </Card>
  );
}
function MorningCard() {
  const { C, go } = useApp();
  const c = wakeCfg();
  if ((!c.on && !(c.bus && c.bus.on)) || !S.pronote) return null;
  const wakeMode = !!c.on;
  const p = nextWake(wakeMode ? 'wake' : 'depart');
  if (!p || (!wakeMode && !p.bus)) return null;
  const isTomorrow = p.day === addDays(today(), 1), isToday = p.day === today();
  const done = c.setFor === keyOf(p);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.muted, fontWeight: '800', fontSize: 12 }}>{wakeMode ? '⏰ RÉVEIL' : '🚪 DÉPART'} {isToday ? "AUJOURD'HUI" : isTomorrow ? 'DEMAIN' : fmtDate(p.day).toUpperCase()}</Text>
          <Text style={{ color: C.ink, fontSize: 40, fontWeight: '900', letterSpacing: -1 }}>{wakeMode ? p.label.wake : p.label.depart}</Text>
          <Text style={{ color: C.muted, fontSize: 13 }}>{wakeMode ? `🚪 départ ${p.label.depart} · ` : ''}🏫 {p.lesson.subject} à {p.label.start}</Text>
          {p.bus && <Text style={{ color: C.priInk, fontSize: 13, fontWeight: '800', marginTop: 2 }}>🚌 Bus de {p.bus.label.bus}{c.bus.aller.ligne ? ` (ligne ${c.bus.aller.ligne})` : ''}{p.bus.label.prev ? ` · plus tôt : ${p.bus.label.prev}` : ''}</Text>}
        </View>
        <Pressable onPress={() => go({ name: 'settings', back: 'home' })} hitSlop={10}><Text style={{ fontSize: 20 }}>⚙️</Text></Pressable>
      </View>
      {wakeMode && Platform.OS === 'android' && (
        done
          ? <Row style={{ marginTop: 10 }}><Txt muted style={{ flex: 1 }}>✅ Réglé dans l'Horloge</Txt><Btn small kind="ghost" label="Voir" onPress={showPhoneAlarms} /></Row>
          : <Btn label={`Mettre ${p.label.wake} dans l'Horloge`} style={{ marginTop: 12 }} onPress={() => setPhoneAlarm(p)} />
      )}
      {wakeMode && c.notif && <Txt muted style={{ marginTop: 8, fontSize: 12 }}>Une notification sonnera aussi à {p.label.wake}{c.depart ? `, puis à ${p.label.depart} pour partir` : ''}.</Txt>}
    </Card>
  );
}

// Réglages du réveil
function Stepper({ value, onChange, step = 5, min = 0, max = 180 }) {
  const { C } = useApp();
  const B = ({ d, l }) => (
    <Pressable onPress={() => onChange(Math.max(min, Math.min(max, value + d)))} hitSlop={6}
      style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.priSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.priInk, fontSize: 22, fontWeight: '900' }}>{l}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <B d={-step} l="−" />
      <Text style={{ color: C.ink, fontSize: 22, fontWeight: '900', minWidth: 90, textAlign: 'center' }}>{value} min</Text>
      <B d={step} l="+" />
    </View>
  );
}
export function WakeSettings({ onChange }) {
  const { C } = useApp();
  const c = wakeCfg();
  const [, setT] = useState(0);
  const set = (k, v, quiet) => { c[k] = v; c.setFor = ''; commit(); setT((t) => t + 1); if (onChange && !quiet) onChange(k, v); };
  const b = c.bus || {};
  const p = b.on ? nextWake('depart') : null;
  const r = b.on && p ? returnPlan(c, p.day) : null;
  return (
    <Card>
      {!S.pronote && <Txt muted style={{ marginBottom: 6 }}>Connecte Pronote pour que l'appli connaisse tes horaires de cours.</Txt>}
      <BusSettings cfg={c} set={set} />
      {b.on && (
        <View>
          {p && p.bus ? (
            <View style={{ backgroundColor: C.priSoft, borderRadius: 16, padding: 14, marginTop: 14 }}>
              <Text style={{ color: C.priInk, fontWeight: '800' }}>{p.day === today() ? "Aujourd'hui" : p.day === addDays(today(), 1) ? 'Demain' : fmtDate(p.day)} : cours à {p.label.start} → pars de chez toi à {p.label.depart} (bus de {p.bus.label.bus})</Text>
              {r && <Text style={{ color: C.priInk, marginTop: 4 }}>🏠 Retour : fin des cours {r.label.end} → sors à {r.label.leave} pour le bus de {r.label.bus}</Text>}
            </View>
          ) : p && p.busMiss ? <Txt muted style={{ marginTop: 10 }}>⚠️ Aucun bus enregistré ne t'amène assez tôt pour ton prochain cours.</Txt> : null}
          <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', marginTop: 14 }}>
            <Txt style={{ flex: 1 }}>🔔 Notification « c'est l'heure de partir »</Txt>
            <Switch value={!!c.depart} onValueChange={(v) => set('depart', v)} trackColor={{ true: C.pri }} />
          </Row>
        </View>
      )}
    </Card>
  );
}
