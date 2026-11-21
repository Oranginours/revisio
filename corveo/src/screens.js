// Écrans de Corvéo.
import React, { useState, useContext, createContext } from 'react';
import { View, Text, Pressable, Share, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { C, Txt, H1, H2, Label, Card, Row, Btn, Input, Err, Stepper, TaskBar, Avatar, Chip, Pop, toast, ask, isWeb } from './ui';
import * as D from './data';
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

export function WeekScreen() {
  const { me, fam, members, week, tasks, refresh, setWeek, isParent, setModal } = useCtx();
  const [pop, setPop] = useState(0);
  if (!tasks.length) {
    return (
      <Card>
        <H2>Aucune tâche pour l'instant</H2>
        <Txt muted>{isParent ? "Ajoute les tâches de la maison dans l'onglet Tâches : la semaine se répartit toute seule." : 'Un parent doit ajouter les tâches de la maison.'}</Txt>
      </Card>
    );
  }
  if (!week) return <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />;
  const uid = currentUid();
  const mine = (week.assign && week.assign[uid]) || [];
  const fs = D.familyStats(week), ms = D.stats(week, uid);
  const extra = (week.extra && week.extra[uid]) || 0;
  const allDone = ms.total > 0 && ms.done === ms.total;
  const dl = D.daysLeft();

  const toggle = async (i) => {
    const key = D.doneKey(uid, i);
    const on = !(week.done && week.done[key]);
    // on coche tout de suite à l'écran, puis on enregistre
    setWeek({ ...week, done: { ...(week.done || {}), [key]: on ? Date.now() : undefined }, doing: { ...(week.doing || {}), [key]: undefined } });
    if (on) setPop((p) => p + 1);
    try { await D.setDone(fam.id, uid, i, on); if (on && ms.done + 1 === ms.total) toast('🎉 Toutes tes tâches sont faites !'); }
    catch (e) { toast(e.message, 'bad'); refresh(); }
  };

  return (
    <View>
      <Card style={{ backgroundColor: '#141A28', borderColor: '#000', borderWidth: 2 }}>
        <TaskBar label="TÂCHES DE LA FAMILLE" done={fs.done} total={fs.total} />
        <TaskBar label="MES TÂCHES" done={ms.done} total={ms.total} />
        <Txt muted style={{ fontSize: 13 }}>{dl === 1 ? '⏰ Dernier jour de la semaine !' : `⏳ Encore ${DAYS[dl]} avant lundi`}</Txt>
      </Card>

      {extra > 0 && (
        <View style={{ backgroundColor: '#3B1518', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#7F1D1D' }}>
          <Txt style={{ color: '#FCA5A5' }} bold>⚠️ +{extra} tâche{extra > 1 ? 's' : ''} en plus cette semaine</Txt>
          <Txt style={{ color: '#FCA5A5', fontSize: 13 }}>Des tâches n'ont pas été faites la semaine dernière.</Txt>
        </View>
      )}

      {allDone && (
        <Pop trigger={pop}>
          <View style={{ backgroundColor: '#14301A', borderRadius: 20, padding: 18, marginBottom: 12, alignItems: 'center', borderWidth: 2, borderColor: C.green }}>
            <Text style={{ fontSize: 40 }}>🏆</Text>
            <Text style={{ color: C.green, fontWeight: '900', fontSize: 20 }}>TÂCHES TERMINÉES !</Text>
            <Txt muted center>Bien joué {me.name}, tu as fait ta part cette semaine.</Txt>
          </View>
        </Pop>
      )}

      <H2>Mes tâches</H2>
      {mine.length === 0 && <Txt muted>Rien pour toi cette semaine.</Txt>}
      {mine.map((t, i) => {
        const k = D.doneKey(uid, i);
        return <TaskRow key={i} t={t} status={D.statusOf(week, k)} notes={((week.notes || {})[k] || []).length}
          onPress={() => setModal(<TaskSheet uid={uid} i={i} />)} onCheck={() => toggle(i)} extra={i >= mine.length - extra} />;
      })}
      {mine.length > 0 && <Txt muted style={{ fontSize: 12, marginTop: 2 }}>Touche une tâche pour dire qu'elle est en cours ou ajouter une note.</Txt>}
      <Others members={members} week={week} />
    </View>
  );
}

export function TaskRow({ t, status, notes, onPress, onCheck, extra, who }) {
  const done = status === 'done', doing = status === 'doing';
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: done ? '#14301A' : doing ? '#2E2810' : C.card, borderRadius: 18, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: done ? C.greenDark : doing ? '#A16207' : C.line, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <Text style={{ fontSize: 26 }}>{t.e || '✨'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: done ? C.muted : C.ink, fontSize: 16, fontWeight: '800', textDecorationLine: done ? 'line-through' : 'none' }}>{t.n}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
          {who ? <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700' }}>{who}</Text> : null}
          {doing && <Text style={{ color: C.yellow, fontSize: 12, fontWeight: '900' }}>⏳ EN COURS</Text>}
          {extra && !done && <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '700' }}>tâche en plus</Text>}
          {notes > 0 && <Text style={{ color: C.blue, fontSize: 12, fontWeight: '800' }}>💬 {notes}</Text>}
        </View>
      </View>
      {onCheck ? (
        <Pressable onPress={onCheck} hitSlop={10}>
          <Pop trigger={done}>
            <View style={{ width: 34, height: 34, borderRadius: 10, borderWidth: 3, borderColor: done ? C.green : doing ? C.yellow : '#5B6478', backgroundColor: done ? C.green : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {done ? <Text style={{ color: '#0B1A06', fontWeight: '900', fontSize: 18 }}>✓</Text> : doing ? <Text style={{ fontSize: 14 }}>⏳</Text> : null}
            </View>
          </Pop>
        </Pressable>
      ) : (
        <Text style={{ fontSize: 20 }}>{done ? '✅' : doing ? '⏳' : '⬜'}</Text>
      )}
    </Pressable>
  );
}

// Les tâches des autres : on voit qui fait quoi, ce qui est en cours, et les notes
function Others({ members, week }) {
  const { setModal } = useCtx();
  const [open, setOpen] = useState(null);
  const list = members.filter((m) => week.assign && week.assign[m.id] && m.id !== currentUid());
  if (!list.length) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <H2>Les autres</H2>
      {list.map((m) => {
        const s = D.stats(week, m.id);
        const tasks = week.assign[m.id] || [];
        const doing = tasks.filter((_, i) => D.statusOf(week, D.doneKey(m.id, i)) === 'doing').length;
        const isOpen = open === m.id;
        return (
          <View key={m.id} style={{ marginBottom: 10 }}>
            <Pressable onPress={() => setOpen(isOpen ? null : m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar m={m} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontWeight: '800', marginBottom: 3 }}>{m.name}{s.total && s.done === s.total ? ' ✅' : ''}{doing ? `  ·  ⏳ ${doing} en cours` : ''}</Text>
                <TaskBar small done={s.done} total={s.total} />
              </View>
              <Text style={{ color: C.muted, fontSize: 16 }}>{isOpen ? '▾' : '▸'}</Text>
            </Pressable>
            {isOpen && (
              <View style={{ marginTop: 8, marginLeft: 8 }}>
                {tasks.map((t, i) => {
                  const k = D.doneKey(m.id, i);
                  return <TaskRow key={i} t={t} status={D.statusOf(week, k)} notes={((week.notes || {})[k] || []).length} onPress={() => setModal(<TaskSheet uid={m.id} i={i} />)} />;
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// Fiche d'une tâche : statut (à faire / en cours / faite) et notes visibles par tous
export function TaskSheet({ uid, i }) {
  const { me, fam, week, setWeek, members, tasks, isParent, setModal, refresh } = useCtx();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  if (!week || !week.assign || !week.assign[uid] || !week.assign[uid][i]) return <Txt muted>Cette tâche n'existe plus.</Txt>;
  const t = week.assign[uid][i];
  const k = D.doneKey(uid, i);
  const status = D.statusOf(week, k);
  const owner = members.find((m) => m.id === uid) || { name: '?' };
  const mine = uid === me.id;
  const canEdit = mine || isParent;
  const info = (tasks.find((x) => x.id === t.t) || {}).info;
  const notes = (week.notes || {})[k] || [];
  const doingBy = week.doing && week.doing[k] && week.doing[k].by;

  const setStatus = async (st) => {
    if (busy || st === status) return;
    setBusy(true);
    const next = { ...week, done: { ...(week.done || {}) }, doing: { ...(week.doing || {}) } };
    next.done[k] = st === 'done' ? Date.now() : undefined;
    next.doing[k] = st === 'doing' ? { ts: Date.now(), by: me.name } : undefined;
    setWeek(next);
    try {
      if (st === 'doing') await D.setDoing(fam.id, uid, i, true, me.name);
      else if (st === 'done') await D.setDone(fam.id, uid, i, true);
      else await D.setDone(fam.id, uid, i, false);
      if (st === 'done') toast('✅ Tâche faite !');
    } catch (e) { toast(e.message, 'bad'); refresh(); }
    setBusy(false);
  };
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try { const list = await D.addNote(fam.id, week, k, me, text); setWeek({ ...week, notes: { ...(week.notes || {}), [k]: list } }); setText(''); }
    catch (e) { toast(e.message, 'bad'); }
    setBusy(false);
  };
  const del = async (ts) => {
    try { const list = await D.removeNote(fam.id, week, k, ts); setWeek({ ...week, notes: { ...(week.notes || {}), [k]: list.length ? list : undefined } }); }
    catch (e) { toast(e.message, 'bad'); }
  };
  const ago = (ts) => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
  const ST = [['todo', '⬜ À faire', C.card2], ['doing', '⏳ En cours', '#A16207'], ['done', '✅ Faite', C.greenDark]];

  return (
    <View>
      <Row style={{ flexWrap: 'nowrap', marginBottom: 6 }}>
        <Text style={{ fontSize: 40 }}>{t.e || '✨'}</Text>
        <View style={{ flex: 1 }}>
          <H2 style={{ marginBottom: 0 }}>{t.n}</H2>
          <Txt muted>{mine ? 'Ta tâche' : `Tâche de ${owner.name}`}{status === 'doing' && doingBy ? ` · lancée par ${doingBy}` : ''}</Txt>
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

      <Label>Notes ({notes.length})</Label>
      {notes.length === 0 && <Txt muted>Pas encore de note. Ex. « plus de liquide vaisselle », « je la fais ce soir ».</Txt>}
      {notes.map((n) => (
        <View key={n.ts} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <Text style={{ fontSize: 22 }}>{n.a || '💬'}</Text>
          <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 14, padding: 10 }}>
            <Text style={{ color: C.muted, fontSize: 12, fontWeight: '800' }}>{n.n} · {ago(n.ts)}</Text>
            <Txt>{n.t}</Txt>
          </View>
          {(n.u === me.id || isParent) && <Pressable hitSlop={8} onPress={() => del(n.ts)}><Text style={{ color: C.muted }}>✕</Text></Pressable>}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 4 }}>
        <Input style={{ flex: 1 }} value={text} onChangeText={setText} placeholder="Écrire une note…" multiline onSubmitEditing={send} />
        <Btn small label="Envoyer" onPress={send} disabled={busy || !text.trim()} />
      </View>
      <Btn kind="ghost" label="Fermer" style={{ marginTop: 14 }} onPress={() => setModal(null)} />
    </View>
  );
}

/* =========================================================
   Onglet « Famille »
   ========================================================= */
export function FamilyScreen() {
  const { fam, members, week, isParent, setModal, refresh } = useCtx();
  const share = async () => {
    const msg = `Rejoins notre famille sur Corvéo 🧹\nCode : ${fam.code}`;
    try { if (isWeb && navigator.clipboard) { await navigator.clipboard.writeText(fam.code); toast('Code copié 📋'); } else await Share.share({ message: msg }); } catch (e) { /* annulé */ }
  };
  const ranking = members.filter((m) => week && week.assign && week.assign[m.id])
    .map((m) => ({ m, s: D.stats(week, m.id) }))
    .sort((a, b) => (b.s.total ? b.s.done / b.s.total : 0) - (a.s.total ? a.s.done / a.s.total : 0));
  return (
    <View>
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
        {isParent && <Btn small kind="ghost" label="🔄 Changer le code" style={{ alignSelf: 'flex-start', marginTop: 6 }}
          onPress={() => ask('Changer le code ?', "L'ancien code ne marchera plus.", [{ text: 'Annuler', style: 'cancel' }, { text: 'Changer', onPress: async () => { try { await D.newCode(fam); await refresh(true); toast('Nouveau code créé'); } catch (e) { toast(e.message, 'bad'); } } }])} />}
      </Card>

      {ranking.length > 0 && (
        <Card>
          <H2>🏅 Cette semaine</H2>
          {ranking.map(({ m, s }, k) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: k ? 12 : 0 }}>
              <Text style={{ color: C.muted, fontWeight: '900', width: 18 }}>{k + 1}</Text>
              <Avatar m={m} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontWeight: '800', marginBottom: 3 }}>{m.name}{week.extra && week.extra[m.id] ? `  ·  +${week.extra[m.id]} en plus` : ''}</Text>
                <TaskBar small done={s.done} total={s.total} />
              </View>
            </View>
          ))}
        </Card>
      )}

      <H2>Membres</H2>
      {members.map((m) => (
        <Pressable key={m.id} onPress={() => (isParent ? setModal(<MemberSheet m={m} />) : null)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 18, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.line }}>
          <Avatar m={m} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontWeight: '800', fontSize: 16 }}>{m.name}{m.id === currentUid() ? ' (toi)' : ''}</Text>
            <Txt muted style={{ fontSize: 13 }}>@{m.username}{m.active === false ? ' · ne participe pas' : ''}</Txt>
          </View>
          <Chip color={m.role === 'parent' ? '#1E3A5F' : C.card2} ink={m.role === 'parent' ? C.blue : C.ink}>{m.role === 'parent' ? '👑 Parent' : 'Enfant'}</Chip>
          {isParent && <Text style={{ color: C.muted, fontSize: 20 }}>›</Text>}
        </Pressable>
      ))}
      {isParent && <Txt muted style={{ fontSize: 12, marginTop: 4 }}>Touche un membre pour le passer parent, valider ses tâches ou lui en donner une en plus.</Txt>}
    </View>
  );
}

function MemberSheet({ m }) {
  const { fam, week, tasks, setModal, refresh } = useCtx();
  const [busy, setBusy] = useState(false);
  const run = async (fn, msg) => { setBusy(true); try { await fn(); await refresh(true); if (msg) toast(msg); setModal(null); } catch (e) { toast(e.message, 'bad'); } setBusy(false); };
  const list = (week && week.assign && week.assign[m.id]) || [];
  const [, setT] = useState(0);
  const [give, setGive] = useState(false);
  const self = m.id === currentUid();
  return (
    <View>
      <Row style={{ marginBottom: 12 }}>
        <Avatar m={m} size={52} />
        <View style={{ flex: 1 }}><H2 style={{ marginBottom: 0 }}>{m.name}</H2><Txt muted>@{m.username}</Txt></View>
      </Row>
      {list.length > 0 && (
        <View>
          <Label>Ses tâches (tu peux les valider)</Label>
          {list.map((t, i) => {
            const k = D.doneKey(m.id, i);
            const done = !!(week.done && week.done[k]);
            return <TaskRow key={i} t={t} status={D.statusOf(week, k)} notes={((week.notes || {})[k] || []).length}
              onPress={() => setModal(<TaskSheet uid={m.id} i={i} />)}
              onCheck={async () => {
                week.done = { ...(week.done || {}), [k]: done ? undefined : Date.now() }; setT((x) => x + 1);
                try { await D.setDone(fam.id, m.id, i, !done); refresh(); } catch (e) { toast(e.message, 'bad'); }
              }} />;
          })}
        </View>
      )}
      {week && (
        give ? (
          <View>
            <Label>Quelle tâche en plus ?</Label>
            {tasks.map((t) => (
              <Pressable key={t.id} onPress={() => run(() => D.giveTask(fam.id, week, m.id, t), `Tâche donnée à ${m.name}`)} style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderColor: C.line }}>
                <Text style={{ fontSize: 20 }}>{t.emoji}</Text><Txt>{t.title}</Txt>
              </Pressable>
            ))}
          </View>
        ) : <Btn kind="sec" small label="➕ Lui donner une tâche en plus" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => setGive(true)} />
      )}
      <Label>Rôle</Label>
      <Row>
        {['parent', 'enfant'].map((r) => (
          <Btn key={r} small kind={m.role === r ? 'pri' : 'sec'} label={r === 'parent' ? '👑 Parent' : '🧒 Enfant'} disabled={busy || (self && r === 'enfant')}
            onPress={() => m.role !== r && run(() => D.setMember(m.id, { role: r }), `${m.name} est maintenant ${r}`)} />
        ))}
      </Row>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', marginTop: 14 }}>
        <Txt style={{ flex: 1 }}>Participe aux tâches</Txt>
        <Switch value={m.active !== false} onValueChange={(v) => run(() => D.setMember(m.id, { active: v }), v ? 'Participe à partir de la prochaine répartition' : 'Ne recevra plus de tâches')} trackColor={{ true: C.green }} />
      </Row>
      {!self && m.id !== fam.owner && <Btn kind="danger" small label="Retirer de la famille" style={{ marginTop: 16, alignSelf: 'flex-start' }}
        onPress={() => ask('Retirer ?', `${m.name} ne fera plus partie de la famille.`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Retirer', style: 'destructive', onPress: () => run(() => D.setMember(m.id, { familyId: '', role: '' }), 'Membre retiré') }])} />}
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
  const setF = async (patch) => { try { await D.updateFamily(fam.id, patch); await refresh(true); } catch (e) { toast(e.message, 'bad'); } };
  const redo = () => ask('Refaire la répartition ?', 'Les tâches de cette semaine seront redistribuées et les cases cochées remises à zéro.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Répartir', onPress: async () => { try { await D.buildWeek(fam, members, tasks, false); await refresh(true); toast('🔀 Nouvelle répartition faite'); } catch (e) { toast(e.message, 'bad'); } } },
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
      {tasks.map((t) => (
        <Pressable key={t.id} onPress={() => (isParent ? setModal(<TaskForm t={t} />) : null)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 16, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: C.line }}>
          <Text style={{ fontSize: 24 }}>{t.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontWeight: '800', fontSize: 15 }}>{t.title}</Text>
            {!!t.info && <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={2}>📌 {t.info}</Text>}
          </View>
          <Chip>{t.times > 1 ? `${t.times}× / sem.` : '1× / sem.'}</Chip>
        </Pressable>
      ))}
      {!tasks.length && <Txt muted>Aucune tâche pour l'instant.</Txt>}
      {isParent && tasks.length > 0 && !week && <Btn label="▶️ Lancer la semaine" style={{ marginTop: 10 }} onPress={async () => { try { await D.ensureWeek(fam, members, tasks); await refresh(true); } catch (e) { toast(e.message, 'bad'); } }} />}
    </View>
  );
}

const EMOJIS = ['🍽️', '🧽', '🗑️', '🧹', '🛏️', '🧺', '👕', '🍴', '🧼', '🚽', '🪴', '🛒', '🐶', '🐱', '🚗', '🪟', '🍳', '♻️', '📦', '🧸', '🛁', '🌿', '❄️', '✨'];
function TaskForm({ t }) {
  const { fam, setModal, refresh } = useCtx();
  const [emoji, setEmoji] = useState(t ? t.emoji : '✨');
  const [title, setTitle] = useState(t ? t.title : '');
  const [times, setTimes] = useState(t ? t.times || 1 : 1);
  const [info, setInfo] = useState(t ? t.info || '' : '');
  const [err, setErr] = useState('');
  const save = async () => {
    if (!title.trim()) return setErr('Écris le nom de la tâche.');
    try {
      if (t) await D.editTask(fam.id, t.id, { emoji, title, times, info }); else await D.addTask(fam.id, { emoji, title, times, info });
      await refresh(true); setModal(null); toast(t ? 'Tâche modifiée' : 'Tâche ajoutée ✅');
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
          <Pressable key={e} onPress={() => setEmoji(e)} style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: emoji === e ? C.card2 : 'transparent', borderWidth: emoji === e ? 2 : 0, borderColor: C.green }}>
            <Text style={{ fontSize: 22 }}>{e}</Text>
          </Pressable>
        ))}
      </View>
      <Label>Consignes (facultatif, visibles par tous)</Label>
      <Input value={info} onChangeText={setInfo} placeholder="ex. Sacs jaunes le mardi, bac vert le jeudi" multiline />
      <Label>Combien de fois par semaine ?</Label>
      <Stepper value={times} onChange={setTimes} min={1} max={14} fmt={(v) => `${v}×`} />
      <Txt muted style={{ fontSize: 12, marginTop: 6 }}>Ex. « Vider le lave-vaisselle » 7× : elle sera partagée entre plusieurs personnes.</Txt>
      <Err>{err}</Err>
      <Row style={{ marginTop: 16 }}>
        <Btn label="Enregistrer" onPress={save} />
        <Btn kind="ghost" label="Annuler" onPress={() => setModal(null)} />
      </Row>
      {t && <Btn kind="danger" small label="🗑️ Supprimer" style={{ marginTop: 14, alignSelf: 'flex-start' }}
        onPress={() => ask('Supprimer ?', `« ${t.title} » ne sera plus distribuée.`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: async () => { try { await D.removeTask(fam.id, t.id); await refresh(true); setModal(null); } catch (e) { toast(e.message, 'bad'); } } }])} />}
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
  const save = async () => { try { await D.updateMe({ name: name.trim() || me.username, avatar, color }); await refresh(true); toast('Profil enregistré'); } catch (e) { toast(e.message, 'bad'); } };
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
      <Btn kind="sec" label="Se déconnecter" onPress={logout} />
      <DeleteAccount me={me} after={logout} />
      {fam.owner !== me.id && <Btn kind="danger" label="Quitter la famille" style={{ marginTop: 10 }}
        onPress={() => ask('Quitter la famille ?', 'Tu pourras la rejoindre à nouveau avec le code.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Quitter', style: 'destructive', onPress: async () => { await D.leaveFamily(); await refresh(true); } }])} />}
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
