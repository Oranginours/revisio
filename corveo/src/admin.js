// 🛡️ Espace admin : tous les comptes et toutes les familles.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Switch, ActivityIndicator } from 'react-native';
import { C, Txt, H2, Label, Card, Row, Btn, Input, Avatar, Chip, toast, ask } from './ui';
import * as D from './data';
import { currentUid } from './fb';

export function AdminScreen({ reload }) {
  const [users, setUsers] = useState(null);
  const [fams, setFams] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [view, setView] = useState('users');
  const [err, setErr] = useState('');
  const load = async () => {
    setErr('');
    try { const [u, f] = await Promise.all([D.allUsers(), D.allFamilies()]); setUsers(u); setFams(f); }
    catch (e) { setErr(e.status === 403 ? "Accès refusé : colle les nouvelles règles dans Firebase (Firestore → Règles) puis Publier." : e.message); setUsers([]); }
  };
  useEffect(() => { load(); }, []);
  const famName = (id) => (fams.find((f) => f.id === id) || {}).name || '—';
  const s = q.trim().toLowerCase();
  const ul = (users || []).filter((u) => !s || String(u.username).includes(s) || String(u.name).toLowerCase().includes(s));
  const fl = fams.filter((f) => !s || String(f.name).toLowerCase().includes(s) || String(f.code).toLowerCase().includes(s));

  return (
    <View>
      <Card style={{ borderColor: '#7C3AED' }}>
        <H2>🛡️ Admin</H2>
        <Txt muted>{users ? `${users.length} comptes · ${fams.length} familles` : 'Chargement…'}</Txt>
        <Input style={{ marginTop: 10 }} value={q} onChangeText={setQ} placeholder="Chercher un pseudo, un nom, une famille…" autoCapitalize="none" />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
          {[['users', '👤 Comptes'], ['fams', '🏠 Familles']].map(([k, l]) => (
            <Pressable key={k} onPress={() => { setView(k); setOpen(null); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: view === k ? C.card2 : C.bg }}>
              <Text style={{ color: view === k ? C.ink : C.muted, fontWeight: '800' }}>{l}</Text>
            </Pressable>
          ))}
        </View>
        {err ? <Text style={{ color: '#FCA5A5', marginTop: 10, fontWeight: '700' }}>{err}</Text> : null}
      </Card>
      {!users && <ActivityIndicator color={C.green} />}

      {view === 'users' && ul.map((u) => (
        <View key={u.id}>
          <Pressable onPress={() => setOpen(open === u.id ? null : u.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 16, padding: 12, marginBottom: open === u.id ? 0 : 8, borderWidth: 1, borderColor: open === u.id ? '#7C3AED' : C.line }}>
            <Avatar m={u} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ink, fontWeight: '800' }}>{u.name} <Text style={{ color: C.muted, fontWeight: '600' }}>{u.managed ? '📵 sans téléphone' : '@' + u.username}</Text></Text>
              <Txt muted style={{ fontSize: 12 }}>{u.familyId ? `${famName(u.familyId)} · ${u.role || '?'}` : 'Sans famille'}{u.banned ? ' · 🚫 bloqué' : ''}</Txt>
            </View>
            {D.isAdminUser(u) && <Chip color="#2E1065" ink="#C4B5FD">admin</Chip>}
          </Pressable>
          {open === u.id && <UserEdit u={u} fams={fams} done={async () => { await load(); if (u.id === currentUid()) reload(); }} />}
        </View>
      ))}

      {view === 'fams' && fl.map((f) => (
        <View key={f.id}>
          <Pressable onPress={() => setOpen(open === f.id ? null : f.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 16, padding: 12, marginBottom: open === f.id ? 0 : 8, borderWidth: 1, borderColor: open === f.id ? '#7C3AED' : C.line }}>
            <Text style={{ fontSize: 26 }}>🏠</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ink, fontWeight: '800' }}>{f.name}</Text>
              <Txt muted style={{ fontSize: 12 }}>Code {f.code} · {(users || []).filter((u) => u.familyId === f.id).length} membres</Txt>
            </View>
          </Pressable>
          {open === f.id && <FamEdit f={f} members={(users || []).filter((u) => u.familyId === f.id)} done={load} reload={reload} />}
        </View>
      ))}
    </View>
  );
}

