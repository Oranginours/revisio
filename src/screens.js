// Écrans principaux : accueil, session, chapitre, réglages.
import React, { useState } from 'react';
import { View, Text, Pressable, Alert, Switch, Linking, ScrollView } from 'react-native';
import * as Updates from 'expo-updates';
import { useApp, Card, H2, Txt, Btn, Row, Chip, Dot, DsBadge, Progress, Label, Input, Err, IconBtn, FadeIn, Pop } from './ui';
import { today, addDays, diffDays, fmtDate, dayLetter, isArchived, items, mastery, grade, buildSession, randomItems, errorItems, dsInfo, normPack, mergePack, promptMore, promptVariants, applyVariants } from './logic';
import { gemini, DEFAULT_MODEL } from './ai';
import { askPermission, reschedule, testNotification } from './notifs';
import { Item, skipItem, TCours, TFiches, TPractice, TOrdre, TExos, TRedac, TBilan } from './tabs';
import { S, commit, matOf, activeChs } from './store';
import { MatiereForm, ChapitreForm, AddNotesForm, ChSettings, loadExamples } from './forms';
import { ImportForm, ShareChoice } from './share';
import { DsDetected, QrLogin, logoutPronote } from './school';
import { tipOfDay } from './tools';

/* ================= Accueil ================= */
export function Home() {
  const { C, go, setModal } = useApp();
  const [openArch, setOpenArch] = useState({});
  const [openMat, setOpenMat] = useState({});
  const P = S.profil, t = today(), all = Object.values(S.chs), chs = activeChs();
  if (!P.matieres.length) {
    return (
      <Card>
        <H2>Bienvenue 👋</H2>
        <Txt>Ajoute tes matières, puis pour chaque chapitre prends tes cours en photo : l'IA en fait des fiches, des quiz et des exercices. Entre la date de tes DS : chaque jour, l'appli te propose une petite session, avec plus de questions pour les DS qui approchent.</Txt>
        <View style={{ gap: 8, marginTop: 14 }}>
          <Btn label="Ajouter une matière" onPress={() => setModal(<MatiereForm />)} />
          <Btn kind="sec" label="📥 Importer les chapitres d'un pote" onPress={() => setModal(<ImportForm />)} />
          <Btn kind="sec" label="Charger les 2 chapitres d'exemple" onPress={loadExamples} />
          {!S.pronote && <Btn kind="sec" label="🔗 Connecter Pronote" onPress={() => setModal(<QrLogin />)} />}
        </View>
        {!S.settings.apiKey && <Txt muted style={{ marginTop: 14 }}>Pour que l'IA lise tes photos, ajoute ta clé Gemini gratuite dans ⚙️ Réglages.</Txt>}
      </Card>
    );
  }
  const sess = buildSession(chs); const done = P.lastDay === t; const by = {};
  sess.forEach((i) => { const m = matOf(i.ch); by[m.nom] = by[m.nom] || { n: 0, c: m.couleur }; by[m.nom].n++; });
  const up = chs.filter((c) => c.ds && diffDays(t, c.ds) >= 0).sort((a, b) => (a.ds < b.ds ? -1 : 1));
  const week = [...Array(7)].map((_, i) => addDays(t, i - 6));
  const tip = tipOfDay();
  return (
    <View>
      <FadeIn>
        <View style={{ backgroundColor: C.pri, borderRadius: 24, padding: 20, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, color: '#fff', opacity: 0.85, fontWeight: '700', fontSize: 14 }}>AUJOURD'HUI</Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>🔥 {P.streak || 0} jour{(P.streak || 0) > 1 ? 's' : ''}</Text>
            </View>
          </View>
          {!chs.length ? (
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 10 }}>Crée ton premier chapitre pour commencer 👇</Text>
          ) : !sess.length ? (
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 10 }}>✅ Tout est à jour !{'\n'}<Text style={{ fontSize: 15, fontWeight: '600' }}>Entraîne-toi librement dans 🧠.</Text></Text>
          ) : (
            <View>
              <Text style={{ color: '#fff', fontSize: 40, fontWeight: '900', marginTop: 6, letterSpacing: -1 }}>{sess.length} <Text style={{ fontSize: 18, fontWeight: '700' }}>questions</Text></Text>
              <Text style={{ color: '#fff', opacity: 0.85, fontSize: 14 }}>{done ? 'Session faite ✅ · une session bonus ?' : `environ ${Math.max(3, Math.round(sess.length * 0.4))} minutes`}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {Object.entries(by).map(([n, o]) => (
                  <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10 }}>
                    <Dot color={o.c} size={8} /><Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{n} · {o.n}</Text>
                  </View>
                ))}
              </View>
              <Btn kind="white" label={done ? 'Session bonus ➜' : 'Commencer ➜'} style={{ marginTop: 16 }} onPress={() => setModal(<SessionSetup />)} />
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 18 }}>
            {week.map((d) => (
              <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ height: 28, alignSelf: 'stretch', borderRadius: 9, backgroundColor: P.hist && P.hist[d] ? '#FFFFFF' : 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                  {P.hist && P.hist[d] ? <Text style={{ color: C.pri, fontWeight: '900' }}>✓</Text> : null}
                </View>
                <Text style={{ fontSize: 11, color: '#fff', opacity: d === t ? 1 : 0.7, marginTop: 4, fontWeight: d === t ? '900' : '600' }}>{dayLetter(d)}</Text>
              </View>
            ))}
          </View>
        </View>
      </FadeIn>

      <DsDetected />

      {up.length > 0 && (
        <Card>
          <H2>📅 Prochains DS</H2>
          {up.map((c) => { const m = matOf(c); return (
            <Pressable key={c.id} onPress={() => go({ name: 'ch', id: c.id, tab: 'cours' })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
              <Dot color={m.couleur} />
              <View style={{ flex: 1 }}><Txt bold>{c.titre}</Txt><Txt muted>{m.nom} · {fmtDate(c.ds)} · maîtrisé à {mastery(c)} %</Txt></View>
              <DsBadge info={dsInfo(c.ds)} />
            </Pressable>
          ); })}
        </Card>
      )}

      {P.matieres.map((m) => {
        const list = chs.filter((c) => c.matiereId === m.id).sort((a, b) => (b.created || 0) - (a.created || 0));
        const arch = all.filter((c) => c.matiereId === m.id && isArchived(c)).sort((a, b) => ((b.ds || '') < (a.ds || '') ? -1 : 1));
        return (
          <Card key={m.id} style={{ paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() => setOpenMat({ ...openMat, [m.id]: !(openMat[m.id] ?? false) })}>
                <Dot color={m.couleur} size={12} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>{m.nom}</Text>
                  <Txt muted>{list.length ? `${list.length} chapitre${list.length > 1 ? 's' : ''} en cours` : 'Aucun chapitre en cours'}{list.some((c) => c.ds) ? ' · ' + dsInfo(list.filter((c) => c.ds).sort((a, b) => (a.ds < b.ds ? -1 : 1))[0].ds).label : ''}</Txt>
                </View>
                <Text style={{ color: C.muted, fontSize: 16 }}>{openMat[m.id] ? '▲' : '▼'}</Text>
              </Pressable>
              <Btn kind="ghost" small label="✏️" onPress={() => setModal(<MatiereForm id={m.id} />)} />
            </View>
            {openMat[m.id] && <View style={{ marginTop: 8 }}>
            {list.length ? list.map((c) => (
              <Pressable key={c.id} onPress={() => go({ name: 'ch', id: c.id, tab: 'cours' })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderColor: C.line }}>
                <View style={{ flex: 1 }}><Txt bold>{c.titre}</Txt><Progress value={mastery(c)} color={m.couleur} /></View>
                <DsBadge info={dsInfo(c.ds)} />
              </Pressable>
            )) : <Txt muted>{arch.length ? 'Aucun chapitre en cours.' : "Aucun chapitre pour l'instant."}</Txt>}
            {arch.length > 0 && (
              <View style={{ borderTopWidth: 1, borderColor: C.line, paddingTop: 8 }}>
                <Pressable onPress={() => setOpenArch({ ...openArch, [m.id]: !openArch[m.id] })}><Txt muted>🗄️ {arch.length} chapitre{arch.length > 1 ? 's' : ''} archivé{arch.length > 1 ? 's' : ''} {openArch[m.id] ? '▲' : '▼'}</Txt></Pressable>
                {openArch[m.id] && arch.map((c) => (
                  <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                    <Pressable style={{ flex: 1 }} onPress={() => go({ name: 'ch', id: c.id, tab: 'cours' })}><Txt style={{ color: C.muted }}>{c.titre}{c.ds ? ' · DS du ' + fmtDate(c.ds) : ''}</Txt></Pressable>
                    <Btn small kind="ghost" label="Désarchiver" onPress={() => { c.archived = false; commit(); reschedule(S); }} />
                  </View>
                ))}
              </View>
            )}
            <Btn kind="sec" label="＋ Ajouter un chapitre en cours" style={{ marginTop: 10 }} onPress={() => setModal(<ChapitreForm mid={m.id} />)} />
            </View>}
          </Card>
        );
      })}
      <Row>
        <Btn kind="ghost" label="＋ Matière" onPress={() => setModal(<MatiereForm />)} />
        <Btn kind="ghost" label="📥 Importer" onPress={() => setModal(<ImportForm />)} />
      </Row>
      <Card style={{ marginTop: 14 }}>
        <Txt bold>{tip[0]}</Txt>
        <Txt muted style={{ marginTop: 4 }}>{tip[1]}</Txt>
      </Card>
    </View>
  );
}

