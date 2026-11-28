// Partager des chapitres avec ses potes (message ou fichier) et les importer.
import React, { useState } from 'react';
import { View, Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useApp, H2, Txt, Btn, Row, Label, Input, Err, toast, ask, isWeb } from './ui';
import { uid, COLORS, normPack } from './logic';
import { reschedule } from './notifs';
import { S, commit, matOf } from './store';
import { importDefi, isDefiText, createDefi, canDefi } from './defi';
import { flag } from './progress';

/* ---------- fichiers : téléphone (partage) ou navigateur (téléchargement) ---------- */
async function saveFile(name, text, title) {
  if (isWeb) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  const { File, Paths } = require('expo-file-system');
  const f = new File(Paths.cache, name);
  try { if (f.exists) f.delete(); } catch (e) {}
  f.create(); f.write(text);
  if (!(await Sharing.isAvailableAsync())) throw new Error("le partage de fichiers n'est pas disponible sur ce téléphone");
  await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: title });
}
async function pickText() {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (r.canceled) return null;
  const a = r.assets[0];
  if (isWeb) return a.file ? await a.file.text() : await (await fetch(a.uri)).text();
  const { File } = require('expo-file-system');
  return await new File(a.uri).text();
}

const MAX_MSG = 60000; // au-delà, WhatsApp coupe le message : on passe par un fichier

function payload(chs) {
  return JSON.stringify({ v: 2, chapters: chs.map((ch) => ({ matiere: matOf(ch).nom, titre: ch.titre, ds: ch.ds || '', consigne: ch.consigne || '', pack: ch.pack })) });
}

// Partage d'un chapitre en message (le plus simple pour un groupe WhatsApp/Snap)
export async function shareText(ch) {
  const data = payload([ch]);
  flag('share'); commit();
  if (data.length > MAX_MSG) return shareFile([ch], ch.titre);
  try {
    await Share.share({ message: `📚 Chapitre « ${ch.titre} » (${matOf(ch).nom}) pour l'appli Révisions.\n👉 Appuie longtemps sur ce message → Copier, puis ouvre l'appli : elle te proposera de l'importer.\nREVISIONS:${data}` });
  } catch (e) { toast('Partage impossible : ' + e.message, 'bad'); }
}

// Partage d'un ou plusieurs chapitres en fichier
export async function shareFile(chs, name) {
  try {
    const safe = String(name || 'chapitres').normalize('NFD').replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 40);
    flag('share'); commit();
    await saveFile(`revisions-${safe}.json`, 'REVISIONS:' + payload(chs), 'Partager les chapitres');
    if (isWeb) toast('Fichier téléchargé : envoie-le à tes potes 📁');
  } catch (e) { toast('Partage impossible : ' + e.message, 'bad'); }
}

// Lit un texte contenant "REVISIONS:{...}" et ajoute les chapitres. Renvoie la liste des id créés.
export function importText(txt) {
  const i = txt.indexOf('REVISIONS:'); if (i < 0) throw new Error('none');
  const rest = txt.slice(i + 10); const a = rest.indexOf('{'), b = rest.lastIndexOf('}');
  const d = JSON.parse(rest.slice(a, b + 1));
  const list = d.v === 2 && Array.isArray(d.chapters) ? d.chapters : [d];
  const ids = [];
  list.forEach((c) => {
    if (!c || !c.pack || !c.titre) return;
    let m = S.profil.matieres.find((x) => x.nom.toLowerCase() === String(c.matiere || '').toLowerCase());
    if (!m) { m = { id: uid(), nom: String(c.matiere || 'Importé'), couleur: COLORS[S.profil.matieres.length % COLORS.length] }; S.profil.matieres.push(m); }
    const id = uid();
    S.chs[id] = { id, matiereId: m.id, titre: String(c.titre), ds: /^\d{4}-\d{2}-\d{2}$/.test(c.ds || '') ? c.ds : '', consigne: String(c.consigne || ''), pack: normPack(c.pack), srs: {}, auto: {}, skip: {}, created: Date.now() };
    ids.push(id);
  });
  if (!ids.length) throw new Error('none');
  S.imported[sig(txt)] = 1;
  commit(); reschedule(S);
  return ids;
}
const sig2 = (t) => 'defi:' + t.length + ':' + t.slice(-80);
const sig = (t) => { const i = t.indexOf('REVISIONS:'); return t.length + ':' + t.slice(i, i + 120); };

