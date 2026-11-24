// ⏳ Générations en arrière-plan : création de chapitre, ajout de notes, nouvelles questions, reformulations.
// - Le travail est découpé en morceaux (2 photos à la fois) et chaque morceau terminé est enregistré :
//   si la connexion coupe ou si l'appli se ferme, on reprend là où on s'était arrêté.
// - On peut faire autre chose pendant ce temps ; une notification prévient quand c'est prêt.
import { Platform, AppState } from 'react-native';
import { S, commit } from './store';
import { gemini, prepareImage } from './ai';
import { normPack, mergePack, promptNotes, promptMore, promptVariants, applyVariants, items, uid } from './logic';
import { toast } from './ui';
import { scheduleTimer } from './notifs';
import { syncClass } from './classe';

const isWeb = Platform.OS === 'web';
const PER_CALL = 2; // photos par appel à l'IA
const mem = {}; // version web : photos gardées en mémoire

export const jobs = () => (S.jobs = S.jobs || []);
export const activeJobs = () => jobs().filter((j) => j.status !== 'done');
export const jobFor = (chId) => activeJobs().find((j) => j.chId === chId);

/* ---------- Photos mises de côté (pour pouvoir reprendre) ---------- */
function dir() {
  const { Directory, Paths } = require('expo-file-system');
  const d = new Directory(Paths.document, 'jobs');
  if (!d.exists) d.create();
  return d;
}
function saveImg(jobId, i, b64) {
  const key = `${jobId}_${i}`;
  if (isWeb) { mem[key] = b64; return 'mem:' + key; }
  try {
    const { File } = require('expo-file-system');
    const f = new File(dir(), key + '.b64');
    if (f.exists) f.delete();
    f.create(); f.write(b64);
    return f.uri;
  } catch (e) { mem[key] = b64; return 'mem:' + key; }
}
async function loadImg(ref) {
  if (ref.startsWith('mem:')) {
    const v = mem[ref.slice(4)];
    if (!v) { const e = new Error('Les photos ont été perdues (appli fermée pendant la préparation). Recommence avec tes photos.'); e.fatal = true; throw e; }
    return v;
  }
  const { File } = require('expo-file-system');
  return await new File(ref).text();
}
function dropImgs(job) {
  (job.imgs || []).forEach((ref) => {
    if (ref.startsWith('mem:')) { delete mem[ref.slice(4)]; return; }
    try { const { File } = require('expo-file-system'); const f = new File(ref); if (f.exists) f.delete(); } catch (e) { /* déjà parti */ }
  });
  job.imgs = [];
}

/* ---------- Ajouter un travail ---------- */
// kind : 'chapter' (nouveau chapitre) | 'notes' (ajout de notes) | 'more' (nouvelles questions) | 'vary' (reformulations)
export async function addJob({ kind, chId, uris = [], text = '', moreKind, label }) {
  const id = 'j' + uid();
  const job = { id, kind, chId, text, moreKind, label, imgs: [], chunks: [], done: 0, status: 'prep', tries: 0, created: Date.now(), added: 0 };
  jobs().push(job);
  commit();
  try {
    // 1) on prépare les photos tout de suite (sur le téléphone, sans internet) et on les met de côté
    for (let i = 0; i < uris.length; i++) { job.stage = `Préparation des photos (${i + 1}/${uris.length})…`; commit(); job.imgs.push(saveImg(id, i, await prepareImage(uris[i]))); }
    job.stage = '';
    // 2) on découpe en morceaux
    if (kind === 'chapter' || kind === 'notes') {
      for (let i = 0; i < Math.max(1, job.imgs.length); i += PER_CALL) job.chunks.push(job.imgs.length ? [i, Math.min(job.imgs.length, i + PER_CALL)] : [0, 0]);
    } else if (kind === 'vary') {
      const ch = S.chs[chId];
      const n = Math.max(ch.pack.qcm.length, ch.pack.vf.length);
      for (let k = 0; k < n; k += 20) job.chunks.push([k, k + 20]);
    } else job.chunks.push([0, 0]);
    job.status = 'queued';
  } catch (e) { job.status = 'error'; job.err = 'Impossible de lire les photos : ' + e.message; }
  commit();
  kick();
  return job;
}

