// Fenêtres : matières, nouveau chapitre, ajout de notes, réglages d'un chapitre.
import React, { useState } from 'react';
import { View, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp, H2, Txt, Btn, Row, Label, Input, Err, toast, ask } from './ui';
import { uid, parseFr, parseTime, isArchived, toFr, COLORS, normPack, mergePack, promptNotes, promptSkip, items } from './logic';
import { gemini, prepareImage } from './ai';
import { reschedule } from './notifs';
import { S, commit, matOf, chaptersOf } from './store';
import { EX_HIST, EX_PC } from './examples';
import { shareFile } from './share';

export function loadExamples() {
  const h = { id: uid(), nom: 'Histoire-Géo', couleur: COLORS[1] }, pc = { id: uid(), nom: 'Physique-Chimie', couleur: COLORS[0] };
  S.profil.matieres.push(h, pc);
  const a = uid(), b = uid();
  S.chs[a] = { id: a, matiereId: h.id, titre: 'La Méditerranée médiévale', ds: '', pack: normPack(EX_HIST), srs: {}, auto: {}, created: Date.now() };
  S.chs[b] = { id: b, matiereId: pc.id, titre: 'Ch. 02 · Les solutions aqueuses', ds: '', pack: normPack(EX_PC), srs: {}, auto: {}, created: Date.now() - 1 };
  commit();
  toast('2 chapitres ajoutés ✨ Pense à mettre les dates de DS (⚙️ du chapitre).');
}

export function newMatiere(nom) {
  const m = { id: uid(), nom, couleur: COLORS[S.profil.matieres.length % COLORS.length] };
  S.profil.matieres.push(m); return m;
}

/* ---------- Matière ---------- */
export function MatiereForm({ id, onCreated }) {
  const { setModal } = useApp();
  const m = id ? S.profil.matieres.find((x) => x.id === id) : null;
  const [nom, setNom] = useState(m ? m.nom : '');
  const [err, setErr] = useState('');
  const list = id ? chaptersOf(id) : [];
  const save = () => {
    if (!nom.trim()) return setErr('Écris un nom.');
    if (m) m.nom = nom.trim(); else { const nm = newMatiere(nom.trim()); if (onCreated) onCreated(nm); }
    commit(); if (!onCreated) setModal(null);
  };
  return (
    <View>
      <H2>{m ? 'Modifier la matière' : 'Nouvelle matière'}</H2>
      <Label>Nom</Label>
      <Input value={nom} onChangeText={(t) => { setNom(t); setErr(''); }} placeholder="Histoire-Géo" autoFocus={!m} />
      <Err>{err}</Err>
      <Row style={{ marginTop: 14 }}><Btn label={m ? 'Enregistrer' : 'Ajouter'} onPress={save} /><Btn kind="ghost" label="Annuler" onPress={() => setModal(null)} /></Row>
      {m && list.length > 0 && <Btn kind="sec" style={{ marginTop: 20 }} label={`📤 Partager toute la matière (${list.length} chapitre${list.length > 1 ? 's' : ''})`} onPress={() => shareFile(list, m.nom)} />}
      {m && <Btn kind="danger" style={{ marginTop: 12 }} label={`Supprimer la matière${list.length ? ` et ses ${list.length} chapitre${list.length > 1 ? 's' : ''}` : ''}`}
        onPress={() => ask('Supprimer ?', 'Cette action est définitive.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => {
          list.forEach((c) => delete S.chs[c.id]);
          S.profil.matieres = S.profil.matieres.filter((x) => x.id !== id);
          // ne pas la recréer depuis l'emploi du temps
          S.profil.ignored = S.profil.ignored || {};
          Object.keys(S.profil.links || {}).forEach((k) => { if (S.profil.links[k] === id) { delete S.profil.links[k]; S.profil.ignored[k] = 1; } });
          commit(); setModal(null);
        } }])} />}
    </View>
  );
}

