// Écrans principaux : accueil, session, chapitre, réglages.
import React, { useState } from 'react';
import { View, Text, Pressable, Alert, Switch, Linking, ScrollView } from 'react-native';
import * as Updates from 'expo-updates';
import { useApp, Card, H2, Txt, Btn, Row, Chip, Dot, DsBadge, Progress, Label, Input, Err, IconBtn, FadeIn, Pop, toast, ACCENTS, makeTheme } from './ui';
import { planFor, today, addDays, diffDays, fmtDate, longDate, dayLetter, isArchived, items, mastery, grade, buildSession, randomItems, errorItems, dsInfo, normPack, mergePack, promptMore, promptVariants, applyVariants } from './logic';
import { gemini, DEFAULT_MODEL } from './ai';
import { askPermission, reschedule, testNotification } from './notifs';
import { Item, skipItem, TCours, TFiches, TPractice, TOrdre, TExos, TRedac, TBilan } from './tabs';
import { S, commit, matOf, activeChs } from './store';
import { MatiereForm, ChapitreForm, AddNotesForm, ChSettings, loadExamples } from './forms';
import { ImportForm, ShareChoice, exportBackup, importBackup } from './share';
import { DsDetected, QrLogin, logoutPronote, firstName, NextLesson } from './school';
import { tipOfDay } from './tools';
import { levelInfo, levelTitle, sessionDone } from './progress';