/* ---------- Faire un morceau ---------- */
async function runChunk(job, k) {
  const ch = S.chs[job.chId];
  if (!ch) { const e = new Error('Le chapitre a été supprimé.'); e.fatal = true; throw e; }
  const m = (S.profil.matieres.find((x) => x.id === ch.matiereId) || {}).nom || '';
  const key = S.settings.apiKey, model = S.settings.model;
  if (job.kind === 'chapter' || job.kind === 'notes') {
    const [a, b] = job.chunks[k];
    const images = [];
    for (let i = a; i < b; i++) images.push(await loadImg(job.imgs[i]));
    const first = job.kind === 'chapter' && k === 0;
    const hasContent = ch.pack && (items({ pack: ch.pack }).length || ch.pack.resume.length);
    const prompt = promptNotes({ matiere: m, titre: ch.titre, text: k === 0 ? job.text : '', nImages: images.length, existing: first || !hasContent ? undefined : ch.pack, consigne: ch.consigne });
    const pack = normPack(await gemini({ apiKey: key, model, prompt, images }));
    job.added += pack.vocab.length + pack.qcm.length + pack.vf.length + pack.exercices.length;
    ch.pack = first || !hasContent ? pack : mergePack(ch.pack, pack);
  } else if (job.kind === 'more') {
    const add = normPack(await gemini({ apiKey: key, model, prompt: promptMore(ch, m, job.moreKind) }));
    const n = add.qcm.length + add.vf.length + add.exercices.length;
    if (!n) { const e = new Error("L'IA n'a pas renvoyé de questions."); e.retry = true; throw e; }
    ch.pack = mergePack(ch.pack, { qcm: add.qcm, vf: add.vf, exercices: add.exercices });
    job.added += n;
  } else if (job.kind === 'vary') {
    const [a, b] = job.chunks[k];
    const qIdx = ch.pack.qcm.map((_, i) => i).slice(a, b), fIdx = ch.pack.vf.map((_, i) => i).slice(a, b);
    const r = await gemini({ apiKey: key, model, prompt: promptVariants(ch, qIdx, fIdx) });
    job.added += applyVariants(ch, r);
  }
}

function notify(title, body) {
  if (isWeb || AppState.currentState === 'active') toast(title + (body ? ' · ' + body : ''));
  if (!isWeb) scheduleTimer(1, title, body).catch(() => {});
}

async function runJob(job) {
  job.status = 'running'; job.err = ''; commit();
  for (let k = job.done; k < job.chunks.length; k++) {
    try {
      job.since = Date.now(); job.err = ''; commit();
      await runChunk(job, k);
      job.done = k + 1; job.tries = 0;
      commit(); // ✅ ce morceau est sauvegardé
    } catch (e) {
      const retry = !e.fatal && (e.retry || !e.status);
      job.tries = (job.tries || 0) + 1;
      job.err = e.message;
      if (retry && job.tries < 30) {
        job.status = 'wait';
        job.next = Date.now() + Math.min(5 * 60000, 10000 * 2 ** Math.min(job.tries - 1, 5));
      } else job.status = 'error';
      commit();
      return;
    }
  }
  // terminé !
  job.status = 'done'; job.end = Date.now();
  dropImgs(job);
  const ch = S.chs[job.chId];
  const what = job.kind === 'chapter' ? `Ton chapitre « ${ch ? ch.titre : ''} » est prêt`
    : job.kind === 'notes' ? `Tes notes sont ajoutées à « ${ch ? ch.titre : ''} »`
    : job.kind === 'vary' ? `${job.added} questions reformulées` : `${job.added} nouvelles questions dans « ${ch ? ch.titre : ''} »`;
  notify('✅ ' + what, job.kind === 'chapter' ? `${job.added} fiches et questions créées. Bonne révision !` : '');
  // on ne garde pas les travaux finis
  S.jobs = jobs().filter((j) => j.status !== 'done' || Date.now() - j.end < 1000);
  commit();
  syncClass({ quiet: true }); // le nouveau cours part tout de suite à la classe
}

/* ---------- La file d'attente ---------- */
let running = false;
let timer = null;
export async function kick() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const now = Date.now();
      const job = jobs().find((j) => j.status === 'queued' || j.status === 'running' || (j.status === 'wait' && now >= (j.next || 0)));
      if (!job) break;
      await runJob(job);
    }
  } finally {
    running = false;
    clearTimeout(timer);
    const waiting = jobs().filter((j) => j.status === 'wait');
    if (waiting.length) {
      const next = Math.min(...waiting.map((j) => j.next || 0));
      timer = setTimeout(kick, Math.max(3000, next - Date.now()));
    }
  }
}
// Réessayer tout de suite (bouton, retour de l'appli au premier plan)
export function retryAll() {
  jobs().forEach((j) => { if (j.status === 'wait' || j.status === 'error') { j.status = 'queued'; j.next = 0; } });
  commit(); kick();
}
// L'appli revient au premier plan : on retente ce qui attendait la connexion
export function retryWaiting() { let n = 0; jobs().forEach((j) => { if (j.status === 'wait') { j.next = 0; n++; } }); if (n) kick(); }
export function retryJob(id) { const j = jobs().find((x) => x.id === id); if (j) { j.status = 'queued'; j.next = 0; j.tries = 0; commit(); kick(); } }
export function cancelJob(id) {
  const j = jobs().find((x) => x.id === id);
  if (!j) return;
  dropImgs(j);
  S.jobs = jobs().filter((x) => x.id !== id);
  const ch = S.chs[j.chId];
  // un chapitre en création encore vide est supprimé
  if (j.kind === 'chapter' && ch && !items({ pack: ch.pack }).length && !ch.pack.resume.length) delete S.chs[j.chId];
  commit();
}
// Au démarrage : un travail resté « en cours » (appli fermée) reprend
export function resumeJobs() {
  jobs().forEach((j) => { if (j.status === 'running') j.status = 'queued'; if (j.status === 'prep') { j.status = 'error'; j.err = "L'appli a été fermée pendant la préparation des photos. Recommence."; } });
  commit(); kick();
}
export const KIND_LABEL = { chapter: 'Création du chapitre', notes: 'Ajout de notes', more: 'Nouvelles questions', vary: 'Reformulation' };
