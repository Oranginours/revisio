// Les outils d'un chapitre : fiches, quiz, vrai/faux, ordre, exercices, rédaction, bilan.
import React, { useMemo, useState, useRef } from 'react';
import { View, Text, Pressable, Animated, Alert, PanResponder } from 'react-native';
import { useApp, Card, H2, Txt, Rich, Btn, Row, Opt, Fb, Note, Progress, Input, Err, FadeIn } from './ui';
import { shuffle, items, mastery, grade, num, promptCorrect, promptExplain, pickPhrase } from './logic';
import { S, commit, matOf } from './store';
import { gemini } from './ai';
import { ChapterGrades } from './school';

/* ---------- une question (fiche, QCM ou vrai/faux) ---------- */
// it = { t: 'v'|'q'|'f', x, id?, ch? }. onSkip : marque la question « pas à apprendre ».
const TYPE = { v: '🃏 Fiche', q: '❓ QCM', f: '⚖️ Vrai ou faux' };
export function Item({ it, onGrade, onNext, onSkip }) {
  const { C } = useApp();
  const [flip, setFlip] = useState(false);
  const [ans, setAns] = useState(null);
  const [expl, setExpl] = useState(null);
  const [menu, setMenu] = useState(false);
  const rot = useRef(new Animated.Value(0)).current;
  // Glisser une fiche : à droite = je savais, à gauche = à revoir
  const dragX = useRef(new Animated.Value(0)).current;
  const gradeRef = useRef(null);
  gradeRef.current = (ok) => { onGrade(ok); onNext(); };
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => dragX.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 110 || Math.abs(g.vx) > 0.8) {
        const ok = g.dx > 0;
        Animated.timing(dragX, { toValue: ok ? 500 : -500, duration: 180, useNativeDriver: false }).start(() => gradeRef.current(ok));
      } else Animated.spring(dragX, { toValue: 0, useNativeDriver: false, speed: 18, bounciness: 8 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(dragX, { toValue: 0, useNativeDriver: false }).start(),
  })).current;
  const order = useMemo(() => (it.t === 'q' ? shuffle(it.x.choix.map((_, i) => i)) : []), [it]);
  const x = it.x;
  // une formulation différente à chaque fois, pour la même réponse
  const phrase = useMemo(() => (it.t === 'q' ? pickPhrase(x.q, x.variantes) : it.t === 'f' ? pickPhrase(x.a, x.variantes) : ''), [it]);
  const explain = async () => {
    const ch = it.ch;
    setExpl({ loading: true });
    try {
      const t = await gemini({ apiKey: S.settings.apiKey, model: S.settings.model, json: false,
        prompt: promptExplain(it, ch ? matOf(ch).nom : '', ch ? ch.titre : '') });
      setExpl({ text: t.replace(/[*#]/g, '') });
    } catch (e) { setExpl({ err: e.message }); }
  };
  // En-tête : type de question + menu « ⋯ » discret
  const head = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ flex: 1, color: C.muted, fontWeight: '700', fontSize: 13 }}>{TYPE[it.t]}</Text>
        {onSkip ? <Pressable onPress={() => setMenu(!menu)} hitSlop={12} style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: menu ? C.priSoft : 'transparent' }}>
          <Text style={{ color: C.muted, fontSize: 20, fontWeight: '800', lineHeight: 22 }}>⋯</Text>
        </Pressable> : null}
      </View>
      {menu && (
        <FadeIn from={-6}>
          <Pressable onPress={() => { setMenu(false); onSkip(); }} style={{ backgroundColor: C.priSoft, borderRadius: 14, padding: 12, marginBottom: 8 }}>
            <Text style={{ color: C.priInk, fontWeight: '700' }}>🚫 Le prof a dit de ne pas l'apprendre</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Elle ne te sera plus posée (tu peux la rétablir dans Bilan).</Text>
          </Pressable>
        </FadeIn>
      )}
    </View>
  );

  if (it.t === 'v') {
    const turn = () => { Animated.spring(rot, { toValue: flip ? 0 : 1, useNativeDriver: true, speed: 12, bounciness: 6 }).start(); setFlip(!flip); };
    const answer = (ok) => { onGrade(ok); onNext(); };
    const face = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: 20, backfaceVisibility: 'hidden' };
    const front = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
    const back = rot.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
    return (
      <View>
        {head}
        <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: dragX }, { rotate: dragX.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-12deg', '0deg', '12deg'] }) }] }}>
        <Pressable onPress={turn} style={{ height: 230, marginVertical: 8 }}>
          <Animated.View style={[face, { backgroundColor: C.pri, transform: [{ perspective: 1000 }, { rotateY: front }] }]}>
            <Rich style={{ color: '#fff', fontSize: 23, fontWeight: '800', textAlign: 'center', lineHeight: 30 }}>{x.terme}</Rich>
            <Text style={{ color: '#fff', opacity: 0.75, marginTop: 14, fontSize: 13, fontWeight: '600' }}>Touche pour retourner ↻</Text>
          </Animated.View>
          <Animated.View style={[face, { backgroundColor: C.priSoft, transform: [{ perspective: 1000 }, { rotateY: back }] }]}>
            <Rich style={{ fontSize: 17, textAlign: 'center', lineHeight: 25 }}>{x.def}</Rich>
          </Animated.View>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 14, left: 14, backgroundColor: C.ok, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12, opacity: dragX.interpolate({ inputRange: [0, 90], outputRange: [0, 1], extrapolate: 'clamp' }) }}>
            <Text style={{ color: '#fff', fontWeight: '900' }}>✓ Je savais</Text>
          </Animated.View>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 14, right: 14, backgroundColor: C.bad, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 12, opacity: dragX.interpolate({ inputRange: [-90, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }}>
            <Text style={{ color: '#fff', fontWeight: '900' }}>↺ À revoir</Text>
          </Animated.View>
        </Pressable>
        </Animated.View>
        <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>Glisse à droite si tu savais, à gauche pour revoir</Text>
        <Row style={{ flexWrap: 'nowrap', marginTop: 6 }}>
          <Btn flex kind="sec" label="🔁 À revoir" onPress={() => answer(false)} />
          <Btn flex label="✅ Je savais" onPress={() => answer(true)} />
        </Row>
      </View>
    );
  }
  const answered = ans !== null;
  const ok = it.t === 'q' ? ans === x.bonne : ans === x.vrai;
  const pick = (v) => { if (answered) return; setAns(v); onGrade(it.t === 'q' ? v === x.bonne : v === x.vrai); };
  return (
    <View>
      {head}
      <Rich style={{ fontWeight: '800', fontSize: 19, lineHeight: 26, marginBottom: 10 }}>{phrase}</Rich>
      {it.t === 'q'
        ? order.map((i, k) => <Opt key={i} letter={'ABCD'[k] || '•'} label={x.choix[i]} onPress={() => pick(i)} state={!answered ? null : i === x.bonne ? 'good' : i === ans ? 'wrong' : null} />)
        : <Row style={{ flexWrap: 'nowrap' }}>{[true, false].map((v) => <Opt key={String(v)} center label={v ? '👍 Vrai' : '👎 Faux'} onPress={() => pick(v)} state={!answered ? null : v === x.vrai ? 'good' : v === ans ? 'wrong' : null} />)}</Row>}
      {answered && (
        <View>
          <Fb ok={ok}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: ok ? C.ok : C.bad, marginBottom: 4 }}>{ok ? pickPhrase('🎉 Bien joué !', ['💪 Exactement !', '🔥 Parfait !', '✨ Bonne réponse !']) : it.t === 'f' ? (x.vrai ? '💡 C\'était vrai' : '💡 C\'était faux') : '💡 Pas tout à fait'}</Text>
            {x.expl ? <Rich style={{ fontSize: 15 }}>{x.expl}</Rich> : null}
          </Fb>
          {!ok && !expl && <Btn kind="sec" small label="🤖 Explique-moi autrement" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={explain} />}
          {expl && <FadeIn><View style={{ backgroundColor: C.priSoft, borderRadius: 16, padding: 14, marginTop: 10 }}>
            <Txt>{expl.loading ? "🤖 L'IA réfléchit…" : expl.err ? expl.err : expl.text}</Txt>
          </View></FadeIn>}
          <Btn label="Suivant ➜" onPress={onNext} style={{ marginTop: 12 }} />
        </View>
      )}
    </View>
  );
}
// Marque une question « pas à apprendre » (elle disparaît des sessions)
export function skipItem(ch, id) { ch.skip = ch.skip || {}; ch.skip[id] = true; commit(); }

