// Onglet « S'entraîner » : modes de révision et outils pour mieux apprendre.
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useApp, Card, H2, Txt, Btn, Row, Chip, Opt, Fb, Progress, Input, Rich, Note } from './ui';
import { shuffle, items, grade, randomItems, errorItems, buildCloze, norm, stripTags, num, today } from './logic';
import { S, commit, matOf, activeChs } from './store';
import { scheduleTimer, cancelTimer } from './notifs';

export const TIPS = [
  ['🧠 Teste-toi au lieu de relire', "Relire donne l'impression de savoir, mais on oublie vite. Chercher la réponse dans sa tête (quiz, fiches) fait beaucoup mieux retenir : c'est le « rappel actif »."],
  ['📅 Un peu chaque jour', '10 minutes par jour pendant une semaine valent mieux que 2 heures la veille. Ton cerveau retient mieux quand on revoit les choses juste avant de les oublier : c\'est la répétition espacée de ta session du jour.'],
  ['🔀 Mélange', "Alterne les matières et les types de questions (le mode rapide fait ça). C'est plus dur sur le moment, mais tu retiens mieux et tu sais reconnaître quel type de question on te pose."],
  ['🗣️ Explique comme à un pote', "Si tu sais l'expliquer simplement, à voix haute ou par écrit, c'est que tu as compris. Sinon, tu sais exactement quoi revoir. Essaie l'onglet Rédaction d'un chapitre."],
  ['😴 Dors', 'Pendant le sommeil, le cerveau range ce que tu as appris dans la journée. Réviser tard la veille du DS au lieu de dormir fait souvent perdre des points.'],
  ['🍅 Fais des pauses', "25 minutes de travail sans téléphone, puis 5 minutes de vraie pause. Au bout de 4 fois, une pause plus longue. Le minuteur Pomodoro est fait pour ça."],
  ['❌ Commence par tes erreurs', 'Ce que tu rates, c\'est ce qui te fera gagner des points. Le mode « Mes erreurs » te repose seulement les questions ratées.'],
  ['🗺️ Fais des liens', 'Relie les notions entre elles : carte mentale, schéma, frise chronologique. Une info reliée à d\'autres se retient bien mieux qu\'une info isolée.'],
  ['⏳ Cherche avant de regarder', "Avant de retourner une fiche, cherche vraiment pendant quelques secondes. Même si tu ne trouves pas, cet effort aide à mieux retenir la réponse."],
  ['📝 Examen blanc 2-3 jours avant', "Fais un examen blanc quelques jours avant le DS, pas la veille : tu auras le temps de combler les trous qu'il révèle."],
];
export const tipOfDay = () => TIPS[Math.floor(Date.now() / 864e5) % TIPS.length];

const selChs = (mats) => activeChs().filter((c) => !mats || !mats.length || mats.includes(c.matiereId));

