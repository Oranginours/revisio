// Les outils d'un chapitre : fiches, quiz, vrai/faux, ordre, exercices, rédaction, bilan.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp, Card, H2, Txt, Rich, Btn, Row, Opt, Fb, Note, Progress, Input, Err } from './ui';
import { shuffle, items, mastery, grade, num, promptCorrect, promptExplain } from './logic';
import { S, commit, matOf } from './store';
import { gemini } from './ai';
import { ChapterGrades } from './school';

/* ---------- une question (fiche, QCM ou vrai/faux) ---------- */
// it = { t: 'v'|'q'|'f', x, id?, ch? }. onSkip : marque la question « pas à apprendre ».
export function Item({ it, onGrade, onNext, onSkip }) {
  const { C } = useApp();
  const [flip, setFlip] = useState(false);
  const [ans, setAns] = useState(null);
  const [expl, setExpl] = useState(null);
  const order = useMemo(() => (it.t === 'q' ? shuffle(it.x.choix.map((_, i) => i)) : []), [it]);
  const x = it.x;
  const explain = async () => {
    const ch = it.ch;
    setExpl({ loading: true });
    try {
      const t = await gemini({ apiKey: S.settings.apiKey, model: S.settings.model, json: false,
        prompt: promptExplain(it, ch ? matOf(ch).nom : '', ch ? ch.titre : '') });
      setExpl({ text: t.replace(/[*#]/g, '') });
    } catch (e) { setExpl({ err: e.message }); }
  };
  const skipLink = onSkip ? (
    <Pressable onPress={onSkip} style={{ marginTop: 14, alignSelf: 'flex-start' }}>
      <Text style={{ color: C.muted, fontSize: 13 }}>🚫 Pas à apprendre (le prof l'a dit)</Text>
    </Pressable>
  ) : null;

  if (it.t === 'v') {
    return (
      <View>
        <Txt muted>Fiche : retourne la carte, puis dis si tu savais.</Txt>
        <Pressable onPress={() => setFlip((f) => !f)}
          style={{ minHeight: 200, marginVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: flip ? C.bg : C.pri, alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          <Rich style={{ color: flip ? C.ink : '#fff', fontSize: flip ? 16 : 21, fontWeight: flip ? '400' : '700', textAlign: 'center' }}>{flip ? x.def : x.terme}</Rich>
          {!flip && <Text style={{ color: '#fff', opacity: 0.8, marginTop: 12, fontSize: 12 }}>Touche pour retourner</Text>}
        </Pressable>
        <Row>
          <Btn flex kind="sec" label="🔁 À revoir" onPress={() => { onGrade(false); onNext(); }} />
          <Btn flex label="✅ Je savais" onPress={() => { onGrade(true); onNext(); }} />
        </Row>
        {skipLink}
      </View>
    );
  }
  const answered = ans !== null;
  const ok = it.t === 'q' ? ans === x.bonne : ans === x.vrai;
  const pick = (v) => { if (answered) return; setAns(v); onGrade(it.t === 'q' ? v === x.bonne : v === x.vrai); };
  return (
    <View>
      {it.t === 'f' && <Txt muted>Vrai ou faux ?</Txt>}
      <Rich style={{ fontWeight: '700', marginVertical: 8 }}>{it.t === 'q' ? x.q : x.a}</Rich>
      {it.t === 'q'
        ? order.map((i) => <Opt key={i} label={x.choix[i]} onPress={() => pick(i)} state={!answered ? null : i === x.bonne ? 'good' : i === ans ? 'wrong' : null} />)
        : <Row style={{ flexWrap: 'nowrap' }}>{[true, false].map((v) => <Opt key={String(v)} center label={v ? 'Vrai' : 'Faux'} onPress={() => pick(v)} state={!answered ? null : v === x.vrai ? 'good' : v === ans ? 'wrong' : null} />)}</Row>}
      {answered && (
        <View>
          <Fb ok={ok}><Rich style={{ fontSize: 15 }}>{(it.t === 'q' ? (ok ? '<b>Bonne réponse !</b> ' : '<b>Pas tout à fait.</b> ') : (x.vrai ? '<b>Vrai.</b> ' : '<b>Faux.</b> ')) + x.expl}</Rich></Fb>
          {!ok && !expl && <Btn kind="sec" small label="🤖 Explique-moi autrement" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={explain} />}
          {expl && <View style={{ backgroundColor: C.priSoft, borderRadius: 10, padding: 12, marginTop: 8 }}>
            <Txt>{expl.loading ? "L'IA réfléchit…" : expl.err ? expl.err : expl.text}</Txt>
          </View>}
          <Btn label="Suivant ➜" onPress={onNext} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
        </View>
      )}
      {skipLink}
    </View>
  );
}
// Marque une question « pas à apprendre » (elle disparaît des sessions)
export function skipItem(ch, id) { ch.skip = ch.skip || {}; ch.skip[id] = true; commit(); }

/* ---------- Cours ---------- */
export function TCours({ ch }) {
  const { C } = useApp(); const p = ch.pack;
  ch.skip = ch.skip || {};
  const toggle = (id) => { ch.skip[id] = !ch.skip[id]; commit(); };
  const Mute = ({ id }) => (
    <Pressable onPress={() => toggle(id)} hitSlop={8}><Text style={{ fontSize: 13, color: C.muted }}>{ch.skip[id] ? '↩️ Rétablir' : '🚫'}</Text></Pressable>
  );
  return (
    <View>
      {ch.consigne ? <Note><Txt>{'🚫 À ne pas apprendre : ' + ch.consigne}</Txt></Note> : null}
      {p.alertes.map((a, i) => <Note key={i}><Rich style={{ fontSize: 15 }}>{'⚠️ ' + a}</Rich></Note>)}
      {p.resume.map((r, i) => (
        <Card key={i} style={ch.skip['r' + i] ? { opacity: 0.45 } : null}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ flex: 1 }}><H2><Rich style={{ fontSize: 18, fontWeight: '700', textDecorationLine: ch.skip['r' + i] ? 'line-through' : 'none' }}>{r.titre}</Rich></H2></View>
            <Mute id={'r' + i} />
          </View>
          {ch.skip['r' + i] ? <Txt muted>Partie à ne pas apprendre.</Txt> : <Rich>{r.texte}</Rich>}
        </Card>
      ))}
      {p.formules.length > 0 && (
        <Card><H2>🧮 Formules</H2>
          {p.formules.map((f, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Txt bold>{f.nom}</Txt>
              <View style={{ backgroundColor: C.priSoft, padding: 10, borderRadius: 10, marginVertical: 6 }}><Rich style={{ textAlign: 'center', fontSize: 17 }}>{f.formule}</Rich></View>
              {f.note ? <Rich style={{ color: C.muted, fontSize: 14 }}>{f.note}</Rich> : null}
            </View>
          ))}
        </Card>
      )}
      {p.vocab.length > 0 && <Card><H2>📖 Vocabulaire</H2>{p.vocab.map((v, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginVertical: 4, opacity: ch.skip['v' + i] ? 0.45 : 1 }}>
          <View style={{ flex: 1 }}><Rich>{`<b>${v.terme}</b> : ${v.def}`}</Rich></View>
          <Mute id={'v' + i} />
        </View>
      ))}</Card>}
      {!p.resume.length && !p.vocab.length && <Card><Txt muted>Pas encore de résumé pour ce chapitre.</Txt></Card>}
      <Txt muted>Touche 🚫 à côté d'une partie ou d'un mot que le prof a dit de ne pas apprendre : il ne sera plus demandé.</Txt>
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