/* ---------- Cours ---------- */
// Appui long sur une partie ou un mot : « le prof a dit de ne pas l'apprendre »
function askSkip(ch, id, name) {
  ch.skip = ch.skip || {};
  if (ch.skip[id]) {
    Alert.alert('Rétablir ?', `« ${name} » sera de nouveau à apprendre.`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Rétablir', onPress: () => { delete ch.skip[id]; commit(); } }]);
  } else {
    Alert.alert('Pas à apprendre ?', `« ${name} » ne te sera plus demandé.`, [{ text: 'Annuler', style: 'cancel' }, { text: '🚫 Pas à apprendre', style: 'destructive', onPress: () => { ch.skip[id] = true; commit(); } }]);
  }
}
export function TCours({ ch }) {
  const { C } = useApp(); const p = ch.pack;
  const sk = ch.skip || {};
  const plain = (t) => String(t).replace(/<[^>]+>/g, '');
  const hidden = p.resume.map((r, i) => ({ r, i })).filter((o) => sk['r' + o.i]);
  return (
    <View>
      {ch.consigne ? <Note><Txt bold>🚫 À ne pas apprendre</Txt><Txt>{ch.consigne}</Txt></Note> : null}
      {p.alertes.map((a, i) => <Note key={i}><Rich style={{ fontSize: 15 }}>{'⚠️ ' + a}</Rich></Note>)}
      {p.resume.map((r, i) => sk['r' + i] ? null : (
        <FadeIn key={i} delay={Math.min(i, 6) * 50}>
          <Pressable onLongPress={() => askSkip(ch, 'r' + i, plain(r.titre))} delayLongPress={450}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: C.priSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: C.priInk, fontWeight: '800' }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}><Rich style={{ fontSize: 18, fontWeight: '800', lineHeight: 24 }}>{r.titre}</Rich></View>
              </View>
              <Rich style={{ lineHeight: 25 }}>{r.texte}</Rich>
            </Card>
          </Pressable>
        </FadeIn>
      ))}
      {p.formules.length > 0 && (
        <Card><H2>🧮 Formules</H2>
          {p.formules.map((f, i) => (
            <View key={i} style={{ marginBottom: 10 }}>
              <Txt bold>{f.nom}</Txt>
              <View style={{ backgroundColor: C.priSoft, padding: 14, borderRadius: 16, marginVertical: 6 }}><Rich style={{ textAlign: 'center', fontSize: 18, fontWeight: '700' }}>{f.formule}</Rich></View>
              {f.note ? <Rich style={{ color: C.muted, fontSize: 14 }}>{f.note}</Rich> : null}
            </View>
          ))}
        </Card>
      )}
      {p.vocab.length > 0 && <Card><H2>📖 Vocabulaire</H2>{p.vocab.map((v, i) => (
        <Pressable key={i} onLongPress={() => askSkip(ch, 'v' + i, plain(v.terme))} delayLongPress={450}
          style={{ paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderColor: C.line, opacity: sk['v' + i] ? 0.35 : 1 }}>
          <Rich style={{ textDecorationLine: sk['v' + i] ? 'line-through' : 'none' }}>{`<b>${v.terme}</b> : ${v.def}`}</Rich>
        </Pressable>
      ))}</Card>}
      {hidden.length > 0 && (
        <Card style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line, shadowOpacity: 0, elevation: 0 }}>
          <Txt muted bold>🚫 Parties pas à apprendre</Txt>
          {hidden.map((o) => (
            <Pressable key={o.i} onPress={() => askSkip(ch, 'r' + o.i, plain(o.r.titre))} style={{ paddingVertical: 6 }}>
              <Txt muted>{plain(o.r.titre)} · <Text style={{ color: C.pri, fontWeight: '700' }}>rétablir</Text></Txt>
            </Pressable>
          ))}
        </Card>
      )}
      {!p.resume.length && !p.vocab.length && <Card><Txt muted>Pas encore de cours. Ajoute tes notes avec 📷 en haut.</Txt></Card>}
      <Txt muted center style={{ marginTop: 4, fontSize: 12 }}>Astuce : appuie longtemps sur une partie ou un mot que le prof a dit de ne pas apprendre.</Txt>
    </View>
  );
}

