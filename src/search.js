// Recherche dans tous les chapitres : titres, cours, vocabulaire, questions.
import React, { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp, Card, Txt, Input, Dot, Rich, FadeIn } from './ui';
import { norm, stripTags } from './logic';
import { S, matOf } from './store';

function find(q) {
  const n = norm(q);
  if (n.length < 2) return [];
  const out = [];
  Object.values(S.chs).forEach((ch) => {
    const p = ch.pack || {};
    const add = (kind, text, tab, extra) => { if (out.length < 60) out.push({ ch, kind, text: stripTags(text), tab, extra }); };
    if (norm(ch.titre).includes(n)) add('📘 Chapitre', ch.titre, 'cours');
    (p.vocab || []).forEach((v) => { if (norm(v.terme).includes(n) || norm(v.def).includes(n)) add('📖 Vocabulaire', v.terme, 'fiches', stripTags(v.def)); });
    (p.resume || []).forEach((r) => { if (norm(r.titre).includes(n) || norm(r.texte).includes(n)) add('📝 Cours', r.titre, 'cours', snippet(r.texte, n)); });
    (p.formules || []).forEach((f) => { if (norm(f.nom).includes(n) || norm(f.formule).includes(n)) add('🧮 Formule', f.nom, 'cours', stripTags(f.formule)); });
    (p.qcm || []).forEach((x) => { if (norm(x.q).includes(n)) add('❓ Question', x.q, 'quiz', '→ ' + stripTags(x.choix[x.bonne])); });
  });
  return out;
}
// Extrait d'environ 90 caractères autour du mot trouvé
function snippet(text, n) {
  const t = stripTags(text).replace(/\s+/g, ' ');
  const i = norm(t).indexOf(n);
  if (i < 0) return t.slice(0, 90) + (t.length > 90 ? '…' : '');
  const a = Math.max(0, i - 35);
  return (a ? '…' : '') + t.slice(a, a + 90) + (a + 90 < t.length ? '…' : '');
}

export function Search() {
  const { C, go } = useApp();
  const [q, setQ] = useState('');
  const res = useMemo(() => find(q), [q]);
  return (
    <View>
      <Input value={q} onChangeText={setQ} placeholder="Un mot, une notion, une date…" autoFocus returnKeyType="search" />
      {q.trim().length >= 2 && <Txt muted style={{ marginTop: 10, marginBottom: 6 }}>{res.length ? `${res.length}${res.length >= 60 ? '+' : ''} résultat${res.length > 1 ? 's' : ''}` : 'Aucun résultat'}</Txt>}
      {res.map((r, i) => {
        const m = matOf(r.ch);
        return (
          <FadeIn key={i} delay={Math.min(i, 8) * 25}>
            <Pressable onPress={() => go({ name: 'ch', id: r.ch.id, tab: r.tab, back: 'search' })} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <Card style={{ paddingVertical: 12, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: C.muted, fontSize: 12, fontWeight: '800' }}>{r.kind}</Text>
                  <Text style={{ color: C.muted, fontSize: 12 }}>·</Text>
                  <Dot color={m.couleur} size={8} />
                  <Text style={{ color: C.muted, fontSize: 12, flex: 1 }} numberOfLines={1}>{r.ch.titre}</Text>
                </View>
                <Text style={{ color: C.ink, fontWeight: '800', fontSize: 16, marginTop: 4 }}>{r.text}</Text>
                {r.extra ? <Text style={{ color: C.muted, marginTop: 2 }} numberOfLines={3}>{r.extra}</Text> : null}
              </Card>
            </Pressable>
          </FadeIn>
        );
      })}
      {q.trim().length < 2 && <Txt muted center style={{ marginTop: 30 }}>🔎 Cherche dans tous tes chapitres : cours, vocabulaire, formules et questions.</Txt>}
    </View>
  );
}
