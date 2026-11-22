// Écrans de Corvéo.
import React, { useState, useContext, createContext } from 'react';
import { View, Text, Pressable, Share, ScrollView, Switch, ActivityIndicator, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, Txt, H1, H2, Label, Card, Row, Btn, Input, Err, Stepper, TaskBar, Avatar, Chip, Pop, toast, ask, isWeb } from './ui';
import * as D from './data';
import { NewTaskQuick } from './admin';
import { ReplaceTasks } from './replace';
import { Draggable } from './drag';
import { notifSupported, notifPrefs, setNotifPrefs, testNotif, resetNotifSig } from './notify';
import { currentUid, usernameOk, normUser, signOut } from './fb';

export const Ctx = createContext(null);
export const useCtx = () => useContext(Ctx);

/* =========================================================
   Connexion / inscription
   ========================================================= */
export function AuthScreen({ onDone }) {
  const [mode, setMode] = useState('login');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(D.AVATARS[Math.floor(Math.random() * D.AVATARS.length)]);
  const [color, setColor] = useState(D.COLORS[Math.floor(Math.random() * 8)]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  const go = async () => {
    setErr('');
    const u = normUser(user);
    if (!usernameOk(u)) return setErr('Pseudo : 3 à 20 caractères (lettres, chiffres, . _ -), sans espace.');
    if (pass.length < 6) return setErr('Mot de passe : 6 caractères minimum.');
    setBusy(true);
    try {
      if (signup) await D.register({ username: u, password: pass, name: name || user, avatar, color });
      else await D.login(u, pass);
      await onDone();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 60, maxWidth: 520, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', marginBottom: 26 }}>
        <Text style={{ fontSize: 56 }}>🧹</Text>
        <H1>Corvéo</H1>
        <Txt muted center>Les tâches de la maison, chacun sa part.</Txt>
      </View>
      <View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, padding: 4, marginBottom: 14 }}>
        {[['login', 'Se connecter'], ['signup', 'Créer un compte']].map(([k, l]) => (
          <Pressable key={k} onPress={() => { setMode(k); setErr(''); }} style={{ flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: mode === k ? C.card2 : 'transparent', alignItems: 'center' }}>
            <Text style={{ color: mode === k ? C.ink : C.muted, fontWeight: '800' }}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <Card>
        <Label>Nom d'utilisateur</Label>
        <Input value={user} onChangeText={setUser} autoCapitalize="none" autoCorrect={false} placeholder="ex. gael" />
        <Label>Mot de passe</Label>
        <Input value={pass} onChangeText={setPass} secureTextEntry placeholder="6 caractères minimum" onSubmitEditing={signup ? undefined : go} />
        {signup && (
          <View>
            <Label>Prénom affiché</Label>
            <Input value={name} onChangeText={setName} placeholder="ex. Gaël" />
            <Label>Ton avatar</Label>
            <AvatarPicker avatar={avatar} color={color} setAvatar={setAvatar} setColor={setColor} />
          </View>
        )}
        <Err>{err}</Err>
        <Btn label={busy ? '…' : signup ? 'Créer mon compte' : 'Se connecter'} onPress={go} disabled={busy} style={{ marginTop: 16 }} />
      </Card>
      {signup && <Txt muted center style={{ fontSize: 12 }}>Pas besoin d'email. Retiens bien ton mot de passe : un parent ne peut pas le retrouver.</Txt>}
    </ScrollView>
  );
}

function AvatarPicker({ avatar, color, setAvatar, setColor }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 }}>
        <Avatar m={{ avatar, color }} size={64} />
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {D.COLORS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, borderWidth: color === c ? 3 : 1, borderColor: color === c ? '#fff' : '#000' }} />
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {D.AVATARS.map((a) => (
          <Pressable key={a} onPress={() => setAvatar(a)} style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: avatar === a ? C.card2 : 'transparent', borderWidth: avatar === a ? 2 : 0, borderColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24 }}>{a}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* =========================================================
   Pas encore de famille
   ========================================================= */
export function NoFamily({ me, reload, admin }) {
  const [name, setName] = useState(me.name ? `Famille de ${me.name}` : '');
  const [defaults, setDefaults] = useState(true);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn) => { setErr(''); setBusy(true); try { await fn(); await reload(); } catch (e) { setErr(e.message); } setBusy(false); };
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 50, maxWidth: 560, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <Row style={{ marginBottom: 18 }}>
        <Avatar m={me} size={52} />
        <View style={{ flex: 1 }}><H1 style={{ fontSize: 24 }}>Salut {me.name} !</H1><Txt muted>Rejoins ta famille pour commencer.</Txt></View>
      </Row>
      <Card>
        <H2>🔑 Rejoindre ma famille</H2>
        <Txt muted>Demande le code à un parent (dans l'onglet Famille de son appli).</Txt>
        <Input style={{ marginTop: 12, fontSize: 22, letterSpacing: 6, textAlign: 'center', fontWeight: '900' }} value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" placeholder="ABC234" maxLength={8} />
        <Btn label="Rejoindre" style={{ marginTop: 12 }} disabled={busy} onPress={() => run(() => D.joinFamily(code))} />
      </Card>
      <Card>
        <H2>🏠 Créer une famille (parent)</H2>
        <Txt muted>Tu deviens parent : tu gères les tâches et la répartition.</Txt>
        <Label>Nom de la famille</Label>
        <Input value={name} onChangeText={setName} placeholder="ex. Famille Martin" />
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', marginTop: 12 }}>
          <Txt style={{ flex: 1 }}>Ajouter des tâches de base (vaisselle, poubelles, linge…)</Txt>
          <Switch value={defaults} onValueChange={setDefaults} trackColor={{ true: C.green }} />
        </Row>
        <Btn kind="sec" label="Créer la famille" style={{ marginTop: 12 }} disabled={busy} onPress={() => run(() => D.createFamily(name, defaults))} />
      </Card>
      {busy && <ActivityIndicator color={C.green} />}
      <Err>{err}</Err>
      <Btn kind="ghost" label="Se déconnecter" style={{ marginTop: 20 }} onPress={async () => { await signOut(); await reload(); }} />
      <DeleteAccount me={me} after={reload} />
      {admin && <View style={{ marginTop: 24 }}>{admin}</View>}
    </ScrollView>
  );
}

/* =========================================================
   Onglet « Semaine » : mes tâches + les barres
   ========================================================= */
const DAYS = ['', 'dernier jour !', '2 jours', '3 jours', '4 jours', '5 jours', '6 jours', '7 jours'];

// Ordre d'affichage : à faire d'abord (celles du jour en tête), puis en cours, puis faites
function sortItems(week, list) {
  const td = D.todayNum();
  const rank = (it) => {
    const st = D.statusOf(week, it.k);
    if (st === 'done') return 90;
    if (it.d && it.d < td) return 0; // en retard
    if (it.d === td) return 1;
    if (st === 'doing') return 2;
    if (!it.d) return 3;
    return 4 + it.d;
  };
  return list.slice().sort((a, b) => rank(a) - rank(b));
}

export function WeekScreen() {
  const { actor: me, fam, members, week, tasks, isParent, setModal, act } = useCtx();
  const [party, setParty] = useState(0);
  if (!tasks.length && !week) {
    return (
      <Card>
        <H2>Aucune tâche pour l'instant</H2>
        <Txt muted>{isParent ? "Ajoute les tâches de la maison dans l'onglet Tâches : la semaine se répartit toute seule." : 'Un parent doit ajouter les tâches de la maison.'}</Txt>
      </Card>
    );
  }
  if (!week) return <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />;
  const uid = me.id;
  const mine = sortItems(week, D.itemsOf(week, uid));
  const fs = D.familyStats(week), ms = D.stats(week, uid);
  const extra = mine.filter((x) => x.x).length;
  const allDone = ms.total > 0 && ms.done === ms.total;
  const famDone = fs.total > 0 && fs.done === fs.total;
  const dl = D.daysLeft();

  const toggle = async (it) => {
    const on = D.statusOf(week, it.k) !== 'done';
    if (on && ms.done + 1 === ms.total) { setParty((p) => p + 1); toast('🎉 Toutes tes tâches sont faites !'); }
    await act(D.OPS.done(it.k, on));
  };

  return (
    <View>
      <Announce />
      <Card style={{ backgroundColor: '#141A28', borderColor: '#000', borderWidth: 2 }}>
        <TaskBar label="TÂCHES DE LA FAMILLE" done={fs.done} total={fs.total} />
        <TaskBar label={me.id === currentUid() ? 'MES TÂCHES' : `TÂCHES DE ${String(me.name).toUpperCase()}`} done={ms.done} total={ms.total} />
        <Txt muted style={{ fontSize: 13 }}>{famDone ? '🏆 Toute la famille a fini ! Victoire !' : dl === 1 ? '⏰ Dernier jour de la semaine !' : `⏳ Encore ${DAYS[dl]} avant lundi`}</Txt>
      </Card>

      {extra > 0 && (
        <View style={{ backgroundColor: '#3B1518', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#7F1D1D' }}>
          <Txt style={{ color: '#FCA5A5' }} bold>⚠️ +{extra} tâche{extra > 1 ? 's' : ''} en plus cette semaine</Txt>
          <Txt style={{ color: '#FCA5A5', fontSize: 13 }}>Des tâches n'ont pas été faites la semaine dernière.</Txt>
        </View>
      )}

      {allDone && (
        <Pop trigger={party}>
          <View style={{ backgroundColor: '#14301A', borderRadius: 20, padding: 18, marginBottom: 12, alignItems: 'center', borderWidth: 2, borderColor: C.green }}>
            <Text style={{ fontSize: 40 }}>🏆</Text>
            <Text style={{ color: C.green, fontWeight: '900', fontSize: 20 }}>TÂCHES TERMINÉES !</Text>
            <Txt muted center>Bien joué {me.name}, {me.id === currentUid() ? 'tu as fait ta part' : 'sa part est faite'} cette semaine.</Txt>
          </View>
        </Pop>
      )}

      <H2>{me.id === currentUid() ? 'Mes tâches' : `Tâches de ${me.name}`}</H2>
      {mine.length === 0 && <Txt muted>Rien cette semaine.</Txt>}
      {mine.map((it) => (
        <Draggable key={it.k} uid={uid} t={it} enabled={isParent}>
          <TaskRow it={it} week={week} onToggle={() => toggle(it)} onOpen={() => setModal(<TaskSheet uid={uid} k={it.k} />)} />
        </Draggable>
      ))}
      {mine.length > 0 && <Txt muted style={{ fontSize: 12, marginTop: 2 }}>Touche une tâche pour la cocher. Touche ⋯ pour « en cours » ou les notes.{isParent ? ' Appui long pour la glisser chez quelqu\'un d\'autre.' : ''}</Txt>}
      <Others members={members} week={week} />
      <Confetti trigger={party} />
    </View>
  );
}

// Une tâche : on touche = cocher (si on a le droit), ⋯ = la fiche (en cours, notes)
export function TaskRow({ it, week, onToggle, onOpen, onLongPress, onPressOut, delayLongPress, compact }) {
  const status = D.statusOf(week, it.k);
  const done = status === 'done', doing = status === 'doing';
  const notes = ((week.notes || {})[it.k] || []).length;
  const td = D.todayNum();
  const late = it.d && it.d < td && !done, today = it.d === td && !done;
  return (
    <Pressable onPress={onToggle || onOpen} onLongPress={onLongPress || onOpen} onPressOut={onPressOut} delayLongPress={delayLongPress || 400}
      style={({ pressed }) => ({ userSelect: 'none', flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: done ? '#14301A' : doing ? '#2E2810' : C.card, borderRadius: 18, padding: compact ? 10 : 14, marginBottom: 8, borderWidth: 2, borderColor: done ? C.greenDark : doing ? '#A16207' : today ? C.blue : late ? '#7F1D1D' : C.line, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <Text style={{ fontSize: compact ? 22 : 26 }}>{it.e || '✨'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: done ? C.muted : C.ink, fontSize: compact ? 15 : 16, fontWeight: '800', textDecorationLine: done ? 'line-through' : 'none' }}>{it.n}</Text>
        {(doing || it.x || notes > 0 || it.d) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
            {doing && <Text style={{ color: C.yellow, fontSize: 12, fontWeight: '900' }}>⏳ EN COURS</Text>}
            {!!it.d && !done && <Text style={{ color: late ? '#FCA5A5' : today ? C.blue : C.muted, fontSize: 12, fontWeight: '800' }}>📅 {today ? "Aujourd'hui" : late ? `${D.DAY_NAMES[it.d]} (en retard)` : D.DAY_NAMES[it.d]}</Text>}
            {!!it.x && !done && <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '700' }}>tâche en plus</Text>}
            {notes > 0 && <Text style={{ color: C.blue, fontSize: 12, fontWeight: '800' }}>💬 {notes}</Text>}
          </View>
        ) : null}
      </View>
      {onOpen && (
        <Pressable onPress={onOpen} hitSlop={10} style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.card2 : 'transparent' })}>
          <Text style={{ color: C.muted, fontSize: 20, fontWeight: '900' }}>⋯</Text>
        </Pressable>
      )}
      <Pop trigger={done}>
        <View style={{ width: 34, height: 34, borderRadius: 10, borderWidth: 3, borderColor: done ? C.green : doing ? C.yellow : '#5B6478', backgroundColor: done ? C.green : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: onToggle ? 1 : 0.5 }}>
          {done ? <Text style={{ color: '#0B1A06', fontWeight: '900', fontSize: 18 }}>✓</Text> : doing ? <Text style={{ fontSize: 14 }}>⏳</Text> : null}
        </View>
      </Pop>
    </Pressable>
  );
}

