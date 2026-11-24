// 📚 ENT Skolengo (« Ma classe en Auvergne-Rhône-Alpes », Mon Bureau Numérique, …) : les devoirs du cahier de textes.
// Connexion comme l'appli officielle Skolengo : OpenID Connect + PKCE, la page de connexion de l'ENT
// (EduConnect…) s'ouvre dans l'appli, et on récupère le code au retour « skoapp-prod://sign-in-callback ».
// API non officielle : peut casser si Skolengo change quelque chose.
import { S, commit } from './store';

const API = 'https://api.skolengo.com/api/v1/bff-sko-app';
// Client public de l'appli mobile Skolengo (le même pour tout le monde, publié par les projets open source)
const CLIENT_ID = 'SkoApp.Prod.0d349217-9a4e-41ec-9af9-df9e69e09494';
const CLIENT_SECRET = '7cb4d9a8-2580-4041-9ae8-d5803869183f';
export const REDIRECT = 'skoapp-prod://sign-in-callback';

/* ---------- petits outils ---------- */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}
const utf8 = (s) => Array.from(unescape(encodeURIComponent(s))).map((c) => c.charCodeAt(0));
const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function b64decode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  let out = '';
  for (let i = 0; i < s.length; i += 4) {
    const n = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12) | ((B64.indexOf(s[i + 2]) & 63) << 6) | (B64.indexOf(s[i + 3]) & 63);
    out += String.fromCharCode((n >> 16) & 255);
    if (s[i + 2] !== '=') out += String.fromCharCode((n >> 8) & 255);
    if (s[i + 3] !== '=') out += String.fromCharCode(n & 255);
  }
  try { return decodeURIComponent(escape(out)); } catch (e) { return out; }
}
// SHA-256 (pour le PKCE)
function sha256(bytes) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const l = bytes.length * 8;
  const m = bytes.slice(); m.push(0x80);
  while (m.length % 64 !== 56) m.push(0);
  for (let i = 7; i >= 0; i--) m.push(i >= 4 ? 0 : (l >>> (i * 8)) & 255);
  const r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < m.length; o += 64) {
    const w = [];
    for (let i = 0; i < 16; i++) w[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H = H.map((x, i) => (x + [a, b, c, d, e, f, g, h][i]) | 0);
  }
  const out = [];
  H.forEach((x) => out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255));
  return out;
}
export const _sha256hex = (s) => sha256(utf8(s)).map((x) => x.toString(16).padStart(2, '0')).join('');
const rand = (n) => { const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const qs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

async function getJSON(url, opts = {}) {
  let r;
  try { r = await fetch(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers || {}) } }); }
  catch (e) { throw new Error('Pas de connexion internet.'); }
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* pas du JSON */ }
  if (!r.ok) { const e = new Error(entError(r.status, j)); e.status = r.status; throw e; }
  return j;
}
function entError(status, j) {
  const d = j && j.errors && j.errors[0];
  if (status === 401) return "L'ENT a refusé la connexion : reconnecte-toi (⚙️ → ENT).";
  if (status === 403) return "L'ENT ne donne pas accès aux devoirs pour ce compte.";
  return `Erreur de l'ENT (${status})${d && (d.title || d.detail) ? ' : ' + (d.title || d.detail) : ''}`;
}

/* ---------- JSON:API ---------- */
function deref(doc, rel) {
  if (!rel || !rel.data) return null;
  const ref = rel.data;
  return (doc.included || []).find((x) => x.type === ref.type && x.id === ref.id) || null;
}

/* ---------- Établissements ---------- */
export async function searchSchools(text) {
  const j = await getJSON(`${API}/schools?${qs({ 'filter[text]': text, 'page[limit]': 20 })}`);
  return (j && j.data ? j.data : []).map((x) => ({ id: x.id, ...(x.attributes || {}) })).filter((s) => s.emsCode && s.emsOIDCWellKnownUrl)
    .map((s) => ({ id: s.id, name: s.name || s.id, city: s.city || '', emsCode: s.emsCode, wellKnown: s.emsOIDCWellKnownUrl }));
}