// Appelé quand on ouvre l'appli : si un chapitre a été copié, on propose de l'importer.
export async function checkClipboard(go) {
  try {
    if (!(await Clipboard.hasStringAsync())) return;
    const t = await Clipboard.getStringAsync();
    if (t && isDefiText(t) && !S.imported[sig2(t)]) {
      const m = t.match(/⚔️ (.+?) te défie sur « (.+?) »/);
      ask('⚔️ Défi reçu', m ? `${m[1]} te défie sur « ${m[2]} ». Tu relèves le défi ?` : 'Tu as copié un défi. Tu le relèves ?', [
        { text: 'Plus tard', style: 'cancel', onPress: () => { S.imported[sig2(t)] = 1; commit(); } },
        { text: 'Jouer !', onPress: () => { try { S.imported[sig2(t)] = 1; const d = importDefi(t); go({ name: 'defi', id: d.id, back: 'train' }); } catch (e) { toast('Le défi copié est incomplet.', 'bad'); } } },
      ]);
      return;
    }
    if (!t || t.indexOf('REVISIONS:') < 0 || S.imported[sig(t)]) return;
    const m = t.match(/Chapitre « (.+?) »/);
    ask('📥 Chapitre copié', `Tu as copié ${m ? '« ' + m[1] + ' »' : 'un chapitre'}. L'ajouter à tes révisions ?`, [
      { text: 'Non', style: 'cancel', onPress: () => { S.imported[sig(t)] = 1; commit(); } },
      { text: 'Importer', onPress: () => { try { const ids = importText(t); go({ name: 'ch', id: ids[0], tab: 'cours' }); } catch (e) { toast('Le message copié est incomplet.', 'bad'); } } },
    ]);
  } catch (e) {}
}

export function ImportForm() {
  const { setModal, go } = useApp();
  const [txt, setTxt] = useState('');
  const [err, setErr] = useState('');
  const done = (ids) => { setModal(null); if (ids.length === 1) go({ name: 'ch', id: ids[0], tab: 'cours' }); else toast(`Importé ✨ ${ids.length} chapitres ajoutés`); };
  const fromText = (t) => {
    if (isDefiText(t)) { try { const d = importDefi(t); setModal(null); go({ name: 'defi', id: d.id, back: 'train' }); } catch (e) { setErr('Défi incomplet. Copie bien le message en entier.'); } return; }
    try { done(importText(t)); } catch (e) { setErr('Pas de chapitre valide là-dedans. Copie bien le message en entier.'); }
  };
  const paste = async () => { try { const t = await Clipboard.getStringAsync(); setTxt(t); fromText(t); } catch (e) { setErr('Impossible de lire le presse-papiers. Colle le message à la main.'); } };
  const pickFile = async () => {
    try {
      const t = await pickText();
      if (t !== null) fromText(t);
    } catch (e) { setErr("Impossible de lire ce fichier."); }
  };
  return (
    <View>
      <H2>📥 Importer des chapitres</H2>
      <Txt muted>Pas besoin d'internet ni de clé IA.</Txt>
      <Label>Ton pote t'a envoyé un message ?</Label>
      <Txt muted>Appuie longtemps sur le message → Copier, puis :</Txt>
      <Btn label="📋 Coller le message copié" style={{ marginTop: 8 }} onPress={paste} />
      <Label>Ton pote t'a envoyé un fichier .json ?</Label>
      <Txt muted>Enregistre-le sur ton téléphone (Téléchargements), puis :</Txt>
      <Btn kind="sec" label="📁 Choisir le fichier" style={{ marginTop: 8 }} onPress={pickFile} />
      <Label>Ou colle le message ici</Label>
      <Input multiline value={txt} onChangeText={(t) => { setTxt(t); setErr(''); }} placeholder="📚 Chapitre … REVISIONS:{…}" />
      <Err>{err}</Err>
      <Row style={{ marginTop: 14 }}><Btn label="Importer" onPress={() => fromText(txt)} /><Btn kind="ghost" label="Fermer" onPress={() => setModal(null)} /></Row>
    </View>
  );
}