/* ================= Hub ================= */
export function Train() {
  const { C, go } = useApp();
  const [mats, setMats] = useState([]);
  const chs = selChs(mats);
  const nErr = errorItems(chs).length;
  const toggle = (id) => setMats(mats.includes(id) ? mats.filter((x) => x !== id) : [...mats, id]);
  const T = ({ icon, title, sub, onPress, disabled }) => (
    <Pressable onPress={disabled ? undefined : onPress} style={{ width: '48%', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, opacity: disabled ? 0.45 : 1 }}>
      <Text style={{ fontSize: 26 }}>{icon}</Text>
      <Text style={{ color: C.ink, fontWeight: '700', fontSize: 15, marginTop: 6 }}>{title}</Text>
      <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{sub}</Text>
    </Pressable>
  );
  if (!S.profil.matieres.length) return <Card><Txt muted>Ajoute d'abord une matière et un chapitre depuis l'accueil.</Txt></Card>;
  return (
    <View>
      <Txt muted>Matières à réviser (rien de coché = toutes)</Txt>
      <Row style={{ marginVertical: 10 }}>{S.profil.matieres.map((m) => <Btn key={m.id} small kind={mats.includes(m.id) ? 'pri' : 'sec'} label={m.nom} onPress={() => toggle(m.id)} />)}</Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
        <T icon="⚡" title="Mode rapide" sub="20 questions en vrac" onPress={() => go({ name: 'session', mode: 'rapide', mats, back: 'train' })} />
        <T icon="⏱️" title="Défi 60 s" sub={`Record : ${S.profil.best.eclair || 0}`} onPress={() => go({ name: 'tool', tool: 'eclair', mats, back: 'train' })} />
        <T icon="❌" title="Mes erreurs" sub={nErr ? `${nErr} à revoir` : 'Aucune pour l\'instant'} disabled={!nErr} onPress={() => go({ name: 'session', mode: 'erreurs', mats, back: 'train' })} />
        <T icon="✍️" title="Texte à trous" sub="Complète ton cours" onPress={() => go({ name: 'tool', tool: 'trous', mats, back: 'train' })} />
        <T icon="🔁" title="Fiches inversées" sub="Définition → mot" onPress={() => go({ name: 'tool', tool: 'inverse', mats, back: 'train' })} />
        <T icon="📝" title="Examen blanc" sub="Note sur 20" onPress={() => go({ name: 'tool', tool: 'exam', mats, back: 'train' })} />
        <T icon="🍅" title="Pomodoro" sub="25 min de concentration" onPress={() => go({ name: 'tool', tool: 'pomodoro', back: 'train' })} />
        <T icon="💡" title="Bien apprendre" sub="10 conseils qui marchent" onPress={() => go({ name: 'tool', tool: 'conseils', back: 'train' })} />
      </View>
    </View>
  );
}

export function Tool({ tool, mats }) {
  if (tool === 'eclair') return <Eclair mats={mats} />;
  if (tool === 'trous') return <Trous mats={mats} />;
  if (tool === 'inverse') return <Inverse mats={mats} />;
  if (tool === 'exam') return <Exam mats={mats} />;
  if (tool === 'pomodoro') return <Pomodoro />;
  return <Conseils />;
}
export const TOOL_TITLES = { eclair: '⏱️ Défi 60 secondes', trous: '✍️ Texte à trous', inverse: '🔁 Fiches inversées', exam: '📝 Examen blanc', pomodoro: '🍅 Pomodoro', conseils: '💡 Bien apprendre' };

