// Mes révisions : structure de l'appli (en-tête, onglets du bas, fenêtres).
import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, Modal, BackHandler, AppState, ActivityIndicator, Platform, StatusBar as RNStatusBar, useColorScheme, KeyboardAvoidingView, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ctx, makeTheme, Btn, Chip, ToastHost, pull } from './src/ui';
import { S, load, commit, persistNow, setRefresher } from './src/store';
import { reschedule } from './src/notifs';
import { checkClipboard } from './src/share';
import { silentRefresh, Edt, Notes } from './src/school';
import { Home, Session, sessionTitle, Chapter, Settings } from './src/screens';
import { Train, Tool, TOOL_TITLES } from './src/tools';
import './src/progress';
import { Progres } from './src/progres-screen';

const NAV = [['home', '🏠', 'Accueil'], ['edt', '📅', 'Emploi du temps'], ['notes', '📊', 'Notes'], ['train', '🧠', "S'entraîner"]];
const TOP = NAV.map((n) => n[0]);

export default function App() {
  const scheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const [pulling, setPulling] = useState(false);
  const themePref = S.settings.theme || 'auto';
  const C = makeTheme(themePref === 'dark' || (themePref !== 'light' && scheme === 'dark'), S.settings.accent);
  const topPad = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 50;
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
      silentRefresh();
      setTimeout(() => checkClipboard(go), 800);
    })();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') checkClipboard(go);
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
  if (v.name === 'train') { title = "S'entraîner"; screen = <Train />; }
  if (v.name === 'session') { title = v.mode === 'chapitre' && S.chs[v.chId] ? '🎯 ' + S.chs[v.chId].titre : sessionTitle(v.mode); screen = <Session mode={v.mode} mats={v.mats} chId={v.chId} />; }
  if (v.name === 'tool') { title = TOOL_TITLES[v.tool] || 'Outil'; screen = <Tool tool={v.tool} mats={v.mats} />; }
  if (v.name === 'ch') { title = S.chs[v.id].titre; screen = <Chapter id={v.id} tab={v.tab} setTab={(t) => setView({ ...v, tab: t })} />; }
  if (v.name === 'settings') { title = 'Réglages'; screen = <Settings />; }
  if (v.name === 'progres') { title = 'Mes progrès'; screen = <Progres />; }
  const isTop = TOP.includes(v.name);

  return (
    <Ctx.Provider value={ctx}>
      <StatusBar style={C.dark ? 'light' : 'dark'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg, paddingTop: topPad }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
          {!isTop && <Pressable onPress={back} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }}><Text style={{ fontSize: 20, color: C.ink, fontWeight: '800' }}>‹</Text></Pressable>}
          {title === null ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image source={require('./assets/logo-mark.png')} style={{ width: 28, height: 32 }} resizeMode="contain" />
              <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -1, color: C.ink }}>révisio</Text>
            </View>
          ) : <Text numberOfLines={1} style={{ flex: 1, fontSize: isTop ? 26 : 20, fontWeight: '900', letterSpacing: -0.6, color: C.ink }}>{title}</Text>}
          {isTop && v.name !== 'home' && <Chip>🔥 {S.profil.streak || 0}</Chip>}
          {isTop && <Pressable onPress={() => go({ name: 'settings', back: v.name })} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line }}><Text style={{ fontSize: 18 }}>⚙️</Text></Pressable>}
        </View>
        <ScrollView key={v.name + (v.id || '') + (v.tool || '') + (v.mode || '')} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
          refreshControl={(v.name === 'edt' || v.name === 'notes') ? <RefreshControl refreshing={pulling} colors={[C.pri]} tintColor={C.pri}
            onRefresh={async () => { if (!pull.fn) return; setPulling(true); try { await pull.fn(); } finally { setPulling(false); } }} /> : undefined}>
          {screen}
        </ScrollView>
        {isTop && (
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingTop: 6, paddingBottom: Platform.OS === 'android' ? 24 : 28 }}>
            {NAV.map(([k, icon, label]) => {
              const on = v.name === k;
              return (
                <Pressable key={k} onPress={() => go({ name: k })} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                  <View style={{ paddingHorizontal: 18, paddingVertical: 4, borderRadius: 99, backgroundColor: on ? C.priSoft : 'transparent' }}>
                    <Text style={{ fontSize: 20, opacity: on ? 1 : 0.55 }}>{icon}</Text>
                  </View>
                  <Text style={{ fontSize: 11, marginTop: 2, color: on ? C.priInk : C.muted, fontWeight: on ? '800' : '500' }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </KeyboardAvoidingView>
      <Modal visible={!!modal} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '92%' }}>
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
