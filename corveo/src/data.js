// Logique de Corvéo : familles, tâches, semaines, répartition équitable et tâches en plus.
import { getDoc, listDocs, setDoc, updateDoc, deleteDoc, queryEq, newId, currentUid, currentUser, signUp, signIn, normUser, deleteAccount } from './fb';
import { ADMINS } from './config';

/* ---------- Semaines (lundi → dimanche) ---------- */
export function weekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = d.getUTCFullYear();
  const w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
export function mondayOf(date = new Date()) { const d = new Date(date); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
export const prevWeekId = (date = new Date()) => { const d = mondayOf(date); d.setDate(d.getDate() - 3); return weekId(d); };
export function daysLeft(date = new Date()) { return 7 - ((date.getDay() + 6) % 7); } // lundi = 7 … dimanche = 1

/* ---------- Comptes ---------- */
export const AVATARS = ['🦊', '🐼', '🐸', '🐯', '🦁', '🐵', '🐧', '🐙', '🦄', '🐲', '🐻', '🐨', '🐰', '🦉', '🐢', '🐝'];
export const COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#EAB308', '#F97316', '#A855F7', '#EC4899', '#14B8A6', '#F8FAFC', '#78350F', '#84CC16', '#06B6D4'];

export async function register({ username, password, name, avatar, color }) {
  const u = normUser(username);
  const uid = await signUp(u, password); // échoue si le pseudo est déjà pris
  await setDoc(`users/${uid}`, { username: u, name: name.trim() || u, avatar, color, familyId: '', role: '', active: true, created: Date.now() });
  return uid;
}
export async function login(username, password) { return signIn(normUser(username), password); }
export const getMe = () => getDoc(`users/${currentUid()}`);
export const updateMe = (patch) => updateDoc(`users/${currentUid()}`, patch);

/* ---------- Familles ---------- */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => { let s = ''; for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; };

export const DEFAULT_TASKS = [
  ['🍽️', 'Vider le lave-vaisselle', 3], ['🧽', 'Faire la vaisselle', 2], ['🗑️', 'Sortir les poubelles', 2],
  ['🧹', 'Passer l’aspirateur', 1], ['🛏️', 'Changer les draps', 1], ['🧺', 'Étendre le linge', 2],
  ['👕', 'Plier et ranger le linge', 1], ['🍴', 'Mettre la table', 3], ['🧼', 'Débarrasser la table', 3],
  ['🚽', 'Nettoyer la salle de bain', 1], ['🪴', 'Arroser les plantes', 1], ['🛒', 'Ranger les courses', 1],
];

export async function createFamily(name, withDefaults) {
  const uid = currentUid();
  const fid = newId();
  let code = makeCode();
  for (let k = 0; k < 5; k++) {
    try { await setDoc(`codes/${code}`, { familyId: fid }, true); break; } catch (e) { code = makeCode(); if (k === 4) throw e; }
  }
  await setDoc(`families/${fid}`, { name: name.trim() || 'Ma famille', owner: uid, code, perPerson: 0, penalty: 1, penMax: 3, created: Date.now() });
  await updateMe({ familyId: fid, role: 'parent' });
  if (withDefaults) {
    for (const [emoji, title, times] of DEFAULT_TASKS) await addTask(fid, { emoji, title, times });
  }
  return fid;
}
export async function joinFamily(codeTxt) {
  const code = String(codeTxt || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const c = await getDoc(`codes/${code}`);
  if (!c) throw new Error('Aucune famille avec ce code.');
  await updateMe({ familyId: c.familyId, role: 'enfant' });
  return c.familyId;
}
export async function leaveFamily() { await updateMe({ familyId: '', role: '' }); }
export const getFamily = (fid) => getDoc(`families/${fid}`);
export const updateFamily = (fid, patch) => updateDoc(`families/${fid}`, patch);
export const getMembers = async (fid) => (await queryEq('users', 'familyId', fid)).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'parent' ? -1 : 1));
export const setMember = (uid, patch) => updateDoc(`users/${uid}`, patch);
export async function newCode(fam) {
  let code = makeCode();
  await setDoc(`codes/${code}`, { familyId: fam.id }, true);
  try { await deleteDoc(`codes/${fam.code}`); } catch (e) { /* ancien code déjà parti */ }
  await updateFamily(fam.id, { code });
  return code;
}

/* ---------- Tâches ---------- */
export const getTasks = async (fid) => (await listDocs(`families/${fid}/tasks`)).sort((a, b) => (a.created || 0) - (b.created || 0));
export const addTask = (fid, t) => setDoc(`families/${fid}/tasks/${newId()}`, { emoji: t.emoji || '✨', title: t.title.trim(), info: (t.info || '').trim(), times: Math.max(1, t.times || 1), created: Date.now() });
export const editTask = (fid, id, t) => updateDoc(`families/${fid}/tasks/${id}`, { emoji: t.emoji, title: t.title.trim(), info: (t.info || '').trim(), times: Math.max(1, t.times || 1) });
export const removeTask = (fid, id) => deleteDoc(`families/${fid}/tasks/${id}`);