/* ---------- Photos ---------- */
export function PhotoPicker({ uris, setUris }) {
  const { C } = useApp();
  const camera = async () => {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) return ask('Appareil photo', "Autorise l'appareil photo dans les réglages du téléphone.");
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!r.canceled) setUris([...uris, ...r.assets.map((a) => a.uri)].slice(0, 12));
  };
  const gallery = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 12, quality: 1 });
    if (!r.canceled) setUris([...uris, ...r.assets.map((a) => a.uri)].slice(0, 12));
  };
  return (
    <View>
      <Label>Photos de tes cours (12 max)</Label>
      <Row><Btn kind="sec" label="📷 Prendre une photo" onPress={camera} /><Btn kind="sec" label="🖼️ Galerie" onPress={gallery} /></Row>
      {uris.length > 0 && (
        <Row style={{ marginTop: 8 }}>
          {uris.map((u, i) => <Image key={i} source={{ uri: u }} style={{ width: 60, height: 60, borderRadius: 8, borderWidth: 1, borderColor: C.line }} />)}
          <Btn kind="ghost" small label="Vider" onPress={() => setUris([])} />
        </Row>
      )}
    </View>
  );
}
async function generate({ uris, text, matiere, titre, existing, consigne }) {
  const images = [];
  for (const u of uris) images.push(await prepareImage(u));
  const r = await gemini({ apiKey: S.settings.apiKey, model: S.settings.model, prompt: promptNotes({ matiere, titre, text, nImages: images.length, existing, consigne }), images });
  return normPack(r);
}

/* ---------- Nouveau chapitre ---------- */
export function ChapitreForm({ mid }) {
  const { setModal, go, runAI } = useApp();
  const [mat, setMat] = useState(mid || (S.profil.matieres[0] && S.profil.matieres[0].id));
  const [titre, setTitre] = useState('');
  const [ds, setDs] = useState('');
  const [dsTime, setDsTime] = useState('');
  const [txt, setTxt] = useState('');
  const [consigne, setConsigne] = useState('');
  const [uris, setUris] = useState([]);
  const [err, setErr] = useState('');
  const create = async () => {
    if (!mat) return setErr("Crée d'abord une matière.");
    if (!titre.trim()) return setErr('Donne un titre au chapitre.');
    const dsIso = ds.trim() ? parseFr(ds) : '';
    if (dsIso === null) return setErr('Date du DS invalide. Écris-la comme 12/12/2026.');
    const tIso = dsTime.trim() ? parseTime(dsTime) : '';
    if (tIso === null) return setErr("Heure du DS invalide. Écris-la comme 10h30.");
    if (!uris.length && !txt.trim()) {
      // chapitre en cours, sans notes pour l'instant : on le crée vide
      const id = uid();
      S.chs[id] = { id, matiereId: mat, titre: titre.trim(), ds: dsIso || '', dsTime: tIso || '', pack: normPack({}), srs: {}, auto: {}, skip: {}, consigne: consigne.trim(), created: Date.now() };
      commit(); setModal(null); reschedule(S); go({ name: 'ch', id, tab: 'cours' });
      return;
    }
    if (!S.settings.apiKey) return setErr("Ajoute d'abord ta clé Gemini dans ⚙️ Réglages.");
    const m = S.profil.matieres.find((x) => x.id === mat);
    try {
      const pack = await runAI('Création de ton chapitre', () => generate({ uris, text: txt.trim(), matiere: m.nom, titre: titre.trim(), consigne: consigne.trim() }));
      if (!items({ pack }).length && !pack.resume.length) throw new Error("L'IA n'a rien trouvé de lisible. Essaie des photos plus nettes.");
      const id = uid();
      S.chs[id] = { id, matiereId: mat, titre: titre.trim(), ds: dsIso || '', dsTime: tIso || '', pack, srs: {}, auto: {}, skip: {}, consigne: consigne.trim(), created: Date.now() };
      commit(); setModal(null); reschedule(S); go({ name: 'ch', id, tab: 'cours' });
    } catch (e) { setErr(e.message); }
  };
  return (
    <View>
      <H2>Nouveau chapitre</H2>
      <Label>Matière</Label>
      <Row>{S.profil.matieres.map((m) => <Btn key={m.id} small kind={m.id === mat ? 'pri' : 'sec'} label={m.nom} onPress={() => setMat(m.id)} />)}</Row>
      <Label>Titre du chapitre</Label>
      <Input value={titre} onChangeText={(t) => { setTitre(t); setErr(''); }} placeholder="Ch. 3 : la Révolution française" />
      <Label>Date du DS (si tu la connais)</Label>
      <Input value={ds} onChangeText={(t) => { setDs(t); setErr(''); }} placeholder="JJ/MM/AAAA" keyboardType="numbers-and-punctuation" />
      <Label>Heure du DS (le chapitre sera archivé après)</Label>
      <Input value={dsTime} onChangeText={(t) => { setDsTime(t); setErr(''); }} placeholder="10h30" keyboardType="numbers-and-punctuation" />
      <PhotoPicker uris={uris} setUris={(u) => { setUris(u); setErr(''); }} />
      <Label>Ou tape / colle tes notes (facultatif)</Label>
      <Input multiline value={txt} onChangeText={(t) => { setTxt(t); setErr(''); }} placeholder="Tu peux ajouter du texte en plus des photos" />
      <Label>🚫 Ce que le prof a dit de ne PAS apprendre (facultatif)</Label>
      <Input value={consigne} onChangeText={setConsigne} placeholder="Ex. : pas les dates des croisades, pas le doc 3" />
      <Err>{err}</Err>
      <Txt muted style={{ marginTop: 10 }}>Pas encore de notes ? Laisse photos et texte vides : le chapitre est créé, tu ajouteras tes cours plus tard (📷 Notes).</Txt>
      <Row style={{ marginTop: 14 }}><Btn label={uris.length || txt.trim() ? "✨ Créer avec l'IA" : 'Créer le chapitre'} onPress={create} /><Btn kind="ghost" label="Annuler" onPress={() => setModal(null)} /></Row>
    </View>
  );
}

