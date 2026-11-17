// Simulateur de moyenne : générale ou par matière, en cachant des notes ou en en ajoutant.
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useApp, H2, Txt, Btn, Row, Label, Input, Dot, toast } from './ui';
import { uid } from './logic';
import { S, commit } from './store';

const fmt = (v) => (v === null || v === undefined || isNaN(v) ? '—' : (Math.round(v * 100) / 100).toString().replace('.', ','));
const num = (s) => parseFloat(String(s).replace(',', '.'));

// État de la simulation, gardé par période (on le retrouve en revenant)
function simState(period) {
  S.cache.sim = S.cache.sim || {};
  const st = S.cache.sim[period] || (S.cache.sim[period] = {});
  st.hide = st.hide || {}; st.extra = st.extra || []; st.coefs = st.coefs || {}; st.off = st.off || {};
  return st;
}
const valid = (g) => g.kind === 0 && g.value !== null && g.value !== undefined && g.outOf;

// Moyenne d'une matière sur 20 (notes visibles + notes ajoutées)
function subjectAvg(data, st, s) {
  const real = data.grades.filter((g) => g.subject === s.name);
  const changed = real.some((g) => st.hide[g.id]) || st.extra.some((e) => e.subject === s.name);
  if (!changed && s.avg !== null && s.avg !== undefined) return { avg: (s.avg / (s.outOf || 20)) * 20, changed: false };
  const list = [...real.filter((g) => valid(g) && !st.hide[g.id]), ...st.extra.filter((e) => e.subject === s.name)];
  const w = list.reduce((a, g) => a + (g.coef || 1), 0);
  return { avg: w ? list.reduce((a, g) => a + (g.value / g.outOf) * 20 * (g.coef || 1), 0) / w : null, changed: true };
}
function generalAvg(data, st) {
  let w = 0, sum = 0;
  data.subjects.forEach((s) => {
    if (st.off[s.name]) return;
    const a = subjectAvg(data, st, s).avg;
    if (a === null) return;
    const c = st.coefs[s.name] ?? 1;
    w += c; sum += a * c;
  });
  return w ? sum / w : null;
}

function Big({ v, l, col }) {
  const { C } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 18, padding: 12, alignItems: 'center' }}>
      <Text style={{ fontSize: 28, fontWeight: '900', color: col || C.ink, letterSpacing: -0.5 }}>{v}</Text>
      <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>{l}</Text>
    </View>
  );
}
function Delta({ a, b }) {
  const { C } = useApp();
  if (a === null || b === null) return null;
  const d = b - a;
  if (Math.abs(d) < 0.005) return <Txt muted center style={{ marginTop: 6 }}>Aucun changement pour l'instant</Txt>;
  return <Text style={{ textAlign: 'center', marginTop: 6, fontWeight: '900', color: d > 0 ? C.ok : C.bad }}>{d > 0 ? '▲ +' : '▼ '}{fmt(d)} point{Math.abs(d) >= 2 ? 's' : ''}</Text>;
}

