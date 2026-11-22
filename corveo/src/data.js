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
export const getMembers = async (fid) => (await queryEq('users', 'familyId', fid)).sort((a, b) => (a.role === b.role ? String(a.name || '').localeCompare(String(b.name || '')) : a.role === 'parent' ? -1 : 1));
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
export const addTask = (fid, t) => setDoc(`families/${fid}/tasks/${newId()}`, { emoji: t.emoji || '✨', title: t.title.trim(), info: (t.info || '').trim(), times: Math.max(1, t.times || 1), day: t.day || 0, created: Date.now() });
export const editTask = (fid, id, t) => updateDoc(`families/${fid}/tasks/${id}`, { emoji: t.emoji, title: t.title.trim(), info: (t.info || '').trim(), times: Math.max(1, t.times || 1), day: t.day || 0 });
export const removeTask = (fid, id) => deleteDoc(`families/${fid}/tasks/${id}`);

/* ---------- Semaine ----------
   Chaque tâche distribuée a sa propre clé « k » : les cases cochées, « en cours » et les notes
   sont rangées sous cette clé. On peut donc retirer, déplacer ou ajouter des tâches sans rien décaler.
   Les anciennes semaines (sans clé) reçoivent la clé « uid_index », qui était l'ancien système. */
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const doneKey = (uid, i) => `${uid}_${i}`;
export const newKey = () => 'k' + newId(10);
export const DAY_NAMES = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const todayNum = () => ((new Date().getDay() + 6) % 7) + 1;

// Ajoute les clés manquantes (anciennes semaines) et repère les tâches en plus
export function normWeek(w) {
  if (!w) return w;
  const assign = {};
  Object.entries(w.assign || {}).forEach(([u, list]) => {
    const ex = (w.extra || {})[u] || 0;
    assign[u] = (list || []).map((it, i) => ({ ...it, k: it.k || doneKey(u, i), x: it.x !== undefined ? it.x : (it.k ? 0 : (i >= (list.length - ex) ? 1 : 0)) }));
  });
  return { ...w, assign, pool: w.pool || [], target: w.target || {}, done: w.done || {}, doing: w.doing || {}, notes: w.notes || {} };
}
export const MODES = {
  auto: { icon: '🎲', name: 'Automatique', desc: "L'appli répartit tout chaque lundi, avec le même nombre pour chacun." },
  manuel: { icon: '✋', name: 'À la main', desc: 'Un parent donne chaque tâche à quelqu\'un (ou répartit le reste en un clic).' },
  libre: { icon: '🙋', name: 'Chacun choisit', desc: 'Chacun prend ses tâches dans la liste, jusqu\'à son nombre de la semaine.' },
};
// Combien de tâches chacun doit avoir cette semaine (base + tâches en plus)
export const targetOf = (week, uid) => (week && week.target && week.target[uid] !== undefined ? week.target[uid] : (week && week.base) || 0);
export const itemsOf = (week, uid) => ((week && week.assign && week.assign[uid]) || []);
export function stats(week, uid) {
  const list = itemsOf(week, uid);
  const done = list.filter((it) => week.done && week.done[it.k || '']).length;
  return { total: list.length, done };
}
export function familyStats(week) {
  let total = (week && week.pool ? week.pool.length : 0), done = 0;
  Object.keys((week && week.assign) || {}).forEach((u) => { const s = stats(week, u); total += s.total; done += s.done; });
  return { total, done };
}
export const statusOf = (week, key) => (week && week.done && week.done[key] ? 'done' : week && week.doing && week.doing[key] ? 'doing' : 'todo');
export const POOL = '__pool';
export function findItem(week, key) {
  const p = ((week && week.pool) || []).find((x) => x.k === key);
  if (p) return { uid: POOL, it: p };
  for (const [u, list] of Object.entries((week && week.assign) || {})) { const it = (list || []).find((x) => x.k === key); if (it) return { uid: u, it }; }
  return null;
}

