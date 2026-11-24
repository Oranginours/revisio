// Révisio ↔ Firebase (même projet que Corvéo) : un compte anonyme par téléphone + la base Firestore.
// Sert aux classes : cours partagés et petites notes entre élèves.
import AsyncStorage from '@react-native-async-storage/async-storage';
const FIREBASE = { apiKey: 'AIzaSyD8MQpHawxHnCMOSTIWZGiEFZmkSwpNbqU', projectId: 'corveo-b9a16' };

const KEY = 'revisio_cloud_auth_v1';
const EMAIL_DOMAIN = '@corveo-famille.app'; // le pseudo devient une adresse interne : personne n'a besoin d'email
let auth = null; // { idToken, refreshToken, uid, exp }

const docsUrl = () => `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents`;

/* ---------- Erreurs lisibles ---------- */
const MSG = {
  EMAIL_EXISTS: 'Ce pseudo est déjà pris.',
  EMAIL_NOT_FOUND: 'Pseudo ou mot de passe incorrect.',
  INVALID_PASSWORD: 'Pseudo ou mot de passe incorrect.',
  INVALID_LOGIN_CREDENTIALS: 'Pseudo ou mot de passe incorrect.',
  USER_DISABLED: 'Ce compte est désactivé.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Trop d’essais. Réessaie dans quelques minutes.',
  OPERATION_NOT_ALLOWED: 'Les comptes anonymes ne sont pas activés dans Firebase (Authentication → Anonyme).',
  ADMIN_ONLY_OPERATION: 'Les comptes anonymes ne sont pas activés dans Firebase (Authentication → Anonyme).',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Reconnecte-toi puis recommence.',
  CONFIGURATION_NOT_FOUND: 'Authentication n’est pas activé dans Firebase.',
  PERMISSION_DENIED: 'Accès refusé : les règles Firestore pour les classes ne sont pas encore collées.',
};
function niceError(code, fallback) {
  const c = String(code || '').split(' ')[0].split(':')[0];
  if (c.startsWith('WEAK_PASSWORD')) return 'Mot de passe trop court (6 caractères minimum).';
  return MSG[c] || fallback || code || 'Erreur inconnue';
}
async function call(url, opts) {
  let r;
  try { r = await fetch(url, opts); } catch (e) { throw new Error('Pas de connexion internet.'); }
  const txt = await r.text();
  let j = {};
  try { j = txt ? JSON.parse(txt) : {}; } catch (e) { /* réponse vide */ }
  if (!r.ok) {
    const err = j.error || {};
    const e = new Error(niceError(err.message || err.status, err.message || `Erreur ${r.status}`));
    e.status = r.status; e.code = err.status || err.message;
    throw e;
  }
  return j;
}

