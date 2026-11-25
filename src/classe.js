// 🏫 Ma classe : les cours de chacun sont partagés automatiquement avec la classe,
// et chacun peut laisser de petites notes sur un cours pour les autres.
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Switch, Share, ActivityIndicator } from 'react-native';
import { useApp, Card, H2, Txt, Btn, Row, Label, Input, Err, toast, ask, isWeb } from './ui';
import { uid as newUid, normPack, items, COLORS } from './logic';
import { S, commit, matOf } from './store';
import * as F from './cloud';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => { let s = ''; for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; };
const hash = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + str.length.toString(36); };

export const cls = () => (S.cls = S.cls || { id: '', name: '', code: '', auto: true });
export const inClass = () => !!(S.cls && S.cls.id);
const myName = () => S.profil.prenom || (S.pronote && S.pronote.name ? String(S.pronote.name).split(' ').pop() : '') || 'Un élève';
export const noteKey = (ch) => (ch.cls ? ch.cls.key : ch.shareKey || '');

/* ---------- Créer / rejoindre / quitter ---------- */
export async function createClass(name) {
  const me = await F.ensureAuth();
  const id = F.newId();
  let code = makeCode();
  for (let k = 0; k < 5; k++) {
    try { await F.setDoc(`classCodes/${code}`, { classId: id }, true); break; } catch (e) { code = makeCode(); if (k === 4) throw e; }
  }
  await F.setDoc(`classes/${id}`, { name: name.trim() || 'Ma classe', code, owner: me, created: Date.now() });
  await F.setDoc(`classes/${id}/members/${me}`, { name: myName(), joined: Date.now() });
  Object.assign(cls(), { id, name: name.trim() || 'Ma classe', code });
  commit();
  return code;
}
export async function joinClass(codeTxt) {
  const me = await F.ensureAuth();
  const code = String(codeTxt || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const c = await F.getDoc(`classCodes/${code}`);
  if (!c) throw new Error('Aucune classe avec ce code.');
  await F.setDoc(`classes/${c.classId}/members/${me}`, { name: myName(), joined: Date.now() });
  const k = await F.getDoc(`classes/${c.classId}`);
  Object.assign(cls(), { id: c.classId, name: (k && k.name) || 'Ma classe', code });
  commit();
}
export async function leaveClass() {
  const c = cls();
  try { await F.deleteDoc(`classes/${c.id}/members/${F.currentUid()}`); } catch (e) { /* déjà parti */ }
  S.cls = { id: '', name: '', code: '', auto: c.auto };
  Object.values(S.chs).forEach((ch) => { delete ch.shareKey; delete ch.shareSig; });
  commit();
}

/* ---------- Synchronisation ---------- */
let syncing = false;
export async function syncClass({ quiet } = {}) {
  if (!inClass() || syncing) return null;
  syncing = true;
  const c = cls();
  const out = { up: 0, added: 0, updated: 0 };
  try {
    const me = await F.ensureAuth();
    // 1) j'envoie mes cours (ceux que j'ai créés, s'ils ont changé)
    for (const ch of Object.values(S.chs)) {
      if (ch.cls || ch.noShare) continue;
      if (!items({ pack: ch.pack }).length && !ch.pack.resume.length) continue;
      const json = JSON.stringify(ch.pack);
      const sig = hash(json + ch.titre + (ch.ds || ''));
      if (ch.shareSig === sig && ch.shareCls === c.id) continue;
      const key = `${me}_${ch.id}`;
      const m = matOf(ch);
      await F.setDoc(`classes/${c.id}/chapters/${key}`, { titre: ch.titre, matiere: m.nom, couleur: m.couleur || '', by: me, byName: myName(), updated: Date.now(), ds: ch.ds || '', pack: json });
      ch.shareKey = key; ch.shareSig = sig; ch.shareCls = c.id;
      out.up++;
    }
    // 2) je récupère les cours des autres
    const list = await F.listDocs(`classes/${c.id}/chapters`, ['titre', 'matiere', 'couleur', 'by', 'byName', 'updated', 'ds']);
    for (const r of list) {
      if (r.by === me) continue;
      const local = Object.values(S.chs).find((x) => x.cls && x.cls.key === r.id);
      if (local && (local.cls.updated || 0) >= (r.updated || 0)) continue;
      if (!local && (c.auto === false || (c.hidden || {})[r.id])) continue;
      const full = await F.getDoc(`classes/${c.id}/chapters/${r.id}`);
      if (!full || !full.pack) continue;
      let pack; try { pack = normPack(JSON.parse(full.pack)); } catch (e) { continue; }
      if (local) {
        local.pack = pack; local.titre = full.titre; local.cls = { ...local.cls, updated: full.updated, byName: full.byName };
        out.updated++;
      } else {
        let m = S.profil.matieres.find((x) => x.nom.trim().toLowerCase() === String(full.matiere || '').trim().toLowerCase());
        if (!m) { m = { id: newUid(), nom: full.matiere || 'Autre', couleur: full.couleur || COLORS[S.profil.matieres.length % COLORS.length] }; S.profil.matieres.push(m); }
        const id = newUid();
        S.chs[id] = { id, matiereId: m.id, titre: full.titre, ds: full.ds || '', dsTime: '', pack, srs: {}, auto: {}, skip: {}, consigne: '', created: Date.now(), cls: { key: r.id, by: full.by, byName: full.byName, updated: full.updated, cid: c.id } };
        out.added++;
      }
    }
    c.last = Date.now(); c.err = '';
    commit();
    if (!quiet && out.added) toast(`🏫 ${out.added} cours ajouté${out.added > 1 ? 's' : ''} depuis ta classe`);
  } catch (e) {
    c.err = e.message; commit();
    if (!quiet) toast('🏫 ' + e.message, 'bad');
  } finally { syncing = false; }
  return out;
}
// Ne plus recevoir un cours de la classe (il est retiré de mon appli)
export function hideClassChapter(ch) {
  const c = cls();
  c.hidden = { ...(c.hidden || {}), [ch.cls.key]: true };
  delete S.chs[ch.id];
  commit();
}

// Ne plus partager un de mes cours
export async function unshareChapter(ch) {
  if (ch.shareKey && inClass()) { try { await F.deleteDoc(`classes/${cls().id}/chapters/${ch.shareKey}`); } catch (e) { /* tant pis */ } }
  delete ch.shareKey; delete ch.shareSig; delete ch.shareCls;
}

/* ---------- Notes de la classe ---------- */
export const getNotes = async (key) => (await F.listDocs(`classes/${cls().id}/chapters/${key}/notes`)).sort((a, b) => a.ts - b.ts);
export async function addNote(key, text, part) {
  const me = await F.ensureAuth();
  await F.setDoc(`classes/${cls().id}/chapters/${key}/notes/${F.newId()}`, { t: text.trim(), part: part || '', by: me, name: myName(), ts: Date.now() });
}
export const delNote = (key, id) => F.deleteDoc(`classes/${cls().id}/chapters/${key}/notes/${id}`);
const ago = (ts) => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };

