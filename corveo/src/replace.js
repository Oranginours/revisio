// 📋 Remplacer toute la liste des tâches d'un coup (une tâche par ligne).
import React, { useState } from 'react';
import { View, Text, Switch } from 'react-native';
import { C, Txt, H2, Label, Row, Btn, Input, Stepper, toast, ask } from './ui';
import * as D from './data';

// La feuille « Tâches ménagères » de la famille
export const PRESET = `🧽 Laver le plan de travail de la cuisine
🍳 Laver la plaque de cuisson et la vitre au-dessus
👟 Ranger les chaussures
🪞 Laver le lavabo de la salle de bain + miroir
🤖 Laver le coin robot + le robot
🪟 Laver une grande vitre ou 2 petites
📦 Laver la boîte du robot (intérieur et extérieur)
🐱 Laver le distributeur du chat et la chatière
🪶 Faire la poussière sur le meuble du salon
🚽 Laver le WC + lavabo du couloir + miroir
🪑 Laver les chaises (bas en métal)
🗑️ Laver les poubelles (verte, grise, salles de bain enfants et parents), vider et remettre un sac neuf
🛁 Salle de bain : chiffon sur le bord de la baignoire + robinet
🪟 Laver l'intérieur d'un volet
🚽 Laver le WC de la salle de bain
🚪 Laver les portes de la cuisine
🧹 Laver les plinthes de la cuisine
🧺 Lancer une machine
👕 Étendre le linge
👚 Plier le linge
🍽️ Finir de ranger la table quand tout le monde est parti + nettoyer
🍲 Préparer le repas
🚗 Laver la voiture
🧊 Laver le frigo
🍂 Aspirer les feuilles`;

// « 🧺 Lancer une machine ×2 » → { emoji, title, times }
function parseLine(line) {
  let l = line.trim();
  if (!l) return null;
  let times = 1;
  const m = l.match(/\s*[×x*]\s*(\d{1,2})\s*$/i);
  if (m) { times = Math.max(1, Math.min(14, +m[1])); l = l.slice(0, m.index).trim(); }
  const cps = Array.from(l);
  const first = cps[0] || '';
  const isEmoji = first.codePointAt(0) > 0x2100;
  let emoji = '✨', title = l;
  if (isEmoji) {
    let k = 1;
    while (k < cps.length && (cps[k].codePointAt(0) === 0xfe0f || cps[k].codePointAt(0) === 0x200d || (cps[k - 1] && cps[k - 1].codePointAt(0) === 0x200d))) k++;
    emoji = cps.slice(0, k).join('');
    title = cps.slice(k).join('').trim();
  }
  return title ? { emoji, title, times } : null;
}

export function ReplaceTasks({ fam, members, onDone, onCancel }) {
  const [text, setText] = useState(PRESET);
  const [per, setPer] = useState(fam.perPerson || 8);
  const [redo, setRedo] = useState(true);
  const [busy, setBusy] = useState(false);
  const list = text.split('\n').map(parseLine).filter(Boolean);
  const go = () => ask('Remplacer toutes les tâches ?', `Les tâches actuelles de « ${fam.name} » seront supprimées et remplacées par ces ${list.length} tâches.${redo ? ' La semaine sera aussi répartie à nouveau.' : ''}`, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Remplacer', style: 'destructive', onPress: async () => {
      setBusy(true);
      try {
        const old = await D.getTasks(fam.id);
        for (const t of old) await D.removeTask(fam.id, t.id);
        for (const t of list) await D.addTask(fam.id, t);
        await D.updateFamily(fam.id, { perPerson: per });
        if (redo) { const tasks = await D.getTasks(fam.id); await D.buildWeek({ ...fam, perPerson: per }, members, tasks, false); }
        toast(`📋 ${list.length} tâches enregistrées`);
        onDone && onDone();
      } catch (e) { toast(e.message, 'bad'); }
      setBusy(false);
    } },
  ]);
  return (
    <View>
      <H2>📋 Remplacer la liste des tâches</H2>
      <Txt muted>Une tâche par ligne : un emoji, puis le nom. Ajoute « ×2 » à la fin pour une tâche à faire 2 fois par semaine. La liste de ta feuille est déjà écrite.</Txt>
      <Input style={{ marginTop: 10, minHeight: 260, textAlignVertical: 'top', fontSize: 14 }} value={text} onChangeText={setText} multiline />
      <Txt muted style={{ fontSize: 12, marginTop: 4 }}>{list.length} tâches · {list.reduce((a, t) => a + t.times, 0)} par semaine en tout</Txt>
      <Label>Tâches par personne et par semaine</Label>
      <Stepper value={per} onChange={setPer} max={40} fmt={(v) => (v === 0 ? 'Auto' : v)} />
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', marginTop: 12 }}>
        <Txt style={{ flex: 1 }}>Refaire la répartition de cette semaine</Txt>
        <Switch value={redo} onValueChange={setRedo} trackColor={{ true: C.green }} />
      </Row>
      <Row style={{ marginTop: 14 }}>
        <Btn label={busy ? 'Enregistrement…' : `Remplacer (${list.length})`} disabled={busy || !list.length} onPress={go} />
        {onCancel && <Btn kind="ghost" label="Annuler" onPress={onCancel} />}
      </Row>
    </View>
  );
}
