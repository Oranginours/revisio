// Devoirs : ceux de Pronote + ceux qu'on ajoute soi-même (quand les profs ne les mettent pas sur Pronote).
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import * as pronote from './pawnote';
import { useApp, Card, H2, Txt, Btn, Row, Label, Input, Err, Dot, toast, ask, pull, isWeb } from './ui';
import { uid, dstr, today, addDays, diffDays, fmtDate, parseFr, stripTags } from './logic';
import { S, commit } from './store';
import { withSession, matiereFor } from './school';
import { reschedule } from './notifs';
import { fetchEntHomework, setEntDone } from './skolengo';

const D = () => {
  S.devoirs = S.devoirs || {};
  const d = S.devoirs;
  d.manual = d.manual || []; d.doneP = d.doneP || {};
  S.cache.hw = S.cache.hw || [];
  return d;
};
const decode = (t) => stripTags(String(t || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n'))
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/\n{3,}/g, '\n\n').trim();

/* ---------- Pronote ---------- */
export async function fetchHomework() {
  if (!S.pronote || !pronote.assignmentsFromIntervals) return;
  D();
  const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - 3);
  const to = new Date(from); to.setDate(to.getDate() + 31);
  const list = await withSession((session) => pronote.assignmentsFromIntervals(session, from, to));
  S.cache.hw = list.map((a) => ({
    id: String(a.id), subject: (a.subject && a.subject.name) || 'Devoir', color: a.backgroundColor || '',
    text: decode(a.description), due: dstr(new Date(a.deadline)), done: !!a.done,
    files: (a.attachments || []).length,
  }));
  S.cache.hwAt = new Date().toISOString();
  commit(); reschedule(S);
}
async function pushDone(id, done) {
  try { if (pronote.assignmentStatus) await withSession((s) => pronote.assignmentStatus(s, id, done)); } catch (e) { /* on garde le choix sur le téléphone */ }
}

/* ---------- Données réunies ---------- */
export function allHomework() {
  const d = D();
  const mat = (id) => S.profil.matieres.find((m) => m.id === id);
  const p = S.cache.hw.map((h) => {
    const mid = matiereFor(h.subject);
    return { ...h, src: 'pronote', done: d.doneP[h.id] !== undefined ? d.doneP[h.id] : h.done, mid, color: (mid && mat(mid) && mat(mid).couleur) || h.color };
  });
  const e = (S.sko ? S.cache.hwEnt || [] : []).map((h) => {
    const mid = matiereFor(h.subject);
    return { ...h, src: 'ent', done: d.doneE && d.doneE[h.id] !== undefined ? d.doneE[h.id] : h.done, mid, color: (mid && mat(mid) && mat(mid).couleur) || h.color };
  });
  const m = d.manual.map((h) => {
    const mm = mat(h.mid);
    return { ...h, src: 'moi', subject: mm ? mm.nom : h.subject || 'Autre', color: mm ? mm.couleur : '#94A3B8' };
  });
  return [...p, ...e, ...m].sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : (a.subject < b.subject ? -1 : 1)));
}
export const todoCount = (day) => allHomework().filter((h) => !h.done && (day ? h.due === day : h.due >= today())).length;

function toggle(h) {
  const d = D();
  if (h.src === 'moi') { const x = d.manual.find((y) => y.id === h.id); if (x) x.done = !x.done; }
  else if (h.src === 'ent') { d.doneE = d.doneE || {}; d.doneE[h.id] = !h.done; setEntDone(h.id, !h.done).catch(() => {}); }
  else { d.doneP[h.id] = !h.done; pushDone(h.id, !h.done); }
  commit(); reschedule(S);
  if (!h.done) toast('✅ Fait !');
}
// Prochain cours d'une matière (d'après l'emploi du temps)
function nextLessonDay(mid) {
  const now = new Date().toISOString();
  let best = null;
  Object.values(S.cache.edt || {}).forEach((w) => (w.lessons || []).forEach((l) => {
    if (l.canceled || l.start <= now || matiereFor(l.subject) !== mid) return;
    if (dstr(new Date(l.start)) === today()) return;
    if (!best || l.start < best) best = l.start;
  }));
  return best ? dstr(new Date(best)) : null;
}
const dayTitle = (day) => {
  const n = diffDays(today(), day);
  if (n < 0) return '⚠️ En retard';
  if (n === 0) return "Pour aujourd'hui";
  if (n === 1) return 'Pour demain';
  return 'Pour ' + fmtDate(day).toLowerCase();
};