/* ---------- Comptes ---------- */
export const usernameOk = (u) => /^[a-z0-9_.-]{3,20}$/.test(u);
export const normUser = (u) => String(u || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');

async function saveAuth(a) { auth = a; await AsyncStorage.setItem(KEY, JSON.stringify(a)); }
export async function loadAuth() {
  try { const t = await AsyncStorage.getItem(KEY); auth = t ? JSON.parse(t) : null; } catch (e) { auth = null; }
  return auth;
}
export const currentUid = () => (auth ? auth.uid : null);
export const currentUser = () => (auth ? auth.user || '' : '');
export async function signOut() { auth = null; await AsyncStorage.removeItem(KEY); }

function fromSignIn(j) {
  return { idToken: j.idToken, refreshToken: j.refreshToken, uid: j.localId, exp: Date.now() + (Number(j.expiresIn || 3600) - 120) * 1000 };
}
// Compte anonyme (aucun pseudo ni mot de passe) : créé une seule fois par téléphone
export async function ensureAuth() {
  if (!auth) await loadAuth();
  if (auth) return auth.uid;
  const j = await call(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE.apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  });
  await saveAuth(fromSignIn(j));
  return auth.uid;
}
export async function signUp(username, password) {
  const j = await call(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE.apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: username + EMAIL_DOMAIN, password, returnSecureToken: true }),
  });
  await saveAuth({ ...fromSignIn(j), user: username });
  return auth.uid;
}
export async function signIn(username, password) {
  const j = await call(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE.apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: username + EMAIL_DOMAIN, password, returnSecureToken: true }),
  });
  await saveAuth({ ...fromSignIn(j), user: username });
  return auth.uid;
}
export async function deleteAccount() {
  const t = await token();
  await call(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FIREBASE.apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: t }),
  });
  await signOut();
}
let refreshing = null;
async function token() {
  if (!auth) throw new Error('Pas connecté');
  if (Date.now() < auth.exp) return auth.idToken;
  if (!refreshing) {
    refreshing = (async () => {
      const j = await call(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE.apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(auth.refreshToken)}`,
      });
      await saveAuth({ user: auth.user, idToken: j.id_token, refreshToken: j.refresh_token, uid: j.user_id, exp: Date.now() + (Number(j.expires_in || 3600) - 120) * 1000 });
    })().finally(() => { refreshing = null; });
  }
  await refreshing;
  return auth.idToken;
}

/* ---------- Conversion JS ⇄ Firestore ---------- */
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'object') return { mapValue: { fields: encFields(v) } };
  return { stringValue: String(v) };
}
const encFields = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, enc(v)]));
function dec(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  if ('mapValue' in v) return decFields(v.mapValue.fields || {});
  return null;
}
const decFields = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, dec(v)]));
const idOf = (name) => name.split('/').pop();
const fromDoc = (d) => ({ id: idOf(d.name), ...decFields(d.fields) });

async function headers() { return { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' }; }

/* ---------- Documents ---------- */
// Lire un document (null s'il n'existe pas)
export async function getDoc(path) {
  try { return fromDoc(await call(`${docsUrl()}/${path}`, { headers: await headers() })); } catch (e) { if (e.status === 404) return null; throw e; }
}
// Lister une collection
// fields : ne récupérer que ces champs (plus léger)
export async function listDocs(path, fields) {
  const out = []; let page = '';
  const mask = fields ? fields.map((f) => '&mask.fieldPaths=' + encodeURIComponent(f)).join('') : '';
  do {
    const j = await call(`${docsUrl()}/${path}?pageSize=300${mask}${page ? `&pageToken=${page}` : ''}`, { headers: await headers() });
    (j.documents || []).forEach((d) => out.push(fromDoc(d)));
    page = j.nextPageToken || '';
  } while (page);
  return out;
}
// Créer (échoue si le document existe déjà quand mustNotExist)
export async function setDoc(path, data, mustNotExist) {
  const q = mustNotExist ? '?currentDocument.exists=false' : '';
  return fromDoc(await call(`${docsUrl()}/${path}${q}`, { method: 'PATCH', headers: await headers(), body: JSON.stringify({ fields: encFields(data) }) }));
}
// Modifier seulement certains champs. Les chemins peuvent viser dans une table : "done.abc".
// Un chemin dont la valeur est undefined est effacé.
export async function updateDoc(path, patch) {
  const paths = Object.keys(patch);
  const fields = {};
  paths.forEach((p) => {
    const v = patch[p];
    if (v === undefined) return;
    const parts = p.split('.');
    let cur = fields;
    parts.forEach((k, i) => {
      if (i === parts.length - 1) cur[k] = enc(v);
      else { cur[k] = cur[k] || { mapValue: { fields: {} } }; cur = cur[k].mapValue.fields; }
    });
  });
  const q = paths.map((p) => 'updateMask.fieldPaths=' + encodeURIComponent(p.split('.').map((k) => (/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(k) ? k : '`' + k + '`')).join('.'))).join('&');
  return fromDoc(await call(`${docsUrl()}/${path}?${q}&currentDocument.exists=true`, { method: 'PATCH', headers: await headers(), body: JSON.stringify({ fields }) }));
}
export async function deleteDoc(path) {
  await call(`${docsUrl()}/${path}`, { method: 'DELETE', headers: await headers() });
}
// Requête simple : tous les documents d'une collection dont champ == valeur
export async function queryEq(collection, field, value) {
  const j = await call(`${docsUrl()}:runQuery`, {
    method: 'POST', headers: await headers(),
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: enc(value) } } } }),
  });
  return (j || []).filter((x) => x.document).map((x) => fromDoc(x.document));
}
// Identifiant aléatoire
export const newId = (n = 20) => { const a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let s = ''; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
