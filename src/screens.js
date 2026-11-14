// Écrans principaux : accueil, session, chapitre, réglages.
import React, { useState } from 'react';
import { View, Text, Pressable, Alert, Switch, Linking, ScrollView } from 'react-native';
import * as Updates from 'expo-updates';
import { useApp, Card, H2, Txt, Btn, Row, Chip, Dot, DsBadge, Progress, Label, Input, Err } from './ui';
import { today, addDays, diffDays, fmtDate, dayLetter, isArchived, items, mastery, grade, buildSession, randomItems, errorItems, dsInfo, normPack, mergePack, promptMore } from './logic';
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
      <Card>
        <H2>Aujourd'hui</H2>
        {!chs.length ? <Txt muted>Crée ton premier chapitre pour avoir des questions chaque jour.</Txt>
          : !sess.length ? <Txt>✅ Rien à revoir aujourd'hui, tout est à jour. Tu peux t'entraîner dans l'onglet 🧠.</Txt>
          : (
            <View>
              <Txt>{done ? '✅ Session du jour faite. Tu peux en refaire une en bonus.' : `${sess.length} questions t'attendent (environ ${Math.max(3, Math.round(sess.length * 0.4))} min).`}</Txt>
              <Row style={{ marginVertical: 10 }}>{Object.entries(by).map(([n, o]) => <Chip key={n} color={o.c}>{n} · {o.n}</Chip>)}</Row>
              <Btn label={done ? 'Session bonus' : 'Commencer ma session'} onPress={() => setModal(<SessionSetup />)} />
            </View>
          )}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
          {week.map((d) => (
            <View key={d} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ height: 24, alignSelf: 'stretch', borderRadius: 7, backgroundColor: P.hist && P.hist[d] ? C.ok : C.line }} />
              <Text style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{dayLetter(d)}</Text>
            </View>
          ))}
        </View>
        <Txt muted style={{ marginTop: 8 }}>🔥 Série : {P.streak || 0} jour{(P.streak || 0) > 1 ? 's' : ''} d'affilée</Txt>
      </Card>

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
    return { list, i: 0, ok: 0, again: {} };
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
    return (
      <Card style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: C.ink }}>🎉 Terminé</Text>
        <Txt center style={{ marginVertical: 8 }}>{st.ok} bonnes réponses sur {st.list.length} essais ({p} %)</Txt>
        <Text style={{ fontSize: 34, fontWeight: '800', color: C.ink }}>🔥 {S.profil.streak}</Text>
        <Txt muted center>jour{S.profil.streak > 1 ? 's' : ''} d'affilée. Reviens demain pour garder ta série.</Txt>
        <Txt muted center style={{ marginVertical: 8 }}>Les questions ratées reviendront demain, celles que tu sais reviendront plus tard.</Txt>
        <Btn label="Retour à l'accueil" onPress={() => go({ name: 'home' })} />
      </Card>
    );
  }
  const it = st.list[st.i]; const m = matOf(it.ch);
  const next = () => { if (st.i + 1 >= st.list.length) finish(); else setSt({ ...st, i: st.i + 1 }); };
  return (
    <View>
      <Progress value={(st.i / st.list.length) * 100} />
      <Row style={{ marginBottom: 8 }}><Txt muted>{st.i + 1} / {st.list.length}</Txt><Chip color={m.couleur}>{m.nom}</Chip><Txt muted>{it.ch.titre}</Txt></Row>
      <Card>
        <Item key={st.i} it={it}
          onGrade={(ok) => {
            grade(it.ch, it.id, ok); commit();
            if (ok) st.ok++; else if (!st.again[it.id]) { st.again[it.id] = 1; st.list.push(it); }
          }}
          onNext={next}
          onSkip={() => { skipItem(it.ch, it.id); st.list = st.list.filter((x, k) => k <= st.i || x.id !== it.id || x.ch !== it.ch); next(); }} />
      </Card>
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
  const Tab = { cours: TCours, fiches: TFiches, quiz: TPractice, vf: TPractice, ordre: TOrdre, exos: TExos, redac: TRedac, bilan: TBilan }[cur];
  const size = items(ch, true).length + p.exercices.length;
  return (
    <View>
      {isArchived(ch) && (
        <View style={{ backgroundColor: C.warnSoft, borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt style={{ flex: 1 }}>🗄️ Chapitre archivé : il n'apparaît plus dans tes sessions.</Txt>
          <Btn small label="Désarchiver" onPress={() => { ch.archived = false; commit(); reschedule(S); }} />
        </View>
      )}
      <Row style={{ marginBottom: 10 }}>
        <Chip color={m.couleur}>{m.nom}</Chip>
        {ch.ds ? <Chip>📅 {fmtDate(ch.ds)}{ch.dsTime ? ' à ' + ch.dsTime.replace(':', 'h') : ''}</Chip> : null}
        <DsBadge info={dsInfo(ch.ds)} />
        <Chip>Maîtrise {mastery(ch)} %</Chip>
      </Row>
      <Row style={{ marginBottom: 12 }}>
        <Btn small kind="sec" label="📷 Notes" onPress={() => setModal(<AddNotesForm id={id} />)} />
        <Btn small kind="sec" label="✨ + Questions" onPress={() => more('q')} />
        <Btn small kind="sec" label="📤 Partager" onPress={() => setModal(<ShareChoice ch={ch} />)} />
        <Btn small kind="ghost" label="⚙️" onPress={() => setModal(<ChSettings id={id} />)} />
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
        {tabs.map(([k, l]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 99, borderWidth: 1, borderColor: k === cur ? C.pri : C.line, backgroundColor: k === cur ? C.pri : C.card }}>
            <Text style={{ color: k === cur ? '#fff' : C.ink, fontSize: 14 }}>{l}</Text>
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