/* ================= Choix avant la session ================= */
function SessionSetup() {
  const { setModal, go } = useApp();
  const [mats, setMats] = useState([]);
  const chs = activeChs().filter((c) => !mats.length || mats.includes(c.matiereId));
  const n = buildSession(chs).length;
  const toggle = (id) => setMats(mats.includes(id) ? mats.filter((x) => x !== id) : [...mats, id]);
  return (
    <View>
      <H2>Qu'est-ce qu'on révise ?</H2>
      <Txt muted>Touche les matières voulues (rien de coché = toutes).</Txt>
      <Row style={{ marginVertical: 12 }}>{S.profil.matieres.map((m) => <Btn key={m.id} small kind={mats.includes(m.id) ? 'pri' : 'sec'} label={m.nom} onPress={() => toggle(m.id)} />)}</Row>
      <View style={{ gap: 10 }}>
        <Btn label={`📅 Session du jour (${n} questions)`} disabled={!n} onPress={() => { setModal(null); go({ name: 'session', mode: 'jour', mats }); }} />
        <Txt muted>Les questions à revoir aujourd'hui, plus de questions pour les DS proches.</Txt>
        <Btn kind="sec" label="⚡ Mode rapide (20 questions en vrac)" onPress={() => { setModal(null); go({ name: 'session', mode: 'rapide', mats }); }} />
        <Txt muted>Des questions au hasard, pour s'entraîner sans réfléchir à quoi réviser.</Txt>
        <Btn kind="ghost" label="Annuler" onPress={() => setModal(null)} />
      </View>
    </View>
  );
}

