// ⚔️ Défis entre potes : 10 questions d'un chapitre, on joue, on envoie son score, le pote essaie de faire mieux.
import React, { useState } from 'react';
import { View, Text, Pressable, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useApp, Card, H2, Txt, Btn, Row, Opt, Fb, Rich, Progress, FadeIn, Pop, toast, ask, isWeb } from './ui';
import { uid, shuffle, stripTags } from './logic';
import { S, commit } from './store';
import { addXp } from './progress';

const PREFIX = 'REVISIO-DEFI:';
const store = () => (S.profil.defis = S.profil.defis || {});
const myName = () => {
  const n = S.profil.prenom || (S.pronote && S.pronote.name ? String(S.pronote.name).split(' ').pop() : '');
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : 'Un pote';
};
const matName = (ch) => ((S.profil.matieres || []).find((m) => m.id === ch.matiereId) || {}).nom || '';

export const canDefi = (ch) => ch && ch.pack && ((ch.pack.qcm || []).length + (ch.pack.vf || []).length) >= 4;

// Fabrique 10 questions (QCM + vrai/faux) d'un chapitre
export function createDefi(ch) {
  const p = ch.pack;
  const qs = [
    ...(p.qcm || []).map((x) => {
      const opts = shuffle(x.choix.map((c, i) => ({ c: stripTags(c), ok: i === x.bonne })));
      return { q: stripTags(x.q), c: opts.map((o) => o.c), a: opts.findIndex((o) => o.ok), e: stripTags(x.expl || '') };
    }),
    ...(p.vf || []).map((x) => ({ q: 'Vrai ou faux ? ' + stripTags(x.a), c: ['Vrai', 'Faux'], a: x.vrai ? 0 : 1, e: stripTags(x.expl || '') })),
  ].filter((x) => x.a >= 0);
  const d = { id: 'd' + uid(), titre: ch.titre, mat: matName(ch), q: shuffle(qs).slice(0, 10), from: null, mine: null, at: Date.now() };
  store()[d.id] = d; commit();
  return d;
}

export async function shareDefi(d) {
  const payload = JSON.stringify({ id: d.id, titre: d.titre, mat: d.mat, q: d.q, from: { name: myName(), score: d.mine } });
  const n = d.q.length;
  const msg = `⚔️ ${myName()} te défie sur « ${d.titre} »${d.mat ? ` (${d.mat})` : ''} : ${d.mine}/${n}. Fais mieux !\n👉 Copie ce message, puis ouvre Révisio : le défi se lance tout seul.\n${PREFIX}${payload}`;
  try {
    if (isWeb) { await Clipboard.setStringAsync(msg); toast('Défi copié 📋 Colle-le à ton pote'); }
    else await Share.share({ message: msg });
  } catch (e) { toast("Impossible de partager : " + e.message, 'bad'); }
}

// Lit un défi dans un texte copié. Renvoie le défi enregistré, ou null.
export function importDefi(txt) {
  const i = String(txt || '').indexOf(PREFIX);
  if (i < 0) return null;
  const o = JSON.parse(txt.slice(i + PREFIX.length).trim());
  if (!o || !Array.isArray(o.q) || !o.q.length) throw new Error('défi incomplet');
  const all = store();
  const key = o.id + ':' + (o.from && o.from.name) + ':' + (o.from && o.from.score);
  const existing = Object.values(all).find((d) => d.key === key);
  if (existing) return existing;
  const d = { id: 'd' + uid(), key, titre: String(o.titre || 'Défi'), mat: String(o.mat || ''), q: o.q.slice(0, 15), from: o.from || null, mine: null, at: Date.now() };
  all[d.id] = d; commit();
  return d;
}
export const isDefiText = (t) => String(t || '').indexOf(PREFIX) >= 0;

// Choisir un chapitre pour lancer un défi
export function DefiPicker() {
  const { C, setModal, go } = useApp();
  const chs = Object.values(S.chs).filter(canDefi).sort((a, b) => (b.created || 0) - (a.created || 0));
  return (
    <View>
      <H2>⚔️ Défier un pote</H2>
      <Txt muted>Tu réponds à 10 questions, puis tu envoies ton score. Ton pote joue les mêmes questions et essaie de faire mieux.</Txt>
      {!chs.length && <Txt style={{ marginTop: 12 }}>Il te faut un chapitre avec au moins 4 questions.</Txt>}
      <View style={{ marginTop: 10 }}>
        {chs.map((ch) => (
          <Pressable key={ch.id} onPress={() => { const d = createDefi(ch); setModal(null); go({ name: 'defi', id: d.id, back: 'train' }); }}
            style={({ pressed }) => ({ paddingVertical: 12, borderTopWidth: 1, borderColor: C.line, opacity: pressed ? 0.6 : 1 })}>
            <Txt bold>{ch.titre}</Txt>
            <Txt muted>{matName(ch)}</Txt>
          </Pressable>
        ))}
      </View>
      <Btn kind="ghost" label="Fermer" style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => setModal(null)} />
    </View>
  );
}