// Tâches en plus : pour chaque tâche pas faite la semaine d'avant, +penalty (au maximum penMax)
export function extrasFrom(prev, fam, uids) {
  const out = {};
  uids.forEach((u) => {
    if (!prev || !prev.assign || !prev.assign[u]) { out[u] = 0; return; }
    const s = stats(prev, u);
    out[u] = Math.min(fam.penMax ?? 3, (s.total - s.done) * (fam.penalty ?? 1));
  });
  return out;
}

const itemOf = (t) => ({ k: newKey(), t: t.id, n: t.title, e: t.emoji, ...(t.day ? { d: t.day } : {}) });

// Répartit les tâches : tout le monde a le même nombre de base, plus ses tâches en plus.
// hist[u][tâche] = combien de fois la personne l'a eue les semaines d'avant (pour changer chaque semaine)
export function distribute(tasks, uids, base, extra, hist = {}) {
  const pool0 = [];
  tasks.forEach((t) => { for (let k = 0; k < (t.times || 1); k++) pool0.push(t); });
  if (!pool0.length || !uids.length) return { assign: Object.fromEntries(uids.map((u) => [u, []])), base: 0 };
  const b = base > 0 ? base : Math.max(1, Math.floor(pool0.length / uids.length));
  const need = Object.fromEntries(uids.map((u) => [u, b + (extra[u] || 0)]));
  const assign = Object.fromEntries(uids.map((u) => [u, []]));
  let pool = shuffle(pool0);
  let guard = 0;
  while (uids.some((u) => assign[u].length < need[u]) && guard++ < 3000) {
    for (const u of shuffle(uids)) {
      if (assign[u].length >= need[u]) continue;
      if (!pool.length) pool = shuffle(pool0); // plus de tâches : on en redonne
      const mine = new Set(assign[u].map((x) => x.t));
      const h = hist[u] || {};
      let k = 0, best = Infinity;
      pool.forEach((x, j) => { const sc = (mine.has(x.id) ? 100 : 0) + (h[x.id] || 0) * 10 + Math.random() * 3; if (sc < best) { best = sc; k = j; } });
      const it = itemOf(pool.splice(k, 1)[0]);
      if (assign[u].length >= b) it.x = 1; // tâche en plus
      assign[u].push(it);
    }
  }
  return { assign, base: b };
}

export const getWeek = async (fid, wk) => normWeek(await getDoc(`families/${fid}/weeks/${wk}`));
export const updateWeek = (fid, wk, patch) => updateDoc(`families/${fid}/weeks/${wk}`, patch);

// Crée la semaine si elle n'existe pas encore (le premier qui ouvre l'appli le lundi la crée)
export async function ensureWeek(fam, members, tasks) {
  const cur = await getWeek(fam.id, weekId());
  if (cur) return cur;
  if (!tasks.length) return null;
  return buildWeek(fam, members, tasks, true);
}
export async function buildWeek(fam, members0, tasks, mustNotExist) {
  const wk = weekId();
  const members = await getMembers(fam.id).catch(() => members0); // liste à jour (quelqu'un vient peut-être de rejoindre)
  const uids = members.filter((m) => m.active !== false).map((m) => m.id);
  const prev = await getWeek(fam.id, prevWeekId()).catch(() => null);
  const prev2 = await getWeek(fam.id, weekIdOffset(-2)).catch(() => null);
  const cur = mustNotExist ? null : await getWeek(fam.id, wk).catch(() => null);
  const extra = extrasFrom(prev, fam, uids);
  const hist = {};
  [[cur, 3], [prev, 2], [prev2, 1]].forEach(([w, wt]) => {
    if (!w || !w.assign) return;
    Object.entries(w.assign).forEach(([u, list]) => { hist[u] = hist[u] || {}; (list || []).forEach((x) => { hist[u][x.t] = (hist[u][x.t] || 0) + wt; }); });
  });
  const mode = fam.mode || 'auto';
  let assign, base, pool = [];
  if (mode === 'auto') ({ assign, base } = distribute(tasks, uids, fam.perPerson || 0, extra, hist));
  else {
    // à la main / chacun choisit : toutes les tâches de la semaine attendent dans « À répartir »
    tasks.forEach((t) => { for (let k = 0; k < (t.times || 1); k++) pool.push(itemOf(t)); });
    pool = shuffle(pool).sort((a, b) => (a.d || 9) - (b.d || 9));
    assign = Object.fromEntries(uids.map((u) => [u, []]));
    base = fam.perPerson > 0 ? fam.perPerson : Math.max(1, Math.floor(pool.length / Math.max(1, uids.length)));
  }
  const target = Object.fromEntries(uids.map((u) => [u, base + (extra[u] || 0)]));
  const doc = { assign, pool, target, mode, done: {}, doing: {}, notes: {}, extra, base, created: Date.now(), by: currentUid() };
  try {
    return normWeek(await setDoc(`families/${fam.id}/weeks/${wk}`, doc, mustNotExist));
  } catch (e) {
    if (mustNotExist && (e.status === 400 || e.status === 409 || /exist/i.test(e.message))) return getWeek(fam.id, wk);
    throw e;
  }
}