/* ================= Défi 60 s ================= */
function Eclair({ mats }) {
  const { C } = useApp();
  const [st, setSt] = useState('ready');
  const [list, setList] = useState([]);
  const [i, setI] = useState(0);
  const [sc, setSc] = useState(0);
  const [left, setLeft] = useState(60);
  const [flash, setFlash] = useState(null);
  const endRef = useRef(0);
  useEffect(() => {
    if (st !== 'run') return;
    const iv = setInterval(() => { const l = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000)); setLeft(l); if (!l) { setSt('end'); } }, 250);
    return () => clearInterval(iv);
  }, [st]);
  useEffect(() => { if (st === 'end' && sc > (S.profil.best.eclair || 0)) { S.profil.best.eclair = sc; commit(); } }, [st]);
  const start = () => { const l = randomItems(selChs(mats), 300, ['q', 'f']); if (!l.length) return; setList(l); setI(0); setSc(0); setLeft(60); endRef.current = Date.now() + 60000; setSt('run'); };
  if (st === 'ready' || !list.length) return (
    <Card style={{ alignItems: 'center' }}>
      <Txt center>Un maximum de bonnes réponses en 60 secondes. Pas de correction : on enchaîne !</Txt>
      <Text style={{ fontSize: 22, fontWeight: '800', color: C.ink, marginVertical: 12 }}>Record : {S.profil.best.eclair || 0}</Text>
      <Btn label="C'est parti !" onPress={start} />
      {st !== 'ready' && <Txt muted style={{ marginTop: 8 }}>Pas de questions dans ces matières.</Txt>}
    </Card>
  );
  if (st === 'end') return (
    <Card style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 40, fontWeight: '800', color: C.ink }}>{sc}</Text>
      <Txt>bonne{sc > 1 ? 's' : ''} réponse{sc > 1 ? 's' : ''} sur {i}</Txt>
      <Txt muted style={{ marginVertical: 8 }}>{sc >= (S.profil.best.eclair || 0) && sc > 0 ? '🏆 Nouveau record !' : `Record : ${S.profil.best.eclair || 0}`}</Txt>
      <Btn label="Rejouer" onPress={start} />
    </Card>
  );
  const it = list[i % list.length], x = it.x;
  const answer = (ok) => {
    if (flash) return;
    grade(it.ch, it.id, ok); if (ok) setSc(sc + 1);
    setFlash(ok ? 'ok' : 'bad'); setTimeout(() => { setFlash(null); setI((k) => k + 1); }, 350);
  };
  return (
    <View>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><Text style={{ fontSize: 28, fontWeight: '800', color: left <= 10 ? C.bad : C.ink }}>⏱️ {left}</Text><Text style={{ fontSize: 22, fontWeight: '800', color: C.ok }}>✓ {sc}</Text></Row>
      <Progress value={(left / 60) * 100} color={left <= 10 ? C.bad : C.pri} />
      <Card style={{ borderColor: flash === 'ok' ? C.ok : flash === 'bad' ? C.bad : C.line, borderWidth: flash ? 3 : 1 }}>
        <Rich style={{ fontWeight: '700', marginBottom: 8 }}>{it.t === 'q' ? x.q : x.a}</Rich>
        {it.t === 'q'
          ? x.choix.map((c, k) => <Opt key={k} label={c} onPress={() => answer(k === x.bonne)} />)
          : <Row style={{ flexWrap: 'nowrap' }}><Opt center label="Vrai" onPress={() => answer(x.vrai)} /><Opt center label="Faux" onPress={() => answer(!x.vrai)} /></Row>}
      </Card>
    </View>
  );
}

/* ================= Texte à trous ================= */
function Trous({ mats }) {
  const { C } = useApp();
  const pool = selChs(mats).flatMap((c) => c.pack.resume.map((r, i) => ({ c, r, i })).filter((o) => !(o.c.skip || {})['r' + o.i]))
    .map((o) => ({ ...o, cl: buildCloze(o.r.texte, o.c.pack.vocab.map((v) => v.terme)) })).filter((o) => o.cl.gaps >= 2);
  const [k, setK] = useState(() => Math.floor(Math.random() * Math.max(1, pool.length)));
  const [vals, setVals] = useState({});
  const [checked, setChecked] = useState(false);
  if (!pool.length) return <Card><Txt muted>Pas assez de cours dans ces matières pour faire un texte à trous.</Txt></Card>;
  const o = pool[k % pool.length];
  const gaps = o.cl.tokens.filter((t) => t.gap);
  const good = gaps.filter((g) => norm(vals[g.id] || '') === norm(g.ans)).length;
  const next = () => { setK(k + 1 + Math.floor(Math.random() * Math.max(1, pool.length - 1))); setVals({}); setChecked(false); };
  return (
    <View>
      <Card>
        <Txt muted>{matOf(o.c).nom} · {o.c.titre}</Txt>
        <H2 style={{ marginTop: 6 }}>{stripTags(o.r.titre)}</H2>
        <Text style={{ color: C.ink, fontSize: 16, lineHeight: 24 }}>
          {o.cl.tokens.map((t, j) => t.gap
            ? <Text key={j} style={{ fontWeight: '700', color: checked ? (norm(vals[t.id] || '') === norm(t.ans) ? C.ok : C.bad) : C.pri }}>{checked ? ` ${t.ans} ` : ` [${t.id + 1}] ____ `}</Text>
            : <Text key={j}>{t.t}</Text>)}
        </Text>
      </Card>
      <Card>
        {gaps.map((g) => (
          <Row key={g.id} style={{ flexWrap: 'nowrap', marginBottom: 8 }}>
            <Text style={{ color: C.pri, fontWeight: '700', width: 28 }}>[{g.id + 1}]</Text>
            <Input style={{ flex: 1 }} value={vals[g.id] || ''} editable={!checked} autoCapitalize="none" onChangeText={(t) => setVals({ ...vals, [g.id]: t })} />
          </Row>
        ))}
        {checked && <Fb ok={good === gaps.length}><Txt>{good} / {gaps.length} trous bien remplis{good === gaps.length ? ' 🌟' : ''}.</Txt></Fb>}
        <Row style={{ marginTop: 10 }}>{!checked && <Btn label="Vérifier" onPress={() => setChecked(true)} />}<Btn kind="sec" label="Autre texte ➜" onPress={next} /></Row>
      </Card>
    </View>
  );
}