/* ---------- Fiches + association ---------- */
export function TFiches({ ch }) {
  const { C } = useApp(); const V = ch.pack.vocab;
  const live = () => V.map((_, i) => i).filter((i) => !(ch.skip || {})['v' + i]);
  const [deck, setDeck] = useState(() => shuffle(live()));
  const [known, setKnown] = useState(0);
  const [n, setN] = useState(0);
  return (
    <View>
      <Card>
        <H2>🃏 Flashcards</H2>
        <Progress value={(known / Math.max(1, live().length)) * 100} />
        <Txt muted>{known} / {live().length} cartes sues</Txt>
        {deck.length ? (
          <Item key={n} it={{ t: 'v', x: V[deck[0]], ch }} onSkip={() => { skipItem(ch, 'v' + deck[0]); setDeck(deck.slice(1)); setN((k) => k + 1); }}
            onGrade={(ok) => { const i = deck[0]; grade(ch, 'v' + i, ok); commit(); const rest = deck.slice(1); if (ok) setKnown((k) => k + 1); else rest.splice(Math.min(3, rest.length), 0, i); setDeck(rest); }}
            onNext={() => setN((k) => k + 1)} />
        ) : (
          <View style={{ marginTop: 10 }}><Txt>🎉 Toutes les cartes sont sues.</Txt><Btn label="Recommencer" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => { setDeck(shuffle(live())); setKnown(0); }} /></View>
        )}
      </Card>
      <Match V={V} ids={live()} />
    </View>
  );
}
function Match({ V, ids }) {
  const { C } = useApp();
  const make = () => { const set = shuffle(ids).slice(0, Math.min(5, ids.length)); return { L: shuffle(set), R: shuffle(set) }; };
  const [g, setG] = useState(make);
  const [sel, setSel] = useState(null);
  const [done, setDone] = useState([]);
  const [errs, setErrs] = useState(0);
  const [flash, setFlash] = useState(null);
  const tap = (side, id) => {
    if (done.includes(id)) return;
    if (!sel) return setSel({ side, id });
    if (sel.side === side) return setSel(sel.id === id ? null : { side, id });
    if (sel.id === id) setDone([...done, id]);
    else { setErrs(errs + 1); setFlash(side + id); setTimeout(() => setFlash(null), 400); }
    setSel(null);
  };
  const cell = (side, id, label) => {
    const isDone = done.includes(id), isSel = sel && sel.side === side && sel.id === id, bad = flash === side + id;
    return (
      <Pressable key={side + id} onPress={() => tap(side, id)}
        style={{ flex: 1, minHeight: 52, padding: 10, borderRadius: 10, borderWidth: 1, justifyContent: 'center', borderColor: bad ? C.bad : isSel ? C.pri : C.line, backgroundColor: isDone ? C.okSoft : isSel ? C.priSoft : C.bg, opacity: isDone ? 0.4 : 1 }}>
        <Rich style={{ fontSize: 13, lineHeight: 18 }}>{label}</Rich>
      </Pressable>
    );
  };
  return (
    <Card>
      <H2>🔗 Associe mot et définition</H2>
      <Txt muted>Touche un mot, puis sa définition.</Txt>
      <View style={{ gap: 8, marginTop: 10 }}>
        {g.L.map((a, k) => <View key={k} style={{ flexDirection: 'row', gap: 8 }}>{cell('w', a, V[a].terme)}{cell('d', g.R[k], V[g.R[k]].def)}</View>)}
      </View>
      {done.length === g.L.length && <Txt style={{ marginTop: 10 }}>{errs ? `✅ Terminé avec ${errs} erreur(s).` : '🌟 Parfait, sans erreur !'}</Txt>}
      <Btn kind="sec" label="Nouvelle série" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => { setG(make()); setDone([]); setErrs(0); setSel(null); }} />
    </Card>
  );
}