export function AvgSim({ data, subject }) {
  const { C, setModal } = useApp();
  const st = simState(data.period);
  const [sel, setSel] = useState(subject || null); // null = moyenne générale
  const [, setT] = useState(0);
  const [val, setVal] = useState(''); const [out, setOut] = useState('20'); const [coef, setCoef] = useState('1');
  const save = () => { commit(); setT((t) => t + 1); };
  const color = (v) => (v === null ? C.muted : v >= 14 ? C.ok : v >= 10 ? C.warn : C.bad);

  const realGeneral = data.overall !== null && data.overall !== undefined ? data.overall : generalAvg(data, { hide: {}, extra: [], coefs: {}, off: {} });
  const simGeneral = generalAvg(data, st);
  const s = sel && data.subjects.find((x) => x.name === sel);

  const addGrade = () => {
    const v = num(val), o = num(out) || 20, c = num(coef) || 1;
    if (isNaN(v) || v < 0 || v > o) return toast(`Écris une note entre 0 et ${fmt(o)}`, 'bad');
    st.extra.push({ id: 'x' + uid(), subject: sel, value: v, outOf: o, coef: c, kind: 0 });
    setVal(''); save();
  };
  const reset = () => { S.cache.sim[data.period] = {}; save(); toast('Simulation remise à zéro'); };

  return (
    <View>
      <H2>🧮 Simulateur de moyenne</H2>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
        {[null, ...data.subjects.map((x) => x.name)].map((n) => {
          const on = sel === n;
          return (
            <Pressable key={n || '_'} onPress={() => setSel(n)} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 99, backgroundColor: on ? C.pri : C.priSoft }}>
              <Text style={{ color: on ? '#fff' : C.priInk, fontWeight: '800', fontSize: 13 }}>{n || 'Générale'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {!s ? (
        <View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Big v={fmt(realGeneral)} l="moyenne Pronote" />
            <Big v={fmt(simGeneral)} l="simulée" col={color(simGeneral)} />
          </View>
          <Delta a={realGeneral} b={simGeneral} />
          <Label>Matières (touche pour cacher · coef à droite)</Label>
          {data.subjects.map((x) => {
            const r = subjectAvg(data, st, x), off = !!st.off[x.name], c = st.coefs[x.name] ?? 1;
            return (
              <View key={x.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderColor: C.line, opacity: off ? 0.4 : 1 }}>
                <Pressable onPress={() => { st.off[x.name] = !off; if (off) delete st.off[x.name]; save(); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Dot color={x.color || C.pri} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: C.ink, fontWeight: '700', textDecorationLine: off ? 'line-through' : 'none' }}>{x.name}</Text>
                    {r.changed && <Text style={{ color: C.priInk, fontSize: 11, fontWeight: '700' }}>modifiée</Text>}
                  </View>
                  <Text style={{ fontWeight: '900', fontSize: 16, color: color(r.avg) }}>{fmt(r.avg)}</Text>
                </Pressable>
                <Pressable onPress={() => { st.coefs[x.name] = c >= 8 ? 0.5 : c === 0.5 ? 1 : c + 1; save(); }} hitSlop={6}
                  style={{ minWidth: 48, paddingVertical: 6, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center' }}>
                  <Text style={{ color: C.muted, fontSize: 10 }}>coef</Text>
                  <Text style={{ color: C.ink, fontWeight: '900' }}>{fmt(c)}</Text>
                </Pressable>
                <Pressable onPress={() => setSel(x.name)} hitSlop={8}><Text style={{ color: C.muted, fontSize: 20 }}>›</Text></Pressable>
              </View>
            );
          })}
          <Txt muted style={{ marginTop: 8, fontSize: 12 }}>Ouvre une matière (›) pour cacher des notes ou en ajouter. Le coef de chaque matière change en le touchant (1 par défaut, comme Pronote le plus souvent).</Txt>
        </View>
      ) : (() => {
        const r = subjectAvg(data, st, s);
        const real = s.avg !== null && s.avg !== undefined ? (s.avg / (s.outOf || 20)) * 20 : null;
        const gs = data.grades.filter((g) => g.subject === s.name);
        const ex = st.extra.filter((e) => e.subject === s.name);
        return (
          <View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Big v={fmt(real)} l={`${s.name} · Pronote`} />
              <Big v={fmt(r.avg)} l="simulée" col={color(r.avg)} />
              <Big v={fmt(simGeneral)} l="générale simulée" col={color(simGeneral)} />
            </View>
            <Delta a={real} b={r.avg} />

            <Label>Ajouter une note</Label>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Input style={{ flex: 2 }} value={val} onChangeText={setVal} keyboardType="decimal-pad" placeholder="note" onSubmitEditing={addGrade} />
              <Text style={{ color: C.muted, fontWeight: '900' }}>/</Text>
              <Input style={{ flex: 1.3 }} value={out} onChangeText={setOut} keyboardType="decimal-pad" placeholder="20" />
              <Input style={{ flex: 1.3 }} value={coef} onChangeText={setCoef} keyboardType="decimal-pad" placeholder="coef" />
              <Btn small label="＋" onPress={addGrade} />
            </View>
            <Txt muted style={{ fontSize: 11, marginTop: 4 }}>note · sur · coef</Txt>

            <Label>Notes (touche pour cacher / remettre)</Label>
            {ex.map((g) => (
              <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: C.line }}>
                <View style={{ flex: 1 }}><Text style={{ color: C.priInk, fontWeight: '800' }}>✨ Note simulée</Text><Txt muted>coef {fmt(g.coef)}</Txt></View>
                <Text style={{ fontWeight: '900', color: color((g.value / g.outOf) * 20) }}>{fmt(g.value)}/{fmt(g.outOf)}</Text>
                <Pressable hitSlop={10} onPress={() => { st.extra = st.extra.filter((e) => e.id !== g.id); save(); }}><Text style={{ color: C.bad, fontSize: 18, fontWeight: '900' }}>✕</Text></Pressable>
              </View>
            ))}
            {gs.map((g) => {
              const h = !!st.hide[g.id], ok = valid(g);
              return (
                <Pressable key={g.id} disabled={!ok} onPress={() => { if (h) delete st.hide[g.id]; else st.hide[g.id] = 1; save(); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: C.line, opacity: h ? 0.4 : 1 }}>
                  <Text style={{ fontSize: 16 }}>{!ok ? '·' : h ? '🙈' : '👁️'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: C.ink, fontWeight: '700', textDecorationLine: h ? 'line-through' : 'none' }}>{g.comment || 'Évaluation'}</Text>
                    <Txt muted>coef {fmt(g.coef || 1)}</Txt>
                  </View>
                  <Text style={{ fontWeight: '900', color: ok ? color((g.value / g.outOf) * 20) : C.muted, textDecorationLine: h ? 'line-through' : 'none' }}>{ok ? `${fmt(g.value)}/${fmt(g.outOf)}` : 'Abs.'}</Text>
                </Pressable>
              );
            })}
          </View>
        );
      })()}

      <Txt muted style={{ marginTop: 12, fontSize: 12 }}>Estimation : Pronote peut calculer autrement (sous-matières, notes bonus, coefs du prof).</Txt>
      <Row style={{ marginTop: 12 }}>
        <Btn kind="sec" label="↺ Tout remettre" onPress={reset} />
        <Btn kind="ghost" label="Fermer" onPress={() => setModal(null)} />
      </Row>
    </View>
  );
}
export const openAvgSim = (data, setModal, subject) => setModal(<AvgSim data={data} subject={subject} />);