/* ================= Session (du jour, rapide, erreurs) ================= */
const MODE_TITLES = { jour: 'Session du jour', rapide: '⚡ Mode rapide', erreurs: '❌ Mes erreurs' };
export const sessionTitle = (mode) => MODE_TITLES[mode] || 'Session';
export function Session({ mode, mats }) {
  const { go, C } = useApp();
  const [st, setSt] = useState(() => {
    const chs = activeChs().filter((c) => !mats || !mats.length || mats.includes(c.matiereId));
    const list = mode === 'rapide' ? randomItems(chs, 20) : mode === 'erreurs' ? errorItems(chs).slice(0, 20) : buildSession(chs);
    return { list, i: 0, ok: 0, again: {}, combo: 0, best: 0 };
  });
  const [ended, setEnded] = useState(false);
  if (!st.list.length) return <Card><Txt>Rien à revoir pour l'instant 🎉</Txt><Btn label="Retour" style={{ marginTop: 10 }} onPress={() => go({ name: 'home' })} /></Card>;
  const finish = () => {
    const P = S.profil, t = today(); P.hist = P.hist || {};
    if (P.lastDay !== t) { P.streak = P.lastDay === addDays(t, -1) ? (P.streak || 0) + 1 : 1; P.lastDay = t; }
    P.hist[t] = (P.hist[t] || 0) + st.list.length;
    Object.keys(P.hist).forEach((d) => { if (diffDays(d, t) > 60) delete P.hist[d]; });
    commit(); reschedule(S); setEnded(true);
  };
  if (ended) {
    const p = Math.round((st.ok / st.list.length) * 100);
    const msg = p >= 90 ? 'Incroyable 🤩' : p >= 70 ? 'Très bien joué 💪' : p >= 50 ? 'Pas mal du tout 👍' : 'Chaque erreur compte 🌱';
    return (
      <FadeIn>
        <View style={{ backgroundColor: C.pri, borderRadius: 24, padding: 24, alignItems: 'center' }}>
          <Pop trigger={1}><Text style={{ fontSize: 64 }}>🎉</Text></Pop>
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 6 }}>{msg}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' }}>
            {[[p + ' %', 'de réussite'], ['🔥 ' + S.profil.streak, 'jours de suite'], ['⚡ ' + st.best, 'meilleur combo']].map(([v, l]) => (
              <View key={l} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{v}</Text>
                <Text style={{ color: '#fff', opacity: 0.8, fontSize: 12, marginTop: 2 }}>{l}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: '#fff', opacity: 0.85, textAlign: 'center', marginTop: 16, fontSize: 14 }}>Les questions ratées reviendront demain, celles que tu sais reviendront plus tard.</Text>
          <Btn kind="white" label="Retour à l'accueil" style={{ marginTop: 18, alignSelf: 'stretch' }} onPress={() => go({ name: 'home' })} />
        </View>
      </FadeIn>
    );
  }
  const it = st.list[st.i]; const m = matOf(it.ch);
  const next = () => { if (st.i + 1 >= st.list.length) finish(); else setSt({ ...st, i: st.i + 1 }); };
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}><Progress value={(st.i / st.list.length) * 100} height={12} /></View>
        <Text style={{ color: C.muted, fontWeight: '800' }}>{st.i + 1}/{st.list.length}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Chip color={m.couleur}>{m.nom}</Chip>
        <Text style={{ flex: 1, color: C.muted, fontSize: 13 }} numberOfLines={1}>{it.ch.titre}</Text>
        {st.combo >= 2 && <Pop trigger={st.combo}><View style={{ backgroundColor: C.warnSoft, borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10 }}><Text style={{ color: C.warn, fontWeight: '900' }}>🔥 x{st.combo}</Text></View></Pop>}
      </View>
      <FadeIn key={st.i}>
        <Card>
          <Item it={it}
            onGrade={(ok) => {
              grade(it.ch, it.id, ok); commit();
              if (ok) { st.ok++; st.combo++; st.best = Math.max(st.best, st.combo); } else { st.combo = 0; if (!st.again[it.id]) { st.again[it.id] = 1; st.list.push(it); } }
              setSt({ ...st });
            }}
            onNext={next}
            onSkip={() => { skipItem(it.ch, it.id); st.list = st.list.filter((x, k) => k <= st.i || x.id !== it.id || x.ch !== it.ch); next(); }} />
        </Card>
      </FadeIn>
    </View>
  );
}