/* ---------- Semaine : répartition ---------- */
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const doneKey = (uid, i) => `${uid}_${i}`;
export function stats(week, uid) {
  const list = (week && week.assign && week.assign[uid]) || [];
  const done = list.filter((_, i) => week.done && week.done[doneKey(uid, i)]).length;
  return { total: list.length, done };
}
export function familyStats(week) {
  let total = 0, done = 0;
  Object.keys((week && week.assign) || {}).forEach((u) => { const s = stats(week, u); total += s.total; done += s.done; });
  return { total, done };
}

// Tâches en plus : pour chaque tâche pas faite la semaine d'avant, +penalty (au maximum penMax)
export function extrasFrom(prev, fam, uids) {
  const out = {};
  uids.forEach((u) => {
    if (!prev || !prev.assign || !prev.assign[u]) { out[u] = 0; return; }
    const s = stats(prev, u);
    const missed = s.total - s.done;
    out[u] = Math.min(fam.penMax ?? 3, missed * (fam.penalty ?? 1));
  });
  return out;
}

// Répartit les tâches : tout le monde a le même nombre de base, plus ses tâches en plus.
// hist[u][tâche] = combien de fois la personne l'a eue les semaines d'avant (pour changer chaque semaine)
export function distribute(tasks, uids, base, extra, hist = {}) {
  const pool0 = [];
  tasks.forEach((t) => { for (let k = 0; k < (t.times || 1); k++) pool0.push({ t: t.id, n: t.title, e: t.emoji }); });
  if (!pool0.length || !uids.length) return { assign: Object.fromEntries(uids.map((u) => [u, []])), base: 0 };
  const b = base > 0 ? base : Math.max(1, Math.floor(pool0.length / uids.length));
  const need = Object.fromEntries(uids.map((u) => [u, b + (extra[u] || 0)]));
  const assign = Object.fromEntries(uids.map((u) => [u, []]));
  let pool = shuffle(pool0);
  // Tour par tour : chacun prend une tâche, de préférence une qu'il n'a pas encore
  let guard = 0;
  while (uids.some((u) => assign[u].length < need[u]) && guard++ < 2000) {
    for (const u of shuffle(uids)) {
      if (assign[u].length >= need[u]) continue;
      if (!pool.length) pool = shuffle(pool0); // plus de tâches : on en redonne (les tâches en plus peuvent se répéter)
      const mine = new Set(assign[u].map((x) => x.t));
      const h = hist[u] || {};
      // on choisit la tâche la moins « déjà vue » : pas en double, et pas eue les semaines d'avant
      let k = 0, best = Infinity;
      pool.forEach((x, j) => { const sc = (mine.has(x.t) ? 100 : 0) + (h[x.t] || 0) * 10 + Math.random() * 3; if (sc < best) { best = sc; k = j; } });
      assign[u].push(pool.splice(k, 1)[0]);
    }
  }
  return { assign, base: b };
}

export const getWeek = (fid, wk) => getDoc(`families/${fid}/weeks/${wk}`);

