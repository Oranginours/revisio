// Écran « Mes progrès » : niveau, activité des 14 derniers jours, réussite par matière, badges.
import React from 'react';
import { View, Text } from 'react-native';
import { useApp, Card, H2, Txt, Progress, FadeIn, Dot } from './ui';
import { addDays, today, dayLetter } from './logic';
import { S } from './store';
import { levelInfo, levelTitle, getStats, BADGES } from './progress';

export function Progres() {
  const { C } = useApp();
  const L = levelInfo();
  const st = getStats();
  const days = [...Array(14)].map((_, i) => addDays(today(), i - 13));
  const max = Math.max(5, ...days.map((d) => (st.days[d] ? st.days[d].a : 0)));
  const rate = st.a ? Math.round((st.c / st.a) * 100) : 0;
  const got = S.profil.badges || {};
  const nGot = BADGES.filter((b) => got[b[0]]).length;
  const mats = S.profil.matieres.map((m) => ({ m, s: st.mats[m.id] })).filter((o) => o.s && o.s.a >= 3)
    .map((o) => ({ ...o, r: Math.round((o.s.c / o.s.a) * 100) })).sort((a, b) => a.r - b.r);
  const Stat = ({ v, l }) => (
    <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 16, padding: 12, alignItems: 'center' }}>
      <Text style={{ color: C.ink, fontSize: 22, fontWeight: '900' }}>{v}</Text>
      <Text style={{ color: C.muted, fontSize: 12, marginTop: 2, textAlign: 'center' }}>{l}</Text>
    </View>
  );
  return (
    <View>
      <FadeIn>
        <View style={{ backgroundColor: C.pri, borderRadius: 24, padding: 20, marginBottom: 14 }}>
          <Text style={{ color: '#fff', opacity: 0.85, fontWeight: '800', fontSize: 13 }}>NIVEAU</Text>
          <Text style={{ color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: -1 }}>{L.lvl} <Text style={{ fontSize: 18 }}>· {levelTitle(L.lvl)}</Text></Text>
          <View style={{ height: 12, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
            <View style={{ height: '100%', width: `${L.pct}%`, backgroundColor: '#fff', borderRadius: 99 }} />
          </View>
          <Text style={{ color: '#fff', opacity: 0.85, marginTop: 6, fontSize: 13 }}>{L.into} / {L.need} XP avant le niveau {L.lvl + 1} · {L.xp} XP au total</Text>
        </View>
      </FadeIn>

      <Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Stat v={st.c} l="bonnes réponses" />
          <Stat v={rate + ' %'} l="de réussite" />
          <Stat v={'🔥 ' + (S.profil.streak || 0)} l="jours de suite" />
        </View>
      </Card>

      <Card>
        <H2>📅 14 derniers jours</H2>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 5 }}>
          {days.map((d) => {
            const x = st.days[d] || { a: 0, c: 0 };
            const h = (x.a / max) * 100, hc = (x.c / max) * 100;
            return (
              <View key={d} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <View style={{ width: '100%', height: `${Math.max(h, 3)}%`, backgroundColor: x.a ? C.soft : C.line, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' }}>
                  <View style={{ height: x.a ? `${(hc / h) * 100}%` : 0, backgroundColor: C.pri }} />
                </View>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 5, marginTop: 6 }}>
          {days.map((d) => <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: d === today() ? C.ink : C.muted, fontWeight: d === today() ? '900' : '500' }}>{dayLetter(d)}</Text>)}
        </View>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Dot color={C.pri} /><Txt muted>bonnes réponses</Txt></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Dot color={C.soft} /><Txt muted>erreurs</Txt></View>
        </View>
      </Card>

      {mats.length > 0 && (
        <Card>
          <H2>🎯 Réussite par matière</H2>
          {mats.map(({ m, s, r }) => (
            <View key={m.id} style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Dot color={m.couleur} /><Txt style={{ flex: 1 }} bold>{m.nom}</Txt>
                <Text style={{ fontWeight: '900', color: r >= 75 ? C.ok : r >= 50 ? C.warn : C.bad }}>{r} %</Text>
              </View>
              <Progress value={r} color={m.couleur} height={8} />
            </View>
          ))}
          <Txt muted style={{ fontSize: 12 }}>La matière la plus faible est en haut : c'est là que tu gagneras le plus de points.</Txt>
        </Card>
      )}

      <Card>
        <H2>🏅 Badges · {nGot}/{BADGES.length}</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
          {BADGES.map(([id, icon, name, desc]) => {
            const on = !!got[id];
            return (
              <View key={id} style={{ width: '31%', backgroundColor: on ? C.priSoft : C.bg, borderRadius: 16, padding: 10, alignItems: 'center', opacity: on ? 1 : 0.55 }}>
                <Text style={{ fontSize: 28 }}>{on ? icon : '🔒'}</Text>
                <Text style={{ color: C.ink, fontWeight: '800', fontSize: 12, textAlign: 'center', marginTop: 4 }}>{name}</Text>
                <Text style={{ color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 2 }}>{desc}</Text>
              </View>
            );
          })}
        </View>
      </Card>
    </View>
  );
}
