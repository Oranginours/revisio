// 🎒 Carte « Demain » : le prochain jour de cours en un coup d'œil (le sac à préparer, les DS, les devoirs).
import React, { useState } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { useApp, Card, Dot, H2, Txt, Btn, Row, Label, Input, Err, toast, ask } from './ui';
import { dstr, today, addDays, diffDays, fmtDate, uid } from './logic';
import { S, commit } from './store';
import { matiereFor } from './school';
import { allHomework } from './devoirs';

const hh = (iso) => { const d = new Date(iso); return d.getHours() + 'h' + String(d.getMinutes()).padStart(2, '0'); };
const pretty = (s) => { const x = String(s).toLowerCase(); return x.charAt(0).toUpperCase() + x.slice(1); };

function lessonsOn(day) {
  const out = [];
  Object.values(S.cache.edt || {}).forEach((w) => (w.lessons || []).forEach((l) => { if (!l.canceled && dstr(new Date(l.start)) === day) out.push(l); }));
  const seen = new Set();
  return out.filter((l) => { const k = l.id + l.start; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => (a.start < b.start ? -1 : 1));
}

export function TomorrowCard() {
  const { C, go } = useApp();
  if (!S.pronote) return null;
  const now = new Date();
  const t = today();
  const todayLeft = lessonsOn(t).filter((l) => l.end > now.toISOString());
  if (todayLeft.length && now.getHours() < 15) return null; // la journée n'est pas finie
  let day = null, list = [];
  for (let k = 1; k <= 7; k++) { const d = addDays(t, k); const l = lessonsOn(d); if (l.length) { day = d; list = l; break; } }
  if (!day) return null;
  const n = diffDays(t, day);
  const subjects = [];
  list.forEach((l) => { if (!subjects.some((s) => s.name === l.subject)) subjects.push({ name: l.subject, mid: matiereFor(l.subject), color: l.color }); });
  const color = (s) => { const m = S.profil.matieres.find((x) => x.id === s.mid); return (m && m.couleur) || s.color || C.pri; };
  const tests = list.filter((l) => l.test);
  const hw = allHomework().filter((h) => !h.done && h.due === day);
  return (
    <Pressable onPress={() => go({ name: 'edt' })}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: C.muted, fontWeight: '800', fontSize: 12 }}>🎒 {n === 1 ? 'DEMAIN' : fmtDate(day).toUpperCase()}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>{list.length} cours</Text>
        </View>
        <Text style={{ color: C.ink, fontSize: 24, fontWeight: '900', marginTop: 2 }}>{hh(list[0].start)} → {hh(list[list.length - 1].end)}</Text>
        <BagList day={day} subjects={subjects} color={color} />
        {tests.map((l) => (
          <Text key={l.id + l.start} style={{ color: C.bad, fontWeight: '800', marginTop: 8 }}>🚨 DS de {pretty(l.subject)} à {hh(l.start)}</Text>
        ))}
        {hw.length > 0 && (
          <Pressable onPress={() => go({ name: 'devoirs' })} style={{ marginTop: 8, backgroundColor: C.warnSoft, borderRadius: 12, padding: 10 }}>
            <Text style={{ color: C.ink, fontWeight: '800' }}>📝 {hw.length} devoir{hw.length > 1 ? 's' : ''} à finir : {[...new Set(hw.map((h) => pretty(h.subject)))].join(', ')} ›</Text>
          </Pressable>
        )}
      </Card>
    </Pressable>
  );
}

/* ---------- 🎒 Le sac : groupes d'affaires (classeur rouge = Histoire + SES…) ---------- */
export const BAG_COLORS = [['Rouge', '#DC2626'], ['Bleu', '#2563EB'], ['Vert', '#16A34A'], ['Jaune', '#EAB308'], ['Orange', '#EA580C'], ['Violet', '#7C3AED'], ['Rose', '#DB2777'], ['Noir', '#1F2937'], ['Gris', '#9CA3AF'], ['Marron', '#92400E']];
const bag = () => (S.profil.sac = S.profil.sac || []);
const packed = (day) => { const p = S.profil.sacOk || {}; return p.day === day ? p.ids || [] : []; };