function Panel({ children }) {
  return <View style={{ backgroundColor: '#161B2B', borderWidth: 1, borderTopWidth: 0, borderColor: '#7C3AED', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, padding: 14, marginBottom: 10 }}>{children}</View>;
}

function UserEdit({ u, fams, done }) {
  const [name, setName] = useState(u.name || '');
  const [busy, setBusy] = useState(false);
  const run = async (fn, msg) => { setBusy(true); try { await fn(); if (msg) toast(msg); await done(); } catch (e) { toast(e.message, 'bad'); } setBusy(false); };
  const self = u.id === currentUid();
  return (
    <Panel>
      <Label>Prénom affiché</Label>
      <Row style={{ flexWrap: 'nowrap' }}>
        <Input style={{ flex: 1 }} value={name} onChangeText={setName} />
        <Btn small label="OK" disabled={busy} onPress={() => run(() => D.adminUpdateUser(u.id, { name: name.trim() || u.username }), 'Nom modifié')} />
      </Row>
      <Label>Rôle</Label>
      <Row>
        {[['parent', '👑 Parent'], ['enfant', '🧒 Enfant']].map(([r, l]) => (
          <Btn key={r} small kind={u.role === r ? 'pri' : 'sec'} label={l} disabled={busy || !u.familyId} onPress={() => run(() => D.adminUpdateUser(u.id, { role: r }), 'Rôle changé')} />
        ))}
      </Row>
      <Label>Famille</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Btn small kind={!u.familyId ? 'pri' : 'sec'} label="Aucune" disabled={busy} onPress={() => run(() => D.adminUpdateUser(u.id, { familyId: '', role: '' }), 'Retiré de sa famille')} />
        {fams.map((f) => (
          <Btn key={f.id} small kind={u.familyId === f.id ? 'pri' : 'sec'} label={f.name} disabled={busy}
            onPress={() => run(() => D.adminUpdateUser(u.id, { familyId: f.id, role: u.familyId === f.id ? u.role : 'enfant' }), `Placé dans ${f.name}`)} />
        ))}
      </View>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', marginTop: 14 }}>
        <Txt style={{ flex: 1 }}>Participe aux tâches</Txt>
        <Switch value={u.active !== false} onValueChange={(v) => run(() => D.adminUpdateUser(u.id, { active: v }))} trackColor={{ true: C.green }} />
      </Row>
      {!self && (
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', marginTop: 10 }}>
          <Txt style={{ flex: 1 }}>🚫 Bloquer ce compte</Txt>
          <Switch value={!!u.banned} onValueChange={(v) => run(() => D.adminUpdateUser(u.id, { banned: v }), v ? 'Compte bloqué' : 'Compte débloqué')} trackColor={{ true: C.red }} />
        </Row>
      )}
      {!self && (
        <Btn kind="danger" small label="🗑️ Supprimer le profil" style={{ marginTop: 14, alignSelf: 'flex-start' }}
          onPress={() => ask('Supprimer le profil ?', `Le profil de @${u.username} sera effacé (nom, avatar, famille). S'il se reconnecte, il repartira de zéro. Pour l'empêcher de revenir, bloque-le plutôt.`, [
            { text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => run(() => D.adminDeleteUser(u.id), 'Profil supprimé') }])} />
      )}
      <Txt muted style={{ fontSize: 11, marginTop: 10 }}>id : {u.id}</Txt>
    </Panel>
  );
}

function FamEdit({ f, members, done, reload }) {
  const [name, setName] = useState(f.name || '');
  const [busy, setBusy] = useState(false);
  const run = async (fn, msg) => { setBusy(true); try { await fn(); if (msg) toast(msg); await done(); } catch (e) { toast(e.message, 'bad'); } setBusy(false); };
  return (
    <Panel>
      <Label>Nom</Label>
      <Row style={{ flexWrap: 'nowrap' }}>
        <Input style={{ flex: 1 }} value={name} onChangeText={setName} />
        <Btn small label="OK" disabled={busy} onPress={() => run(() => D.updateFamily(f.id, { name: name.trim() || f.name }), 'Famille renommée')} />
      </Row>
      <Label>Membres</Label>
      {members.length === 0 && <Txt muted>Aucun membre.</Txt>}
      {members.map((m) => (
        <Row key={m.id} style={{ marginBottom: 6 }}>
          <Avatar m={m} size={28} />
          <Txt>{m.name} <Text style={{ color: C.muted }}>@{m.username} · {m.role}{f.owner === m.id ? ' · créateur' : ''}</Text></Txt>
        </Row>
      ))}
      <TasksEditor f={f} />
      <WeekEditor f={f} members={members} />
      <Btn kind="sec" small label="🚪 Entrer dans cette famille (parent)" style={{ marginTop: 12, alignSelf: 'flex-start' }} disabled={busy}
        onPress={() => run(async () => { await D.adminUpdateUser(currentUid(), { familyId: f.id, role: 'parent' }); await reload(); }, `Tu es dans ${f.name}`)} />
      <Btn kind="danger" small label="🗑️ Supprimer la famille" style={{ marginTop: 10, alignSelf: 'flex-start' }} disabled={busy}
        onPress={() => ask('Supprimer la famille ?', `« ${f.name} », ses tâches et ses semaines seront effacées. Les membres resteront, sans famille.`, [
          { text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => run(async () => { await D.deleteFamily(f, members); if (members.some((m) => m.id === currentUid())) await reload(); }, 'Famille supprimée') }])} />
    </Panel>
  );
}

