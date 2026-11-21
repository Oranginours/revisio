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
      <Btn kind="sec" small label="🚪 Entrer dans cette famille (parent)" style={{ marginTop: 12, alignSelf: 'flex-start' }} disabled={busy}
        onPress={() => run(async () => { await D.adminUpdateUser(currentUid(), { familyId: f.id, role: 'parent' }); await reload(); }, `Tu es dans ${f.name}`)} />
      <Btn kind="danger" small label="🗑️ Supprimer la famille" style={{ marginTop: 10, alignSelf: 'flex-start' }} disabled={busy}
        onPress={() => ask('Supprimer la famille ?', `« ${f.name} », ses tâches et ses semaines seront effacées. Les membres resteront, sans famille.`, [
          { text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => run(async () => { await D.deleteFamily(f, members); if (members.some((m) => m.id === currentUid())) await reload(); }, 'Famille supprimée') }])} />
    </Panel>
  );
}