export function AddNotesForm({ id }) {
  const { setModal, runAI } = useApp();
  const ch = S.chs[id];
  const [txt, setTxt] = useState('');
  const [uris, setUris] = useState([]);
  const [err, setErr] = useState('');
  const add = async () => {
    if (!uris.length && !txt.trim()) return setErr('Ajoute au moins une photo ou du texte.');
    try {
      const extra = await runAI('Ajout de tes notes', () => generate({ uris, text: txt.trim(), matiere: matOf(ch).nom, titre: ch.titre, existing: ch.pack, consigne: ch.consigne }));
      ch.pack = mergePack(ch.pack, extra); commit(); setModal(null);
      toast(`Ajouté ✨ ${extra.vocab.length + extra.qcm.length + extra.vf.length} nouvelles fiches et questions`);
    } catch (e) { setErr(e.message); }
  };
  return (
    <View>
      <H2>Ajouter des notes</H2>
      <Txt muted>L'IA ajoutera seulement ce qui est nouveau à ce chapitre.</Txt>
      <PhotoPicker uris={uris} setUris={(u) => { setUris(u); setErr(''); }} />
      <Label>Ou du texte</Label>
      <Input multiline value={txt} onChangeText={(t) => { setTxt(t); setErr(''); }} />
      <Err>{err}</Err>
      <Row style={{ marginTop: 14 }}><Btn label="✨ Ajouter" onPress={add} /><Btn kind="ghost" label="Annuler" onPress={() => setModal(null)} /></Row>
    </View>
  );
}

