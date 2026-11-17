// Pronote : connexion par QR code, emploi du temps, notes et DS repérés.
// Utilise Pawnote, une bibliothèque NON officielle : elle peut arrêter de marcher si Pronote change.
import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as pronote from './pawnote';
import { useApp, Card, H2, Txt, Btn, Row, Chip, Dot, Label, Input, Err, Fb, toast, pull } from './ui';
import { uid, dstr, today, fmtDate, mondayOf, norm, diffDays, isArchived } from './logic';
import { S, commit, persistNow, chaptersOf } from './store';
import { reschedule } from './notifs';
import { ChapitreForm, newMatiere } from './forms';
import { openAvgSim } from './avgsim';

/* ================= Connexion ================= */
// Pronote donne « NOM Prénom » : on garde le prénom
export const firstName = (n) => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? p[p.length - 1] : p[0] || ''; };
let SESSION = null;
const plainRefresh = (r) => ({ url: r.url, token: r.token, username: r.username, kind: r.kind, navigatorIdentifier: r.navigatorIdentifier });

async function loginWithQr(qr, pin) {
  const deviceUUID = (S.pronote && S.pronote.deviceUUID) || 'revisions-' + uid() + uid();
  const session = pronote.createSessionHandle();
  const refresh = await pronote.loginQrCode(session, { deviceUUID, pin, qr });
  const res = session.userResource || {};
  S.pronote = { refresh: plainRefresh(refresh), deviceUUID, name: res.name || '', className: res.className || '', school: res.establishmentName || '' };
  SESSION = session; persistNow();
  return session;
}
async function getSession(force) {
  if (SESSION && !force) return SESSION;
  if (!S.pronote) throw new Error('Pas connecté à Pronote.');
  const r = S.pronote.refresh;
  const session = pronote.createSessionHandle();
  try {
    const refresh = await pronote.loginToken(session, { url: r.url, kind: r.kind, username: r.username, token: r.token, deviceUUID: S.pronote.deviceUUID, navigatorIdentifier: r.navigatorIdentifier });
    S.pronote.refresh = plainRefresh(refresh); // le jeton change à chaque connexion : on garde le nouveau
    persistNow();
  } catch (e) {
    throw new Error("La connexion à Pronote a expiré. Reconnecte-toi avec un nouveau QR code (⚙️ Réglages).");
  }
  SESSION = session;
  return session;
}
async function withSession(fn) {
  try { return await fn(await getSession()); } catch (e) {
    if (/Reconnecte|Pas connecté/.test(e.message)) throw e;
    try { return await fn(await getSession(true)); } catch (e2) {
      if (/Reconnecte|Pas connecté/.test(e2.message)) throw e2;
      throw new Error('Pronote ne répond pas (' + (e2.message || 'erreur') + '). Vérifie ta connexion internet.');
    }
  }
}
export function logoutPronote() { SESSION = null; S.pronote = null; S.cache.edt = {}; S.cache.grades = {}; S.cache.gradesPeriods = []; commit(); }

/* ================= Données ================= */
async function fetchWeek(monday) {
  return withSession(async (session) => {
    const end = new Date(monday); end.setDate(end.getDate() + 6); end.setHours(23, 59);
    const tt = await pronote.timetableFromIntervals(session, monday, end);
    pronote.parseTimetable(session, tt, { withSuperposedCanceledClasses: false, withCanceledClasses: true, withPlannedClasses: true });
    const lessons = tt.classes.filter((c) => c.is === 'lesson').map((c) => ({
      id: String(c.id), start: c.startDate.toISOString(), end: c.endDate.toISOString(),
      subject: (c.subject && c.subject.name) || 'Cours', room: (c.classrooms || []).join(', '), teacher: (c.teacherNames || []).join(', '),
      canceled: !!c.canceled, test: !!c.test, status: c.status || '', color: c.backgroundColor || '',
    })).sort((a, b) => (a.start < b.start ? -1 : 1));
    S.cache.edt[dstr(monday)] = { at: new Date().toISOString(), lessons };
    syncSubjects(lessons);
    // on ne garde que les semaines proches
    Object.keys(S.cache.edt).forEach((k) => { if (Math.abs(diffDays(k, dstr(monday))) > 35) delete S.cache.edt[k]; });
    commit();
    return lessons;
  });
}
const gv = (v) => (v && v.kind === 0 ? v.points : null);
async function fetchGrades(periodName) {
  return withSession(async (session) => {
    const tab = session.userResource.tabs.get(pronote.TabLocation.Grades);
    const periods = (tab && tab.periods) || [];
    const period = periods.find((p) => p.name === periodName) || (tab && tab.defaultPeriod) || periods[0];
    if (!period) throw new Error("Les notes ne sont pas disponibles dans ton Pronote.");
    const ov = await pronote.gradesOverview(session, period);
    const data = {
      period: period.name, overall: gv(ov.overallAverage), classOverall: gv(ov.classAverage),
      subjects: (ov.subjectsAverages || []).map((s) => ({ name: s.subject.name, avg: gv(s.student), cls: gv(s.class_average), outOf: gv(s.outOf) || 20, color: s.backgroundColor || '' })),
      grades: (ov.grades || []).map((g) => ({ id: String(g.id), subject: g.subject.name, value: gv(g.value), kind: g.value ? g.value.kind : -1, outOf: gv(g.outOf) || 20, date: g.date.toISOString(), coef: g.coefficient, avg: gv(g.average), comment: g.comment || '' }))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    };
    S.cache.grades[period.name] = data; S.cache.gradesPeriods = periods.map((p) => p.name); S.cache.gradesAt = new Date().toISOString();
    commit();
    return data;
  });
}
// À l'ouverture de l'appli : met à jour cette semaine et la suivante (pour repérer les DS), sans bloquer.
export async function silentRefresh() {
  if (!S.pronote) return;
  try { const m = mondayOf(new Date()); await fetchWeek(m); const n = new Date(m); n.setDate(n.getDate() + 7); await fetchWeek(n); } catch (e) {}
  reschedule(S); // les réveils suivent l'emploi du temps à jour
}