/* ---------- Connexion ---------- */
let pending = null; // { verifier, state, school, oidc }
export async function startLogin(school) {
  const d = await getJSON(school.wellKnown);
  const oidc = { auth: d.authorization_endpoint, token: d.token_endpoint };
  const verifier = rand(64), state = rand(20);
  const challenge = b64url(sha256(utf8(verifier)));
  pending = { verifier, state, school, oidc };
  return `${oidc.auth}?${qs({ client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: 'code', scope: 'openid', state, code_challenge: challenge, code_challenge_method: 'S256' })}`;
}
async function tokenRequest(url, form) {
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + b64(utf8(`${CLIENT_ID}:${CLIENT_SECRET}`)) }, body: qs(form) });
  } catch (e) { throw new Error('Pas de connexion internet.'); }
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.access_token) { const e = new Error(r.status === 400 || r.status === 401 ? 'Connexion à l\'ENT expirée : reconnecte-toi (⚙️ → ENT).' : `Erreur de connexion à l'ENT (${r.status})`); e.auth = r.status === 400 || r.status === 401; throw e; }
  return j;
}
const subOf = (idToken) => { try { return JSON.parse(b64decode(idToken.split('.')[1])).sub; } catch (e) { return ''; } };
// Appelé avec l'adresse « skoapp-prod://sign-in-callback?code=… »
export async function finishLogin(url) {
  if (!pending) throw new Error('Connexion expirée, recommence.');
  const q = {};
  (url.split('?')[1] || '').split('&').forEach((p) => { const [k, v] = p.split('='); if (k) q[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' ')); });
  if (q.error) throw new Error("L'ENT a refusé la connexion (" + q.error + ').');
  if (!q.code) throw new Error("Pas de code de connexion reçu de l'ENT.");
  if (q.state && q.state !== pending.state) throw new Error('Connexion incohérente, recommence.');
  const t = await tokenRequest(pending.oidc.token, { grant_type: 'authorization_code', code: q.code, redirect_uri: REDIRECT, code_verifier: pending.verifier });
  const sko = {
    school: pending.school, tokenUrl: pending.oidc.token,
    access: t.access_token, refresh: t.refresh_token, idToken: t.id_token || '', sub: subOf(t.id_token || ''),
    exp: Date.now() + ((t.expires_in || 1800) - 120) * 1000,
  };
  pending = null;
  S.sko = sko;
  // qui suis-je ? (élève, établissement)
  const doc = await api(`/users-info/${sko.sub}`, { include: 'students,students.school,school,schools,prioritySchool' });
  const u = Array.isArray(doc.data) ? doc.data[0] : doc.data;
  const a = (u && u.attributes) || {};
  const studs = (u && u.relationships && u.relationships.students && u.relationships.students.data) || [];
  const stud = studs.length ? (doc.included || []).find((x) => x.type === studs[0].type && x.id === studs[0].id) : u;
  const sch = deref(doc, stud && stud.relationships && stud.relationships.school) || deref(doc, u && u.relationships && u.relationships.school);
  sko.studentId = stud ? stud.id : sko.sub;
  sko.schoolId = sch ? sch.id : sko.school.id;
  sko.name = `${a.firstName || ''} ${a.lastName || ''}`.trim();
  sko.className = (stud && stud.attributes && stud.attributes.className) || '';
  commit();
  return sko;
}
export function logoutEnt() { delete S.sko; S.cache.hwEnt = []; commit(); }

async function refreshTokens() {
  const s = S.sko;
  const t = await tokenRequest(s.tokenUrl, { grant_type: 'refresh_token', refresh_token: s.refresh });
  s.access = t.access_token; if (t.refresh_token) s.refresh = t.refresh_token; // il change à chaque fois : on le garde !
  s.exp = Date.now() + ((t.expires_in || 1800) - 120) * 1000;
  commit();
}
async function api(path, params, method = 'GET', body) {
  if (!S.sko) throw new Error("Pas connecté à l'ENT.");
  if (Date.now() > S.sko.exp) await refreshTokens();
  for (let k = 0; k < 2; k++) {
    const s = S.sko;
    const headers = { Authorization: `Bearer ${s.access}`, Accept: 'application/json', 'X-Skolengo-Date-Format': 'utc', 'X-Skolengo-Ems-Code': s.school.emsCode };
    if (s.schoolId) headers['X-Skolengo-School-Id'] = s.schoolId;
    if (body) headers['Content-Type'] = 'application/vnd.api+json';
    try { return await getJSON(`${API}${path}${params ? '?' + qs(params) : ''}`, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
    catch (e) { if (e.status === 401 && k === 0) { await refreshTokens(); continue; } throw e; }
  }
  return null;
}

/* ---------- Devoirs ---------- */
const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const text = (html) => String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<li>/gi, '• ').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();
export async function fetchEntHomework() {
  if (!S.sko) return;
  const from = new Date(); from.setDate(from.getDate() - 3);
  const to = new Date(); to.setDate(to.getDate() + 30);
  const doc = await api('/homework-assignments', {
    'filter[student.id]': S.sko.studentId || S.sko.sub,
    'filter[dueDate][GE]': day(from), 'filter[dueDate][LE]': day(to),
    include: 'subject,teacher,teacher.person', 'fields[homework]': 'title,done,dueDateTime,html', 'fields[subject]': 'label,color', 'page[limit]': 100,
  });
  S.cache.hwEnt = ((doc && doc.data) || []).map((x) => {
    const a = x.attributes || {};
    const sub = deref(doc, x.relationships && x.relationships.subject);
    const title = (a.title || '').trim(), body = text(a.html);
    const due = a.dueDateTime ? day(new Date(a.dueDateTime)) : '';
    return { id: x.id, subject: (sub && sub.attributes && sub.attributes.label) || 'Devoir', color: (sub && sub.attributes && sub.attributes.color) || '', text: body && body !== title ? (title ? `${title}\n${body}` : body) : title, due, done: !!a.done };
  }).filter((h) => h.due);
  S.cache.hwEntAt = new Date().toISOString();
  commit();
}
export async function setEntDone(id, done) {
  await api(`/homework-assignments/${id}`, { 'filter[student.id]': S.sko.studentId || S.sko.sub }, 'PATCH', { data: { type: 'homework', id, attributes: { done } } });
}