/* ---------- Quiz et vrai/faux (10 questions) ---------- */
export function TPractice({ ch, kind }) {
  const { C } = useApp();
  const pool = kind === 'q' ? ch.pack.qcm : ch.pack.vf;
  const make = () => shuffle(pool.map((_, i) => i).filter((i) => !(ch.skip || {})[kind + i])).slice(0, 10);
  const [list, setList] = useState(make);
  const [i, setI] = useState(0);
  const [sc, setSc] = useState(0);
  if (!list.length && i === 0) return <Card><Txt muted>Aucune question disponible.</Txt></Card>;
  if (i >= list.length) {
    const r = sc / Math.max(1, list.length);
    return (
      <Card style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: C.ink }}>{sc} / {list.length}</Text>
        <Txt center style={{ marginVertical: 10 }}>{r >= 0.9 ? '🌟 Excellent !' : r >= 0.7 ? '👍 Bien, encore un petit effort.' : r >= 0.5 ? '🙂 Moyen : relis le cours et recommence.' : "📘 Relis l'onglet Cours puis réessaie."}</Txt>
        <Btn label="Nouvelle série" onPress={() => { setList(make()); setI(0); setSc(0); }} />
      </Card>
    );
  }
  const k = list[i];
  return (
    <Card>
      <Progress value={(i / list.length) * 100} />
      <Txt muted>{kind === 'q' ? 'Question' : 'Affirmation'} {i + 1} / {list.length} · score {sc}</Txt>
      <Item key={i} it={{ t: kind, x: pool[k], ch }} onGrade={(ok) => { grade(ch, kind + k, ok); commit(); if (ok) setSc((s) => s + 1); }} onNext={() => setI(i + 1)}
        onSkip={() => { skipItem(ch, kind + k); setList(list.filter((_, j) => j !== i)); }} />
    </Card>
  );
}