/* ================= Fiches inversées ================= */
function Inverse({ mats }) {
  const all = selChs(mats).flatMap((c) => c.pack.vocab.map((v, i) => ({ c, v, id: 'v' + i })).filter((o) => !(o.c.skip || {})[o.id]));
  const [list] = useState(() => shuffle(all).slice(0, 10));
  const [i, setI] = useState(0);
  const [sc, setSc] = useState(0);
  const [ans, setAns] = useState(null);
  const choices = React.useMemo(() => {
    if (!list[i]) return [];
    const same = all.filter((o) => o.c === list[i].c && o.id !== list[i].id);
    const others = shuffle(same.length >= 3 ? same : all.filter((o) => o.v.terme !== list[i].v.terme)).slice(0, 3);
    return shuffle([list[i], ...others]);
  }, [i]);
  if (all.length < 4) return <Card><Txt muted>Il faut au moins 4 mots de vocabulaire dans ces matières.</Txt></Card>;
  if (i >= list.length) return <Card style={{ alignItems: 'center' }}><Txt bold>{sc} / {list.length}</Txt><Txt muted center style={{ marginTop: 6 }}>Retrouver le mot à partir de la définition, c'est exactement ce qu'on te demande en contrôle.</Txt></Card>;
  const o = list[i];
  return (
    <Card>
      <Progress value={(i / list.length) * 100} />
      <Txt muted>Quel mot correspond à cette définition ?</Txt>
      <Rich style={{ fontWeight: '700', marginVertical: 10 }}>{o.v.def}</Rich>
      {choices.map((c, k) => <Opt key={k} label={c.v.terme} state={ans === null ? null : c === o ? 'good' : c === ans ? 'wrong' : null}
        onPress={() => { if (ans !== null) return; setAns(c); const ok = c === o; grade(o.c, o.id, ok); commit(); if (ok) setSc(sc + 1); }} />)}
      {ans !== null && <Btn label="Suivant ➜" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => { setAns(null); setI(i + 1); }} />}
    </Card>
  );
}

