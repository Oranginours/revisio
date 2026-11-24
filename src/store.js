// Toutes les données de l'appli, enregistrées sur le téléphone (marche hors ligne).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_MODEL } from './ai';
import { isArchived } from './logic';

const KEY = 'revisions_v1';

export const S = {
  profil: { matieres: [], streak: 0, lastDay: '', hist: {}, links: {}, best: {} },
  chs: {},
  settings: { apiKey: '', model: DEFAULT_MODEL, notifOn: true, notifTime: '18:00' },
  pronote: null, // { refresh: {url, token, username, kind, navigatorIdentifier}, deviceUUID, name, className }
  cache: { edt: {}, grades: {}, gradesPeriods: [], gradesAt: '', dsSeen: {} },
  imported: {},
  devoirs: { manual: [], doneP: {} },
  jobs: [], // générations en arrière-plan (voir jobs.js)
  cls: { id: '', name: '', code: '', auto: true }, // ma classe (voir classe.js)
};

export async function load() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    Object.assign(S.profil, o.profil || {});
    S.chs = o.chs || {};
    Object.assign(S.settings, o.settings || {});
    S.pronote = o.pronote || null;
    Object.assign(S.cache, o.cache || {});
    S.imported = o.imported || {};
    if (o.devoirs) S.devoirs = o.devoirs;
    S.jobs = Array.isArray(o.jobs) ? o.jobs : [];
    if (o.cls) S.cls = o.cls;
    if (o.sko) S.sko = o.sko; // connexion à l'ENT Skolengo
  } catch (e) {}
}

let timer = null;
export function persistNow() { AsyncStorage.setItem(KEY, JSON.stringify(S)).catch(() => {}); }
export function persistSoon() { clearTimeout(timer); timer = setTimeout(persistNow, 300); }

let refresher = () => {};
export const setRefresher = (f) => { refresher = f; };
// À appeler après chaque modification : rafraîchit l'écran et sauvegarde.
let afterCommit = null;
export const setAfterCommit = (f) => { afterCommit = f; };
export function commit() { if (afterCommit) afterCommit(); refresher(); persistSoon(); }

export const matOf = (ch) => S.profil.matieres.find((m) => m.id === ch.matiereId) || { id: '', nom: '?', couleur: '#888' };
export const chaptersOf = (mid) => Object.values(S.chs).filter((c) => c.matiereId === mid);
// Chapitres non archivés : les seuls utilisés dans les sessions et les entraînements
export const activeChs = () => Object.values(S.chs).filter((c) => !isArchived(c));