/* ---------- Remettre dans l'ordre ---------- */
export function TOrdre({ ch }) {
  const { C } = useApp(); const O = ch.pack.ordres;
  const [k, setK] = useState(0);
  const init = (kk) => shuffle(O[kk].etapes.map((_, i) => i));
  const [pool, setPool] = useState(() => init(0));
  const [done, setDone] = useState([]);
  const [checked, setChecked] = useState(false);
  const [msg, setMsg] = useState('');
  const E = O[k].etapes;
  const restart = (kk = k) => { setK(kk); setPool(init(kk)); setDone([]); setChecked(false); setMsg(''); };
  const good = done.filter((i, p) => i === p).length;
  return (
    <Card>
      {O.length > 1 && <Row style={{ marginBottom: 10 }}>{O.map((o, i) => <Btn key={i} small kind={i === k ? 'pri' : 'sec'} label={`Série ${i + 1}`} onPress={() => restart(i)} />)}</Row>}
      <H2><Rich style={{ fontSize: 18, fontWeight: '700' }}>{O[k].titre}</Rich></H2>
      <Txt muted>Touche les éléments dans le bon ordre. Touche un élément placé pour le retirer.</Txt>
      <Txt bold style={{ marginTop: 12 }}>Ton ordre</Txt>
      {done.length ? done.map((i, p) => (
        <Pressable key={i} onPress={() => { setPool([...pool, i]); setDone(done.filter((_, q) => q !== p)); setChecked(false); setMsg(''); }}
          style={{ flexDirection: 'row', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginVertical: 4, borderColor: checked ? (i === p ? C.ok : C.bad) : C.line, backgroundColor: checked ? (i === p ? C.okSoft : C.badSoft) : C.bg }}>
          <Text style={{ color: C.pri, fontWeight: '700' }}>{p + 1}.</Text>
          <View style={{ flex: 1 }}><Rich style={{ fontSize: 15 }}>{E[i].t + (checked && E[i].d ? `  <b>(${E[i].d})</b>` : '')}</Rich></View>
        </Pressable>
      )) : <Txt muted>Rien pour l'instant.</Txt>}
      <Txt bold style={{ marginTop: 12 }}>À placer</Txt>
      {pool.length ? pool.map((i) => (
        <Pressable key={i} onPress={() => { setPool(pool.filter((x) => x !== i)); setDone([...done, i]); setChecked(false); setMsg(''); }}
          style={{ flexDirection: 'row', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, marginVertical: 4 }}>
          <Text style={{ color: C.pri, fontWeight: '700' }}>＋</Text>
          <View style={{ flex: 1 }}><Rich style={{ fontSize: 15 }}>{E[i].t}</Rich></View>
        </Pressable>
      )) : <Txt muted>Tout est placé.</Txt>}
      <Row style={{ marginTop: 10 }}>
        <Btn label="Vérifier" onPress={() => { if (pool.length) return setMsg('Place d\'abord tous les éléments.'); setChecked(true); setMsg(''); }} />
        <Btn kind="sec" label="Recommencer" onPress={() => restart()} />
      </Row>
      <Err>{msg}</Err>
      {checked && <Fb ok={good === done.length}><Txt>{good === done.length ? '🌟 Parfait !' : `${good} / ${done.length} bien placés. Touche les éléments en rouge pour les replacer.`}</Txt></Fb>}
    </Card>
  );
}

/* ---------- Exercices ---------- */
export function TExos({ ch, onMore }) {
  const { C } = useApp(); const E = ch.pack.exercices;
  const [order] = useState(() => shuffle(E.map((_, i) => i)));
  const [i, setI] = useState(0);
  const [val, setVal] = useState('');
  const [res, setRes] = useState(null); // null | 'ok' | 'bad' | 'sol'
  const [hint, setHint] = useState('');
  const [err, setErr] = useState('');
  const [tried, setTried] = useState(false);
  const [score, setScore] = useState({ ok: 0, tot: 0 });
  if (!E.length) return <Card><Txt muted>Pas d'exercices pour ce chapitre.</Txt><Btn label="✨ Demander des exercices à l'IA" style={{ marginTop: 10 }} onPress={onMore} /></Card>;
  const x = E[order[i % order.length]] || E[0];
  const count = (good) => { if (!tried) { setTried(true); setScore((s) => ({ ok: s.ok + (good ? 1 : 0), tot: s.tot + 1 })); } };
  const check = () => {
    const v = num(val), a = num(x.reponse);
    if (isNaN(v)) return setErr('Entre un nombre.');
    const good = Math.abs(v - a) <= Math.abs(a) * 0.02 + 1e-9; count(good);
    setHint(!good && a && (Math.abs(v - a * 1000) <= Math.abs(a * 1000) * 0.02 || Math.abs(v - a / 1000) <= Math.abs(a / 1000) * 0.02) ? ' 💡 Tu es à un facteur 1000 près : vérifie tes conversions.' : ' Réessaie ou regarde la correction.');
    setRes(good ? 'ok' : 'bad');
  };
  const next = () => { setI(i + 1); setVal(''); setRes(null); setErr(''); setTried(false); };
  return (
    <View>
      <Card>
        <Txt muted>Exercice {(i % E.length) + 1} / {E.length}{score.tot ? ` · réussis du premier coup : ${score.ok} / ${score.tot}` : ''}</Txt>
        <Rich style={{ marginVertical: 10 }}>{x.enonce}</Rich>
        {x.numerique ? (
          <Row style={{ flexWrap: 'nowrap' }}>
            <Input style={{ flex: 1 }} value={val} onChangeText={(t) => { setVal(t); setErr(''); }} keyboardType="decimal-pad" placeholder="Ta réponse" onSubmitEditing={check} />
            {x.unite ? <Rich style={{ fontWeight: '700' }}>{x.unite}</Rich> : null}
          </Row>
        ) : <Txt muted>Cherche sur ton brouillon, puis regarde la correction.</Txt>}
        <Err>{err}</Err>
        <Row style={{ marginTop: 10 }}>
          {x.numerique && <Btn label="Vérifier" onPress={check} />}
          <Btn kind="sec" label="Correction" onPress={() => { count(false); setRes('sol'); }} />
          <Btn kind="sec" label="Suivant ➜" onPress={next} />
        </Row>
        {res === 'bad' && <Fb ok={false}><Txt>❌ Pas encore.{hint}</Txt></Fb>}
        {(res === 'ok' || res === 'sol') && <Fb ok><Rich style={{ fontSize: 15 }}>{(res === 'ok' ? '<b>✅ Juste !</b>\n' : '') + `<b>Correction</b> (réponse : ${x.reponse} ${x.unite})\n${x.correction}`}</Rich></Fb>}
      </Card>
      <Btn kind="ghost" label="✨ Encore des exercices" onPress={onMore} style={{ alignSelf: 'flex-start' }} />
    </View>
  );
}

/* ---------- Rédaction corrigée par l'IA ---------- */
export function TRedac({ ch }) {
  const { S, matOf } = useApp(); const O = ch.pack.ouvertes;
  const [k, setK] = useState(0);
  const [txt, setTxt] = useState('');
  const [out, setOut] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const x = O[k];
  const correct = async () => {
    if (txt.trim().length < 15) return setErr("Écris d'abord une vraie réponse.");
    setLoading(true); setErr('');
    try {
      const r = await gemini({ apiKey: S.settings.apiKey, model: S.settings.model, prompt: promptCorrect(matOf(ch).nom, ch.titre, x, txt.trim()), json: false });
      setOut({ ok: true, text: r.replace(/[*#]/g, '') });
    } catch (e) { setOut({ ok: false, text: e.message }); }
    setLoading(false);
  };
  return (
    <Card>
      {O.length > 1 && <Row style={{ marginBottom: 10 }}>{O.map((_, i) => <Btn key={i} small kind={i === k ? 'pri' : 'sec'} label={`Q${i + 1}`} onPress={() => { setK(i); setTxt(''); setOut(null); setErr(''); }} />)}</Row>}
      <Rich style={{ fontWeight: '700', marginBottom: 10 }}>{x.q}</Rich>
      <Input multiline value={txt} onChangeText={(t) => { setTxt(t); setErr(''); }} placeholder="Écris ta réponse comme au contrôle" />
      <Err>{err}</Err>
      <Row style={{ marginTop: 10 }}>
        <Btn label={loading ? 'Correction…' : "✨ Faire corriger par l'IA"} disabled={loading} onPress={correct} />
        <Btn kind="sec" label="Voir les attendus" onPress={() => setOut({ ok: true, text: '<b>Éléments attendus</b>\n' + x.attendus })} />
      </Row>
      {out && <Fb ok={out.ok}><Rich style={{ fontSize: 15 }}>{out.text}</Rich></Fb>}
    </Card>
  );
}

/* ---------- Bilan ---------- */
export function TBilan({ ch }) {
  const { C } = useApp();
  const it = items(ch), s = ch.srs || {}; const box = [0, 0, 0];
  const hidden = Object.values(ch.skip || {}).filter(Boolean).length;
  const exams = ch.exams || [];
  it.forEach((i) => { const b = s[i.id] ? s[i.id].b : 0; box[b === 0 ? 0 : b < 3 ? 1 : 2]++; });
  ch.auto = ch.auto || {};
  const Stat = ({ v, l }) => <View style={{ flex: 1, minWidth: '45%', backgroundColor: C.bg, borderRadius: 10, padding: 10 }}><Text style={{ fontSize: 24, fontWeight: '800', color: C.ink }}>{v}</Text><Txt muted>{l}</Txt></View>;
  return (
    <View>
      <ChapterGrades ch={ch} />
      <Card>
        <H2>📊 Où j'en suis</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Stat v={mastery(ch) + ' %'} l="maîtrisé" /><Stat v={it.length} l="questions et fiches" />
          <Stat v={box[1]} l="en cours d'apprentissage" /><Stat v={box[0]} l="jamais vues" />
        </View>
        {exams.length > 0 && <Txt style={{ marginTop: 12 }}>📝 Examens blancs : {exams.slice(-5).map((e) => e.note + '/20').join(' → ')}</Txt>}
        {hidden > 0 && <Row style={{ marginTop: 12 }}><Txt muted>🚫 {hidden} élément{hidden > 1 ? 's' : ''} masqué{hidden > 1 ? 's' : ''} (pas à apprendre)</Txt>
          <Btn small kind="ghost" label="Tout rétablir" onPress={() => { ch.skip = {}; commit(); }} /></Row>}
      </Card>
      {ch.pack.competences.length > 0 && (
        <Card>
          <H2>🎯 Je sais faire…</H2>
          {ch.pack.competences.map((t, i) => (
            <View key={i} style={{ paddingVertical: 10, borderBottomWidth: i < ch.pack.competences.length - 1 ? 1 : 0, borderColor: C.line }}>
              <Rich>{t}</Rich>
              <Row style={{ marginTop: 6 }}>
                {['☹️', '😐', '😊'].map((e, kk) => (
                  <Pressable key={kk} onPress={() => { ch.auto[i] = kk; commit(); }}
                    style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 2, borderColor: ch.auto[i] === kk ? C.pri : 'transparent', opacity: ch.auto[i] === kk ? 1 : 0.45 }}>
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </Pressable>
                ))}
              </Row>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}
