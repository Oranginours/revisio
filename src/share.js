// Partager des chapitres avec ses potes (message ou fichier) et les importer.
import React, { useState } from 'react';
import { View, Alert, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useApp, H2, Txt, Btn, Row, Label, Input, Err } from './ui';
import { uid, COLORS, normPack } from './logic';
import { reschedule } from './notifs';
import { S, commit, matOf } from './store';

const MAX_MSG = 60000; // au-delà, WhatsApp coupe le message : on passe par un fichier

function payload(chs) {
  return JSON.stringify({ v: 2, chapters: chs.map((ch) => ({ matiere: matOf(ch).nom, titre: ch.titre, ds: ch.ds || '', consigne: ch.consigne || '', pack: ch.pack })) });
}

// Partage d'un chapitre en message (le plus simple pour un groupe WhatsApp/Snap)
export async function shareText(ch) {
  const data = payload([ch]);
  if (data.length > MAX_MSG) return shareFile([ch], ch.titre);
  try {
    await Share.share({ message: `📚 Chapitre « ${ch.titre} » (${matOf(ch).nom}) pour l'appli Révisions.\n👉 Appuie longtemps sur ce message → Copier, puis ouvre l'appli : elle te proposera de l'importer.\nREVISIONS:${data}` });
  } catch (e) { Alert.alert('Partage impossible', e.message); }
}

// Partage d'un ou plusieurs chapitres en fichier
export async function shareFile(chs, name) {
  try {
    const safe = String(name || 'chapitres').normalize('NFD').replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 40);
    const f = new File(Paths.cache, `revisions-${safe}.json`);
    try { if (f.exists) f.delete(); } catch (e) {}
    f.create();
    f.write('REVISIONS:' + payload(chs));
    if (!(await Sharing.isAvailableAsync())) throw new Error("Le partage de fichiers n'est pas disponible sur ce téléphone.");
    await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'Partager les chapitres' });
  } catch (e) { Alert.alert('Partage impossible', e.message); }
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
const sig = (t) => { const i = t.indexOf('REVISIONS:'); return t.length + ':' + t.slice(i, i + 120); };

// Appelé quand on ouvre l'appli : si un chapitre a été copié, on propose de l'importer.
export async function checkClipboard(go) {
  try {
    if (!(await Clipboard.hasStringAsync())) return;
    const t = await Clipboard.getStringAsync();
    if (!t || t.indexOf('REVISIONS:') < 0 || S.imported[sig(t)]) return;
    const m = t.match(/Chapitre « (.+?) »/);
    Alert.alert('📥 Chapitre copié', `Tu as copié ${m ? '« ' + m[1] + ' »' : 'un chapitre'}. L'ajouter à tes révisions ?`, [
      { text: 'Non', style: 'cancel', onPress: () => { S.imported[sig(t)] = 1; commit(); } },
      { text: 'Importer', onPress: () => { try { const ids = importText(t); go({ name: 'ch', id: ids[0], tab: 'cours' }); } catch (e) { Alert.alert('Oups', 'Le message copié est incomplet.'); } } },
    ]);
  } catch (e) {}
}

export function ImportForm() {
  const { setModal, go } = useApp();
  const [txt, setTxt] = useState('');
  const [err, setErr] = useState('');
  const done = (ids) => { setModal(null); if (ids.length === 1) go({ name: 'ch', id: ids[0], tab: 'cours' }); else Alert.alert('Importé ✨', `${ids.length} chapitres ajoutés.`); };
  const fromText = (t) => { try { done(importText(t)); } catch (e) { setErr('Pas de chapitre valide là-dedans. Copie bien le message en entier.'); } };
  const paste = async () => { try { const t = await Clipboard.getStringAsync(); setTxt(t); fromText(t); } catch (e) { setErr('Impossible de lire le presse-papiers. Colle le message à la main.'); } };
  const pickFile = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (r.canceled) return;
      const t = await new File(r.assets[0].uri).text();
      fromText(t);
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
  const { setModal } = useApp();
  return (
    <View>
      <H2>📤 Partager « {ch.titre} »</H2>
      <Txt muted>Tes potes reçoivent tout le chapitre (cours, fiches, questions), sans ta progression ni ta clé IA.</Txt>
      <Btn label="💬 Envoyer en message (WhatsApp, Snap…)" style={{ marginTop: 14 }} onPress={() => { setModal(null); shareText(ch); }} />
      <Txt muted style={{ marginTop: 6 }}>Ton pote appuie longtemps sur le message → Copier, puis ouvre l'appli : elle propose l'import toute seule.</Txt>
      <Btn kind="sec" label="📁 Envoyer en fichier" style={{ marginTop: 14 }} onPress={() => { setModal(null); shareFile([ch], ch.titre); }} />
      <Txt muted style={{ marginTop: 6 }}>Ton pote enregistre le fichier, puis 📥 Importer → Choisir le fichier.</Txt>
      <Btn kind="ghost" label="Fermer" style={{ marginTop: 16, alignSelf: 'flex-start' }} onPress={() => setModal(null)} />
    </View>
  );
}
