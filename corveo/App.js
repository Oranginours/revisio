// Corvéo : les tâches ménagères de la famille, avec des barres de progression façon jeu.
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Modal, AppState, ActivityIndicator, Platform, RefreshControl, KeyboardAvoidingView, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C, Txt, H1, Card, ToastHost, toast, isWeb } from './src/ui';
import { configured } from './src/config';
import { loadAuth, currentUid, signOut } from './src/fb';
import * as D from './src/data';
import { Ctx, AuthScreen, NoFamily, WeekScreen, FamilyScreen, TasksScreen, ProfileScreen } from './src/screens';
import { AdminScreen } from './src/admin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Avatar } from './src/ui';
import { Switcher } from './src/screens';
import { DragProvider } from './src/drag';
import { scheduleFor } from './src/notify';

const TABS = [['week', '✅', 'Mes tâches'], ['family', '👨‍👩‍👧', 'Famille'], ['tasks', '📋', 'Tâches'], ['me', '🙂', 'Moi']];

export default function App() {
  const [phase, setPhase] = useState('load'); // load | auth | nofamily | main
  const [me, setMe] = useState(null);
  const [fam, setFam] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [week, setWeek] = useState(null);
  const [tab, setTab] = useState('week');
  const [modal, setModal] = useState(null);
  const [pulling, setPulling] = useState(false);
  const [dragging, setDragging] = useState(false);
  const famRef = useRef(null);
  const [actingId, setActingId] = useState(null); // profil sans téléphone utilisé par un parent
  useEffect(() => { AsyncStorage.getItem('corveo_acting').then((v) => v && setActingId(v)).catch(() => {}); }, []);
  const actAs = (id) => { setActingId(id); setTab('week'); AsyncStorage.setItem('corveo_acting', id || '').catch(() => {}); };

  // Charge tout : profil, famille, membres, tâches, semaine
  const loadAll = useCallback(async () => {
    if (!configured()) { setPhase('config'); return; }
    const a = await loadAuth();
    if (!a) { setPhase('auth'); return; }
    let u;
    try { u = await D.getMe(); } catch (e) {
      if (e.status === 401 || e.status === 400) { await signOut(); setPhase('auth'); return; }
      toast(e.message, 'bad'); setPhase((p) => (p === 'load' ? 'offline' : p)); return;
    }
    if (!u) { // profil effacé par l'admin : on repart d'un profil vide
      try { u = await D.recreateProfile(); } catch (e) { await signOut(); setPhase('auth'); return; }
    }
    setMe(u);
    if (u.banned) { setPhase('banned'); return; }
    if (!u.familyId) { setPhase('nofamily'); return; }
    const [f, ms, ts] = await Promise.all([D.getFamily(u.familyId), D.getMembers(u.familyId), D.getTasks(u.familyId)]);
    if (!f) { await D.leaveFamily(); setPhase('nofamily'); return; }
    famRef.current = f;
    setFam(f); setMembers(ms); setTasks(ts);
    const w = await D.ensureWeek(f, ms, ts);
    if (!quiet()) { weekRef.current = w; setWeek(w); }
    setPhase('main');
  }, []);

  // Écritures en cours : tant qu'il y en a, on n'écrase pas l'écran avec une version plus ancienne
  const pending = useRef(0);
  const lastWrite = useRef(0);
  const quiet = () => pending.current > 0 || Date.now() - lastWrite.current < 2500;
  const weekRef = useRef(null);
  useEffect(() => { weekRef.current = week; }, [week]);

  // Rafraîchissement léger (la semaine + la famille), ou complet
  const refresh = useCallback(async (full) => {
    try {
      if (full || !famRef.current) return await loadAll();
      const f = famRef.current;
      const [w, nf, ms, ts] = await Promise.all([D.getWeek(f.id, D.weekId()), D.getFamily(f.id), D.getMembers(f.id), D.getTasks(f.id)]);
      if (nf) { famRef.current = nf; setFam(nf); }
      if (ms) { setMembers(ms); const mine = ms.find((m) => m.id === currentUid()); if (!mine || mine.banned) { await loadAll(); return; } setMe(mine); }
      if (ts) setTasks(ts);
      if (!w) { await loadAll(); return; } // nouvelle semaine : on la crée
      if (!quiet()) setWeek(w);
    } catch (e) { /* hors ligne : on réessaiera */ }
  }, [loadAll]);

  // Fait une action sur la semaine : l'écran change tout de suite, puis on enregistre
  const act = useCallback(async (op, wk) => {
    const f = famRef.current;
    if (!f) return false;
    const cur = weekRef.current;
    if (cur && (!wk || wk === D.weekId())) { const r = op.run(cur); weekRef.current = r.next; setWeek(r.next); }
    pending.current++;
    let ok = true;
    try { await D.applyOp(f.id, wk || D.weekId(), op, cur); } catch (e) { ok = false; toast(e.message, 'bad'); }
    pending.current = Math.max(0, pending.current - 1);
    lastWrite.current = ok ? Date.now() : 0;
    if (!ok) { refresh(); return false; }
    if (op.fresh) setTimeout(() => refresh(), 2600);
    return true;
  }, [refresh]);

  useEffect(() => { loadAll().catch((e) => { toast(e.message, 'bad'); setPhase('offline'); }); }, []);
  // Rappels sur le téléphone, recalculés quand mes tâches changent
  useEffect(() => {
    if (phase !== 'main' || !week || !me) return;
    const sel = actingId && members.find((m) => m.id === actingId && m.managed);
    const t = setTimeout(() => scheduleFor(week, sel || me), 1500);
    return () => clearTimeout(t);
  }, [week, me, actingId, phase]);
  // Synchro régulière quand l'appli est ouverte
  useEffect(() => {
    if (phase !== 'main') return;
    let n = 0; // eslint-disable-line no-unused-vars
    const id = setInterval(() => { n++; refresh(false); }, 8000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(true); });
    return () => { clearInterval(id); sub.remove(); };
  }, [phase]);

  const logout = async () => { actAs(null); await signOut(); setMe(null); setFam(null); famRef.current = null; setTab('week'); setPhase('auth'); };
  const isParent = !!(me && (me.role === 'parent' || D.isAdminUser(me))); // l'admin a les droits d'un parent partout
  const topPad = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) + 8 : isWeb ? 16 : 54;

  if (phase === 'load') return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 56 }}>🧹</Text><ActivityIndicator color={C.green} style={{ marginTop: 16 }} /><StatusBar style="light" /></View>;
  if (phase === 'config') return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, paddingTop: topPad + 40 }}>
      <H1>Presque prêt 🔧</H1>
      <Txt muted style={{ marginTop: 10 }}>L'appli n'est pas encore reliée à sa base de données Firebase. Il faut ajouter la configuration dans src/config.js.</Txt>
      <StatusBar style="light" />
    </View>
  );
  if (phase === 'offline') return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, paddingTop: topPad + 40, alignItems: 'center' }}>
      <Text style={{ fontSize: 48 }}>📡</Text>
      <H1 style={{ marginTop: 10 }}>Pas de connexion</H1>
      <Txt muted center style={{ marginTop: 8 }}>Corvéo a besoin d'internet pour partager les tâches avec ta famille.</Txt>
      <Pressable onPress={() => { setPhase('load'); loadAll().catch(() => setPhase('offline')); }} style={{ marginTop: 20, backgroundColor: C.green, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 16 }}>
        <Text style={{ fontWeight: '900', color: '#0B1A06' }}>Réessayer</Text>
      </Pressable>
      <StatusBar style="light" />
    </View>
  );
  if (phase === 'auth') return <View style={{ flex: 1, backgroundColor: C.bg }}><AuthScreen onDone={loadAll} /><ToastHost /><StatusBar style="light" /></View>;
  if (phase === 'nofamily') return <View style={{ flex: 1, backgroundColor: C.bg }}><NoFamily me={me} reload={loadAll} admin={D.isAdminUser(me) ? <AdminScreen reload={loadAll} /> : null} /><ToastHost /><StatusBar style="light" /></View>;
  if (phase === 'banned') return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, paddingTop: topPad + 40, alignItems: 'center' }}>
      <Text style={{ fontSize: 48 }}>🚫</Text>
      <H1 style={{ marginTop: 10 }}>Compte bloqué</H1>
      <Txt muted center style={{ marginTop: 8 }}>Ce compte a été bloqué par l'administrateur.</Txt>
      <Pressable onPress={logout} style={{ marginTop: 20, backgroundColor: C.card2, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 16 }}>
        <Text style={{ fontWeight: '900', color: C.ink }}>Se déconnecter</Text>
      </Pressable>
      <StatusBar style="light" />
    </View>
  );

  const admin = D.isAdminUser(me);
  const tabs = admin ? [...TABS, ['admin', '🛡️', 'Admin']] : TABS;
  const Screen = { week: WeekScreen, family: FamilyScreen, tasks: TasksScreen, me: ProfileScreen }[tab] || WeekScreen;
  const titles = { week: 'Mes tâches', family: 'Famille', tasks: 'Tâches', me: 'Moi', admin: 'Admin' };
  const managedSel = isParent && actingId ? members.find((m) => m.id === actingId && m.managed) : null;
  const actor = managedSel || me;
  const ctx = { me, actor, actAs, fam, members, tasks, week, setWeek, refresh, act, isParent, setModal, logout };
  const myStats = week ? D.stats(week, actor.id) : { done: 0, total: 0 };
  const hasManaged = isParent && members.some((m) => m.managed);
  const onDrop = async (d, toUid) => {
    const to = members.find((m) => m.id === toUid);
    if (await act(D.OPS.move(d.uid, d.t.k, toUid))) toast(`${d.t.e} donnée à ${to ? to.name : '…'}`);
  };
  const left = myStats.total - myStats.done;

  return (
    <Ctx.Provider value={ctx}>
     <DragProvider members={members} onDrop={onDrop} onState={setDragging}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar style="light" />
        <View style={{ paddingTop: topPad, paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', maxWidth: 640, width: '100%', alignSelf: 'center' }}>
          <H1 style={{ flex: 1 }}>{titles[tab]}</H1>
          <Pressable onPress={() => setModal(<Switcher />)} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
            {hasManaged && <Text style={{ color: C.muted, fontWeight: '800', fontSize: 12 }}>⇄</Text>}
            <Avatar m={actor} size={38} />
          </Pressable>
        </View>
        {managedSel && (
          <Pressable onPress={() => actAs(null)} style={{ marginHorizontal: 16, marginBottom: 4, backgroundColor: '#2E1065', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 608, width: '92%', alignSelf: 'center' }}>
            <Text style={{ color: '#E9D5FF', fontWeight: '800', flex: 1 }}>📵 Profil de {managedSel.name}</Text>
            <Text style={{ color: '#C4B5FD', fontWeight: '900' }}>Revenir à moi ›</Text>
          </Pressable>
        )}
        <ScrollView style={{ flex: 1 }} scrollEnabled={!dragging} contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={pulling} tintColor={C.green} colors={[C.green]} onRefresh={async () => { setPulling(true); await refresh(true); setPulling(false); }} />}>
          {tab === 'admin' ? <AdminScreen reload={loadAll} /> : <Screen />}
        </ScrollView>
        <View style={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: Platform.OS === 'android' ? 24 : isWeb ? 10 : 24, backgroundColor: C.bg }}>
          <View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 20, padding: 4, borderWidth: 1, borderColor: C.line, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
            {tabs.map(([k, icon, label]) => {
              const on = tab === k;
              const badge = k === 'week' && left > 0 ? left : 0;
              return (
                <Pressable key={k} onPress={() => setTab(k)} style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 5, borderRadius: 16, backgroundColor: on ? C.card2 : 'transparent', transform: [{ scale: pressed ? 0.92 : 1 }] })}>
                  <Text style={{ fontSize: 18, opacity: on ? 1 : 0.55 }}>{icon}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 10.5, color: on ? C.green : C.muted, fontWeight: on ? '900' : '600' }}>{label}</Text>
                  {badge > 0 && <View style={{ position: 'absolute', top: 1, right: '24%', minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{badge}</Text></View>}
                </Pressable>
              );
            })}
          </View>
        </View>
        <Modal visible={!!modal} transparent animationType="slide" onRequestClose={() => setModal(null)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => setModal(null)} />
          <View style={{ backgroundColor: C.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '88%', maxWidth: 640, width: '100%', alignSelf: 'center' }}>
            <View style={{ alignItems: 'center', paddingTop: 10 }}><View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: C.line }} /></View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <Ctx.Provider value={ctx}>{modal}</Ctx.Provider>
            </ScrollView>
          </View>
        </Modal>
        <ToastHost />
      </KeyboardAvoidingView>
     </DragProvider>
    </Ctx.Provider>
  );
}