/* ================= Accueil ================= */
export function Home() {
  const { C, go, setModal } = useApp();
  const [openArch, setOpenArch] = useState({});
  const [openMat, setOpenMat] = useState({});
  const P = S.profil, t = today(), all = Object.values(S.chs), chs = activeChs();
  if (!P.matieres.length) {
    return (
      <View>
        <FadeIn>
          <View style={{ backgroundColor: C.pri, borderRadius: 26, padding: 22, marginBottom: 14 }}>
            <Text style={{ fontSize: 44 }}>👋</Text>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 6, letterSpacing: -0.6 }}>Bienvenue sur Révisio</Text>
            <Text style={{ color: '#fff', opacity: 0.9, fontSize: 15, marginTop: 8, lineHeight: 22 }}>Prends tes cours en photo : l'IA en fait des fiches, des quiz et des exercices. Chaque jour, une petite session t'attend, avec plus de questions quand un DS approche.</Text>
          </View>
        </FadeIn>
        <FadeIn delay={80}>
          <View style={{ gap: 10 }}>
            {!S.pronote && <Btn label="🏫 Connecter Pronote (matières auto)" onPress={() => setModal(<QrLogin />)} />}
            <Btn kind={S.pronote ? 'pri' : 'sec'} label="＋ Ajouter une matière à la main" onPress={() => setModal(<MatiereForm />)} />
            <Btn kind="sec" label="📥 Importer les chapitres d'un pote" onPress={() => setModal(<ImportForm />)} />
            <Btn kind="ghost" label="Essayer avec 2 chapitres d'exemple" onPress={loadExamples} />
          </View>
        </FadeIn>
        {!S.settings.apiKey && <Txt muted center style={{ marginTop: 16 }}>Pour que l'IA lise tes photos, ajoute ta clé Gemini gratuite dans ⚙️ Réglages.</Txt>}
      </View>
    );
  }
  const sess = buildSession(chs, S.settings.goal); const done = P.lastDay === t; const by = {};
  sess.forEach((i) => { const m = matOf(i.ch); by[m.nom] = by[m.nom] || { n: 0, c: m.couleur }; by[m.nom].n++; });
  const up = chs.filter((c) => c.ds && diffDays(t, c.ds) >= 0).sort((a, b) => (a.ds < b.ds ? -1 : 1));
  const week = [...Array(7)].map((_, i) => addDays(t, i - 6));
  const tip = tipOfDay();
  const name = S.profil.prenom || firstName(S.pronote && S.pronote.name);
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Encore debout' : hour < 12 ? 'Salut' : hour < 18 ? 'Hello' : 'Bonsoir';
  return (
    <View>
      <View style={{ marginBottom: 12, marginTop: 2 }}>
        <Text style={{ color: C.ink, fontSize: 26, fontWeight: '900', letterSpacing: -0.6 }}>{hello}{name ? ' ' + name : ''} 👋</Text>
        <Text style={{ color: C.muted, fontSize: 14, fontWeight: '600', marginTop: 2 }}>{longDate()}</Text>
      </View>
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

      <GettingStarted />
      <NextLesson />
      <LevelRow />

      <DsDetected />

      {up.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={{ color: C.ink, fontSize: 19, fontWeight: '900', marginBottom: 10, marginLeft: 2 }}>📅 Prochains DS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 6 }}>
            {up.map((c) => { const m = matOf(c); const d = diffDays(t, c.ds); const mast = mastery(c); return (
              <Pressable key={c.id} onPress={() => go({ name: 'ch', id: c.id, tab: 'cours' })} style={({ pressed }) => ({ width: 170, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 14, borderWidth: d <= 3 ? 2 : C.dark ? 1 : 0, borderColor: d <= 3 ? C.bad : C.line, minHeight: 150 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Dot color={m.couleur} /><Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>{m.nom}</Text></View>
                  <Text style={{ color: d <= 3 ? C.bad : C.ink, fontSize: 30, fontWeight: '900', marginTop: 6 }}>{d === 0 ? "Aujourd'hui" : d === 1 ? 'Demain' : 'J-' + d}</Text>
                  <Text style={{ color: C.ink, fontWeight: '700', marginTop: 2 }} numberOfLines={2}>{c.titre}</Text>
                  <View style={{ flex: 1 }} />
                  <Progress value={mast} color={m.couleur} height={6} />
                  <Text style={{ color: C.muted, fontSize: 11 }}>maîtrisé à {mast} %</Text>
                </View>
              </Pressable>
            ); })}
          </ScrollView>
        </View>
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

// Plan jour par jour jusqu'au DS (affiché dans le chapitre)
function PlanCard({ ch }) {
  const { C } = useApp();
  const [open, setOpen] = useState(false);
  const plan = planFor(ch);
  if (!plan.length) return null;
  const t = today();
  ch.plan = ch.plan || {};
  const cur = plan.find((p) => p.date === t) || plan.find((p) => p.date > t) || plan[plan.length - 1];
  const done = plan.filter((p) => ch.plan[p.date]).length;
  const Line = ({ p }) => {
    const ok = !!ch.plan[p.date], isToday = p.date === t, past = p.date < t;
    return (
      <Pressable onPress={() => { ch.plan[p.date] = !ok; commit(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, opacity: past && !ok ? 0.5 : 1 }}>
        <View style={{ width: 26, height: 26, borderRadius: 9, borderWidth: 2, borderColor: ok ? C.ok : C.line, backgroundColor: ok ? C.ok : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {ok ? <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: isToday ? C.pri : C.muted, fontWeight: '800', fontSize: 12 }}>{isToday ? "AUJOURD'HUI" : p.d === 0 ? 'JOUR DU DS' : 'J-' + p.d + ' · ' + fmtDate(p.date).toUpperCase()}</Text>
          <Text style={{ color: C.ink, textDecorationLine: ok ? 'line-through' : 'none' }}>{p.icon} {p.text}</Text>
        </View>
      </Pressable>
    );
  };
  return (
    <Card>
      <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: C.ink, fontWeight: '900', fontSize: 17 }}>🗓️ Mon plan avant le DS</Text>
        <Text style={{ color: C.muted, fontWeight: '700' }}>{done}/{plan.length} {open ? '▲' : '▼'}</Text>
      </Pressable>
      {open ? plan.map((p) => <Line key={p.date} p={p} />) : <Line p={cur} />}
    </Card>
  );
}

// Premiers pas : une petite liste à cocher tant que tout n'est pas prêt
function GettingStarted() {
  const { C, go, setModal } = useApp();
  if (S.profil.onboarded) return null;
  const steps = [
    ['👋', 'Dis-moi ton prénom', !!(S.profil.prenom || (S.pronote && S.pronote.name)), () => go({ name: 'settings', back: 'home' })],
    ['🏫', 'Connecte Pronote (matières auto)', !!S.pronote, () => setModal(<QrLogin />)],
    ['🤖', 'Ajoute ta clé IA gratuite', !!S.settings.apiKey, () => go({ name: 'settings', back: 'home' })],
    ['📷', 'Crée ton premier chapitre', Object.keys(S.chs).length > 0, () => setModal(<ChapitreForm />)],
    ['🎯', 'Fais ta première session', ((S.profil.stats || {}).sessions || 0) > 0, () => setModal(<SessionSetup />)],
  ];
  const n = steps.filter((x) => x[2]).length;
  if (n === steps.length) { S.profil.onboarded = true; return null; }
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: C.ink, fontWeight: '900', fontSize: 17 }}>🚀 Bien démarrer · {n}/{steps.length}</Text>
        <Pressable onPress={() => { S.profil.onboarded = true; commit(); }} hitSlop={10}><Text style={{ color: C.muted, fontSize: 13 }}>Masquer</Text></Pressable>
      </View>
      <Progress value={(n / steps.length) * 100} height={8} />
      {steps.map(([icon, label, ok, act]) => (
        <Pressable key={label} onPress={ok ? undefined : act} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
          <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: ok ? C.ok : C.priSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '900' }}>{ok ? '✓' : ''}</Text>{!ok ? <Text style={{ position: 'absolute', fontSize: 15 }}>{icon}</Text> : null}
          </View>
          <Text style={{ flex: 1, color: ok ? C.muted : C.ink, fontWeight: ok ? '500' : '700', textDecorationLine: ok ? 'line-through' : 'none' }}>{label}</Text>
          {!ok && <Text style={{ color: C.muted, fontSize: 20 }}>›</Text>}
        </Pressable>
      ))}
    </Card>
  );
}