/* ---------- Opérations sur une semaine ----------
   Chaque opération prend la semaine et renvoie { next, patch } :
   - next : la semaine modifiée (pour l'écran, tout de suite)
   - patch : ce qu'il faut écrire dans la base
   « fresh: true » = l'opération touche une liste : on relit la semaine juste avant d'écrire. */
const cloneW = (w) => ({ ...w, pool: (w.pool || []).slice(), assign: { ...(w.assign || {}) }, done: { ...(w.done || {}) }, doing: { ...(w.doing || {}) }, notes: { ...(w.notes || {}) }, extra: { ...(w.extra || {}) } });
export const OPS = {
  done: (k, on) => ({ fresh: false, run: (w) => { const n = cloneW(w); if (on) n.done[k] = Date.now(); else delete n.done[k]; delete n.doing[k]; return { next: n, patch: { ['done.' + k]: on ? n.done[k] : undefined, ['doing.' + k]: undefined } }; } }),
  doing: (k, on, who) => ({ fresh: false, run: (w) => { const n = cloneW(w); const v = on ? { ts: Date.now(), by: who } : undefined; if (v) n.doing[k] = v; else delete n.doing[k]; delete n.done[k]; return { next: n, patch: { ['doing.' + k]: v, ['done.' + k]: undefined } }; } }),
  addNote: (k, note) => ({ fresh: true, run: (w) => { const n = cloneW(w); n.notes[k] = (n.notes[k] || []).concat([note]); return { next: n, patch: { ['notes.' + k]: n.notes[k] } }; } }),
  delNote: (k, ts) => ({ fresh: true, run: (w) => { const n = cloneW(w); const l = (n.notes[k] || []).filter((x) => x.ts !== ts); if (l.length) n.notes[k] = l; else delete n.notes[k]; return { next: n, patch: { ['notes.' + k]: l.length ? l : undefined } }; } }),
  give: (uid, task, isExtra) => {
    const it = { ...itemOf(task), ...(isExtra ? { x: 1 } : {}) };
    return { fresh: true, run: (w) => { const n = cloneW(w); n.assign[uid] = itemsOf(w, uid).concat([it]); return { next: n, patch: { ['assign.' + uid]: n.assign[uid] } }; } };
  },
  remove: (uid, k) => ({ fresh: true, run: (w) => {
    const n = cloneW(w);
    const old = itemsOf(w, uid);
    const it = old.find((x) => x.k === k);
    n.assign[uid] = old.filter((x) => x.k !== k);
    delete n.done[k]; delete n.doing[k]; delete n.notes[k];
    const patch = { ['assign.' + uid]: n.assign[uid], ['done.' + k]: undefined, ['doing.' + k]: undefined, ['notes.' + k]: undefined };
    if (it && it.x && n.extra[uid]) { n.extra[uid] -= 1; patch['extra.' + uid] = n.extra[uid]; }
    return { next: n, patch };
  } }),
  move: (from, k, to) => ({ fresh: true, run: (w) => {
    const n = cloneW(w);
    const src = itemsOf(w, from);
    const it = src.find((x) => x.k === k);
    if (!it || from === to) return { next: w, patch: {} };
    n.assign[from] = src.filter((x) => x.k !== k);
    const moved = { ...it }; delete moved.x;
    n.assign[to] = itemsOf(w, to).concat([moved]);
    const patch = { ['assign.' + from]: n.assign[from], ['assign.' + to]: n.assign[to] };
    if (it.x && n.extra[from]) { n.extra[from] -= 1; patch['extra.' + from] = n.extra[from]; }
    return { next: n, patch };
  } }),
  // prendre une tâche de « À répartir » (pour soi ou pour quelqu'un)
  take: (uid, k) => ({ fresh: true, run: (w) => {
    const n = cloneW(w);
    const it = (w.pool || []).find((x) => x.k === k);
    if (!it) throw new Error('Quelqu\'un vient de la prendre.');
    n.pool = (w.pool || []).filter((x) => x.k !== k);
    n.assign[uid] = itemsOf(w, uid).concat([it]);
    return { next: n, patch: { pool: n.pool, ['assign.' + uid]: n.assign[uid] } };
  } }),
  // remettre une tâche dans « À répartir »
  release: (uid, k) => ({ fresh: true, run: (w) => {
    const n = cloneW(w);
    const it = itemsOf(w, uid).find((x) => x.k === k);
    if (!it) return { next: w, patch: {} };
    const back = { ...it }; delete back.x;
    n.assign[uid] = itemsOf(w, uid).filter((x) => x.k !== k);
    n.pool = (w.pool || []).concat([back]);
    delete n.done[k]; delete n.doing[k];
    const patch = { pool: n.pool, ['assign.' + uid]: n.assign[uid], ['done.' + k]: undefined, ['doing.' + k]: undefined };
    if (it.x && n.extra[uid]) { n.extra[uid] -= 1; patch['extra.' + uid] = n.extra[uid]; }
    return { next: n, patch };
  } }),
  // répartir automatiquement ce qui reste dans « À répartir », en complétant chacun jusqu'à son nombre
  fill: (uids) => ({ fresh: true, run: (w) => {
    const n = cloneW(w);
    let pool = shuffle(w.pool || []);
    const patch = {};
    const need = (u) => Math.max(0, targetOf(w, u) - itemsOf(n, u).length);
    let guard = 0;
    while (pool.length && uids.some((u) => need(u) > 0) && guard++ < 1000) {
      for (const u of uids.slice().sort((a, b) => need(b) - need(a))) {
        if (!pool.length || need(u) <= 0) continue;
        const mine = new Set(itemsOf(n, u).map((x) => x.t));
        let j = pool.findIndex((x) => !mine.has(x.t)); if (j < 0) j = 0;
        n.assign[u] = itemsOf(n, u).concat([pool.splice(j, 1)[0]]);
        patch['assign.' + u] = n.assign[u];
      }
    }
    // s'il reste des tâches (tout le monde a son compte), on les partage quand même équitablement
    while (pool.length && uids.length) {
      const u = uids.slice().sort((a, b) => itemsOf(n, a).length - itemsOf(n, b).length)[0];
      n.assign[u] = itemsOf(n, u).concat([pool.shift()]);
      patch['assign.' + u] = n.assign[u];
    }
    n.pool = pool; patch.pool = pool;
    return { next: n, patch };
  } }),
};
// Applique une opération dans la base (en relisant la semaine si besoin)
export async function applyOp(fid, wk, op, current) {
  const base = op.fresh ? (await getWeek(fid, wk)) : current;
  if (!base) throw new Error("Cette semaine n'existe pas.");
  const { next, patch } = op.run(base);
  if (Object.keys(patch).length) await updateWeek(fid, wk, patch);
  return next;
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

/* ---------- Semaines passées / historique ---------- */
export function weekIdOffset(n) { const d = mondayOf(); d.setDate(d.getDate() + 7 * n + 3); return weekId(d); }
export function weekLabel(n) {
  const d = mondayOf(); d.setDate(d.getDate() + 7 * n);
  const e = new Date(d); e.setDate(e.getDate() + 6);
  const f = (x) => `${x.getDate()}/${x.getMonth() + 1}`;
  return n === 0 ? `Cette semaine (${f(d)} → ${f(e)})` : n === -1 ? `Semaine dernière (${f(d)} → ${f(e)})` : `Du ${f(d)} au ${f(e)}`;
}
export const shortWeek = (n) => { const d = mondayOf(); d.setDate(d.getDate() + 7 * n); return `${d.getDate()}/${d.getMonth() + 1}`; };
// Les n dernières semaines (la plus ancienne d'abord)
export async function history(fid, n = 6) {
  const ids = []; for (let i = n - 1; i >= 0; i--) ids.push(-i);
  return Promise.all(ids.map(async (o) => ({ o, w: await getWeek(fid, weekIdOffset(o)).catch(() => null) })));
}

// Recalcule les tâches en plus de cette semaine d'après la semaine dernière (après avoir corrigé des cases)
export async function recomputeExtras(fam, tasks) {
  const wk = weekId();
  const cur = await getWeek(fam.id, wk);
  if (!cur || !cur.assign) return 0;
  const prev = await getWeek(fam.id, prevWeekId());
  const uids = Object.keys(cur.assign);
  const want = extrasFrom(prev, fam, uids);
  const patch = {};
  let changed = 0;
  uids.forEach((u) => {
    let list = itemsOf(cur, u).slice();
    const had = list.filter((x) => x.x).length, need = want[u] || 0;
    if (had === need) return;
    if (need < had) {
      // on retire d'abord les tâches en plus pas encore faites
      let cut = had - need;
      const order = list.map((x, i) => ({ x, i })).filter((o) => o.x.x).sort((a, b) => (cur.done[a.x.k] ? 1 : 0) - (cur.done[b.x.k] ? 1 : 0));
      const drop = new Set(order.slice(0, cut).map((o) => o.x.k));
      drop.forEach((k) => { patch['done.' + k] = undefined; patch['doing.' + k] = undefined; patch['notes.' + k] = undefined; });
      list = list.filter((x) => !drop.has(x.k));
    } else if (tasks.length) {
      const mine = new Set(list.map((x) => x.t));
      const pool = shuffle(tasks).sort((a, b) => (mine.has(a.id) ? 1 : 0) - (mine.has(b.id) ? 1 : 0));
      for (let j = 0; j < need - had; j++) list.push({ ...itemOf(pool[j % pool.length]), x: 1 });
    }
    patch['assign.' + u] = list;
    patch['extra.' + u] = need;
    changed++;
  });
  if (changed) await updateWeek(fam.id, wk, patch);
  return changed;
}

/* ---------- Annonce (« réunion d'urgence ») ---------- */
export const setAnnounce = (fid, a) => updateFamily(fid, { announce: a || null });

/* ---------- Fil d'activité ---------- */
export function activity(week, members, max = 25) {
  if (!week) return [];
  const who = (u) => members.find((m) => m.id === u) || { name: '?', avatar: '🙂' };
  const ev = [];
  Object.entries(week.assign || {}).forEach(([u, list]) => (list || []).forEach((it) => {
    const d = week.done[it.k];
    if (d) ev.push({ ts: d, m: who(u), txt: `a fait ${it.e} ${it.n}`, kind: 'done' });
    const g = week.doing[it.k];
    if (g && g.ts) ev.push({ ts: g.ts, m: who(u), txt: `a commencé ${it.e} ${it.n}`, kind: 'doing' });
    (week.notes[it.k] || []).forEach((n) => ev.push({ ts: n.ts, m: { name: n.n, avatar: n.a, color: (who(n.u) || {}).color }, txt: `💬 « ${n.t} » (${it.e} ${it.n})`, kind: 'note' }));
  }));
  return ev.sort((a, b) => b.ts - a.ts).slice(0, max);
}
export const ago = (ts) => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