/* ================= Matières Pronote ↔ matières de l'appli ================= */
// "SCIENCES VIE & TERRE" -> "Sciences vie & terre"
const pretty = (s) => { const t = String(s).trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
const NOT_SUBJECT = /vie de classe|heure de vie|permanence|^etude|accompagnement personnalis|devoirs faits|^ap$|^dnl$/i;
// Crée automatiquement une matière pour chaque cours de l'emploi du temps
function syncSubjects(lessons) {
  S.profil.links = S.profil.links || {}; S.profil.ignored = S.profil.ignored || {};
  let added = false;
  [...new Set(lessons.map((l) => l.subject))].forEach((sub) => {
    if (!sub || sub === 'Cours' || S.profil.ignored[sub] || NOT_SUBJECT.test(norm(sub))) return;
    if (matiereFor(sub)) { if (!S.profil.links[sub]) S.profil.links[sub] = matiereFor(sub); return; }
    const m = newMatiere(pretty(sub)); S.profil.links[sub] = m.id; added = true;
  });
  if (added) commit();
}
export function matiereFor(subject) {
  const links = S.profil.links || {};
  if (links[subject] && S.profil.matieres.some((m) => m.id === links[subject])) return links[subject];
  const ns = norm(subject);
  const m = S.profil.matieres.find((x) => { const nm = norm(x.nom); return nm && (ns === nm || ns.startsWith(nm) || nm.startsWith(ns) || ns.slice(0, 6) === nm.slice(0, 6)); });
  return m ? m.id : null;
}
function LinkSubject({ subject, then }) {
  const { setModal } = useApp();
  const link = (mid) => { S.profil.links = S.profil.links || {}; S.profil.links[subject] = mid; commit(); then(mid); };
  return (
    <View>
      <H2>À quelle matière correspond « {subject} » ?</H2>
      <View style={{ gap: 8 }}>
        {S.profil.matieres.map((m) => <Btn key={m.id} kind="sec" label={m.nom} onPress={() => link(m.id)} />)}
        <Btn label={`＋ Créer la matière « ${pretty(subject)} »`} onPress={() => { const m = newMatiere(pretty(subject)); link(m.id); }} />
        <Btn kind="ghost" label="Annuler" onPress={() => setModal(null)} />
      </View>
    </View>
  );
}
// Toucher un cours de l'emploi du temps : ouvre le chapitre de la matière
export function openSubject(subject, ctx) {
  const { go, setModal } = ctx;
  const openMat = (mid) => {
    const allOf = chaptersOf(mid);
    const list = allOf.filter((c) => !isArchived(c)).length ? allOf.filter((c) => !isArchived(c)) : allOf;
    if (!list.length) {
      const m = S.profil.matieres.find((x) => x.id === mid);
      setModal(
        <View>
          <H2>Pas encore de chapitre en {m ? m.nom : subject}</H2>
          <Txt muted>Prends ton cours en photo pour créer le premier.</Txt>
          <Row style={{ marginTop: 12 }}><Btn label="📷 Créer un chapitre" onPress={() => setModal(<ChapitreForm mid={mid} />)} /><Btn kind="ghost" label="Fermer" onPress={() => setModal(null)} /></Row>
        </View>
      );
      return;
    }
    const t = today();
    const next = list.filter((c) => c.ds && c.ds >= t).sort((a, b) => (a.ds < b.ds ? -1 : 1))[0];
    const recent = list.slice().sort((a, b) => (b.created || 0) - (a.created || 0))[0];
    if (list.length === 1 || next) { setModal(null); go({ name: 'ch', id: (next || recent).id, tab: 'cours', back: 'edt' }); return; }
    setModal(
      <View>
        <H2>Quel chapitre ?</H2>
        <View style={{ gap: 8 }}>{list.sort((a, b) => (b.created || 0) - (a.created || 0)).map((c) => <Btn key={c.id} kind="sec" label={c.titre} onPress={() => { setModal(null); go({ name: 'ch', id: c.id, tab: 'cours', back: 'edt' }); }} />)}</View>
      </View>
    );
  };
  const mid = matiereFor(subject);
  if (mid) openMat(mid); else setModal(<LinkSubject subject={subject} then={openMat} />);
}

/* ================= Connexion par QR code ================= */
export function QrLogin() {
  const { C, setModal, runAI } = useApp();
  const [perm, requestPerm] = useCameraPermissions();
  const [qr, setQr] = useState(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const onScan = ({ data }) => {
    if (qr) return;
    try { const o = JSON.parse(data); if (!o.jeton || !o.url) throw 0; setQr(o); setErr(''); } catch (e) { setErr("Ce n'est pas un QR code Pronote."); }
  };
  const login = async () => {
    if (!/^\d{4}$/.test(pin)) return setErr('Le code fait 4 chiffres.');
    try {
      await runAI('Connexion à Pronote', () => loginWithQr(qr, pin), 'Connexion en cours…');
      setModal(null); silentRefresh();
      toast(`Connecté ✅ Bonjour ${firstName(S.pronote.name)} !`);
    } catch (e) { setErr('Connexion refusée (' + ((e && e.name) || '') + ' : ' + ((e && e.message) || String(e)) + '). Vérifie le code à 4 chiffres ou génère un nouveau QR code.'); setQr(null); }
  };
  return (
    <View>
      <H2>🔗 Connecter Pronote</H2>
      {!qr ? (
        <View>
          <Txt>1. Sur un ordinateur, ouvre Pronote (par Ma Classe, comme d'habitude).</Txt>
          <Txt>2. En haut à droite, clique sur l'icône du <Text style={{ fontWeight: '700' }}>QR code</Text> (« Accès à l'application mobile »).</Txt>
          <Txt>3. Choisis un code à 4 chiffres et retiens-le.</Txt>
          <Txt>4. Scanne le QR code ici :</Txt>
          {!perm ? null : !perm.granted ? (
            <Btn label="Autoriser l'appareil photo" style={{ marginTop: 12 }} onPress={requestPerm} />
          ) : (
            <View style={{ height: 280, borderRadius: 14, overflow: 'hidden', marginTop: 12, backgroundColor: '#000' }}>
              <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
            </View>
          )}
        </View>
      ) : (
        <View>
          <Fb ok><Txt>QR code lu ✅</Txt></Fb>
          <Label>Le code à 4 chiffres que tu as choisi sur Pronote</Label>
          <Input value={pin} onChangeText={(t) => { setPin(t.replace(/\D/g, '').slice(0, 4)); setErr(''); }} keyboardType="number-pad" placeholder="1234" maxLength={4} />
          <Btn label="Se connecter" style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={login} />
        </View>
      )}
      <Err>{err}</Err>
      <Txt muted style={{ marginTop: 12 }}>Ton mot de passe n'est jamais demandé ni enregistré. L'appli garde seulement un jeton de connexion sur ton téléphone. La connexion passe par une bibliothèque non officielle (Pawnote) : elle peut parfois ne plus marcher.</Txt>
      <Btn kind="ghost" label="Annuler" style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => setModal(null)} />
    </View>
  );
}

function NotConnected({ what }) {
  const { setModal } = useApp();
  return (
    <Card>
      <H2>Connecte Pronote</H2>
      <Txt>Pour voir {what} ici, connecte ton compte Pronote avec le QR code. Ça marche aussi si tu passes par Ma Classe en Auvergne-Rhône-Alpes.</Txt>
      <Btn label="🔗 Connecter Pronote" style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => setModal(<QrLogin />)} />
    </Card>
  );
}
const hhmm = (iso) => { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0'); };

/* ================= Emploi du temps ================= */
export function Edt() {
  const ctx = useApp(); const { C } = ctx;
  const [monday, setMonday] = useState(() => { const d = new Date(); const m = mondayOf(d); if (d.getDay() === 6 || d.getDay() === 0) m.setDate(m.getDate() + 7); return m; });
  const [day, setDay] = useState(() => { const g = (new Date().getDay() + 6) % 7; return g > 4 ? 0 : g; });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const key = dstr(monday);
  const week = S.cache.edt[key];
  const load = async () => { setLoading(true); setErr(''); try { await fetchWeek(monday); } catch (e) { setErr(e.message); } setLoading(false); };
  useEffect(() => { if (S.pronote) load(); }, [key]);
  useEffect(() => { pull.fn = load; return () => { pull.fn = null; }; });
  if (!S.pronote) return <NotConnected what="ton emploi du temps" />;
  const shift = (n) => { const m = new Date(monday); m.setDate(m.getDate() + 7 * n); setMonday(m); setDay(0); }; // nouvelle semaine : on se met sur le lundi
  const days = [...Array(6)].map((_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return dstr(d); });
  const lessons = ((week && week.lessons) || []).filter((l) => dstr(new Date(l.start)) === days[day]);
  const hasSat = ((week && week.lessons) || []).some((l) => dstr(new Date(l.start)) === days[5]);
  return (
    <View>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', marginBottom: 10 }}>
        <Btn small kind="ghost" label="‹" onPress={() => shift(-1)} />
        <View style={{ alignItems: 'center' }}>
          <Txt bold>Semaine du {fmtDate(key)}</Txt>
          {key !== dstr(mondayOf(new Date())) && (
            <Pressable hitSlop={8} onPress={() => { setMonday(mondayOf(new Date())); const g = (new Date().getDay() + 6) % 7; setDay(g > 4 ? 0 : g); }}>
              <Text style={{ color: C.pri, fontWeight: '800', fontSize: 13 }}>↺ Revenir à aujourd'hui</Text>
            </Pressable>
          )}
        </View>
        <Btn small kind="ghost" label="›" onPress={() => shift(1)} />
      </Row>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
        {days.slice(0, hasSat ? 6 : 5).map((d, i) => {
          const n = ((week && week.lessons) || []).filter((l) => dstr(new Date(l.start)) === d && l.test).length;
          return (
            <Pressable key={d} onPress={() => setDay(i)} style={{ flex: 1, paddingVertical: 10, borderRadius: 16, alignItems: 'center', backgroundColor: i === day ? C.pri : C.card, borderWidth: i === day ? 0 : d === today() ? 2 : 1, borderColor: d === today() ? C.pri : C.line }}>
              <Text style={{ color: i === day ? '#fff' : C.ink, fontWeight: '700', fontSize: 13 }}>{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][i]}</Text>
              <Text style={{ color: i === day ? '#fff' : C.muted, fontSize: 12 }}>{d.slice(8)}{n ? ' 📝' : ''}</Text>
            </Pressable>
          );
        })}
      </View>
      {loading && !week ? <Txt muted>Chargement…</Txt> : null}
      {err ? <Fb ok={false}><Txt>{err}</Txt></Fb> : null}
      {week && !lessons.length ? <Card><Txt muted>Pas de cours ce jour-là 🎉</Txt></Card> : null}
      {lessons.map((l) => {
        const mid = matiereFor(l.subject); const m = S.profil.matieres.find((x) => x.id === mid);
        const nowIso = new Date().toISOString(); const live = l.start <= nowIso && nowIso < l.end; const past = l.end <= nowIso;
        return (
          <Pressable key={l.id + l.start} onPress={() => openSubject(l.subject, ctx)}
            style={({ pressed }) => ({ flexDirection: 'row', gap: 10, backgroundColor: live ? C.priSoft : C.card, borderWidth: live || l.test ? 2 : 1, borderColor: live ? C.pri : l.test ? C.bad : C.line, borderRadius: 18, padding: 14, marginBottom: 8, opacity: l.canceled ? 0.5 : past ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <View style={{ width: 4, borderRadius: 2, backgroundColor: l.color || (m && m.couleur) || C.pri }} />
            <View style={{ width: 52 }}><Txt bold>{hhmm(l.start)}</Txt><Txt muted>{hhmm(l.end)}</Txt></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ink, fontWeight: '700', fontSize: 15, textDecorationLine: l.canceled ? 'line-through' : 'none' }}>{l.subject}</Text>
              <Txt muted>{[l.room, l.teacher].filter(Boolean).join(' · ')}</Txt>
              <Row style={{ marginTop: 4 }}>
                {live && <Chip>⏺ En cours</Chip>}
                {l.test && <Chip>📝 DS / contrôle</Chip>}
                {l.status ? <Chip>{l.status}</Chip> : null}
                {m ? <Txt muted>→ {m.nom} ›</Txt> : <Txt muted>Toucher pour relier à une matière ›</Txt>}
              </Row>
            </View>
          </Pressable>
        );
      })}
      <Row style={{ marginTop: 6 }}>
        <Btn small kind="ghost" label={loading ? 'Mise à jour…' : '🔄 Actualiser'} onPress={load} />
        {week && <Txt muted>Mis à jour le {fmtDate(week.at.slice(0, 10))} à {hhmm(week.at)}</Txt>}
      </Row>
    </View>
  );
}

/* ================= Notes ================= */
const fmtN = (v) => (v === null || v === undefined ? '—' : (Math.round(v * 100) / 100).toString().replace('.', ','));
export function Notes() {
  const { C, setModal } = useApp();
  const periods = S.cache.gradesPeriods || [];
  const [period, setPeriod] = useState(null);
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const data = (period && S.cache.grades[period]) || Object.values(S.cache.grades)[0];
  const load = async (p) => { setLoading(true); setErr(''); try { const d = await fetchGrades(p); setPeriod(d.period); } catch (e) { setErr(e.message); } setLoading(false); };
  useEffect(() => { if (S.pronote) load(period); }, []);
  useEffect(() => { pull.fn = () => load(data && data.period); return () => { pull.fn = null; }; });
  if (!S.pronote) return <NotConnected what="tes notes" />;
  const color = (v, out = 20) => (v === null ? C.muted : v / out >= 0.7 ? C.ok : v / out >= 0.5 ? C.warn : C.bad);
  return (
    <View>
      {periods.length > 1 && <Row style={{ marginBottom: 10 }}>{periods.map((p) => <Btn key={p} small kind={data && data.period === p ? 'pri' : 'sec'} label={p} onPress={() => load(p)} />)}</Row>}
      {err ? <Fb ok={false}><Txt>{err}</Txt></Fb> : null}
      {!data ? <Txt muted>{loading ? 'Chargement…' : 'Aucune note pour le moment.'}</Txt> : (
        <View>
          <Card style={{ alignItems: 'center' }}>
            <Txt muted>Moyenne générale · {data.period}</Txt>
            <Text style={{ fontSize: 34, fontWeight: '800', color: color(data.overall) }}>{fmtN(data.overall)}</Text>
            {data.classOverall !== null && <Txt muted>Classe : {fmtN(data.classOverall)}</Txt>}
            <Btn label="🧮 Simuler ma moyenne" style={{ marginTop: 12, alignSelf: 'stretch' }} onPress={() => openAvgSim(data, setModal)} />
          </Card>
          <Card>
            <H2>Par matière</H2>
            {data.subjects.map((s) => {
              const gs = data.grades.filter((g) => g.subject === s.name);
              return (
                <View key={s.name} style={{ borderTopWidth: 1, borderColor: C.line }}>
                  <Pressable onPress={() => setOpen(open === s.name ? null : s.name)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
                    <Dot color={s.color || C.pri} />
                    <View style={{ flex: 1 }}><Txt bold>{s.name}</Txt>{s.cls !== null && <Txt muted>Classe : {fmtN(s.cls)}</Txt>}</View>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: color(s.avg, s.outOf) }}>{fmtN(s.avg)}</Text>
                  </Pressable>
                  {open === s.name && <Row style={{ marginLeft: 20, marginBottom: 6 }}>
                    <Btn small kind="sec" label="🧮 Simuler" onPress={() => openAvgSim(data, setModal, s.name)} />
                    <Btn small kind="sec" label="🎯 Note à viser" onPress={() => openSim(s.name, gs, setModal)} />
                  </Row>}
                  {open === s.name && gs.map((g) => { const lc = chapterOfGrade(g.id); return (
                    <Pressable key={g.id} onPress={() => pickChapterForGrade(g, setModal)} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6, paddingLeft: 20 }}>
                      <View style={{ flex: 1 }}><Txt>{g.comment || 'Évaluation'}</Txt><Txt muted>{fmtDate(g.date.slice(0, 10))} · coef {g.coef}{g.avg !== null ? ' · classe ' + fmtN(g.avg) : ''}</Txt><Txt muted>{lc ? '🔗 ' + lc.titre : '＋ Associer à un chapitre'}</Txt></View>
                      <Txt bold style={{ color: color(g.value, g.outOf) }}>{g.kind === 0 ? `${fmtN(g.value)}/${fmtN(g.outOf)}` : 'Abs.'}</Txt>
                    </Pressable>
                  ); })}
                </View>
              );
            })}
          </Card>
          <Card>
            <H2>Dernières notes</H2>
            {data.grades.slice(0, 8).map((g) => { const lc = chapterOfGrade(g.id); return (
              <Pressable key={g.id} onPress={() => pickChapterForGrade(g, setModal)} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
                <View style={{ flex: 1 }}><Txt bold>{g.subject}</Txt><Txt muted>{g.comment || 'Évaluation'} · {fmtDate(g.date.slice(0, 10))}{lc ? ' · 🔗 ' + lc.titre : ''}</Txt></View>
                <Txt bold style={{ color: color(g.value, g.outOf) }}>{g.kind === 0 ? `${fmtN(g.value)}/${fmtN(g.outOf)}` : 'Abs.'}</Txt>
              </Pressable>
            ); })}
            <Txt muted style={{ marginTop: 6 }}>Touche une note pour la ranger dans un chapitre.</Txt>
          </Card>
        </View>
      )}
      <Row><Btn small kind="ghost" label={loading ? 'Mise à jour…' : '🔄 Actualiser'} onPress={() => load(data && data.period)} />
        {S.cache.gradesAt ? <Txt muted>Mis à jour le {fmtDate(S.cache.gradesAt.slice(0, 10))}</Txt> : null}</Row>
    </View>
  );
}