// Niveau et XP, touche pour voir « Mes progrès »
function LevelRow() {
  const { C, go } = useApp();
  const L = levelInfo();
  const got = Object.keys(S.profil.badges || {}).length;
  return (
    <Pressable onPress={() => go({ name: 'progres', back: 'home' })}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
        <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: C.priSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.priInk, fontWeight: '900', fontSize: 18 }}>{L.lvl}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.ink, fontWeight: '800' }}>Niveau {L.lvl} · {levelTitle(L.lvl)}</Text>
          <Progress value={L.pct} height={8} />
          <Text style={{ color: C.muted, fontSize: 12 }}>{L.need - L.into} XP avant le niveau {L.lvl + 1} · 🏅 {got} badge{got > 1 ? 's' : ''}</Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 22 }}>›</Text>
      </Card>
    </Pressable>
  );
}

/* ================= Choix avant la session ================= */
function SessionSetup() {
  const { setModal, go } = useApp();
  const [mats, setMats] = useState([]);
  const chs = activeChs().filter((c) => !mats.length || mats.includes(c.matiereId));
  const n = buildSession(chs, S.settings.goal).length;
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
export function Session({ mode, mats, chId }) {
  const { go, C } = useApp();
  const [st, setSt] = useState(() => {
    const chs = mode === 'chapitre' ? [S.chs[chId]].filter(Boolean) : activeChs().filter((c) => !mats || !mats.length || mats.includes(c.matiereId));
    const list = mode === 'chapitre' ? (buildSession(chs, S.settings.goal || 15).length ? buildSession(chs, S.settings.goal || 15) : randomItems(chs, S.settings.goal || 15)) : mode === 'rapide' ? randomItems(chs, 20) : mode === 'erreurs' ? errorItems(chs).slice(0, 20) : buildSession(chs, S.settings.goal);
    return { list, i: 0, ok: 0, again: {}, combo: 0, best: 0 };
  });
  const [ended, setEnded] = useState(false);
  if (!st.list.length) return <Card><Txt>Rien à revoir pour l'instant 🎉</Txt><Btn label="Retour" style={{ marginTop: 10 }} onPress={() => go({ name: 'home' })} /></Card>;
  const finish = () => {
    const P = S.profil, t = today(); P.hist = P.hist || {};
    if (P.lastDay !== t) { P.streak = P.lastDay === addDays(t, -1) ? (P.streak || 0) + 1 : 1; P.lastDay = t; }
    P.hist[t] = (P.hist[t] || 0) + st.list.length;
    Object.keys(P.hist).forEach((d) => { if (diffDays(d, t) > 60) delete P.hist[d]; });
    sessionDone(st.list.length, st.ok);
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
  const { C, setModal, runAI, go } = useApp();
  const ch = S.chs[id], m = matOf(ch), p = ch.pack;
  const tabs = TABS.filter(([k]) => (k === 'ordre' ? p.ordres.length : k === 'redac' ? p.ouvertes.length : k === 'vf' ? p.vf.length : k === 'fiches' ? p.vocab.length : k === 'quiz' ? p.qcm.length : true));
  const cur = tabs.some((t) => t[0] === tab) ? tab : 'cours';
  const more = async (kind) => {
    if (!S.settings.apiKey) return toast("Ajoute d'abord ta clé Gemini dans ⚙️ Réglages.", 'bad');
    try {
      const add = normPack(await runAI(kind === 'ex' ? 'Nouveaux exercices' : 'Nouvelles questions', () => gemini({ apiKey: S.settings.apiKey, model: S.settings.model, prompt: promptMore(ch, m.nom, kind) })));
      const n = add.qcm.length + add.vf.length + add.exercices.length;
      if (!n) throw new Error("L'IA n'a pas renvoyé de questions. Réessaie.");
      ch.pack = mergePack(ch.pack, { qcm: add.qcm, vf: add.vf, exercices: add.exercices }); commit();
      toast(`✨ ${n} nouvelles questions ajoutées`);
    } catch (e) { toast(e.message, 'bad'); }
  };
  const vary = async () => {
    if (!S.settings.apiKey) return toast("Ajoute d'abord ta clé Gemini dans ⚙️ Réglages.", 'bad');
    const qIdx = p.qcm.map((_, i) => i), fIdx = p.vf.map((_, i) => i);
    if (!qIdx.length && !fIdx.length) return toast("Ce chapitre n'a pas encore de questions.", 'info');
    try {
      let n = 0;
      await runAI('Nouvelles formulations', async () => {
        for (let k = 0; k < Math.max(qIdx.length, fIdx.length); k += 20) {
          const r = await gemini({ apiKey: S.settings.apiKey, model: S.settings.model, prompt: promptVariants(ch, qIdx.slice(k, k + 20), fIdx.slice(k, k + 20)) });
          n += applyVariants(ch, r);
        }
      }, "L'IA reformule tes questions et équilibre les réponses…");
      commit();
      toast(`🔀 ${n} questions reformulées, choix équilibrés`);
    } catch (e) { toast(e.message, 'bad'); }
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
        {items(ch).length > 0 && <Btn label="🎯 Réviser ce chapitre" style={{ marginTop: 14 }} onPress={() => go({ name: 'session', mode: 'chapitre', chId: id, back: { name: 'ch', id, tab: cur } })} />}
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <IconBtn icon="📷" label="Notes" onPress={() => setModal(<AddNotesForm id={id} />)} />
          <IconBtn icon="✨" label="Questions" onPress={() => more('q')} />
          <IconBtn icon="🔀" label="Varier" onPress={vary} />
          <IconBtn icon="📤" label="Partager" onPress={() => setModal(<ShareChoice ch={ch} />)} />
          <IconBtn icon="⚙️" label="Réglages" onPress={() => setModal(<ChSettings id={id} />)} />
        </View>
      </Card>
      {!isArchived(ch) && <PlanCard ch={ch} />}
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
// Petit sélecteur en « pastilles »
function Seg({ options, value, onChange }) {
  const { C } = useApp();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.bg, borderRadius: 14, padding: 4, gap: 4 }}>
      {options.map(([v, l]) => (
        <Pressable key={String(v)} onPress={() => onChange(v)} style={{ flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center', backgroundColor: value === v ? C.card : 'transparent',
          shadowColor: '#000', shadowOpacity: value === v && !C.dark ? 0.08 : 0, shadowRadius: 4, elevation: value === v && !C.dark ? 1 : 0 }}>
          <Text style={{ color: value === v ? C.ink : C.muted, fontWeight: value === v ? '800' : '600', fontSize: 14 }}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Settings() {
  const { C, setModal } = useApp();
  const st = S.settings;
  const [key, setKey] = useState(st.apiKey);
  const [show, setShow] = useState(false);
  const [model, setModel] = useState(st.model);
  const [time, setTime] = useState(st.notifTime);
  const [prenom, setPrenom] = useState(S.profil.prenom || '');
  const [err, setErr] = useState('');
  const set = (k, v) => { st[k] = v; commit(); };
  const saveAI = () => { st.apiKey = key.trim(); st.model = model.trim() || DEFAULT_MODEL; commit(); toast('Clé enregistrée ✅'); };
  const toggle = async (v) => {
    if (v && !(await askPermission())) { toast("Autorise les notifications pour l'appli dans les réglages du téléphone.", 'bad'); return; }
    st.notifOn = v; commit(); reschedule(S);
  };
  const saveTime = () => {
    const mm = time.trim().match(/^(\d{1,2})[:hH](\d{2})?$/);
    if (!mm || +mm[1] > 23 || +(mm[2] || 0) > 59) return setErr("Écris l'heure comme 18:30.");
    st.notifTime = String(+mm[1]).padStart(2, '0') + ':' + (mm[2] || '00'); setTime(st.notifTime); setErr(''); commit(); reschedule(S); toast('Rappel à ' + st.notifTime.replace(':', 'h') + ' ✅');
  };
  const checkUpdate = async () => {
    try {
      if (!Updates.isEnabled) return toast("Les mises à jour ne marchent que dans l'APK installée.", 'info');
      toast('Recherche…', 'info');
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) return toast('Tu as déjà la dernière version ✅');
      await Updates.fetchUpdateAsync(); await Updates.reloadAsync();
    } catch (e) { toast('Impossible de vérifier (pas internet ?)', 'bad'); }
  };
  const Section = ({ children }) => <Text style={{ color: C.muted, fontWeight: '800', fontSize: 13, letterSpacing: 0.5, marginTop: 8, marginBottom: 8, marginLeft: 4 }}>{children}</Text>;
  return (
    <View>
      <Section>TOI</Section>
      <Card>
        <Label>Ton prénom</Label>
        <Input value={prenom} onChangeText={setPrenom} onBlur={() => { S.profil.prenom = prenom.trim(); commit(); }} placeholder={firstName(S.pronote && S.pronote.name) || 'Ton prénom'} />
        <Label>Objectif par jour</Label>
        <Seg options={[[10, '10'], [15, '15'], [20, '20'], [30, '30']]} value={st.goal || 15} onChange={(v) => { set('goal', v); toast(`Objectif : ${v} questions par jour 🎯`); }} />
        <Txt muted style={{ marginTop: 8 }}>Questions dans ta session du jour (+5 quand un DS est dans 3 jours ou moins).</Txt>
      </Card>

      <Section>APPARENCE</Section>
      <Card>
        <Label>Thème</Label>
        <Seg options={[['auto', 'Auto'], ['light', '☀️ Clair'], ['dark', '🌙 Sombre']]} value={st.theme || 'auto'} onChange={(v) => set('theme', v)} />
        <Label>Couleur</Label>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {ACCENTS.map(([name, hex]) => {
            const on = (st.accent || 'indigo') === name;
            return (
              <Pressable key={name} onPress={() => set('accent', name)} accessibilityLabel={'Couleur ' + name}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: makeTheme(C.dark, name).pri, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 3 : 0, borderColor: C.ink }}>
                {on ? <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Section>ÉCOLE</Section>
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
            <Txt muted>Emploi du temps, notes, matières et DS repérés automatiquement.</Txt>
            <Btn small label="🔗 Connecter Pronote (QR code)" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => setModal(<QrLogin />)} />
          </View>
        )}
      </Card>

      <Section>INTELLIGENCE ARTIFICIELLE</Section>
      <Card>
        <Txt muted>L'IA lit tes photos et crée les questions. Elle a besoin d'internet et d'une clé Gemini. Ta clé reste sur ton téléphone : elle n'est jamais partagée.</Txt>
        <Btn kind="sec" small label="Obtenir une clé (aistudio.google.com)" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => Linking.openURL('https://aistudio.google.com/apikey')} />
        <Label>Clé API Gemini {st.apiKey ? '✅' : ''}</Label>
        <Row style={{ flexWrap: 'nowrap' }}>
          <Input style={{ flex: 1 }} value={key} onChangeText={setKey} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} placeholder="AIza…" />
          <Btn small kind="ghost" label={show ? '🙈' : '👁️'} onPress={() => setShow(!show)} />
        </Row>
        <Label>Modèle</Label>
        <Input value={model} onChangeText={setModel} autoCapitalize="none" autoCorrect={false} />
        <Txt muted style={{ marginTop: 6, fontSize: 12 }}>Change-le seulement si l'IA dit « modèle introuvable ».</Txt>
        <Btn label="Enregistrer" style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={saveAI} />
      </Card>

      <Section>RAPPELS</Section>
      <Card>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <Txt style={{ flex: 1 }}>Me rappeler de réviser chaque jour</Txt>
          <Switch value={!!st.notifOn} onValueChange={toggle} trackColor={{ true: C.pri }} />
        </Row>
        <Label>Heure du rappel</Label>
        <Row style={{ flexWrap: 'nowrap' }}>
          <Input style={{ flex: 1 }} value={time} onChangeText={(t) => { setTime(t); setErr(''); }} placeholder="18:00" keyboardType="numbers-and-punctuation" />
          <Btn small label="OK" onPress={saveTime} />
        </Row>
        <Err>{err}</Err>
        <Txt muted style={{ marginTop: 8 }}>Le rappel saute les jours où ta session est faite, et te prévient quand un DS approche.</Txt>
        <Btn kind="sec" small label="Tester (notification dans 5 s)" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={async () => { if (await askPermission()) { await testNotification(); toast('Notification dans 5 secondes…', 'info'); } }} />
      </Card>

      <Section>SAUVEGARDE</Section>
      <Card>
        <Txt muted>Garde une copie de tes chapitres et de ta progression (Drive, Discord, e-mail…). Utile si tu changes de téléphone ou réinstalles l'appli.{st.lastBackup ? ` Dernière sauvegarde : ${fmtDate(st.lastBackup.slice(0, 10))}.` : ''}</Txt>
        <Row style={{ marginTop: 10 }}>
          <Btn small label="💾 Sauvegarder" onPress={exportBackup} />
          <Btn small kind="sec" label="♻️ Restaurer" onPress={importBackup} />
        </Row>
      </Card>

      <Section>APPLI</Section>
      <Card>
        <Txt muted>Les mises à jour s'installent toutes seules au démarrage (il faut parfois ouvrir l'appli deux fois).</Txt>
        <Btn kind="sec" small label="Rechercher une mise à jour" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={checkUpdate} />
        <Txt muted style={{ marginTop: 12 }}>📴 Tout marche sans internet, sauf l'IA (création, nouvelles questions, explications, corrections) et Pronote.</Txt>
        <Btn kind="ghost" small label="Charger les 2 chapitres d'exemple" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={loadExamples} />
      </Card>
      <Txt muted center style={{ marginTop: 6, fontSize: 12 }}>Révisio · fait avec Claude</Txt>
    </View>
  );
}