// Jouer un défi
export function DefiPlay({ id }) {
  const { C, go } = useApp();
  const d = store()[id];
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null);
  const [score, setScore] = useState(0);
  const [end, setEnd] = useState(d && d.mine !== null);
  if (!d) return <Card><Txt muted>Ce défi n'existe plus.</Txt></Card>;
  const n = d.q.length;

  if (end) {
    const me = d.mine, them = d.from && d.from.score;
    const vs = d.from && them !== undefined && them !== null;
    const res = !vs ? null : me > them ? 'win' : me === them ? 'tie' : 'lose';
    return (
      <FadeIn>
        <Card style={{ alignItems: 'center' }}>
          <Pop trigger={me}><Text style={{ fontSize: 64 }}>{res === 'win' ? '🏆' : res === 'tie' ? '🤝' : res === 'lose' ? '😤' : me >= n * 0.8 ? '🔥' : '💪'}</Text></Pop>
          <Text style={{ color: C.ink, fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 6 }}>
            {res === 'win' ? `Tu bats ${d.from.name} !` : res === 'tie' ? `Égalité avec ${d.from.name}` : res === 'lose' ? `${d.from.name} gagne… cette fois` : 'Défi prêt à envoyer'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' }}>
            <View style={{ flex: 1, backgroundColor: C.priSoft, borderRadius: 18, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: C.priInk, fontWeight: '800' }}>Toi</Text>
              <Text style={{ color: C.ink, fontSize: 32, fontWeight: '900' }}>{me}/{n}</Text>
            </View>
            {vs && (
              <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 18, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: C.muted, fontWeight: '800' }}>{d.from.name}</Text>
                <Text style={{ color: C.ink, fontSize: 32, fontWeight: '900' }}>{them}/{n}</Text>
              </View>
            )}
          </View>
          <Txt muted center style={{ marginTop: 12 }}>« {d.titre} »{d.mat ? ` · ${d.mat}` : ''}</Txt>
        </Card>
        <Btn label={vs ? '📤 Renvoyer mon score' : '📤 Envoyer le défi à un pote'} onPress={() => shareDefi(d)} />
        <Btn kind="ghost" label="Retour" style={{ marginTop: 10 }} onPress={() => go({ name: 'train' })} />
      </FadeIn>
    );
  }

  const q = d.q[i];
  const answer = (k) => {
    if (pick !== null) return;
    setPick(k);
    if (k === q.a) setScore((s) => s + 1);
  };
  const next = () => {
    if (i + 1 >= n) {
      const final = score;
      d.mine = final; d.playedAt = Date.now(); addXp(final * 4); commit();
      setEnd(true);
      return;
    }
    setI(i + 1); setPick(null);
  };
  return (
    <View>
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Txt muted bold>⚔️ {d.from ? `Défi de ${d.from.name}` : 'Ton défi'} · {i + 1}/{n}</Txt>
        <Txt bold style={{ color: C.pri }}>{score} ✓</Txt>
      </Row>
      <Progress value={(i + (pick !== null ? 1 : 0)) / n} />
      <FadeIn key={i}>
        <Card style={{ marginTop: 12 }}>
          <Rich style={{ fontSize: 18, fontWeight: '800' }}>{q.q}</Rich>
          <View style={{ marginTop: 10 }}>
            {q.c.map((c, k) => (
              <Opt key={k} letter={'ABCDEF'[k]} label={c} onPress={() => answer(k)}
                state={pick === null ? null : k === q.a ? 'good' : k === pick ? 'wrong' : null} />
            ))}
          </View>
          {pick !== null && (
            <Fb ok={pick === q.a}>
              <Txt bold>{pick === q.a ? 'Bien joué !' : `C'était : ${q.c[q.a]}`}</Txt>
              {q.e ? <Txt muted>{q.e}</Txt> : null}
            </Fb>
          )}
        </Card>
      </FadeIn>
      {pick !== null && <Btn label={i + 1 >= n ? 'Voir le résultat' : 'Suivante →'} onPress={next} />}
    </View>
  );
}

// Liste des défis (dans S'entraîner)
export function DefiList() {
  const { C, go } = useApp();
  const list = Object.values(store()).sort((a, b) => (b.playedAt || b.at) - (a.playedAt || a.at)).slice(0, 8);
  if (!list.length) return null;
  return (
    <Card style={{ marginTop: 14 }}>
      <H2>⚔️ Mes défis</H2>
      {list.map((d) => {
        const vs = d.from && d.from.score !== undefined && d.from.score !== null;
        const todo = d.mine === null;
        const res = todo || !vs ? null : d.mine > d.from.score ? '🏆' : d.mine === d.from.score ? '🤝' : '😤';
        return (
          <Pressable key={d.id} onPress={() => go({ name: 'defi', id: d.id, back: 'train' })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderColor: C.line }}>
            <View style={{ flex: 1 }}>
              <Txt bold>{d.titre}</Txt>
              <Txt muted>{d.from ? `contre ${d.from.name}` : 'lancé par toi'}{todo ? ' · à jouer !' : ` · ${d.mine}/${d.q.length}${vs ? ` vs ${d.from.score}` : ''}`}</Txt>
            </View>
            <Text style={{ fontSize: 22 }}>{todo ? '▶️' : res || '📤'}</Text>
          </Pressable>
        );
      })}
    </Card>
  );
}
