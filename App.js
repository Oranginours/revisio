// Mes révisions : structure de l'appli (en-tête, onglets du bas, fenêtres).
import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, Modal, BackHandler, AppState, ActivityIndicator, Platform, StatusBar as RNStatusBar, useColorScheme, KeyboardAvoidingView, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ctx, makeTheme, Btn, Chip, ToastHost, pull, isWeb } from './src/ui';
import { S, load, commit, persistNow, setRefresher } from './src/store';
import { reschedule } from './src/notifs';
import { checkClipboard } from './src/share';
import { silentRefresh, Edt, Notes } from './src/school';
import { Home, Session, sessionTitle, Chapter, Settings } from './src/screens';
import { Train, Tool, TOOL_TITLES } from './src/tools';
import './src/progress';
import { Progres } from './src/progres-screen';
import { Search } from './src/search';
import { Devoirs, todoCount, fetchHomework } from './src/devoirs';

// Dans le navigateur, pas de Pronote : on cache l'emploi du temps et les notes
const NAV = [['home', '🏠', 'Accueil'], ['edt', '📅', 'EDT'], ['devoirs', '📝', 'Devoirs'], ['notes', '📊', 'Notes'], ['train', '🧠', "S'entraîner"]].filter((n) => !isWeb || (n[0] !== 'edt' && n[0] !== 'notes'));
const TOP = NAV.map((n) => n[0]);
const addDaysStr = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

export default function App() {
  const scheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const [pulling, setPulling] = useState(false);
  const themePref = S.settings.theme || 'auto';
  const C = makeTheme(themePref === 'dark' || (themePref !== 'light' && scheme === 'dark'), S.settings.accent);
  const topPad = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : isWeb ? 8 : 50;
  const [, setTick] = useState(0);
  const [view, setView] = useState({ name: 'home' });
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(null);

  const go = (v) => setView(v);
  useEffect(() => {
    setRefresher(() => setTick((t) => t + 1));
    (async () => {
      await load();
      setReady(true);
      reschedule(S);
      if (!isWeb) { silentRefresh().then(() => fetchHomework()).catch(() => {}); setTimeout(() => checkClipboard(go), 800); }
    })();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') { if (!isWeb) checkClipboard(go); }
      else { persistNow(); reschedule(S); }
    });
    return () => sub.remove();
  }, []);

  const back = () => { const b = view.back; setView(b && typeof b === 'object' ? b : { name: b || 'home' }); };
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) return true;
      if (modal) { setModal(null); return true; }
      if (view.name !== 'home') { back(); return true; }
      return false;
    });
    return () => h.remove();
  }, [view, modal, busy]);

  const runAI = async (title, fn, sub) => {
    setBusy({ title, sub });
    try { return await fn(); } finally { setBusy(null); }
  };
  const ctx = { C, S, commit, go, back, matOf: (ch) => S.profil.matieres.find((m) => m.id === ch.matiereId) || { nom: '?', couleur: '#888' }, setModal, runAI, view };

  if (!ready) return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.pri} size="large" /></View>;

  let v = view;
  if (v.name === 'ch' && !S.chs[v.id]) v = { name: 'home' };
  let title = null, screen = null;
  if (v.name === 'home') screen = <Home />;
  if (v.name === 'edt') { title = 'Emploi du temps'; screen = <Edt />; }
  if (v.name === 'notes') { title = 'Mes notes'; screen = <Notes />; }
  if (v.name === 'devoirs') { title = 'Devoirs'; screen = <Devoirs />; }
  if (v.name === 'train') { title = "S'entraîner"; screen = <Train />; }
  if (v.name === 'session') { title = v.mode === 'chapitre' && S.chs[v.chId] ? '🎯 ' + S.chs[v.chId].titre : sessionTitle(v.mode); screen = <Session mode={v.mode} mats={v.mats} chId={v.chId} />; }
  if (v.name === 'tool') { title = TOOL_TITLES[v.tool] || 'Outil'; screen = <Tool tool={v.tool} mats={v.mats} />; }
  if (v.name === 'ch') { title = S.chs[v.id].titre; screen = <Chapter id={v.id} tab={v.tab} setTab={(t) => setView({ ...v, tab: t })} />; }
  if (v.name === 'settings') { title = 'Réglages'; screen = <Settings />; }
  if (v.name === 'progres') { title = 'Mes progrès'; screen = <Progres />; }
  if (v.name === 'search') { title = 'Rechercher'; screen = <Search />; }
  const isTop = TOP.includes(v.name);

  return (
    <Ctx.Provider value={ctx}>
      <StatusBar style={C.dark ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, width: '100%', maxWidth: isWeb ? 640 : undefined, backgroundColor: C.bg, paddingTop: topPad }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
          {!isTop && <Pressable onPress={back} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }}><Text style={{ fontSize: 20, color: C.ink, fontWeight: '800' }}>‹</Text></Pressable>}
          {title === null ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <LogoMark C={C} />
              <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -1, color: C.ink }}>révisio</Text>
            </View>
          ) : <Text numberOfLines={1} style={{ flex: 1, fontSize: isTop ? 26 : 20, fontWeight: '900', letterSpacing: -0.6, color: C.ink }}>{title}</Text>}
          {isTop && <Pressable onPress={() => go({ name: 'search', back: v.name })} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }}><Text style={{ fontSize: 17 }}>🔍</Text></Pressable>}
          {isTop && <Pressable onPress={() => go({ name: 'settings', back: v.name })} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }}><Text style={{ fontSize: 18 }}>⚙️</Text></Pressable>}
        </View>
        <ScrollView key={v.name + (v.id || '') + (v.tool || '') + (v.mode || '')} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
          refreshControl={(v.name === 'edt' || v.name === 'notes' || v.name === 'devoirs') ? <RefreshControl refreshing={pulling} colors={[C.pri]} tintColor={C.pri}
            onRefresh={async () => { if (!pull.fn) return; setPulling(true); try { await pull.fn(); } finally { setPulling(false); } }} /> : undefined}>
          <Guard key={v.name + (v.id || '') + (v.tool || '')} C={C} onHome={() => setView({ name: 'home' })}>{screen}</Guard>
        </ScrollView>
        {isTop && (
          <View style={{ paddingHorizontal: 12, paddingTop: 2, paddingBottom: Platform.OS === 'android' ? 8 : isWeb ? 6 : 18, backgroundColor: C.bg }}>
            <View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 20, padding: 4, borderWidth: 1, borderColor: C.line,
              shadowColor: '#000', shadowOpacity: C.dark ? 0.35 : 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
              {NAV.map(([k, icon, label]) => {
                const on = v.name === k;
                const badge = k === 'devoirs' ? todoCount(addDaysStr(1)) : 0;
                return (
                  <Pressable key={k} onPress={() => go({ name: k })}
                    style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 16, backgroundColor: on ? C.priSoft : 'transparent', transform: [{ scale: pressed ? 0.92 : 1 }] })}>
                    <Text style={{ fontSize: 17, opacity: on ? 1 : 0.55 }}>{icon}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 10, color: on ? C.priInk : C.muted, fontWeight: on ? '800' : '600' }}>{label}</Text>
                    {badge > 0 && <View style={{ position: 'absolute', top: 1, right: '22%', minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.bad, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{badge}</Text>
                    </View>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
      </View>
      <Modal visible={!!modal} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '92%', width: '100%', maxWidth: isWeb ? 640 : undefined, alignSelf: 'center' }}>
            <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, marginTop: 10 }} />
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              {modal || null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={!!busy} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          {busy && <Busy title={busy.title} sub={busy.sub} C={C} />}
        </View>
      </Modal>
      <ToastHost C={C} top={topPad} />
    </Ctx.Provider>
  );
}