// Liste des tâches de quelqu'un (pour les autres, le classement, la fiche membre)
function PersonTasks({ m, week, compact }) {
  const { isParent, actor, setModal, act } = useCtx();
  const can = isParent || m.id === actor.id;
  return sortItems(week, D.itemsOf(week, m.id)).map((it) => (
    <Draggable key={it.k} uid={m.id} t={it} enabled={isParent}>
      <TaskRow it={it} week={week} compact={compact}
        onToggle={can ? () => act(D.OPS.done(it.k, D.statusOf(week, it.k) !== 'done')) : null}
        onOpen={() => setModal(<TaskSheet uid={m.id} k={it.k} />)} />
    </Draggable>
  ));
}

// Les tâches des autres : on voit qui fait quoi, ce qui est en cours, et les notes
function Others({ members, week }) {
  const { actor, isParent } = useCtx();
  const [open, setOpen] = useState(isParent ? 'all' : null);
  const list = members.filter((m) => D.itemsOf(week, m.id).length && m.id !== actor.id);
  if (!list.length) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <H2 style={{ marginBottom: 0 }}>Les autres</H2>
        <Pressable onPress={() => setOpen(open === 'all' ? null : 'all')} hitSlop={8}><Text style={{ color: C.green, fontWeight: '800' }}>{open === 'all' ? 'Tout replier' : 'Tout voir'}</Text></Pressable>
      </Row>
      {list.map((m) => {
        const s = D.stats(week, m.id);
        const doing = D.itemsOf(week, m.id).filter((it) => D.statusOf(week, it.k) === 'doing').length;
        const isOpen = open === 'all' || open === m.id;
        return (
          <View key={m.id} style={{ marginBottom: 12 }}>
            <Pressable onPress={() => setOpen(isOpen ? (open === 'all' ? null : null) : m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar m={m} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontWeight: '800', marginBottom: 3 }}>{m.name}{s.total && s.done === s.total ? ' ✅' : ''}{doing ? `  ·  ⏳ ${doing} en cours` : ''}</Text>
                <TaskBar small done={s.done} total={s.total} />
              </View>
              <Text style={{ color: C.muted, fontSize: 16 }}>{isOpen ? '▾' : '▸'}</Text>
            </Pressable>
            {isOpen && <View style={{ marginTop: 8, marginLeft: 8 }}><PersonTasks m={m} week={week} compact /></View>}
          </View>
        );
      })}
    </View>
  );
}