/* ================= Chapitre ================= */
const TABS = [['cours', '📘 Cours'], ['fiches', '🃏 Fiches'], ['quiz', '❓ Quiz'], ['vf', '⚖️ Vrai/faux'], ['ordre', '🔢 Ordre'], ['exos', '✏️ Exos'], ['redac', '📝 Rédaction'], ['bilan', '✅ Bilan']];
export function Chapter({ id, tab, setTab }) {
  const { C, setModal, runAI } = useApp();
  const ch = S.chs[id], m = matOf(ch), p = ch.pack;
  const tabs = TABS.filter(([k]) => (k === 'ordre' ? p.ordres.length : k === 'redac' ? p.ouvertes.length : k === 'vf' ? p.vf.length : k === 'fiches' ? p.vocab.length : k === 'quiz' ? p.qcm.length : true));
  const cur = tabs.some((t) => t[0] === tab) ? tab : 'cours';
  const more = async (kind) => {
    if (!S.settings.apiKey) return Alert.alert('Clé manquante', "Ajoute ta clé Gemini dans ⚙️ Réglages.");
    try {
      const add = normPack(await runAI(kind === 'ex' ? 'Nouveaux exercices' : 'Nouvelles questions', () => gemini({ apiKey: S.settings.apiKey, model: S.settings.model, prompt: promptMore(ch, m.nom, kind) })));
      const n = add.qcm.length + add.vf.length + add.exercices.length;
      if (!n) throw new Error("L'IA n'a pas renvoyé de questions. Réessaie.");
      ch.pack = mergePack(ch.pack, { qcm: add.qcm, vf: add.vf, exercices: add.exercices }); commit();
      Alert.alert('✨ Ajouté', `${n} nouvelles questions.`);
    } catch (e) { Alert.alert('Oups', e.message); }
  };
  const vary = async () => {
    if (!S.settings.apiKey) return Alert.alert('Clé manquante', "Ajoute ta clé Gemini dans ⚙️ Réglages.");
    const qIdx = p.qcm.map((_, i) => i), fIdx = p.vf.map((_, i) => i);
    if (!qIdx.length && !fIdx.length) return Alert.alert('Rien à varier', "Ce chapitre n'a pas encore de questions.");
    try {
      let n = 0;
      await runAI('Nouvelles formulations', async () => {
        for (let k = 0; k < Math.max(qIdx.length, fIdx.length); k += 20) {
          const r = await gemini({ apiKey: S.settings.apiKey, model: S.settings.model, prompt: promptVariants(ch, qIdx.slice(k, k + 20), fIdx.slice(k, k + 20)) });
          n += applyVariants(ch, r);
        }
      }, "L'IA reformule tes questions et équilibre les réponses…");
      commit();
      Alert.alert('🔀 C\'est fait', `${n} questions ont maintenant plusieurs formulations, et les choix des QCM ont la même longueur.`);
    } catch (e) { Alert.alert('Oups', e.message); }
  };
  const Tab = { cours: TCours, fiches: TFiches, quiz: TPractice, vf: TPractice, ordre: TOrdre, exos: TExos, redac: TRedac, bilan: TBilan }[cur];
  const size = items(ch, true).length + p.exercices.length;
  const mast = mastery(ch);
  return (
    <View>
      {isArchived(ch) && (
        <View style={{ backgroundColor: C.warnSoft, borderRadius: 16, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt style={{ flex: 1 }}>🗄️ Archivé : n'apparaît plus dans tes sessions.</Txt>
          <Btn small label="Désarchiver" onPress={() => { ch.archived = false; commit(); reschedule(S); }} />
        </View>
      )}
      <Card style={{ paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip color={m.couleur}>{m.nom}</Chip>
          <DsBadge info={dsInfo(ch.ds)} />
          {ch.ds ? <Text style={{ color: C.muted, fontSize: 13 }}>{fmtDate(ch.ds)}{ch.dsTime ? ' · ' + ch.dsTime.replace(':', 'h') : ''}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <View style={{ flex: 1 }}><Progress value={mast} color={m.couleur} height={10} /></View>
          <Text style={{ color: C.ink, fontWeight: '900' }}>{mast} %</Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 12 }}>maîtrisé</Text>
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <IconBtn icon="📷" label="Notes" onPress={() => setModal(<AddNotesForm id={id} />)} />
          <IconBtn icon="✨" label="Questions" onPress={() => more('q')} />
          <IconBtn icon="🔀" label="Varier" onPress={vary} />
          <IconBtn icon="📤" label="Partager" onPress={() => setModal(<ShareChoice ch={ch} />)} />
          <IconBtn icon="⚙️" label="Réglages" onPress={() => setModal(<ChSettings id={id} />)} />
        </View>
      </Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
        {tabs.map(([k, l]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 99, backgroundColor: k === cur ? C.pri : C.card, borderWidth: k === cur ? 0 : 1, borderColor: C.line }}>
            <Text style={{ color: k === cur ? '#fff' : C.ink, fontSize: 14, fontWeight: k === cur ? '800' : '600' }}>{l}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Tab key={cur + size} ch={ch} kind={cur === 'quiz' ? 'q' : 'f'} onMore={() => more('ex')} />
    </View>
  );
}

/* ================= Réglages ================= */
export function Settings() {
  const { C, setModal } = useApp();
  const st = S.settings;
  const [key, setKey] = useState(st.apiKey);
  const [show, setShow] = useState(false);
  const [model, setModel] = useState(st.model);
  const [time, setTime] = useState(st.notifTime);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const saveAI = () => { st.apiKey = key.trim(); st.model = model.trim() || DEFAULT_MODEL; commit(); setMsg('Enregistré ✅'); };
  const toggle = async (v) => {
    if (v && !(await askPermission())) { Alert.alert('Notifications bloquées', "Autorise les notifications pour l'appli dans les réglages du téléphone."); return; }
    st.notifOn = v; commit(); reschedule(S);
  };
  const saveTime = () => {
    const mm = time.trim().match(/^(\d{1,2})[:hH](\d{2})?$/);
    if (!mm || +mm[1] > 23 || +(mm[2] || 0) > 59) return setErr("Écris l'heure comme 18:30.");
    st.notifTime = String(+mm[1]).padStart(2, '0') + ':' + (mm[2] || '00'); setTime(st.notifTime); setErr(''); commit(); reschedule(S); setMsg('Heure enregistrée ✅');
  };
  const checkUpdate = async () => {
    try {
      if (!Updates.isEnabled) return setMsg("Les mises à jour ne marchent que dans l'APK installée.");
      setMsg('Recherche…');
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) return setMsg('Tu as déjà la dernière version ✅');
      await Updates.fetchUpdateAsync(); await Updates.reloadAsync();
    } catch (e) { setMsg('Impossible de vérifier (pas internet ?).'); }
  };
  return (
    <View>
      <Card>
        <H2>🏫 Pronote</H2>
        {S.pronote ? (
          <View>
            <Txt>Connecté : {S.pronote.name}{S.pronote.className ? ' · ' + S.pronote.className : ''}</Txt>
            {S.pronote.school ? <Txt muted>{S.pronote.school}</Txt> : null}
            <Btn kind="ghost" small label="Se déconnecter" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => Alert.alert('Se déconnecter de Pronote ?', '', [{ text: 'Annuler', style: 'cancel' }, { text: 'Oui', onPress: logoutPronote }])} />
          </View>
        ) : (
          <View>
            <Txt muted>Pour voir ton emploi du temps et tes notes, et repérer tes DS automatiquement.</Txt>
            <Btn small label="🔗 Connecter Pronote (QR code)" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => setModal(<QrLogin />)} />
          </View>
        )}
      </Card>
      <Card>
        <H2>🤖 Intelligence artificielle</H2>
        <Txt muted>L'IA lit tes photos et crée les questions. Elle a besoin d'internet et d'une clé Gemini. Ta clé reste sur ton téléphone : elle n'est jamais envoyée quand tu partages un chapitre.</Txt>
        <Btn kind="sec" small label="Obtenir une clé (aistudio.google.com)" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => Linking.openURL('https://aistudio.google.com/apikey')} />
        <Label>Clé API Gemini</Label>
        <Row style={{ flexWrap: 'nowrap' }}>
          <Input style={{ flex: 1 }} value={key} onChangeText={(t) => { setKey(t); setMsg(''); }} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} placeholder="AIza…" />
          <Btn small kind="ghost" label={show ? '🙈' : '👁️'} onPress={() => setShow(!show)} />
        </Row>
        <Label>Modèle (change-le seulement si l'IA dit « modèle introuvable »)</Label>
        <Input value={model} onChangeText={(t) => { setModel(t); setMsg(''); }} autoCapitalize="none" autoCorrect={false} />
        <Btn label="Enregistrer" style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={saveAI} />
      </Card>
      <Card>
        <H2>🔔 Rappels</H2>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <Txt style={{ flex: 1 }}>Me rappeler de réviser chaque jour</Txt>
          <Switch value={!!st.notifOn} onValueChange={toggle} />
        </Row>
        <Label>Heure du rappel</Label>
        <Row style={{ flexWrap: 'nowrap' }}>
          <Input style={{ flex: 1 }} value={time} onChangeText={(t) => { setTime(t); setErr(''); }} placeholder="18:00" keyboardType="numbers-and-punctuation" />
          <Btn small label="OK" onPress={saveTime} />
        </Row>
        <Err>{err}</Err>
        <Txt muted style={{ marginTop: 8 }}>Le rappel saute les jours où ta session est déjà faite, et te prévient quand un DS approche.</Txt>
        <Btn kind="sec" small label="Tester une notification (5 s)" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={async () => { if (await askPermission()) { await testNotification(); setMsg('Notification dans 5 secondes…'); } }} />
      </Card>
      {msg ? <Txt style={{ color: C.ok, marginBottom: 10 }}>{msg}</Txt> : null}
      <Card>
        <H2>📲 Appli</H2>
        <Txt muted>Les mises à jour s'installent toutes seules au démarrage (il faut parfois ouvrir l'appli deux fois).</Txt>
        <Btn kind="sec" small label="Rechercher une mise à jour" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={checkUpdate} />
        <Txt muted style={{ marginTop: 12 }}>📴 Tout est enregistré sur ton téléphone : tu peux réviser sans internet. Seules la création de chapitres, les nouvelles questions, « Explique-moi autrement », la correction des rédactions et Pronote ont besoin d'internet.</Txt>
        <Btn kind="sec" small label="Charger les 2 chapitres d'exemple" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={loadExamples} />
      </Card>
    </View>
  );
}