/* ================= DS repérés dans l'emploi du temps ================= */
export function detectedDs() {
  const t = new Date().toISOString();
  const seen = S.cache.dsSeen || {};
  const out = [];
  Object.values(S.cache.edt || {}).forEach((w) => (w.lessons || []).forEach((l) => { if (l.test && !l.canceled && l.start > t && !seen[l.id + l.start]) out.push(l); }));
  return out.sort((a, b) => (a.start < b.start ? -1 : 1));
}
export function DsDetected() {
  const ctx = useApp(); const { setModal } = ctx;
  const list = detectedDs().slice(0, 3);
  if (!list.length) return null;
  const dismiss = (l) => { S.cache.dsSeen[l.id + l.start] = 1; commit(); };
  const pick = (l) => {
    const mid = matiereFor(l.subject);
    const chs = (mid ? chaptersOf(mid) : Object.values(S.chs)).sort((a, b) => (b.created || 0) - (a.created || 0));
    const day = dstr(new Date(l.start));
    setModal(
      <View>
        <H2>DS de {l.subject} le {fmtDate(day)}</H2>
        <Txt muted>Sur quel chapitre ? L'appli mettra l'accent dessus jusqu'au DS.</Txt>
        <View style={{ gap: 8, marginTop: 12 }}>
          {chs.map((c) => <Btn key={c.id} kind="sec" label={c.titre} onPress={() => { c.ds = day; c.dsTime = hhmm(l.start).replace('h', ':'); delete c.archived; dismiss(l); reschedule(S); setModal(null); }} />)}
          {!chs.length && <Txt>Aucun chapitre dans cette matière pour l'instant.</Txt>}
          <Btn label="📷 Nouveau chapitre" onPress={() => setModal(<ChapitreForm mid={mid} />)} />
          <Btn kind="ghost" label="Fermer" onPress={() => setModal(null)} />
        </View>
      </View>
    );
  };
  return (
    <Card>
      <H2>📢 DS repérés dans Pronote</H2>
      {list.map((l) => (
        <View key={l.id + l.start} style={{ paddingVertical: 8 }}>
          <Txt bold>{l.subject} · {fmtDate(dstr(new Date(l.start)))} à {hhmm(l.start)}</Txt>
          <Row style={{ marginTop: 6 }}><Btn small label="Choisir le chapitre" onPress={() => pick(l)} /><Btn small kind="ghost" label="Ignorer" onPress={() => dismiss(l)} /></Row>
        </View>
      ))}
    </Card>
  );
}

/* ================= Notes associées à un chapitre ================= */
// Toutes les notes Pronote (tous trimestres en mémoire) d'une matière de l'appli
export function gradesForMatiere(mid) {
  const seen = {}, out = [];
  Object.values(S.cache.grades || {}).forEach((p) => (p.grades || []).forEach((g) => {
    if (seen[g.id] || matiereFor(g.subject) !== mid) return;
    seen[g.id] = 1; out.push({ ...g, period: p.period });
  }));
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}
const snap = (g) => ({ id: g.id, value: g.value, kind: g.kind, outOf: g.outOf, date: g.date, comment: g.comment, coef: g.coef, avg: g.avg });
export const chapterOfGrade = (gid) => Object.values(S.chs).find((c) => (c.grades || []).some((g) => g.id === gid));
export function linkGrade(ch, g) {
  Object.values(S.chs).forEach((c) => { if (c.grades) c.grades = c.grades.filter((x) => x.id !== g.id); }); // une note = un seul chapitre
  ch.grades = [...(ch.grades || []), snap(g)].sort((a, b) => (a.date < b.date ? 1 : -1));
  commit();
}
export function unlinkGrade(ch, gid) { ch.grades = (ch.grades || []).filter((g) => g.id !== gid); commit(); }
const gradeText = (g) => (g.kind === 0 ? `${fmtN(g.value)}/${fmtN(g.outOf)}` : 'Abs.');
function avg20(list) {
  const ok = list.filter((g) => g.kind === 0 && g.value !== null && g.outOf);
  const w = ok.reduce((a, g) => a + (g.coef || 1), 0);
  return w ? ok.reduce((a, g) => a + (g.value / g.outOf) * 20 * (g.coef || 1), 0) / w : null;
}

function GradePicker({ ch }) {
  const { C, setModal } = useApp();
  const [, setT] = useState(0);
  const list = gradesForMatiere(ch.matiereId);
  const linked = (id) => (ch.grades || []).some((g) => g.id === id);
  return (
    <View>
      <H2>Associer des notes à « {ch.titre} »</H2>
      <Txt muted>Touche les notes qui portent sur ce chapitre.</Txt>
      {!list.length && <Txt style={{ marginTop: 12 }}>Aucune note trouvée pour cette matière. Ouvre l'onglet 📊 Notes pour les charger (et choisis le bon trimestre).</Txt>}
      <View style={{ marginTop: 10 }}>
        {list.map((g) => {
          const on = linked(g.id); const other = !on && chapterOfGrade(g.id);
          return (
            <Pressable key={g.id} onPress={() => { if (on) unlinkGrade(ch, g.id); else linkGrade(ch, g); setT((t) => t + 1); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1.5, marginBottom: 6, borderColor: on ? C.pri : C.line, backgroundColor: on ? C.priSoft : C.bg }}>
              <Text style={{ fontSize: 18 }}>{on ? '☑️' : '⬜'}</Text>
              <View style={{ flex: 1 }}>
                <Txt bold>{g.comment || 'Évaluation'}</Txt>
                <Txt muted>{fmtDate(g.date.slice(0, 10))} · {g.period}{other ? ' · déjà dans « ' + other.titre + ' »' : ''}</Txt>
              </View>
              <Txt bold>{gradeText(g)}</Txt>
            </Pressable>
          );
        })}
      </View>
      <Btn label="Terminé" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => setModal(null)} />
    </View>
  );
}

// Carte « Mes notes sur ce chapitre » (onglet Bilan)
export function ChapterGrades({ ch }) {
  const { C, setModal } = useApp();
  const gs = ch.grades || [];
  const a = avg20(gs);
  return (
    <Card>
      <H2>📊 Mes notes sur ce chapitre</H2>
      {gs.length ? gs.map((g) => (
        <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <View style={{ flex: 1 }}><Txt bold>{g.comment || 'Évaluation'}</Txt><Txt muted>{fmtDate(g.date.slice(0, 10))} · coef {g.coef}{g.avg !== null && g.avg !== undefined ? ' · classe ' + fmtN(g.avg) : ''}</Txt></View>
          <Txt bold>{gradeText(g)}</Txt>
          <Pressable onPress={() => unlinkGrade(ch, g.id)} hitSlop={8}><Text style={{ color: C.muted }}>✕</Text></Pressable>
        </View>
      )) : <Txt muted>{S.pronote ? 'Aucune note associée pour l\'instant.' : 'Connecte Pronote (⚙️ Réglages) pour associer tes notes à ce chapitre.'}</Txt>}
      {a !== null && <Txt style={{ marginTop: 8 }}>Moyenne du chapitre : <Text style={{ fontWeight: '800' }}>{fmtN(a)}/20</Text></Txt>}
      {S.pronote && <Btn small kind="sec" label="＋ Associer des notes" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => setModal(<GradePicker ch={ch} />)} />}
    </Card>
  );
}