// Fiche d'une tâche : statut (à faire / en cours / faite), notes, et pour les parents : donner / retirer
export function TaskSheet({ uid, k }) {
  const { actor: me, week, members, tasks, isParent, setModal, act } = useCtx();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const found = week && D.findItem(week, k);
  if (!found) return <View><Txt muted>Cette tâche n'existe plus.</Txt><Btn kind="ghost" label="Fermer" style={{ marginTop: 10 }} onPress={() => setModal(null)} /></View>;
  const t = found.it, owner = members.find((m) => m.id === found.uid) || { name: '?' };
  const status = D.statusOf(week, k);
  const mine = found.uid === me.id;
  const canEdit = mine || isParent;
  const info = (tasks.find((x) => x.id === t.t) || {}).info;
  const notes = (week.notes || {})[k] || [];
  const doingBy = week.doing && week.doing[k] && week.doing[k].by;

  const setStatus = async (st) => {
    if (st === status) return;
    if (st === 'doing') await act(D.OPS.doing(k, true, me.name));
    else await act(D.OPS.done(k, st === 'done'));
    if (st === 'done') toast('✅ Tâche faite !');
  };
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const ok = await act(D.OPS.addNote(k, { u: me.id, n: me.name, a: me.avatar || '', t: text.trim(), ts: Date.now() }));
    if (ok) setText('');
    setBusy(false);
  };
  const ST = [['todo', '⬜ À faire', C.card2], ['doing', '⏳ En cours', '#A16207'], ['done', '✅ Faite', C.greenDark]];
  const others = members.filter((m) => m.id !== found.uid && m.active !== false);

  return (
    <View>
      <Row style={{ flexWrap: 'nowrap', marginBottom: 6 }}>
        <Text style={{ fontSize: 40 }}>{t.e || '✨'}</Text>
        <View style={{ flex: 1 }}>
          <H2 style={{ marginBottom: 0 }}>{t.n}</H2>
          <Txt muted>{mine ? (me.id === currentUid() ? 'Ta tâche' : `Tâche de ${me.name}`) : `Tâche de ${owner.name}`}{t.d ? ` · 📅 ${D.DAY_NAMES[t.d]}` : ''}{status === 'doing' && doingBy ? ` · lancée par ${doingBy}` : ''}</Txt>
        </View>
      </Row>
      {!!info && <View style={{ backgroundColor: C.bg, borderRadius: 14, padding: 12, marginTop: 6 }}><Txt muted bold style={{ fontSize: 12 }}>📌 CONSIGNES</Txt><Txt>{info}</Txt></View>}

      <Label>Où ça en est</Label>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {ST.map(([st, l, col]) => {
          const on = status === st;
          return (
            <Pressable key={st} disabled={!canEdit} onPress={() => setStatus(st)}
              style={({ pressed }) => ({ flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center', backgroundColor: on ? col : C.bg, borderWidth: 2, borderColor: on ? col : C.line, opacity: !canEdit && !on ? 0.4 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
              <Text style={{ color: C.ink, fontWeight: '900', fontSize: 13 }}>{l}</Text>
            </Pressable>
          );
        })}
      </View>
      {!canEdit && <Txt muted style={{ fontSize: 12, marginTop: 6 }}>Seul {owner.name} ou un parent peut changer le statut.</Txt>}

      {isParent && others.length > 0 && (
        <View>
          <Label>Donner cette tâche à</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {others.map((m) => (
              <Pressable key={m.id} onPress={async () => { setModal(null); if (await act(D.OPS.move(found.uid, k, m.id))) toast(`${t.e} donnée à ${m.name}`); }}
                style={({ pressed }) => ({ alignItems: 'center', width: 64, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
                <Avatar m={m} size={40} />
                <Text numberOfLines={1} style={{ color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 3 }}>{m.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Label>Notes ({notes.length})</Label>
      {notes.length === 0 && <Txt muted>Pas encore de note. Ex. « plus de liquide vaisselle », « je la fais ce soir ».</Txt>}
      {notes.map((n) => (
        <View key={n.ts} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <Text style={{ fontSize: 22 }}>{n.a || '💬'}</Text>
          <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 14, padding: 10 }}>
            <Text style={{ color: C.muted, fontSize: 12, fontWeight: '800' }}>{n.n} · {D.ago(n.ts)}</Text>
            <Txt>{n.t}</Txt>
          </View>
          {(n.u === me.id || n.u === currentUid() || isParent) && <Pressable hitSlop={8} onPress={() => act(D.OPS.delNote(k, n.ts))}><Text style={{ color: C.muted }}>✕</Text></Pressable>}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 4 }}>
        <Input style={{ flex: 1 }} value={text} onChangeText={setText} placeholder="Écrire une note…" multiline onSubmitEditing={send} />
        <Btn small label="Envoyer" onPress={send} disabled={busy || !text.trim()} />
      </View>
      {isParent && <Btn kind="danger" small label="🗑️ Retirer cette tâche" style={{ marginTop: 16, alignSelf: 'flex-start' }}
        onPress={() => ask('Retirer cette tâche ?', `${t.e} ${t.n} (${owner.name})`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Retirer', style: 'destructive', onPress: async () => { setModal(null); if (await act(D.OPS.remove(found.uid, k))) toast('Tâche retirée'); } }])} />}
      <Btn kind="ghost" label="Fermer" style={{ marginTop: 14 }} onPress={() => setModal(null)} />
    </View>
  );
}

/* ---------- Annonce « réunion d'urgence » ---------- */
function Announce() {
  const { fam, isParent } = useCtx();
  const [hidden, setHidden] = useState(null);
  const a = fam && fam.announce;
  React.useEffect(() => { AsyncStorage.getItem('corveo_ann_seen').then((v) => setHidden(v ? Number(v) : 0)).catch(() => setHidden(0)); }, []);
  if (!a || !a.ts || hidden === null || hidden >= a.ts) return null;
  return (
    <View style={{ backgroundColor: '#450A0A', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 3, borderColor: C.red }}>
      <Text style={{ color: '#FCA5A5', fontWeight: '900', letterSpacing: 1, fontSize: 13 }}>📢 RÉUNION D'URGENCE</Text>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17, marginTop: 6 }}>{a.t}</Text>
      <Text style={{ color: '#FCA5A5', fontSize: 12, marginTop: 6 }}>{a.a || '👑'} {a.by} · {D.ago(a.ts)}</Text>
      <Row style={{ marginTop: 10 }}>
        <Btn small kind="sec" label="👍 Vu !" onPress={() => { setHidden(a.ts); AsyncStorage.setItem('corveo_ann_seen', String(a.ts)).catch(() => {}); }} />
        {isParent && <Text style={{ color: '#FCA5A5', fontSize: 12 }}>Modifiable dans l'onglet Famille</Text>}
      </Row>
    </View>
  );
}
function AnnounceForm() {
  const { fam, me, setModal, refresh } = useCtx();
  const [t, setT] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!t.trim()) return;
    setBusy(true);
    try { await D.setAnnounce(fam.id, { t: t.trim(), by: me.name, a: me.avatar || '', ts: Date.now() }); await refresh(); setModal(null); toast('📢 Annonce envoyée à toute la famille'); }
    catch (e) { toast(e.message, 'bad'); setBusy(false); }
  };
  return (
    <View>
      <H2>📢 Réunion d'urgence</H2>
      <Txt muted>Un message en rouge, en haut de l'appli de tout le monde.</Txt>
      <Input style={{ marginTop: 12, minHeight: 80 }} value={t} onChangeText={setT} placeholder="ex. Tout le monde range sa chambre avant 18h !" multiline autoFocus />
      <Row style={{ marginTop: 12 }}>
        <Btn label="Envoyer" onPress={send} disabled={busy || !t.trim()} />
        {!!(fam.announce && fam.announce.ts) && <Btn kind="sec" label="Effacer l'annonce" onPress={async () => { try { await D.setAnnounce(fam.id, null); await refresh(); setModal(null); } catch (e) { toast(e.message, 'bad'); } }} />}
        <Btn kind="ghost" label="Annuler" onPress={() => setModal(null)} />
      </Row>
    </View>
  );
}

/* ---------- Confettis ---------- */
const BITS = ['🎉', '✨', '🟩', '⭐', '🎊', '💚', '🟢', '🏆'];
function Confetti({ trigger }) {
  const [run, setRun] = useState(0);
  const first = React.useRef(true);
  React.useEffect(() => { if (first.current) { first.current = false; return; } setRun((r) => r + 1); }, [trigger]);
  if (!run) return null;
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: -40, height: 700 }}>{Array.from({ length: 18 }).map((_, i) => <Bit key={run + '_' + i} i={i} />)}</View>;
}
function Bit({ i }) {
  const v = React.useRef(new Animated.Value(0)).current;
  const x = React.useRef(Math.random() * 100).current;
  const dur = React.useRef(1400 + Math.random() * 1000).current;
  React.useEffect(() => { Animated.timing(v, { toValue: 1, duration: dur, delay: Math.random() * 300, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(); }, []);
  return (
    <Animated.Text style={{ position: 'absolute', left: `${x}%`, top: 0, fontSize: 22, opacity: v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 650] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 360}deg`] }) }] }}>
      {BITS[i % BITS.length]}
    </Animated.Text>
  );
}

/* =========================================================
   Onglet « Famille »
   ========================================================= */
export function FamilyScreen() {
  const { fam, members, week, isParent, setModal, refresh } = useCtx();
  const [open, setOpen] = useState(null);
  const share = async () => {
    const msg = `Rejoins notre famille sur Corvéo 🧹\nCode : ${fam.code}\nhttps://oranginours.github.io/revisio/corveo/`;
    try { if (isWeb && navigator.clipboard) { await navigator.clipboard.writeText(msg); toast('Code copié 📋'); } else await Share.share({ message: msg }); } catch (e) { /* annulé */ }
  };
  const ranking = members.filter((m) => week && D.itemsOf(week, m.id).length)
    .map((m) => ({ m, s: D.stats(week, m.id) }))
    .sort((a, b) => (b.s.total ? b.s.done / b.s.total : 0) - (a.s.total ? a.s.done / a.s.total : 0) || b.s.done - a.s.done);
  const feed = D.activity(week, members, 15);
  return (
    <View>
      <Announce />
      <Card>
        <Txt muted bold style={{ fontSize: 12 }}>FAMILLE</Txt>
        <H1 style={{ fontSize: 24 }}>{fam.name}</H1>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, backgroundColor: C.bg, borderRadius: 16, padding: 12 }}>
          <View style={{ flex: 1 }}>
            <Txt muted style={{ fontSize: 12 }}>Code pour rejoindre</Txt>
            <Text selectable style={{ color: C.ink, fontSize: 26, fontWeight: '900', letterSpacing: 5 }}>{fam.code}</Text>
          </View>
          <Btn small kind="sec" label={isWeb ? '📋 Copier' : '📤 Envoyer'} onPress={share} />
        </View>
        {isParent && (
          <Row style={{ marginTop: 10 }}>
            <Btn small label="📢 Réunion d'urgence" onPress={() => setModal(<AnnounceForm />)} />
            <Btn small kind="ghost" label="🔄 Changer le code"
              onPress={() => ask('Changer le code ?', "L'ancien code ne marchera plus.", [{ text: 'Annuler', style: 'cancel' }, { text: 'Changer', onPress: async () => { try { await D.newCode(fam); await refresh(); toast('Nouveau code créé'); } catch (e) { toast(e.message, 'bad'); } } }])} />
          </Row>
        )}
      </Card>

      {ranking.length > 0 && (
        <Card>
          <H2>🏅 Cette semaine</H2>
          {ranking.map(({ m, s }, k) => (
            <View key={m.id} style={{ marginTop: k ? 12 : 0 }}>
              <Pressable onPress={() => setOpen(open === m.id ? null : m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ color: k === 0 && s.done ? C.yellow : C.muted, fontWeight: '900', width: 22 }}>{k === 0 && s.done ? '👑' : k + 1}</Text>
                <Avatar m={m} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.ink, fontWeight: '800', marginBottom: 3 }}>{m.name}{D.itemsOf(week, m.id).some((x) => x.x) ? `  ·  +${D.itemsOf(week, m.id).filter((x) => x.x).length} en plus` : ''}</Text>
                  <TaskBar small done={s.done} total={s.total} />
                </View>
                <Text style={{ color: C.muted }}>{open === m.id ? '▾' : '▸'}</Text>
              </Pressable>
              {open === m.id && <View style={{ marginTop: 8 }}><PersonTasks m={m} week={week} compact /></View>}
            </View>
          ))}
          <Txt muted style={{ fontSize: 12, marginTop: 10 }}>Touche quelqu'un pour voir ses tâches{isParent ? ' et les cocher' : ''}.</Txt>
        </Card>
      )}

      {feed.length > 0 && (
        <Card>
          <H2>📰 Ce qui s'est passé</H2>
          {feed.map((e, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: i ? 10 : 0 }}>
              <Avatar m={e.m} size={30} />
              <Text style={{ color: C.ink, flex: 1 }}><Text style={{ fontWeight: '800' }}>{e.m.name}</Text> {e.txt}</Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>{D.ago(e.ts)}</Text>
            </View>
          ))}
        </Card>
      )}

      <History />

      <H2>Membres</H2>
      {members.map((m) => (
        <Pressable key={m.id} onPress={() => setModal(<MemberSheet m={m} />)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 18, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.line, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <Avatar m={m} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontWeight: '800', fontSize: 16 }}>{m.name}{m.id === currentUid() ? ' (toi)' : ''}</Text>
            <Txt muted style={{ fontSize: 13 }}>{m.managed ? '📵 sans téléphone' : '@' + m.username}{m.active === false ? ' · ne participe pas' : ''}</Txt>
          </View>
          <Chip color={m.role === 'parent' ? '#1E3A5F' : C.card2} ink={m.role === 'parent' ? C.blue : C.ink}>{m.role === 'parent' ? '👑 Parent' : 'Enfant'}</Chip>
          <Text style={{ color: C.muted, fontSize: 20 }}>›</Text>
        </Pressable>
      ))}
      {isParent && <Btn kind="sec" label="📵 Ajouter un enfant sans téléphone" style={{ marginTop: 6 }} onPress={() => setModal(<ManagedForm />)} />}
    </View>
  );
}

// 📈 Les 6 dernières semaines : pourcentage par personne et séries de semaines parfaites
function History() {
  const { fam, members } = useCtx();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  React.useEffect(() => { if (open && !data) D.history(fam.id, 6).then(setData).catch(() => setData([])); }, [open]);
  const people = members.filter((m) => m.active !== false);
  return (
    <Card>
      <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <H2 style={{ flex: 1, marginBottom: 0 }}>📈 Historique</H2>
        <Text style={{ color: C.muted }}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open && !data && <ActivityIndicator color={C.green} style={{ marginTop: 10 }} />}
      {open && data && (
        <View style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', marginLeft: 110, marginBottom: 4 }}>
            {data.map((d) => <Text key={d.o} style={{ flex: 1, color: C.muted, fontSize: 10, textAlign: 'center' }}>{d.o === 0 ? 'cette' : D.shortWeek(d.o)}</Text>)}
          </View>
          {people.map((m) => {
            let streak = 0;
            for (let i = data.length - 2; i >= 0; i--) { const w = data[i].w; const s = w ? D.stats(w, m.id) : null; if (s && s.total && s.done === s.total) streak++; else break; }
            return (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ width: 110, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Avatar m={m} size={24} />
                  <Text numberOfLines={1} style={{ color: C.ink, fontWeight: '700', flex: 1, fontSize: 13 }}>{m.name}{streak >= 2 ? ` 🔥${streak}` : ''}</Text>
                </View>
                {data.map((d) => {
                  const s = d.w ? D.stats(d.w, m.id) : null;
                  const p = s && s.total ? s.done / s.total : null;
                  return (
                    <View key={d.o} style={{ flex: 1, alignItems: 'center' }}>
                      <View style={{ width: 18, height: 34, borderRadius: 4, backgroundColor: '#3A3F4B', borderWidth: 1.5, borderColor: '#000', justifyContent: 'flex-end', overflow: 'hidden' }}>
                        {p !== null && <View style={{ height: `${Math.round(p * 100)}%`, backgroundColor: p === 1 ? C.green : p >= 0.5 ? C.yellow : C.red }} />}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
          <Txt muted style={{ fontSize: 11 }}>Vert = tout fait · 🔥 = semaines parfaites d'affilée</Txt>
        </View>
      )}
    </Card>
  );
}

function MemberSheet({ m }) {
  const { fam, week, tasks, setModal, refresh, actAs, actor, isParent, act } = useCtx();
  const [busy, setBusy] = useState(false);
  const [give, setGive] = useState(false);
  const run = async (fn, msg, close) => { setBusy(true); try { await fn(); await refresh(); if (msg) toast(msg); if (close) setModal(null); } catch (e) { toast(e.message, 'bad'); } setBusy(false); };
  const self = m.id === currentUid();
  const list = week ? D.itemsOf(week, m.id) : [];
  const s = week ? D.stats(week, m.id) : { done: 0, total: 0 };
  return (
    <View>
      <Row style={{ marginBottom: 12, flexWrap: 'nowrap' }}>
        <Avatar m={m} size={52} />
        <View style={{ flex: 1 }}><H2 style={{ marginBottom: 0 }}>{m.name}</H2><Txt muted>{m.managed ? '📵 sans téléphone' : '@' + m.username} · {m.role === 'parent' ? '👑 Parent' : 'Enfant'}</Txt></View>
      </Row>
      {week && list.length > 0 && <TaskBar small label="" done={s.done} total={s.total} />}
      {week && list.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Label>{isParent ? 'Ses tâches (touche pour cocher)' : 'Ses tâches'}</Label>
          {isParent && (
            <Row style={{ marginBottom: 8 }}>
              <Btn small kind="sec" label="✅ Tout cocher" onPress={async () => { for (const it of list) if (D.statusOf(week, it.k) !== 'done') await act(D.OPS.done(it.k, true)); }} />
              <Btn small kind="ghost" label="Tout décocher" onPress={async () => { for (const it of list) if (D.statusOf(week, it.k) === 'done') await act(D.OPS.done(it.k, false)); }} />
            </Row>
          )}
          <PersonTasks m={m} week={week} compact />
        </View>
      )}
      {isParent && week && (
        give ? (
          <View>
            <Label>Quelle tâche lui donner ?</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {tasks.map((t) => (
                <Pressable key={t.id} onPress={async () => { setGive(false); if (await act(D.OPS.give(m.id, t))) toast(`${t.emoji} donnée à ${m.name}`); }} style={({ pressed }) => ({ backgroundColor: C.card2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                  <Text style={{ color: C.ink, fontSize: 13 }}>{t.emoji} {t.title}</Text>
                </Pressable>
              ))}
            </View>
            <NewTaskQuick busy={busy} onAdd={async (t, keep) => {
              let task = { id: 'x' + Date.now().toString(36), title: t.title.trim(), emoji: t.emoji };
              if (keep) { try { const d = await D.addTask(fam.id, t); task = { id: d.id, title: d.title, emoji: d.emoji }; } catch (e) { return toast(e.message, 'bad'); } }
              setGive(false);
              if (await act(D.OPS.give(m.id, task))) toast(`${task.emoji} donnée à ${m.name}`);
            }} />
          </View>
        ) : <Btn kind="sec" small label="➕ Lui donner une tâche" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => setGive(true)} />
      )}
      {isParent && m.managed && (
        <View>
          <Btn label={`📵 Utiliser le profil de ${m.name}`} style={{ marginTop: 12 }} onPress={() => { actAs(m.id); setModal(null); }} />
          <Btn kind="sec" small label="✏️ Modifier le nom et l'avatar" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => setModal(<ManagedForm m={m} />)} />
        </View>
      )}
      {isParent && !m.managed && <Label>Rôle</Label>}
      {isParent && !m.managed && (
        <Row>
          {['parent', 'enfant'].map((r) => (
            <Btn key={r} small kind={m.role === r ? 'pri' : 'sec'} label={r === 'parent' ? '👑 Parent' : '🧒 Enfant'} disabled={busy || (self && r === 'enfant')}
              onPress={() => m.role !== r && run(() => D.setMember(m.id, { role: r }), `${m.name} est maintenant ${r}`)} />
          ))}
        </Row>
      )}
      {isParent && (
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', marginTop: 14 }}>
          <Txt style={{ flex: 1 }}>Participe aux tâches</Txt>
          <Switch value={m.active !== false} onValueChange={(v) => run(() => D.setMember(m.id, { active: v }), v ? 'Participe à partir de la prochaine répartition' : 'Ne recevra plus de tâches')} trackColor={{ true: C.green }} />
        </Row>
      )}
      {isParent && m.managed && <Btn kind="danger" small label="🗑️ Supprimer ce profil" style={{ marginTop: 16, alignSelf: 'flex-start' }}
        onPress={() => ask('Supprimer ce profil ?', `Le profil de ${m.name} sera effacé.`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => run(async () => { await D.deleteManaged(m.id); if (actor.id === m.id) actAs(null); }, 'Profil supprimé', true) }])} />}
      {isParent && !self && !m.managed && m.id !== fam.owner && <Btn kind="danger" small label="Retirer de la famille" style={{ marginTop: 16, alignSelf: 'flex-start' }}
        onPress={() => ask('Retirer ?', `${m.name} ne fera plus partie de la famille.`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Retirer', style: 'destructive', onPress: () => run(() => D.setMember(m.id, { familyId: '', role: '' }), 'Membre retiré', true) }])} />}
      <Btn kind="ghost" label="Fermer" style={{ marginTop: 14 }} onPress={() => setModal(null)} />
    </View>
  );
}

/* =========================================================
   Onglet « Tâches » (parents)
   ========================================================= */
export function TasksScreen() {
  const { fam, tasks, members, week, isParent, setModal, refresh } = useCtx();
  const pool = tasks.reduce((a, t) => a + (t.times || 1), 0);
  const people = members.filter((m) => m.active !== false).length || 1;
  const auto = Math.max(1, Math.floor(pool / people));
  const per = fam.perPerson || 0;
  const setF = async (patch) => { try { await D.updateFamily(fam.id, patch); await refresh(); } catch (e) { toast(e.message, 'bad'); } };
  const redo = () => ask('Refaire la répartition ?', 'Les tâches de cette semaine seront redistribuées et les cases cochées remises à zéro.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Répartir', onPress: async () => { try { await D.buildWeek(fam, members, tasks, false); await refresh(); toast('🔀 Nouvelle répartition faite'); } catch (e) { toast(e.message, 'bad'); } } },
  ]);
  return (
    <View>
      {isParent && (
        <Card>
          <H2>⚖️ Répartition</H2>
          <Txt muted>{pool} tâches par semaine pour {people} personne{people > 1 ? 's' : ''}.</Txt>
          <Label>Tâches par personne et par semaine</Label>
          <Stepper value={per} onChange={(v) => setF({ perPerson: v })} max={40} fmt={(v) => (v === 0 ? `Auto (${auto})` : v)} />
          <Label>Tâches oubliées</Label>
          <Txt muted style={{ fontSize: 13, marginBottom: 6 }}>Pour chaque tâche pas faite, la semaine suivante on en a :</Txt>
          <Stepper value={fam.penalty ?? 1} onChange={(v) => setF({ penalty: v })} max={3} fmt={(v) => (v === 0 ? 'Aucune' : `+${v} en plus`)} />
          <Txt muted style={{ fontSize: 13, marginTop: 8, marginBottom: 6 }}>Au maximum :</Txt>
          <Stepper value={fam.penMax ?? 3} onChange={(v) => setF({ penMax: v })} max={10} fmt={(v) => `+${v} / semaine`} />
          <Btn kind="sec" label="🔀 Refaire la répartition de cette semaine" style={{ marginTop: 16 }} onPress={redo} />
          <Txt muted style={{ fontSize: 12, marginTop: 6 }}>Chaque lundi, la nouvelle semaine se répartit toute seule, en évitant de redonner à chacun les mêmes tâches que les semaines d'avant.</Txt>
        </Card>
      )}
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <H2 style={{ marginBottom: 0 }}>Les tâches de la maison</H2>
        {isParent && <Btn small label="＋ Ajouter" onPress={() => setModal(<TaskForm />)} />}
      </Row>
      <Row style={{ marginBottom: 10 }}>
        {isParent && <Btn small kind="sec" label="📋 Remplacer toute la liste" onPress={() => setModal(<ReplaceTasks fam={fam} members={members} onDone={async () => { setModal(null); await refresh(); }} onCancel={() => setModal(null)} />)} />}
      </Row>
      {tasks.map((t) => (
        <Pressable key={t.id} onPress={() => (isParent ? setModal(<TaskForm t={t} />) : null)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 16, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ fontSize: 24 }}>{t.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontWeight: '800', fontSize: 15 }}>{t.title}</Text>
            {!!t.info && <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={2}>📌 {t.info}</Text>}
          </View>
          <Chip>{(t.times > 1 ? `${t.times}× / sem.` : '1× / sem.') + (t.day ? ` · ${D.DAY_NAMES[t.day].slice(0, 3)}` : '')}</Chip>
        </Pressable>
      ))}
      {!tasks.length && <Txt muted>Aucune tâche pour l'instant.</Txt>}
      {isParent && tasks.length > 0 && !week && <Btn label="▶️ Lancer la semaine" style={{ marginTop: 10 }} onPress={async () => { try { await D.ensureWeek(fam, members, tasks); await refresh(); } catch (e) { toast(e.message, 'bad'); } }} />}
    </View>
  );
}

const EMOJIS = ['🍽️', '🧽', '🗑️', '🧹', '🛏️', '🧺', '👕', '🍴', '🧼', '🚽', '🪴', '🛒', '🐶', '🐱', '🚗', '🪟', '🍳', '♻️', '📦', '🧸', '🛁', '🌿', '❄️', '✨',
  '🐟', '🐹', '🐰', '🍂', '🌱', '🚲', '🧴', '🪣', '🧻', '🥕', '🍞', '🥛', '📚', '🎒', '💡', '🔌', '🧊', '🥾'];
// Garde un seul emoji (le premier « caractère visible », même les emojis composés comme 👨‍🍳)
function firstEmoji(txt) {
  const t = String(txt || '').trim();
  if (!t) return '';
  try { if (typeof Intl !== 'undefined' && Intl.Segmenter) { const it = new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(t)[Symbol.iterator]().next(); if (!it.done) return it.value.segment; } } catch (e) { /* pas de Segmenter */ }
  // sans Segmenter : on assemble à la main (variantes, couleurs de peau, emojis liés par ZWJ, drapeaux)
  const cps = Array.from(t);
  let out = cps[0], i = 1;
  const cp = (c) => c.codePointAt(0);
  const isRI = (c) => c && cp(c) >= 0x1f1e6 && cp(c) <= 0x1f1ff;
  if (isRI(cps[0]) && isRI(cps[1])) return cps[0] + cps[1];
  while (i < cps.length) {
    const c = cps[i], n = cp(c);
    if (n === 0xfe0f || n === 0x20e3 || (n >= 0x1f3fb && n <= 0x1f3ff)) { out += c; i++; }
    else if (n === 0x200d && cps[i + 1]) { out += c + cps[i + 1]; i += 2; }
    else break;
  }
  return out;
}
function TaskForm({ t }) {
  const { fam, setModal, refresh } = useCtx();
  const [emoji, setEmoji] = useState(t ? t.emoji : '✨');
  const [custom, setCustom] = useState('');
  const [title, setTitle] = useState(t ? t.title : '');
  const [times, setTimes] = useState(t ? t.times || 1 : 1);
  const [info, setInfo] = useState(t ? t.info || '' : '');
  const [day, setDay] = useState(t ? t.day || 0 : 0);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!title.trim()) return setErr('Écris le nom de la tâche.');
    try {
      if (t) await D.editTask(fam.id, t.id, { emoji, title, times, info, day }); else await D.addTask(fam.id, { emoji, title, times, info, day });
      await refresh(); setModal(null); toast(t ? 'Tâche modifiée' : 'Tâche ajoutée ✅');
    } catch (e) { setErr(e.message); }
  };
  return (
    <View>
      <H2>{t ? 'Modifier la tâche' : 'Nouvelle tâche'}</H2>
      <Label>Nom</Label>
      <Input value={title} onChangeText={setTitle} placeholder="ex. Nourrir le chat" autoFocus={!t} />
      <Label>Icône</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {EMOJIS.map((e) => (
          <Pressable key={e} onPress={() => { setEmoji(e); setCustom(''); }} style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: emoji === e ? C.card2 : 'transparent', borderWidth: emoji === e ? 2 : 0, borderColor: C.green }}>
            <Text style={{ fontSize: 22 }}>{e}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.green }}>
          <Text style={{ fontSize: 28 }}>{emoji}</Text>
        </View>
        <Input style={{ flex: 1 }} value={custom} placeholder="…ou tape n'importe quel emoji 😀"
          onChangeText={(v) => { setCustom(v); const e = firstEmoji(v); if (e) setEmoji(e); }} />
      </View>
      <Txt muted style={{ fontSize: 12, marginTop: 4 }}>Ouvre le clavier emoji de ton téléphone (😀) ou, sur PC, Windows + .</Txt>
      <Label>Consignes (facultatif, visibles par tous)</Label>
      <Input value={info} onChangeText={setInfo} placeholder="ex. Sacs jaunes le mardi, bac vert le jeudi" multiline />
      <Label>Combien de fois par semaine ?</Label>
      <Stepper value={times} onChange={setTimes} min={1} max={14} fmt={(v) => `${v}×`} />
      <Txt muted style={{ fontSize: 12, marginTop: 6 }}>Ex. « Vider le lave-vaisselle » 7× : elle sera partagée entre plusieurs personnes.</Txt>
      <Label>Un jour précis ? (facultatif)</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {['N\'importe', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((l, d) => (
          <Pressable key={d} onPress={() => setDay(d)} style={{ paddingVertical: 8, paddingHorizontal: 11, borderRadius: 10, backgroundColor: day === d ? C.green : C.bg, borderWidth: 1, borderColor: day === d ? C.green : C.line }}>
            <Text style={{ color: day === d ? '#0B1A06' : C.ink, fontWeight: '800', fontSize: 13 }}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <Txt muted style={{ fontSize: 12, marginTop: 6 }}>Ex. « Sortir les poubelles » le mardi : elle passe en tête de liste ce jour-là.</Txt>
      <Err>{err}</Err>
      <Row style={{ marginTop: 16 }}>
        <Btn label="Enregistrer" onPress={save} />
        <Btn kind="ghost" label="Annuler" onPress={() => setModal(null)} />
      </Row>
      {t && <Btn kind="danger" small label="🗑️ Supprimer" style={{ marginTop: 14, alignSelf: 'flex-start' }}
        onPress={() => ask('Supprimer ?', `« ${t.title} » ne sera plus distribuée.`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: async () => { try { await D.removeTask(fam.id, t.id); await refresh(); setModal(null); } catch (e) { toast(e.message, 'bad'); } } }])} />}
      <Txt muted style={{ fontSize: 12, marginTop: 10 }}>Les changements comptent à partir de la prochaine répartition.</Txt>
    </View>
  );
}

/* =========================================================
   Onglet « Moi »
   ========================================================= */
export function ProfileScreen() {
  const { me, fam, refresh, logout } = useCtx();
  const [name, setName] = useState(me.name);
  const [avatar, setAvatar] = useState(me.avatar);
  const [color, setColor] = useState(me.color);
  const save = async () => { try { await D.updateMe({ name: name.trim() || me.username, avatar, color }); await refresh(); toast('Profil enregistré'); } catch (e) { toast(e.message, 'bad'); } };
  return (
    <View>
      <Card>
        <H2>Mon profil</H2>
        <Txt muted>@{me.username} · {me.role === 'parent' ? '👑 Parent' : 'Enfant'} · {fam.name}</Txt>
        <Label>Prénom affiché</Label>
        <Input value={name} onChangeText={setName} />
        <Label>Avatar</Label>
        <AvatarPicker avatar={avatar} color={color} setAvatar={setAvatar} setColor={setColor} />
        <Btn label="Enregistrer" style={{ marginTop: 14 }} onPress={save} />
      </Card>
      <NotifCard />
      <Btn kind="sec" label="Se déconnecter" onPress={logout} />
      <DeleteAccount me={me} after={logout} />
      {fam.owner !== me.id && <Btn kind="danger" label="Quitter la famille" style={{ marginTop: 10 }}
        onPress={() => ask('Quitter la famille ?', 'Tu pourras la rejoindre à nouveau avec le code.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Quitter', style: 'destructive', onPress: async () => { await D.leaveFamily(); await refresh(); } }])} />}
    </View>
  );
}

/* ---------- Supprimer mon compte ---------- */
function DeleteAccount({ me, after }) {
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return <Btn kind="ghost" small label="Supprimer mon compte" style={{ marginTop: 18, alignSelf: 'center' }} onPress={() => setOpen(true)} />;
  const go = async () => {
    setErr(''); setBusy(true);
    try { await D.deleteMyAccount(me, pass); toast('Compte supprimé'); await after(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Card style={{ marginTop: 18, borderColor: '#7F1D1D' }}>
      <H2>Supprimer mon compte</H2>
      <Txt muted>Ton pseudo @{me.username}, ton profil et tes réglages seront effacés. Tu pourras recréer un compte avec le même pseudo.</Txt>
      <Label>Ton mot de passe pour confirmer</Label>
      <Input value={pass} onChangeText={setPass} secureTextEntry />
      <Err>{err}</Err>
      <Row style={{ marginTop: 12 }}>
        <Btn kind="danger" label={busy ? '…' : 'Supprimer définitivement'} disabled={busy || pass.length < 6} onPress={go} />
        <Btn kind="ghost" label="Annuler" onPress={() => { setOpen(false); setPass(''); setErr(''); }} />
      </Row>
    </Card>
  );
}

/* ---------- Profils sans téléphone ---------- */
function ManagedForm({ m }) {
  const { fam, setModal, refresh, actAs } = useCtx();
  const [name, setName] = useState(m ? m.name : '');
  const [avatar, setAvatar] = useState(m ? m.avatar : D.AVATARS[Math.floor(Math.random() * D.AVATARS.length)]);
  const [color, setColor] = useState(m ? m.color : D.COLORS[Math.floor(Math.random() * 8)]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return setErr('Écris son prénom.');
    setBusy(true);
    try {
      if (m) await D.updateManaged(m.id, { name: name.trim(), avatar, color });
      else await D.createManaged(fam.id, { name, avatar, color });
      await refresh(); setModal(null);
      toast(m ? 'Profil modifié' : `📵 Profil de ${name.trim()} créé : il aura ses tâches à la prochaine répartition`);
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <View>
      <H2>{m ? 'Modifier le profil' : 'Enfant sans téléphone'}</H2>
      {!m && <Txt muted>Il n'a pas de compte : c'est toi qui coches ses tâches depuis ton appli, en changeant de profil.</Txt>}
      <Label>Prénom</Label>
      <Input value={name} onChangeText={setName} placeholder="ex. Léo" autoFocus={!m} />
      <Label>Avatar</Label>
      <AvatarPicker avatar={avatar} color={color} setAvatar={setAvatar} setColor={setColor} />
      <Err>{err}</Err>
      <Row style={{ marginTop: 16 }}>
        <Btn label={m ? 'Enregistrer' : 'Créer le profil'} onPress={save} disabled={busy} />
        <Btn kind="ghost" label="Annuler" onPress={() => setModal(null)} />
      </Row>
    </View>
  );
}

// Changer de profil (moi ↔ enfants sans téléphone)
export function Switcher() {
  const { me, actor, actAs, members, week, isParent, setModal } = useCtx();
  const managed = isParent ? members.filter((m) => m.managed) : [];
  const Item = ({ m, label }) => {
    const on = actor.id === m.id;
    const st = week ? D.stats(week, m.id) : null;
    return (
      <Pressable onPress={() => { actAs(m.id === me.id ? null : m.id); setModal(null); }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, marginBottom: 8, backgroundColor: on ? C.card2 : C.bg, borderWidth: 2, borderColor: on ? C.green : C.line, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
        <Avatar m={m} size={46} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.ink, fontWeight: '900', fontSize: 16 }}>{m.name}</Text>
          <Txt muted style={{ fontSize: 13 }}>{label}{st && st.total ? ` · ${st.done}/${st.total} tâches` : ''}</Txt>
        </View>
        {on && <Text style={{ color: C.green, fontWeight: '900' }}>✓</Text>}
      </Pressable>
    );
  };
  return (
    <View>
      <H2>Changer de profil</H2>
      <Item m={me} label={`Moi · @${me.username}`} />
      {managed.map((m) => <Item key={m.id} m={m} label="📵 sans téléphone" />)}
      {isParent && <Btn kind="sec" label="＋ Ajouter un enfant sans téléphone" style={{ marginTop: 6 }} onPress={() => setModal(<ManagedForm />)} />}
      {!isParent && <Txt muted style={{ marginTop: 6 }}>Seuls les parents peuvent utiliser les profils sans téléphone.</Txt>}
      <Btn kind="ghost" label="Fermer" style={{ marginTop: 10 }} onPress={() => setModal(null)} />
    </View>
  );
}

/* ---------- Rappels ---------- */
function NotifCard() {
  const { refresh } = useCtx();
  const [p, setP] = useState(null);
  React.useEffect(() => { notifPrefs().then(setP); }, []);
  if (isWeb) return null;
  if (!notifSupported()) return (
    <Card><H2>🔔 Rappels</H2><Txt muted>Pour recevoir des rappels (tâches du jour, dernier jour de la semaine…), installe la nouvelle version de l'appli (nouvelle APK).</Txt></Card>
  );
  if (!p) return null;
  const save = async (np) => { setP(np); await setNotifPrefs(np); resetNotifSig(); refresh(); };
  return (
    <Card>
      <H2>🔔 Rappels</H2>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <Txt style={{ flex: 1 }}>Me rappeler mes tâches</Txt>
        <Switch value={p.on} onValueChange={(v) => save({ ...p, on: v })} trackColor={{ true: C.green }} />
      </Row>
      {p.on && (
        <View>
          <Txt muted style={{ fontSize: 13, marginTop: 6 }}>Le matin pour les tâches du jour, le mercredi et le vendredi soir s'il en reste, et le dimanche (dernier jour).</Txt>
          <Label>Heure du rappel du soir</Label>
          <Stepper value={p.hour} onChange={(v) => save({ ...p, hour: v })} min={12} max={22} fmt={(v) => `${v}h00`} />
          <Btn small kind="ghost" label="Tester une notification" style={{ alignSelf: 'flex-start', marginTop: 10 }} onPress={async () => { if (!(await testNotif())) toast('Autorise les notifications dans les réglages du téléphone', 'bad'); }} />
        </View>
      )}
    </Card>
  );
}