/* ---------- Réglages d'un chapitre ---------- */
export function ChSettings({ id }) {
  const { setModal, go, runAI } = useApp();
  const ch = S.chs[id];
  const [titre, setTitre] = useState(ch.titre);
  const [ds, setDs] = useState(toFr(ch.ds));
  const [dsTime, setDsTime] = useState(ch.dsTime ? ch.dsTime.replace(':', 'h') : '');
  const [mat, setMat] = useState(ch.matiereId);
  const [consigne, setConsigne] = useState(ch.consigne || '');
  const [err, setErr] = useState('');
  const save = () => {
    if (!titre.trim()) return setErr('Le titre ne peut pas être vide.');
    const iso = ds.trim() ? parseFr(ds) : '';
    if (iso === null) return setErr('Date invalide. Écris-la comme 12/12/2026.');
    const tIso = dsTime.trim() ? parseTime(dsTime) : '';
    if (tIso === null) return setErr("Heure invalide. Écris-la comme 10h30.");
    if (iso !== ch.ds || tIso !== (ch.dsTime || '')) delete ch.archived; // nouvelle date : on revient à l'archivage automatique
    ch.dsTime = tIso;
    ch.titre = titre.trim(); ch.ds = iso; ch.matiereId = mat; ch.consigne = consigne.trim(); commit(); reschedule(S); setModal(null);
  };
  const clean = async () => {
    if (!consigne.trim()) return setErr("Écris d'abord ce que le prof a dit de ne pas apprendre.");
    if (!S.settings.apiKey) return setErr('Ajoute ta clé Gemini dans ⚙️ Réglages.');
    ch.consigne = consigne.trim();
    try {
      const r = await runAI('Tri de tes fiches', () => gemini({ apiKey: S.settings.apiKey, model: S.settings.model, prompt: promptSkip(ch) }));
      const ids = Array.isArray(r && r.ids) ? r.ids.map(String) : [];
      ch.skip = ch.skip || {}; ids.forEach((k) => { ch.skip[k] = true; });
      commit(); setModal(null);
      toast(ids.length ? `🚫 ${ids.length} élément${ids.length > 1 ? 's' : ''} masqué${ids.length > 1 ? 's' : ''} (rétablissables dans Bilan)` : "L'IA n'a rien trouvé à masquer.", ids.length ? 'ok' : 'info');
    } catch (e) { setErr(e.message); }
  };
  return (
    <View>
      <H2>Réglages du chapitre</H2>
      <Label>Titre</Label><Input value={titre} onChangeText={(t) => { setTitre(t); setErr(''); }} />
      <Label>Date du DS</Label><Input value={ds} onChangeText={(t) => { setDs(t); setErr(''); }} placeholder="JJ/MM/AAAA (vide = pas de DS)" keyboardType="numbers-and-punctuation" />
      <Label>Heure du DS (archivage automatique après)</Label><Input value={dsTime} onChangeText={(t) => { setDsTime(t); setErr(''); }} placeholder="10h30 (vide = fin de journée)" keyboardType="numbers-and-punctuation" />
      <Label>Matière</Label>
      <Row>{S.profil.matieres.map((m) => <Btn key={m.id} small kind={m.id === mat ? 'pri' : 'sec'} label={m.nom} onPress={() => setMat(m.id)} />)}</Row>
      <Label>🚫 Ce que le prof a dit de ne PAS apprendre</Label>
      <Input multiline style={{ minHeight: 70 }} value={consigne} onChangeText={(t) => { setConsigne(t); setErr(''); }} placeholder="Ex. : pas la partie sur Tolède, pas les dates sauf 476 et 622" />
      <Btn kind="sec" small label="✨ Masquer automatiquement ces questions" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={clean} />
      <Txt muted style={{ marginTop: 4 }}>Les prochaines questions créées par l'IA en tiendront compte aussi.</Txt>
      <Err>{err}</Err>
      <Row style={{ marginTop: 14 }}><Btn label="Enregistrer" onPress={save} /><Btn kind="ghost" label="Annuler" onPress={() => setModal(null)} /></Row>
      <View style={{ gap: 8, marginTop: 24 }}>
        {isArchived(ch)
          ? <Btn kind="sec" label="📤 Désarchiver le chapitre" onPress={() => { ch.archived = false; commit(); reschedule(S); setModal(null); }} />
          : <Btn kind="sec" label="🗄️ Archiver le chapitre" onPress={() => { ch.archived = true; commit(); reschedule(S); setModal(null); }} />}
        <Btn kind="ghost" label="Remettre ma progression à zéro" onPress={() => { ch.srs = {}; ch.auto = {}; commit(); setModal(null); }} />
        <Btn kind="danger" label="Supprimer le chapitre" onPress={() => ask('Supprimer ce chapitre ?', 'Les fiches, les questions et ta progression seront effacées.', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer', style: 'destructive', onPress: () => { delete S.chs[id]; commit(); reschedule(S); setModal(null); go({ name: 'home' }); } },
        ])} />
      </View>
    </View>
  );
}