/* ---------- Ajouter / modifier ---------- */
function HomeworkForm({ item, preset }) {
  const { C, setModal } = useApp();
  const d = D();
  const [mid, setMid] = useState(item ? item.mid : (preset && preset.mid) || (S.profil.matieres[0] && S.profil.matieres[0].id) || '');
  const [text, setText] = useState(item ? item.text : '');
  const [due, setDue] = useState(item ? item.due : (preset && preset.mid && nextLessonDay(preset.mid)) || '');
  const [typed, setTyped] = useState('');
  const [err, setErr] = useState('');
  const next = mid ? nextLessonDay(mid) : null;
  const quick = [
    ...(next ? [['📅 Prochain cours', next]] : []),
    ['Demain', addDays(today(), 1)],
    ['Dans 2 jours', addDays(today(), 2)],
    ['Dans 1 semaine', addDays(today(), 7)],
  ];
  const save = () => {
    let day = due;
    if (typed.trim()) { const p = parseFr(typed.trim()); if (!p) return setErr('Date invalide : écris-la comme 24/11.'); day = p; }
    if (!text.trim()) return setErr('Écris le devoir.');
    if (!day) return setErr('Choisis pour quand.');
    if (item) Object.assign(d.manual.find((x) => x.id === item.id) || {}, { mid, text: text.trim(), due: day });
    else d.manual.push({ id: 'm' + uid(), mid, text: text.trim(), due: day, done: false, created: Date.now() });
    commit(); reschedule(S); setModal(null); toast(item ? 'Devoir modifié' : '📝 Devoir ajouté');
  };
  return (
    <View>
      <H2>{item ? 'Modifier le devoir' : 'Nouveau devoir'}</H2>
      <Label>Matière</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {S.profil.matieres.map((m) => {
          const on = mid === m.id;
          return (
            <Pressable key={m.id} onPress={() => { setMid(m.id); setDue(''); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 99, backgroundColor: on ? m.couleur : C.bg, borderWidth: 1.5, borderColor: on ? m.couleur : C.line }}>
              {!on && <Dot color={m.couleur} />}
              <Text style={{ color: on ? '#fff' : C.ink, fontWeight: '800', fontSize: 13 }}>{m.nom}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Label>À faire</Label>
      <Input value={text} onChangeText={setText} placeholder="ex. Exercices 4 et 5 p. 112" multiline style={{ minHeight: 80 }} autoFocus={!item} />
      <Label>Pour quand ?</Label>
      <Row>
        {quick.map(([l, day]) => {
          const on = due === day && !typed;
          return (
            <Pressable key={l} onPress={() => { setDue(day); setTyped(''); }} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: on ? C.pri : C.priSoft }}>
              <Text style={{ color: on ? '#fff' : C.priInk, fontWeight: '800', fontSize: 13 }}>{l}</Text>
              <Text style={{ color: on ? '#fff' : C.muted, fontSize: 11 }}>{fmtDate(day)}</Text>
            </Pressable>
          );
        })}
      </Row>
      <Input style={{ marginTop: 8 }} value={typed} onChangeText={(v) => { setTyped(v); }} placeholder={due ? `ou une autre date (choisi : ${fmtDate(due)})` : 'ou une date : 24/11'} />
      <Err>{err}</Err>
      <Row style={{ marginTop: 12 }}>
        <Btn flex label={item ? 'Enregistrer' : 'Ajouter'} onPress={save} />
        <Btn kind="ghost" label="Annuler" onPress={() => setModal(null)} />
      </Row>
      {item && <Btn kind="ghost" small label="🗑️ Supprimer ce devoir" style={{ marginTop: 12, alignSelf: 'flex-start' }}
        onPress={() => ask('Supprimer ?', 'Ce devoir sera effacé.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => { d.manual = d.manual.filter((x) => x.id !== item.id); commit(); setModal(null); } }])} />}
    </View>
  );
}
export const openHomeworkForm = (setModal, item, preset) => setModal(<HomeworkForm item={item} preset={preset} />);

/* ---------- Une ligne ---------- */
function HwRow({ h }) {
  const { C, setModal } = useApp();
  const [open, setOpen] = useState(false);
  const late = !h.done && h.due < today();
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 11, borderTopWidth: 1, borderColor: C.line, opacity: h.done ? 0.5 : 1 }}>
      <Pressable onPress={() => toggle(h)} hitSlop={10}
        style={{ width: 26, height: 26, borderRadius: 9, borderWidth: 2, borderColor: h.done ? C.ok : late ? C.bad : C.line, backgroundColor: h.done ? C.ok : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {h.done && <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>✓</Text>}
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={() => setOpen(!open)} onLongPress={() => (h.src === 'moi' ? openHomeworkForm(setModal, h) : null)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Dot color={h.color || C.pri} size={8} />
          <Text style={{ color: C.muted, fontSize: 12, fontWeight: '800', flex: 1 }} numberOfLines={1}>{h.subject.toUpperCase()}</Text>
          <Text style={{ color: C.muted, fontSize: 11 }}>{h.src === 'moi' ? '✍️ moi' : h.src === 'ent' ? '📚 ENT' : 'Pronote'}{h.files ? ' · 📎' : ''}</Text>
        </View>
        <Text style={{ color: C.ink, fontSize: 15, marginTop: 2, textDecorationLine: h.done ? 'line-through' : 'none' }} numberOfLines={open ? undefined : 3}>{h.text || '(pas de détail)'}</Text>
        {open && (
          <Row style={{ marginTop: 8 }}>
            {h.src === 'moi' && <Btn small kind="sec" label="✏️ Modifier" onPress={() => openHomeworkForm(setModal, h)} />}
          </Row>
        )}
      </Pressable>
    </View>
  );
}

/* ---------- Écran ---------- */
export function Devoirs() {
  const { C, setModal } = useApp();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showDone, setShowDone] = useState(false);
  const load = async () => {
    if ((!S.pronote && !S.sko) || isWeb) return;
    setLoading(true); setErr('');
    const errs = [];
    if (S.pronote) { try { await fetchHomework(); } catch (e) { errs.push('Pronote : ' + e.message); } }
    if (S.sko) { try { await fetchEntHomework(); } catch (e) { errs.push('ENT : ' + e.message); } }
    setErr(errs.join('\n')); setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { pull.fn = load; return () => { pull.fn = null; }; });
  const all = allHomework();
  const t = today();
  const todo = all.filter((h) => !h.done && h.due >= t);
  const late = all.filter((h) => !h.done && h.due < t && h.src === 'moi');
  const done = all.filter((h) => h.done && h.due >= addDays(t, -7));
  const groups = {};
  todo.forEach((h) => { (groups[h.due] = groups[h.due] || []).push(h); });
  const tomorrow = todo.filter((h) => h.due === addDays(t, 1)).length;

  return (
    <View>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.ink, fontSize: 34, fontWeight: '900', letterSpacing: -1 }}>{todo.length}</Text>
          <Txt muted>{todo.length === 0 ? 'Rien à faire, profites-en 😎' : `devoir${todo.length > 1 ? 's' : ''} à faire${tomorrow ? ` · ${tomorrow} pour demain` : ''}`}</Txt>
        </View>
        <Btn label="＋ Ajouter" onPress={() => openHomeworkForm(setModal)} />
      </Card>
      {err ? <Txt muted style={{ color: C.bad, marginBottom: 8 }}>{err}</Txt> : null}
      {!S.pronote && !S.sko && !isWeb && <Txt muted style={{ marginBottom: 8 }}>Connecte Pronote ou l'ENT (⚙️ → École) pour récupérer aussi les devoirs donnés par les profs.</Txt>}

      {late.length > 0 && (
        <Card>
          <Text style={{ color: C.bad, fontWeight: '900', fontSize: 15, marginBottom: 2 }}>⚠️ En retard</Text>
          {late.map((h) => <HwRow key={h.id} h={h} />)}
        </Card>
      )}
      {Object.keys(groups).map((day) => (
        <Card key={day}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ color: diffDays(t, day) <= 1 ? C.pri : C.ink, fontWeight: '900', fontSize: 15 }}>{dayTitle(day)}</Text>
            <Txt muted style={{ fontSize: 12 }}>{fmtDate(day)}</Txt>
          </Row>
          {groups[day].map((h) => <HwRow key={h.src + h.id} h={h} />)}
        </Card>
      ))}
      {done.length > 0 && (
        <Pressable onPress={() => setShowDone(!showDone)} style={{ paddingVertical: 10 }}>
          <Txt muted bold>{showDone ? '▾' : '▸'} Faits récemment ({done.length})</Txt>
        </Pressable>
      )}
      {showDone && done.length > 0 && <Card>{done.map((h) => <HwRow key={h.src + h.id} h={h} />)}</Card>}

      <Row style={{ marginTop: 4 }}>
        {(S.pronote || S.sko) && !isWeb && <Btn small kind="ghost" label={loading ? 'Mise à jour…' : '🔄 Actualiser'} onPress={load} />}
        {S.cache.hwAt ? <Txt muted style={{ fontSize: 12 }}>Pronote : {fmtDate(S.cache.hwAt.slice(0, 10))}</Txt> : null}
      </Row>
      <Txt muted style={{ fontSize: 12, marginTop: 6 }}>Coche la case quand c'est fait. Appui long sur un devoir que tu as ajouté pour le modifier.</Txt>
    </View>
  );
}

/* ---------- Carte de l'accueil ---------- */
export function HomeworkCard() {
  const { C, go } = useApp();
  const t = today();
  const now = new Date();
  if (S.pronote && now.getHours() >= 15) return null; // l'après-midi, la carte « Demain » les montre déjà
  const day = null;
  const list = allHomework().filter((h) => !h.done && (day ? h.due === day : h.due >= t && h.due <= addDays(t, 1)));
  if (!list.length) return null;
  return (
    <Pressable onPress={() => go({ name: 'devoirs' })}>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: C.muted, fontWeight: '800', fontSize: 12 }}>📝 DEVOIRS {day ? 'POUR DEMAIN' : "AUJOURD'HUI ET DEMAIN"}</Text>
          <Text style={{ color: C.pri, fontWeight: '900' }}>{list.length} ›</Text>
        </Row>
        {list.slice(0, 3).map((h) => (
          <View key={h.src + h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Dot color={h.color || C.pri} />
            <Text style={{ color: C.ink, fontWeight: '800' }}>{h.subject}</Text>
            <Text style={{ color: C.muted, flex: 1 }} numberOfLines={1}>{h.text}</Text>
          </View>
        ))}
      </Card>
    </Pressable>
  );
}