/* ================= Examen blanc ================= */
function Exam({ mats }) {
  const { C } = useApp();
  const chs = selChs(mats).filter((c) => items(c).length >= 5);
  const [ch, setCh] = useState(null);
  const [qs, setQs] = useState([]);
  const [i, setI] = useState(0);
  const [res, setRes] = useState([]);
  const [val, setVal] = useState('');
  const order = React.useMemo(() => (qs[i] && qs[i].t === 'q' ? shuffle(qs[i].x.choix.map((_, k) => k)) : []), [qs, i]);
  const finished = !!ch && qs.length > 0 && i >= qs.length;
  const note = finished ? Math.round((res.filter((r) => r.ok).length / qs.length) * 40) / 2 : 0;
  useEffect(() => { if (finished) { ch.exams = [...(ch.exams || []), { date: today(), note }].slice(-10); commit(); } }, [finished]);
  const begin = (c) => {
    const sk = c.skip || {};
    const q = shuffle(c.pack.qcm.map((x, k) => ({ t: 'q', x, id: 'q' + k })).filter((o) => !sk[o.id]));
    const f = shuffle(c.pack.vf.map((x, k) => ({ t: 'f', x, id: 'f' + k })).filter((o) => !sk[o.id]));
    const e = shuffle(c.pack.exercices.filter((x) => x.numerique)).slice(0, 4).map((x) => ({ t: 'e', x }));
    let l = [...q.slice(0, 8), ...f.slice(0, 6), ...e];
    l = [...l, ...q.slice(8), ...f.slice(6)].slice(0, 20);
    setCh(c); setQs(shuffle(l)); setI(0); setRes([]); setVal('');
  };
  if (!ch) return (
    <Card>
      <H2>Sur quel chapitre ?</H2>
      <Txt muted>20 questions, sans correction pendant l'examen. À la fin : ta note sur 20 et tes erreurs.</Txt>
      <View style={{ gap: 8, marginTop: 12 }}>{chs.length ? chs.map((c) => <Btn key={c.id} kind="sec" label={`${c.titre}${c.exams && c.exams.length ? ' · dernier : ' + c.exams[c.exams.length - 1].note + '/20' : ''}`} onPress={() => begin(c)} />) : <Txt muted>Aucun chapitre avec assez de questions.</Txt>}</View>
    </Card>
  );
  if (i >= qs.length) {
    const ok = res.filter((r) => r.ok).length;
    const wrong = res.filter((r) => !r.ok);
    return (
      <View>
        <Card style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 44, fontWeight: '800', color: note >= 14 ? C.ok : note >= 10 ? C.warn : C.bad }}>{String(note).replace('.', ',')}/20</Text>
          <Txt>{ok} bonnes réponses sur {qs.length}</Txt>
          <Btn kind="sec" label="Refaire un examen" style={{ marginTop: 12 }} onPress={() => setCh(null)} />
        </Card>
        {wrong.length > 0 && <Card><H2>À revoir</H2>{wrong.map((r, k) => (
          <View key={k} style={{ paddingVertical: 8, borderTopWidth: k ? 1 : 0, borderColor: C.line }}>
            <Rich style={{ fontWeight: '700' }}>{r.q.t === 'q' ? r.q.x.q : r.q.t === 'f' ? r.q.x.a : r.q.x.enonce}</Rich>
            <Rich style={{ color: C.ok, marginTop: 4 }}>{'✔ ' + (r.q.t === 'q' ? r.q.x.choix[r.q.x.bonne] : r.q.t === 'f' ? (r.q.x.vrai ? 'Vrai' : 'Faux') : r.q.x.reponse + ' ' + r.q.x.unite)}</Rich>
            {(r.q.x.expl || r.q.x.correction) ? <Rich style={{ color: C.muted, fontSize: 14, marginTop: 2 }}>{r.q.x.expl || r.q.x.correction}</Rich> : null}
          </View>
        ))}</Card>}
      </View>
    );
  }
  const q = qs[i];
  const answer = (ok) => { if (q.t !== 'e') grade(ch, q.id, ok); setRes([...res, { q, ok }]); setI(i + 1); setVal(''); commit(); };
  return (
    <Card>
      <Progress value={(i / qs.length) * 100} />
      <Txt muted>Question {i + 1} / {qs.length}</Txt>
      <Rich style={{ fontWeight: '700', marginVertical: 10 }}>{q.t === 'q' ? q.x.q : q.t === 'f' ? q.x.a : q.x.enonce}</Rich>
      {q.t === 'q' && order.map((k) => <Opt key={k} label={q.x.choix[k]} onPress={() => answer(k === q.x.bonne)} />)}
      {q.t === 'f' && <Row style={{ flexWrap: 'nowrap' }}><Opt center label="Vrai" onPress={() => answer(q.x.vrai)} /><Opt center label="Faux" onPress={() => answer(!q.x.vrai)} /></Row>}
      {q.t === 'e' && <View>
        <Row style={{ flexWrap: 'nowrap' }}><Input style={{ flex: 1 }} value={val} onChangeText={setVal} keyboardType="decimal-pad" placeholder="Ta réponse" />{q.x.unite ? <Rich style={{ fontWeight: '700' }}>{q.x.unite}</Rich> : null}</Row>
        <Btn label="Valider" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => { const v = num(val), a = num(q.x.reponse); answer(!isNaN(v) && Math.abs(v - a) <= Math.abs(a) * 0.02 + 1e-9); }} />
      </View>}
    </Card>
  );
}