function Busy({ title, sub, C }) {
  const [s, setS] = useState(0);
  useEffect(() => { const t0 = Date.now(); const iv = setInterval(() => setS(Math.round((Date.now() - t0) / 1000)), 1000); return () => clearInterval(iv); }, []);
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 24, padding: 26, alignItems: 'center', width: '100%', maxWidth: 400 }}>
      <Text style={{ fontSize: 34, marginBottom: 6 }}>🤖</Text>
      <Text style={{ fontSize: 19, fontWeight: '900', color: C.ink, marginBottom: 14, textAlign: 'center' }}>{title}</Text>
      <ActivityIndicator size="large" color={C.pri} />
      <Text style={{ color: C.muted, marginTop: 14, textAlign: 'center' }}>{sub || "L'IA lit tes cours… Ça peut prendre 1 à 2 minutes. Garde l'appli ouverte."} {s} s</Text>
    </View>
  );
}

// Filet de sécurité : si un écran plante, on affiche l'erreur au lieu d'un écran blanc
class Guard extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    const { C, onHome } = this.props;
    if (!this.state.err) return this.props.children;
    return (
      <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 20, marginTop: 10 }}>
        <Text style={{ fontSize: 40 }}>🐛</Text>
        <Text style={{ color: C.ink, fontSize: 20, fontWeight: '900', marginTop: 6 }}>Oups, cet écran a planté</Text>
        <Text style={{ color: C.muted, marginTop: 8 }}>Fais une capture et envoie-la à Claude pour qu'il corrige :</Text>
        <Text style={{ color: C.bad, marginTop: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 }}>{String(this.state.err && (this.state.err.stack || this.state.err.message || this.state.err)).slice(0, 600)}</Text>
        <Pressable onPress={onHome} style={{ backgroundColor: C.pri, borderRadius: 14, padding: 13, alignItems: 'center', marginTop: 16 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Retour à l'accueil</Text>
        </Pressable>
      </View>
    );
  }
}

// Logo dessiné (pas d'image à charger : il s'affiche toujours)
function LogoMark({ C }) {
  return (
    <View style={{ width: 30, height: 32 }}>
      <View style={{ position: 'absolute', right: 0, top: 0, width: 20, height: 26, borderRadius: 6, backgroundColor: '#C7D2FE' }} />
      <View style={{ position: 'absolute', left: 0, bottom: 0, width: 21, height: 26, borderRadius: 6, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.bg }}>
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', marginTop: -1 }}>✓</Text>
      </View>
    </View>
  );
}
