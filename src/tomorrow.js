// 🎒 Carte « Demain » : le prochain jour de cours en un coup d'œil (le sac à préparer, les DS, les devoirs).
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp, Card, Dot } from './ui';
import { dstr, today, addDays, diffDays, fmtDate } from './logic';
import { S } from './store';
import { matiereFor } from './school';
import { allHomework } from './devoirs';

const hh = (iso) => { const d = new Date(iso); return d.getHours() + 'h' + String(d.getMinutes()).padStart(2, '0'); };
const pretty = (s) => { const x = String(s).toLowerCase(); return x.charAt(0).toUpperCase() + x.slice(1); };

function lessonsOn(day) {
  const out = [];
  Object.values(S.cache.edt || {}).forEach((w) => (w.lessons || []).forEach((l) => { if (!l.canceled && dstr(new Date(l.start)) === day) out.push(l); }));
  const seen = new Set();
  return out.filter((l) => { const k = l.id + l.start; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => (a.start < b.start ? -1 : 1));
}

export function TomorrowCard() {
  const { C, go } = useApp();
  if (!S.pronote) return null;
  const now = new Date();
  const t = today();
  const todayLeft = lessonsOn(t).filter((l) => l.end > now.toISOString());
  if (todayLeft.length && now.getHours() < 15) return null; // la journée n'est pas finie
  let day = null, list = [];
  for (let k = 1; k <= 7; k++) { const d = addDays(t, k); const l = lessonsOn(d); if (l.length) { day = d; list = l; break; } }
  if (!day) return null;
  const n = diffDays(t, day);
  const subjects = [];
  list.forEach((l) => { if (!subjects.some((s) => s.name === l.subject)) subjects.push({ name: l.subject, mid: matiereFor(l.subject), color: l.color }); });
  const color = (s) => { const m = S.profil.matieres.find((x) => x.id === s.mid); return (m && m.couleur) || s.color || C.pri; };
  const tests = list.filter((l) => l.test);
  const hw = allHomework().filter((h) => !h.done && h.due === day);
  return (
    <Pressable onPress={() => go({ name: 'edt' })}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: C.muted, fontWeight: '800', fontSize: 12 }}>🎒 {n === 1 ? 'DEMAIN' : fmtDate(day).toUpperCase()}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{list.length} cours</Text>
        </View>
        <Text style={{ color: C.ink, fontSize: 24, fontWeight: '900', marginTop: 2 }}>{hh(list[0].start)} → {hh(list[list.length - 1].end)}</Text>
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 8, fontWeight: '700' }}>DANS TON SAC</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {subjects.map((s) => (
            <View key={s.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Dot color={color(s)} size={8} />
              <Text style={{ color: C.ink, fontSize: 13, fontWeight: '700' }}>{pretty(s.name)}</Text>
            </View>
          ))}
        </View>
        {tests.map((l) => (
          <Text key={l.id + l.start} style={{ color: C.bad, fontWeight: '800', marginTop: 8 }}>🚨 DS de {pretty(l.subject)} à {hh(l.start)}</Text>
        ))}
        {hw.length > 0 && (
          <Pressable onPress={() => go({ name: 'devoirs' })} style={{ marginTop: 8, backgroundColor: C.warnSoft, borderRadius: 12, padding: 10 }}>
            <Text style={{ color: C.ink, fontWeight: '800' }}>📝 {hw.length} devoir{hw.length > 1 ? 's' : ''} à finir : {[...new Set(hw.map((h) => pretty(h.subject)))].join(', ')} ›</Text>
          </Pressable>
        )}
      </Card>
    </Pressable>
  );
}