function BagList({ day, subjects, color }) {
  const { C, setModal } = useApp();
  const [, setT] = useState(0);
  const items = bag();
  const mids = subjects.map((s) => s.mid).filter(Boolean);
  const need = items.filter((it) => it.always || (it.mats || []).some((m) => mids.includes(m)));
  const covered = new Set(need.flatMap((it) => it.mats || []));
  const loose = subjects.filter((s) => !s.mid || !covered.has(s.mid));
  const ok = packed(day);
  const tick = (id) => {
    const cur = packed(day);
    S.profil.sacOk = { day, ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    commit(); setT((t) => t + 1);
  };
  const matNames = (it) => (it.mats || []).filter((m) => mids.includes(m)).map((m) => (S.profil.matieres.find((x) => x.id === m) || {}).nom).filter(Boolean).join(', ');
  const done = need.length > 0 && need.every((it) => ok.includes(it.id));
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <Text style={{ color: done ? C.ok : C.muted, fontSize: 12, fontWeight: '800' }}>{done ? '✅ SAC PRÊT' : 'DANS TON SAC'}</Text>
        <Pressable hitSlop={8} onPress={() => setModal(<BagEditor />)}><Text style={{ color: C.pri, fontWeight: '800', fontSize: 12 }}>✏️ {items.length ? 'Modifier' : 'Créer mes classeurs'}</Text></Pressable>
      </View>
      {need.map((it) => {
        const on = ok.includes(it.id);
        return (
          <Pressable key={it.id} onPress={() => tick(it.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: on ? C.ok : C.line, backgroundColor: on ? C.ok : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {on && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✓</Text>}
            </View>
            <View style={{ width: 14, height: 18, borderRadius: 3, backgroundColor: it.couleur }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ink, fontWeight: '800', textDecorationLine: on ? 'line-through' : 'none' }}>{it.nom}</Text>
              {!it.always && <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={1}>{matNames(it)}</Text>}
            </View>
          </Pressable>
        );
      })}
      {loose.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {loose.map((s) => (
            <View key={s.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Dot color={color(s)} size={8} />
              <Text style={{ color: C.ink, fontSize: 13, fontWeight: '700' }}>{pretty(s.name)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function BagEditor() {
  const { C, setModal } = useApp();
  const [, setT] = useState(0);
  const [edit, setEdit] = useState(null); // élément en cours de modification
  const items = bag();
  if (edit) return <BagItemForm item={edit === 'new' ? null : edit} done={() => { setEdit(null); setT((t) => t + 1); }} />;
  return (
    <View>
      <H2>🎒 Mes affaires</H2>
      <Txt muted>Regroupe tes matières par classeur ou cahier : la carte « Demain » te dira lesquels prendre.</Txt>
      {items.length === 0 && <Txt style={{ marginTop: 12 }}>Exemple : « Classeur rouge » → Histoire, SES, EMC.</Txt>}
      <View style={{ marginTop: 8 }}>
        {items.map((it) => (
          <Pressable key={it.id} onPress={() => setEdit(it)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: 1, borderColor: C.line }}>
            <View style={{ width: 18, height: 24, borderRadius: 4, backgroundColor: it.couleur }} />
            <View style={{ flex: 1 }}>
              <Txt bold>{it.nom}</Txt>
              <Txt muted numberOfLines={1}>{it.always ? 'Tous les jours' : (it.mats || []).map((m) => (S.profil.matieres.find((x) => x.id === m) || {}).nom).filter(Boolean).join(', ') || 'Aucune matière'}</Txt>
            </View>
            <Text style={{ color: C.muted, fontSize: 20 }}>›</Text>
          </Pressable>
        ))}
      </View>
      <Row style={{ marginTop: 12 }}>
        <Btn label="＋ Ajouter un classeur / cahier" onPress={() => setEdit('new')} />
        <Btn kind="ghost" label="Fermer" onPress={() => setModal(null)} />
      </Row>
    </View>
  );
}

function BagItemForm({ item, done }) {
  const { C } = useApp();
  const [nom, setNom] = useState(item ? item.nom : '');
  const [couleur, setCouleur] = useState(item ? item.couleur : BAG_COLORS[0][1]);
  const [mats, setMats] = useState(item ? item.mats || [] : []);
  const [always, setAlways] = useState(item ? !!item.always : false);
  const [err, setErr] = useState('');
  const cname = (BAG_COLORS.find((c) => c[1] === couleur) || [''])[0].toLowerCase();
  const save = () => {
    const n = nom.trim() || (cname ? `Classeur ${cname}` : '');
    if (!n) return setErr('Donne-lui un nom.');
    if (!always && !mats.length) return setErr('Choisis au moins une matière (ou « Tous les jours »).');
    if (item) Object.assign(item, { nom: n, couleur, mats, always });
    else bag().push({ id: 'b' + uid(), nom: n, couleur, mats, always });
    commit(); toast('🎒 Enregistré'); done();
  };
  const del = () => ask('Supprimer ?', `« ${item.nom} » sera retiré.`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => { S.profil.sac = bag().filter((x) => x.id !== item.id); commit(); done(); } }]);
  return (
    <View>
      <H2>{item ? 'Modifier' : 'Nouveau classeur / cahier'}</H2>
      <Label>Couleur</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {BAG_COLORS.map(([l, c]) => (
          <Pressable key={c} onPress={() => setCouleur(c)} hitSlop={4}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c, borderWidth: couleur === c ? 3 : 0, borderColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
            {couleur === c && <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text>}
          </Pressable>
        ))}
      </View>
      <Label>Nom</Label>
      <Input value={nom} onChangeText={setNom} placeholder={cname ? `Classeur ${cname}` : 'ex. Cahier vert'} />
      <Row style={{ marginTop: 6 }}>
        {['Classeur', 'Cahier', 'Pochette', 'Livre'].map((w) => <Btn key={w} small kind="ghost" label={`${w} ${cname}`} onPress={() => setNom(`${w} ${cname}`)} />)}
      </Row>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', marginTop: 12 }}>
        <Txt style={{ flex: 1 }}>Tous les jours (trousse, carte de cantine…)</Txt>
        <Switch value={always} onValueChange={setAlways} trackColor={{ true: C.pri }} />
      </Row>
      {!always && (
        <View>
          <Label>Pour quelles matières ?</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {S.profil.matieres.map((m) => {
              const on = mats.includes(m.id);
              const other = bag().find((x) => x !== item && (x.mats || []).includes(m.id));
              return (
                <Pressable key={m.id} onPress={() => setMats(on ? mats.filter((x) => x !== m.id) : [...mats, m.id])}
                  style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: 99, backgroundColor: on ? couleur : C.bg, borderWidth: 1.5, borderColor: on ? couleur : C.line }}>
                  <Text style={{ color: on ? '#fff' : C.ink, fontWeight: '800', fontSize: 13 }}>{m.nom}</Text>
                  {other && !on && <Text style={{ color: C.muted, fontSize: 10 }}>déjà : {other.nom}</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      <Err>{err}</Err>
      <Row style={{ marginTop: 14 }}>
        <Btn label="Enregistrer" onPress={save} />
        <Btn kind="ghost" label="Retour" onPress={done} />
      </Row>
      {item && <Btn kind="ghost" small label="🗑️ Supprimer" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={del} />}
    </View>
  );
}
export const openBagEditor = (setModal) => setModal(<BagEditor />);