/* =========================================================
   Réglages : 🏫 Ma classe
   ========================================================= */
export function ClassSettings() {
  const { C } = useApp();
  const c = cls();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState(null);
  const [, setT] = useState(0);
  useEffect(() => { if (c.id) F.listDocs(`classes/${c.id}/members`).then(setMembers).catch(() => setMembers([])); }, [c.id]);
  const run = async (fn, msg) => { setErr(''); setBusy(true); try { await fn(); if (msg) toast(msg); syncClass({ quiet: false }); } catch (e) { setErr(e.message); } setBusy(false); setT((x) => x + 1); };

  if (!c.id) return (
    <Card>
      <Txt muted>Rejoins ta classe : tous les cours que vous créez sont partagés automatiquement, et chacun peut laisser des petites notes pour les autres (« attention, la prof a dit que… »).</Txt>
      <Label>Rejoindre avec un code</Label>
      <Input style={{ letterSpacing: 4, fontWeight: '800', textAlign: 'center', fontSize: 20 }} value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" placeholder="ABC234" maxLength={8} />
      <Btn label="Rejoindre la classe" style={{ marginTop: 8 }} disabled={busy || code.length < 4} onPress={() => run(() => joinClass(code), '🏫 Bienvenue dans la classe !')} />
      <Label>Ou créer la classe</Label>
      <Input value={name} onChangeText={setName} placeholder="ex. 1re 4 – Carnot" />
      <Btn kind="sec" label="Créer la classe" style={{ marginTop: 8 }} disabled={busy} onPress={() => run(() => createClass(name), '🏫 Classe créée : partage le code !')} />
      {busy && <ActivityIndicator style={{ marginTop: 10 }} />}
      <Err>{err}</Err>
      {!S.profil.prenom && <Txt muted style={{ fontSize: 12, marginTop: 8 }}>Pense à mettre ton prénom (section TOI) : c'est lui que verront les autres.</Txt>}
    </Card>
  );
  const share = async () => {
    const msg = `Rejoins notre classe sur Révisio 🏫 : tous nos cours en commun !\nCode : ${c.code}\nhttps://oranginours.github.io/revisio/`;
    try { if (isWeb && navigator.clipboard) { await navigator.clipboard.writeText(msg); toast('Code copié 📋'); } else await Share.share({ message: msg }); } catch (e) { /* annulé */ }
  };
  const mine = Object.values(S.chs).filter((ch) => !ch.cls && ch.shareKey).length;
  const theirs = Object.values(S.chs).filter((ch) => ch.cls).length;
  return (
    <Card>
      <Txt muted bold style={{ fontSize: 12 }}>🏫 MA CLASSE</Txt>
      <Text style={{ color: C.ink, fontSize: 22, fontWeight: '900' }}>{c.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, backgroundColor: C.bg, borderRadius: 14, padding: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt muted style={{ fontSize: 12 }}>Code à donner aux autres</Txt>
          <Text selectable style={{ color: C.ink, fontSize: 24, fontWeight: '900', letterSpacing: 5 }}>{c.code}</Text>
        </View>
        <Btn small kind="sec" label={isWeb ? '📋 Copier' : '📤 Envoyer'} onPress={share} />
      </View>
      <Txt muted style={{ marginTop: 10, fontSize: 13 }}>
        {members ? `${members.length} élève${members.length > 1 ? 's' : ''} : ${members.map((m) => m.name).join(', ')}` : 'Chargement des membres…'}
      </Txt>
      <Txt muted style={{ fontSize: 13 }}>📤 {mine} de tes cours partagés · 📥 {theirs} cours reçus{c.last ? ` · synchro ${ago(c.last)}` : ''}</Txt>
      {c.err ? <Txt style={{ color: C.bad, fontSize: 13, marginTop: 4 }}>{c.err}</Txt> : null}
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', marginTop: 12 }}>
        <Txt style={{ flex: 1 }}>Ajouter automatiquement les cours des autres</Txt>
        <Switch value={c.auto !== false} onValueChange={(v) => { c.auto = v; commit(); setT((x) => x + 1); if (v) syncClass(); }} trackColor={{ true: C.pri }} />
      </Row>
      <Row style={{ marginTop: 12 }}>
        <Btn small label={busy ? '…' : '🔄 Synchroniser'} disabled={busy} onPress={() => run(async () => { const r = await syncClass({ quiet: true }); if (r) toast(`🏫 ${r.up} envoyé${r.up > 1 ? 's' : ''} · ${r.added} reçu${r.added > 1 ? 's' : ''} · ${r.updated} mis à jour`); })} />
        <Btn small kind="ghost" label="Quitter la classe" onPress={() => ask('Quitter la classe ?', 'Les cours déjà reçus restent dans ton appli.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Quitter', style: 'destructive', onPress: async () => { await leaveClass(); setT((x) => x + 1); } }])} />
      </Row>
      <Err>{err}</Err>
    </Card>
  );
}