// Crée la semaine si elle n'existe pas encore (le premier qui ouvre l'appli le lundi la crée)
export async function ensureWeek(fam, members, tasks) {
  const wk = weekId();
  const cur = await getWeek(fam.id, wk);
  if (cur) return cur;
  if (!tasks.length) return null;
  return buildWeek(fam, members, tasks, true);
}
export async function buildWeek(fam, members, tasks, mustNotExist) {
  const wk = weekId();
  const uids = members.filter((m) => m.active !== false).map((m) => m.id);
  const prev = await getWeek(fam.id, prevWeekId());
  const d2 = mondayOf(); d2.setDate(d2.getDate() - 10);
  const prev2 = await getWeek(fam.id, weekId(d2)).catch(() => null);
  const extra = extrasFrom(prev, fam, uids);
  const hist = {};
  const cur = mustNotExist ? null : await getWeek(fam.id, wk).catch(() => null);
  [[cur, 3], [prev, 2], [prev2, 1]].forEach(([w, wt]) => {
    if (!w || !w.assign) return;
    Object.entries(w.assign).forEach(([u, list]) => { hist[u] = hist[u] || {}; (list || []).forEach((x) => { hist[u][x.t] = (hist[u][x.t] || 0) + wt; }); });
  });
  // si on refait la répartition en cours de semaine, on évite aussi ce qu'on avait déjà
  const { assign, base } = distribute(tasks, uids, fam.perPerson || 0, extra, hist);
  const doc = { assign, done: {}, doing: {}, notes: {}, extra, base, created: Date.now(), by: currentUid() };
  try {
    return await setDoc(`families/${fam.id}/weeks/${wk}`, doc, mustNotExist);
  } catch (e) {
    if (mustNotExist && (e.status === 400 || e.status === 409 || /exist/i.test(e.message))) return getWeek(fam.id, wk); // quelqu'un l'a créée en même temps
    throw e;
  }
}
export async function setDone(fid, uid, i, on) {
  const k = doneKey(uid, i);
  return updateDoc(`families/${fid}/weeks/${weekId()}`, { ['done.' + k]: on ? Date.now() : undefined, ['doing.' + k]: undefined });
}
// « En cours » : visible par toute la famille
export async function setDoing(fid, uid, i, on, who) {
  const k = doneKey(uid, i);
  return updateDoc(`families/${fid}/weeks/${weekId()}`, { ['doing.' + k]: on ? { ts: Date.now(), by: who } : undefined, ['done.' + k]: undefined });
}
// Notes sur une tâche de la semaine (tout le monde les voit)
export async function addNote(fid, week, key, me, text) {
  const list = ((week.notes || {})[key] || []).concat([{ u: me.id, n: me.name, a: me.avatar || '', t: text.trim(), ts: Date.now() }]);
  await updateDoc(`families/${fid}/weeks/${weekId()}`, { ['notes.' + key]: list });
  return list;
}
export async function removeNote(fid, week, key, ts) {
  const list = ((week.notes || {})[key] || []).filter((x) => x.ts !== ts);
  await updateDoc(`families/${fid}/weeks/${weekId()}`, { ['notes.' + key]: list.length ? list : undefined });
  return list;
}
export const statusOf = (week, key) => (week && week.done && week.done[key] ? 'done' : week && week.doing && week.doing[key] ? 'doing' : 'todo');
// Ajoute une tâche à quelqu'un en cours de semaine (parents)
export async function giveTask(fid, week, uid, task) {
  const list = ((week.assign || {})[uid] || []).concat([{ t: task.id, n: task.title, e: task.emoji }]);
  return updateDoc(`families/${fid}/weeks/${weekId()}`, { ['assign.' + uid]: list });
}

/* ---------- Compte : suppression ---------- */
// Supprime mon profil puis mon compte (le mot de passe est redemandé par sécurité)
export async function deleteMyAccount(me, password) {
  await signIn(me.username, password);
  try { await deleteDoc(`users/${currentUid()}`); } catch (e) { /* déjà parti */ }
  await deleteAccount();
}
// Profil manquant (supprimé par l'admin) : on en recrée un vide
export async function recreateProfile() {
  const u = currentUser() || 'joueur';
  await setDoc(`users/${currentUid()}`, { username: u, name: u, avatar: '🙂', color: '#3B82F6', familyId: '', role: '', active: true, created: Date.now() });
  return getMe();
}

/* ---------- Admin ---------- */
export const isAdminUser = (me) => !!(me && ADMINS.includes(me.username));
export const allUsers = async () => (await listDocs('users')).sort((a, b) => String(a.username).localeCompare(String(b.username)));
export const allFamilies = async () => (await listDocs('families')).sort((a, b) => String(a.name).localeCompare(String(b.name)));
export const adminUpdateUser = (uid, patch) => updateDoc(`users/${uid}`, patch);
export const adminDeleteUser = (uid) => deleteDoc(`users/${uid}`);
export async function deleteFamily(fam, members) {
  for (const m of members) { try { await updateDoc(`users/${m.id}`, { familyId: '', role: '' }); } catch (e) { /* ignoré */ } }
  for (const sub of ['tasks', 'weeks']) {
    const docs = await listDocs(`families/${fam.id}/${sub}`).catch(() => []);
    for (const d of docs) await deleteDoc(`families/${fam.id}/${sub}/${d.id}`).catch(() => {});
  }
  if (fam.code) await deleteDoc(`codes/${fam.code}`).catch(() => {});
  await deleteDoc(`families/${fam.id}`);
}

/* ---------- Profils sans téléphone (gérés par un parent) ---------- */
export async function createManaged(fid, { name, avatar, color }) {
  const id = 'p' + newId(19);
  await setDoc(`users/${id}`, { username: '', name: name.trim(), avatar, color, familyId: fid, role: 'enfant', active: true, managed: true, managedBy: currentUid(), created: Date.now() });
  return id;
}
export const updateManaged = (id, patch) => updateDoc(`users/${id}`, patch);
export const deleteManaged = (id) => deleteDoc(`users/${id}`);