/* ================= Pomodoro ================= */
const POMO = { phase: 'idle', endsAt: 0, notif: null, len: 0 };
function Pomodoro() {
  const { C } = useApp();
  const [, setT] = useState(0);
  useEffect(() => { const iv = setInterval(() => setT((t) => t + 1), 1000); return () => clearInterval(iv); }, []);
  const day = today(); S.profil.pomo = S.profil.pomo || {};
  const done = S.profil.pomo[day] || 0;
  const left = POMO.phase === 'idle' ? 0 : Math.max(0, Math.round((POMO.endsAt - Date.now()) / 1000));
  useEffect(() => {
    if (POMO.phase !== 'idle' && left === 0 && !POMO.finished) {
      POMO.finished = true;
      if (POMO.phase === 'work') { S.profil.pomo[day] = (S.profil.pomo[day] || 0) + 1; commit(); }
    }
  }, [left]);
  const start = async (phase, min) => {
    await cancelTimer(POMO.notif);
    Object.assign(POMO, { phase, endsAt: Date.now() + min * 60000, len: min * 60, finished: false });
    POMO.notif = await scheduleTimer(min * 60, phase === 'work' ? '🍅 Pause bien méritée !' : '⏰ La pause est finie', phase === 'work' ? 'Lève-toi, bois de l\'eau, 5 minutes loin des écrans.' : 'On repart pour 25 minutes ?');
    setT((t) => t + 1);
  };
  const stop = async () => { await cancelTimer(POMO.notif); Object.assign(POMO, { phase: 'idle', endsAt: 0, notif: null }); setT((t) => t + 1); };
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  return (
    <View>
      <Card style={{ alignItems: 'center' }}>
        <Txt muted>{POMO.phase === 'work' ? 'Concentration : téléphone retourné, une seule tâche' : POMO.phase === 'pause' ? 'Pause : bouge, bois de l\'eau' : 'Prêt ?'}</Txt>
        <Text style={{ fontSize: 64, fontWeight: '800', color: POMO.phase === 'pause' ? C.ok : C.ink, marginVertical: 10, fontVariant: ['tabular-nums'] }}>{POMO.phase === 'idle' ? '25:00' : `${mm}:${ss}`}</Text>
        {POMO.phase !== 'idle' && <View style={{ alignSelf: 'stretch' }}><Progress value={(1 - left / POMO.len) * 100} color={POMO.phase === 'pause' ? C.ok : C.pri} /></View>}
        <Row style={{ marginTop: 10, justifyContent: 'center' }}>
          {(POMO.phase === 'idle' || (POMO.phase === 'pause' && left === 0)) && <Btn label="▶️ 25 min de travail" onPress={() => start('work', 25)} />}
          {POMO.phase === 'work' && left === 0 && <Btn label={(done % 4 === 0 && done > 0) ? '☕ Grande pause (15 min)' : '☕ Pause (5 min)'} onPress={() => start('pause', done % 4 === 0 && done > 0 ? 15 : 5)} />}
          {POMO.phase !== 'idle' && <Btn kind="ghost" label="Arrêter" onPress={stop} />}
        </Row>
        <Text style={{ fontSize: 24, marginTop: 14 }}>{'🍅'.repeat(Math.min(done, 12)) || ' '}</Text>
        <Txt muted>{done} pomodoro{done > 1 ? 's' : ''} aujourd'hui</Txt>
      </Card>
      <Txt muted>Tu peux quitter l'appli : une notification te préviendra à la fin.</Txt>
    </View>
  );
}

/* ================= Conseils ================= */
function Conseils() {
  return <View>{TIPS.map(([t, d], i) => <Card key={i}><H2>{t}</H2><Txt>{d}</Txt></Card>)}</View>;
}