/* =========================================================
   Dans un chapitre : origine + notes de la classe
   ========================================================= */
export function ClassNotes({ ch }) {
  const { C, go } = useApp();
  const key = noteKey(ch);
  const [notes, setNotes] = useState(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [part, setPart] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => (key && inClass() ? getNotes(key).then(setNotes).catch(() => setNotes([])) : null);
  useEffect(() => { setNotes(null); load(); }, [key]);
  if (!inClass()) return null;
  if (!key) return ch.noShare ? null : <Txt muted style={{ fontSize: 12, marginBottom: 10 }}>🏫 Ce cours sera partagé avec ta classe à la prochaine synchro.</Txt>;
  const me = F.currentUid();
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try { await addNote(key, text, part); setText(''); setPart(''); await load(); toast('💬 Note partagée avec la classe'); }
    catch (e) { toast(e.message, 'bad'); }
    setBusy(false);
  };
  const n = notes ? notes.length : 0;
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: n ? C.warn : C.line }}>
      <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18 }}>💬</Text>
        <Text style={{ color: C.ink, fontWeight: '800', flex: 1 }}>Notes de la classe{notes ? ` (${n})` : ''}</Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>{ch.cls ? `cours de ${ch.cls.byName}` : 'partagé ✓'}</Text>
        <Text style={{ color: C.muted }}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {!open && n > 0 && <Text numberOfLines={2} style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>{notes[n - 1].name} : {notes[n - 1].t}</Text>}
      {open && (
        <View style={{ marginTop: 10 }}>
          {notes === null && <ActivityIndicator />}
          {notes && !n && <Txt muted style={{ fontSize: 13 }}>Pas encore de note. Ex. « La prof a dit que la partie 3 n'est pas au DS », « Attention, erreur dans la formule ».</Txt>}
          {(notes || []).map((x) => (
            <View key={x.id} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 10 }}>
                <Text style={{ color: C.muted, fontSize: 12, fontWeight: '800' }}>{x.name} · {ago(x.ts)}{x.part ? ` · 📌 ${x.part}` : ''}</Text>
                <Txt>{x.t}</Txt>
              </View>
              {x.by === me && <Pressable hitSlop={8} onPress={async () => { try { await delNote(key, x.id); load(); } catch (e) { toast(e.message, 'bad'); } }}><Text style={{ color: C.muted }}>✕</Text></Pressable>}
            </View>
          ))}
          {ch.pack.resume.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {ch.pack.resume.map((r) => r.titre).filter(Boolean).slice(0, 8).map((t) => (
                <Pressable key={t} onPress={() => setPart(part === t ? '' : t)} style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, backgroundColor: part === t ? C.pri : C.priSoft }}>
                  <Text style={{ color: part === t ? '#fff' : C.priInk, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>📌 {t.slice(0, 28)}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Input value={text} onChangeText={setText} placeholder="Une petite note pour la classe…" multiline />
          <Btn small label="Envoyer" style={{ marginTop: 8, alignSelf: 'flex-end' }} disabled={busy || !text.trim()} onPress={send} />
          {ch.cls && <Btn small kind="ghost" label="Ne plus recevoir ce cours" style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={() => ask('Retirer ce cours ?', 'Il sera supprimé de ton appli et ne reviendra pas.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Retirer', style: 'destructive', onPress: () => { go({ name: 'home' }); setTimeout(() => hideClassChapter(ch), 50); } }])} />}
        </View>
      )}
    </View>
  );
}