// Cocher / décocher les tâches d'une semaine (même passée)
function WeekEditor({ f, members }) {
  const [n, setN] = useState(0);
  const [week, setWeek] = useState(undefined);
  const [touchedPast, setTouchedPast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [giving, setGiving] = useState(null);
  useEffect(() => { D.getTasks(f.id).then(setTasks).catch(() => {}); }, [f.id]);
  const wk = D.weekIdOffset(n);
  const give = async (uid, t) => {
    setBusy(true);
    try { const list = await D.giveTaskIn(f.id, wk, week, uid, t); setWeek({ ...week, assign: { ...week.assign, [uid]: list } }); toast(`${t.emoji} ajoutée`); }
    catch (e) { toast(e.message, 'bad'); }
    setBusy(false); setGiving(null);
  };
  const removeLast = async (uid) => {
    setBusy(true);
    try { const list = await D.removeLastTaskIn(f.id, wk, week, uid); const k = D.doneKey(uid, list.length); const done = { ...(week.done || {}) }; delete done[k]; setWeek({ ...week, done, assign: { ...week.assign, [uid]: list } }); }
    catch (e) { toast(e.message, 'bad'); }
    setBusy(false);
  };
  useEffect(() => { let ok = true; setWeek(undefined); D.getWeek(f.id, wk).then((w) => ok && setWeek(w || null)).catch(() => ok && setWeek(null)); return () => { ok = false; }; }, [wk]);
  const toggle = async (uid, i) => {
    const k = D.doneKey(uid, i);
    const on = !(week.done && week.done[k]);
    setWeek({ ...week, done: { ...(week.done || {}), [k]: on ? Date.now() : undefined } });
    try { await D.setDoneIn(f.id, wk, uid, i, on); if (n < 0) setTouchedPast(true); }
    catch (e) { toast(e.message, 'bad'); }
  };
  const all = async (uid, on) => {
    const list = (week.assign || {})[uid] || [];
    setBusy(true);
    const done = { ...(week.done || {}) };
    try {
      for (let i = 0; i < list.length; i++) { const k = D.doneKey(uid, i); if (!!done[k] !== on) { await D.setDoneIn(f.id, wk, uid, i, on); done[k] = on ? Date.now() : undefined; } }
      setWeek({ ...week, done }); if (n < 0) setTouchedPast(true);
    } catch (e) { toast(e.message, 'bad'); }
    setBusy(false);
  };
  const recompute = async () => {
    setBusy(true);
    try { const tasks = await D.getTasks(f.id); const c = await D.recomputeExtras(f, tasks); toast(c ? `♻️ Tâches en plus recalculées (${c} personne${c > 1 ? 's' : ''})` : 'Rien à changer'); setTouchedPast(false); }
    catch (e) { toast(e.message, 'bad'); }
    setBusy(false);
  };
  const people = members.filter((m) => week && week.assign && (week.assign[m.id] || m.active !== false));
  return (
    <View style={{ marginTop: 14 }}>
      <Label>Tâches de la semaine</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Btn small kind="sec" label="‹" onPress={() => setN(n - 1)} />
        <Text style={{ color: C.ink, fontWeight: '800', flex: 1, textAlign: 'center' }}>{D.weekLabel(n)}</Text>
        <Btn small kind="sec" label="›" disabled={n >= 0} onPress={() => setN(Math.min(0, n + 1))} />
      </View>
      {week === undefined && <ActivityIndicator color={C.green} style={{ marginTop: 10 }} />}
      {week === null && <Txt muted style={{ marginTop: 8 }}>Pas de répartition cette semaine-là.</Txt>}
      {week && people.length === 0 && <Txt muted style={{ marginTop: 8 }}>Personne n'avait de tâches.</Txt>}
      {week && people.map((m) => {
        const list = week.assign[m.id] || [];
        const st = D.stats(week, m.id);
        return (
          <View key={m.id} style={{ marginTop: 12 }}>
            <Row style={{ flexWrap: 'nowrap' }}>
              <Avatar m={m} size={26} />
              <Text style={{ color: C.ink, fontWeight: '800', flex: 1 }}>{m.name} <Text style={{ color: C.muted }}>{st.done}/{st.total}</Text></Text>
              <Pressable disabled={busy} onPress={() => all(m.id, st.done < st.total)} hitSlop={6}>
                <Text style={{ color: C.green, fontWeight: '800', fontSize: 12 }}>{st.done < st.total ? 'Tout cocher' : 'Tout décocher'}</Text>
              </Pressable>
            </Row>
            {list.map((t, i) => {
              const done = !!(week.done && week.done[D.doneKey(m.id, i)]);
              return (
                <Pressable key={i} disabled={busy} onPress={() => toggle(m.id, i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingLeft: 6 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: done ? C.green : '#5B6478', backgroundColor: done ? C.green : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {done && <Text style={{ color: '#0B1A06', fontWeight: '900', fontSize: 13 }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: 16 }}>{t.e}</Text>
                  <Text style={{ color: done ? C.muted : C.ink, flex: 1, textDecorationLine: done ? 'line-through' : 'none' }}>{t.n}</Text>
                </Pressable>
              );
            })}
            <Row style={{ marginTop: 4, marginLeft: 6 }}>
              <Pressable disabled={busy} onPress={() => setGiving(giving === m.id ? null : m.id)} hitSlop={6}><Text style={{ color: C.blue, fontWeight: '800', fontSize: 13 }}>＋ Ajouter une tâche</Text></Pressable>
              {list.length > 0 && <Pressable disabled={busy} onPress={() => removeLast(m.id)} hitSlop={6}><Text style={{ color: C.muted, fontWeight: '700', fontSize: 13 }}>  ·  Retirer la dernière</Text></Pressable>}
            </Row>
            {giving === m.id && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginLeft: 6 }}>
                {tasks.map((t) => (
                  <Pressable key={t.id} disabled={busy} onPress={() => give(m.id, t)} style={{ backgroundColor: C.card2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: C.ink, fontSize: 13 }}>{t.emoji} {t.title}</Text>
                  </Pressable>
                ))}
                {!tasks.length && <Txt muted>Crée d'abord des tâches ci-dessus.</Txt>}
              </View>
            )}
          </View>
        );
      })}
      {(touchedPast || n === -1) && week && (
        <View style={{ backgroundColor: C.bg, borderRadius: 12, padding: 10, marginTop: 12 }}>
          <Txt muted style={{ fontSize: 12 }}>Les tâches en plus de cette semaine viennent de la semaine dernière. Après une correction, recalcule-les :</Txt>
          <Btn small kind="sec" label="♻️ Recalculer les tâches en plus" style={{ marginTop: 8, alignSelf: 'flex-start' }} disabled={busy} onPress={recompute} />
        </View>
      )}
    </View>
  );
}

// Gérer la liste des tâches d'une famille
function TasksEditor({ f }) {
  const [tasks, setTasks] = useState(null);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null); // id ou 'new'
  const [emoji, setEmoji] = useState('✨');
  const [title, setTitle] = useState('');
  const [times, setTimes] = useState(1);
  const [busy, setBusy] = useState(false);
  const load = () => D.getTasks(f.id).then(setTasks).catch((e) => { toast(e.message, 'bad'); setTasks([]); });
  useEffect(() => { if (open && !tasks) load(); }, [open]);
  const start = (t) => { setEdit(t ? t.id : 'new'); setEmoji(t ? t.emoji : '✨'); setTitle(t ? t.title : ''); setTimes(t ? t.times || 1 : 1); };
  const save = async () => {
    if (!title.trim()) return toast('Écris le nom de la tâche', 'bad');
    setBusy(true);
    try {
      const e = firstChar(emoji) || '✨';
      if (edit === 'new') await D.addTask(f.id, { emoji: e, title, times }); else await D.editTask(f.id, edit, { emoji: e, title, times, info: (tasks.find((x) => x.id === edit) || {}).info || '' });
      toast(edit === 'new' ? 'Tâche ajoutée ✅' : 'Tâche modifiée'); setEdit(null); await load();
    } catch (er) { toast(er.message, 'bad'); }
    setBusy(false);
  };
  const del = (t) => ask('Supprimer ?', `« ${t.title} » ne sera plus distribuée.`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: async () => { try { await D.removeTask(f.id, t.id); await load(); } catch (e) { toast(e.message, 'bad'); } } }]);
  return (
    <View style={{ marginTop: 14 }}>
      <Pressable onPress={() => setOpen(!open)}><Label>{open ? '▾' : '▸'} Liste des tâches{tasks ? ` (${tasks.length})` : ''}</Label></Pressable>
      {open && !tasks && <ActivityIndicator color={C.green} />}
      {open && tasks && (
        <View>
          {tasks.map((t) => (
            <View key={t.id}>
              <Pressable onPress={() => (edit === t.id ? setEdit(null) : start(t))} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
                <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                <Text style={{ color: C.ink, flex: 1 }}>{t.title}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>{t.times || 1}×/sem.</Text>
                <Pressable hitSlop={8} onPress={() => del(t)}><Text style={{ color: C.muted }}>  ✕</Text></Pressable>
              </Pressable>
              {edit === t.id && <TaskInline {...{ emoji, setEmoji, title, setTitle, times, setTimes, save, busy, cancel: () => setEdit(null) }} />}
            </View>
          ))}
          {edit === 'new' ? <TaskInline {...{ emoji, setEmoji, title, setTitle, times, setTimes, save, busy, cancel: () => setEdit(null) }} />
            : <Btn small kind="sec" label="＋ Nouvelle tâche" style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={() => start(null)} />}
          <Txt muted style={{ fontSize: 11, marginTop: 6 }}>Une nouvelle tâche compte à la prochaine répartition. Pour la donner tout de suite à quelqu'un : « ＋ Ajouter une tâche » sous son nom, plus bas.</Txt>
        </View>
      )}
    </View>
  );
}
function TaskInline({ emoji, setEmoji, title, setTitle, times, setTimes, save, busy, cancel }) {
  return (
    <View style={{ backgroundColor: C.bg, borderRadius: 12, padding: 10, marginVertical: 6 }}>
      <Row style={{ flexWrap: 'nowrap' }}>
        <Input style={{ width: 64, textAlign: 'center', fontSize: 22 }} value={emoji} onChangeText={(v) => setEmoji(firstChar(v) || v)} />
        <Input style={{ flex: 1 }} value={title} onChangeText={setTitle} placeholder="Nom de la tâche" />
      </Row>
      <Row style={{ marginTop: 8 }}>
        <Btn small kind="sec" label="−" onPress={() => setTimes(Math.max(1, times - 1))} />
        <Text style={{ color: C.ink, fontWeight: '800' }}>{times}× / semaine</Text>
        <Btn small kind="sec" label="+" onPress={() => setTimes(Math.min(14, times + 1))} />
      </Row>
      <Row style={{ marginTop: 8 }}>
        <Btn small label="Enregistrer" disabled={busy} onPress={save} />
        <Btn small kind="ghost" label="Annuler" onPress={cancel} />
      </Row>
    </View>
  );
}
// Premier emoji d'un texte (gère les emojis composés)
function firstChar(txt) {
  const cps = Array.from(String(txt || '').trim());
  if (!cps.length) return '';
  const cp = (c) => c.codePointAt(0);
  const isRI = (c) => c && cp(c) >= 0x1f1e6 && cp(c) <= 0x1f1ff;
  if (isRI(cps[0]) && isRI(cps[1])) return cps[0] + cps[1];
  let out = cps[0], i = 1;
  while (i < cps.length) {
    const n = cp(cps[i]);
    if (n === 0xfe0f || n === 0x20e3 || (n >= 0x1f3fb && n <= 0x1f3ff)) { out += cps[i]; i++; }
    else if (n === 0x200d && cps[i + 1]) { out += cps[i] + cps[i + 1]; i += 2; }
    else break;
  }
  return out;
}