// Depuis l'onglet Notes : toucher une note pour la ranger dans un chapitre
function pickChapterForGrade(g, setModal) {
  const mid = matiereFor(g.subject);
  const chs = (mid ? chaptersOf(mid) : []).sort((a, b) => (b.created || 0) - (a.created || 0));
  const cur = chapterOfGrade(g.id);
  setModal(
    <View>
      <H2>{g.comment || 'Évaluation'} · {gradeText(g)}</H2>
      <Txt muted>De quel chapitre parle cette note ?</Txt>
      <View style={{ gap: 8, marginTop: 12 }}>
        {chs.map((c) => <Btn key={c.id} kind={cur === c ? 'pri' : 'sec'} label={(cur === c ? '✓ ' : '') + c.titre} onPress={() => { linkGrade(c, g); setModal(null); }} />)}
        {!chs.length && <Txt>Aucun chapitre dans cette matière pour l'instant.</Txt>}
        {cur && <Btn kind="ghost" label="Retirer du chapitre" onPress={() => { unlinkGrade(cur, g.id); setModal(null); }} />}
        <Btn kind="ghost" label="Fermer" onPress={() => setModal(null)} />
      </View>
    </View>
  );
}

/* ================= Prochain cours (accueil) ================= */
function allLessons() { return Object.values(S.cache.edt || {}).flatMap((w) => w.lessons || []); }
export function nextLesson() {
  const now = new Date().toISOString();
  const ls = allLessons().filter((l) => !l.canceled && l.end > now).sort((a, b) => (a.start < b.start ? -1 : 1));
  return ls[0] || null;
}
const until = (iso) => {
  const min = Math.round((new Date(iso) - Date.now()) / 60000);
  if (min <= 0) return 'maintenant';
  if (min < 60) return `dans ${min} min`;
  if (min < 24 * 60 && new Date(iso).getDate() === new Date().getDate()) return `dans ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
  return fmtDate(dstr(new Date(iso))) + ' à ' + hhmm(iso);
};
export function NextLesson() {
  const ctx = useApp(); const { C } = ctx;
  if (!S.pronote) return null;
  const l = nextLesson();
  if (!l) return null;
  const live = l.start <= new Date().toISOString();
  const mid = matiereFor(l.subject); const m = S.profil.matieres.find((x) => x.id === mid);
  const n = mid ? chaptersOf(mid).filter((c) => !isArchived(c)).length : 0;
  return (
    <Pressable onPress={() => openSubject(l.subject, ctx)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: l.color || (m && m.couleur) || C.pri }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.muted, fontWeight: '800', fontSize: 12 }}>{live ? '⏺ EN COURS' : '⏭ PROCHAIN COURS · ' + until(l.start).toUpperCase()}</Text>
          <Text style={{ color: C.ink, fontWeight: '900', fontSize: 18, marginTop: 2 }} numberOfLines={1}>{l.subject}</Text>
          <Text style={{ color: C.muted, fontSize: 13 }}>{hhmm(l.start)} – {hhmm(l.end)}{l.room ? ' · ' + l.room : ''}{l.test ? ' · 📝 DS' : ''}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 22 }}>{n ? '📘' : '📷'}</Text>
          <Text style={{ color: C.muted, fontSize: 10, fontWeight: '700' }}>{n ? 'Revoir' : 'Ajouter'}</Text>
        </View>
      </Card>
    </Pressable>
  );
}

/* ================= Simulateur de moyenne ================= */
// Moyenne /20 pondérée par les coefficients (estimation : Pronote peut avoir d'autres règles)
function simAvg(list) {
  const ok = list.filter((g) => g.kind === 0 && g.value !== null && g.outOf);
  const w = ok.reduce((a, g) => a + (g.coef || 1), 0);
  return w ? ok.reduce((a, g) => a + (g.value / g.outOf) * 20 * (g.coef || 1), 0) / w : null;
}
function GradeSim({ subject, grades }) {
  const { C, setModal } = useApp();
  const [note, setNote] = useState('');
  const [coef, setCoef] = useState('1');
  const [target, setTarget] = useState('');
  const cur = simAvg(grades);
  const n = parseFloat(String(note).replace(',', '.')), c = parseFloat(String(coef).replace(',', '.')) || 1, t = parseFloat(String(target).replace(',', '.'));
  const valid = grades.filter((g) => g.kind === 0 && g.value !== null && g.outOf);
  const W = valid.reduce((a, g) => a + (g.coef || 1), 0), Sum = valid.reduce((a, g) => a + (g.value / g.outOf) * 20 * (g.coef || 1), 0);
  const after = !isNaN(n) ? (Sum + n * c) / (W + c) : null;
  const need = !isNaN(t) ? (t * (W + c) - Sum) / c : null;
  const Big = ({ v, l, col }) => <View style={{ flex: 1, backgroundColor: C.bg, borderRadius: 16, padding: 12, alignItems: 'center' }}><Text style={{ fontSize: 24, fontWeight: '900', color: col || C.ink }}>{v}</Text><Text style={{ color: C.muted, fontSize: 12 }}>{l}</Text></View>;
  return (
    <View>
      <H2>🧮 Simulateur · {subject}</H2>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Big v={fmtN(cur)} l="moyenne actuelle" />
        <Big v={after === null ? '—' : fmtN(after)} l="avec la nouvelle note" col={after === null ? null : after >= (cur || 0) ? C.ok : C.bad} />
      </View>
      <Label>Si j'ai… (sur 20)</Label>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Input style={{ flex: 2 }} value={note} onChangeText={setNote} keyboardType="decimal-pad" placeholder="14" />
        <Input style={{ flex: 1 }} value={coef} onChangeText={setCoef} keyboardType="decimal-pad" placeholder="coef" />
      </View>
      <Label>Pour avoir une moyenne de…</Label>
      <Input value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="12" />
      {need !== null && (
        <Fb ok={need <= 20}>
          <Txt bold>{need <= 0 ? `C'est déjà gagné, même avec 0 🎉` : need > 20 ? `Il faudrait ${fmtN(need)}/20 : impossible avec une seule note (coef ${c}).` : `Il te faut au moins ${fmtN(Math.ceil(need * 4) / 4)}/20 (coef ${c}).`}</Txt>
        </Fb>
      )}
      <Txt muted style={{ marginTop: 10, fontSize: 12 }}>Estimation à partir des notes visibles. Pronote peut calculer autrement (sous-moyennes, notes bonus…).</Txt>
      <Btn kind="ghost" label="Fermer" style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => setModal(null)} />
    </View>
  );
}
export function openSim(subject, grades, setModal) { setModal(<GradeSim subject={subject} grades={grades} />); }