export function ShareChoice({ ch }) {
  const { setModal, go } = useApp();
  return (
    <View>
      <H2>📤 Partager « {ch.titre} »</H2>
      <Txt muted>Tes potes reçoivent tout le chapitre (cours, fiches, questions), sans ta progression ni ta clé IA.</Txt>
      <Btn label="💬 Envoyer en message (WhatsApp, Snap…)" style={{ marginTop: 14 }} onPress={() => { setModal(null); shareText(ch); }} />
      <Txt muted style={{ marginTop: 6 }}>Ton pote appuie longtemps sur le message → Copier, puis ouvre l'appli : elle propose l'import toute seule.</Txt>
      <Btn kind="sec" label="📁 Envoyer en fichier" style={{ marginTop: 14 }} onPress={() => { setModal(null); shareFile([ch], ch.titre); }} />
      <Txt muted style={{ marginTop: 6 }}>Ton pote enregistre le fichier, puis 📥 Importer → Choisir le fichier.</Txt>
      {canDefi(ch) && <Btn kind="sec" label="⚔️ Lancer un défi sur ce chapitre" style={{ marginTop: 14 }} onPress={() => { const d = createDefi(ch); setModal(null); go({ name: 'defi', id: d.id, back: 'home' }); }} />}
      <Btn kind="ghost" label="Fermer" style={{ marginTop: 16, alignSelf: 'flex-start' }} onPress={() => setModal(null)} />
    </View>
  );
}

/* ---------- sauvegarde complète (pour changer de téléphone ou réinstaller) ---------- */
export async function exportBackup() {
  try {
    const data = { v: 1, kind: 'revisio-sauvegarde', at: new Date().toISOString(), profil: S.profil, chs: S.chs, devoirs: S.devoirs,
      settings: { ...S.settings, apiKey: '', apiKeys: [], keys: undefined } }; // jamais la clé IA ni la connexion Pronote dans un fichier
    await saveFile(`revisio-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data), 'Enregistrer ma sauvegarde');
    if (isWeb) toast('Sauvegarde téléchargée 💾');
    S.settings.lastBackup = new Date().toISOString(); commit();
  } catch (e) { toast('Sauvegarde impossible : ' + e.message, 'bad'); }
}
export async function importBackup() {
  try {
    const txt = await pickText();
    if (txt === null) return;
    const d = JSON.parse(txt);
    if (!d || d.kind !== 'revisio-sauvegarde' || !d.chs) throw new Error("ce n'est pas une sauvegarde Révisio");
    const n = Object.keys(d.chs).length;
    ask('Restaurer la sauvegarde ?', `${n} chapitre${n > 1 ? 's' : ''} du ${String(d.at).slice(0, 10)}. Tes données actuelles seront remplacées.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Restaurer', style: 'destructive', onPress: () => {
        const { apiKey: key, apiKeys, keys } = S.settings; // tes clés IA restent celles de ce téléphone
        Object.assign(S.profil, d.profil || {}); S.chs = d.chs; if (d.devoirs) S.devoirs = d.devoirs; Object.assign(S.settings, d.settings || {}, { apiKey: key, apiKeys, keys });
        commit(); reschedule(S); toast('Sauvegarde restaurée ✅');
      } },
    ]);
  } catch (e) { toast('Restauration impossible : ' + e.message, 'bad'); }
}
