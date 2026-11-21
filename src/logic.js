// Logique partagée : dates, révision espacée, format des chapitres, prompts pour l'IA.

export const uid = () => Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, '0');
export const dstr = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const today = () => dstr(new Date());
export const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return dstr(d); };
export const diffDays = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const fmtDate = (s) => { const d = new Date(s + 'T12:00:00'); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; };
const JOURS_L = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS_L = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const longDate = (d = new Date()) => { const x = new Date(d); return `${JOURS_L[x.getDay()]} ${x.getDate()} ${MOIS_L[x.getMonth()]}`; };
export const dayLetter = (s) => 'DLMMJVS'[new Date(s + 'T12:00:00').getDay()];
// "12/12/2026", "12/12" ou "12-12-26" -> "2026-12-12" (null si invalide)
export const parseFr = (s) => {
  const m = String(s || '').trim().match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/);
  if (!m) return null;
  let y = m[3] ? +m[3] : new Date().getFullYear();
  if (y < 100) y += 2000;
  const d = new Date(y, +m[2] - 1, +m[1], 12);
  if (d.getMonth() !== +m[2] - 1) return null;
  if (!m[3] && dstr(d) < today()) d.setFullYear(y + 1);
  return dstr(d);
};
export const toFr = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '');
export const num = (s) => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
export const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const COLORS = ['#2563eb', '#c2410c', '#15803d', '#7c3aed', '#be185d', '#0e7490', '#a16207', '#4d7c0f'];

/* ---------- format d'un chapitre ---------- */
export const SCHEMA = `{
 "titre": "titre court du chapitre",
 "alertes": ["point des notes qui semble faux, incomplet ou douteux, à vérifier avec le prof"],
 "resume": [{"titre":"partie du cours","texte":"résumé clair, phrases courtes, retours à la ligne avec \\n"}],
 "formules": [{"nom":"...","formule":"...","note":"unités, conditions"}],
 "vocab": [{"terme":"...","def":"définition"}],
 "qcm": [{"q":"question","variantes":["la même question posée autrement","..."],"choix":["...","...","...","..."],"bonne":0,"expl":"explication courte"}],
 "vf": [{"a":"affirmation","variantes":["la même affirmation dite autrement (même valeur vrai/faux)","..."],"vrai":true,"expl":"explication courte"}],
 "ordres": [{"titre":"Remets dans l'ordre : ...","etapes":[{"t":"étape ou événement SANS sa date","d":"date ou précision montrée après correction (peut être vide)"}]}],
 "exercices": [{"enonce":"...","reponse":"20","unite":"g/L","numerique":true,"correction":"correction détaillée"}],
 "ouvertes": [{"q":"question de rédaction type contrôle","attendus":"éléments attendus dans une bonne réponse"}],
 "competences": ["Je sais ..."]
}`;
export const RULES = `Règles :
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format ci-dessous.
- Tout en français, au niveau de l'élève (collège ou lycée en France, déduis-le des notes).
- Reste fidèle au cours. Tu peux compléter un peu une notion évidente, sans inventer de contenu hors programme.
- Ignore le texte barré et tout ce qui n'appartient pas à ce chapitre. Les photos peuvent être tournées : lis-les quand même.
- Si une info des notes te semble fausse, garde la version des notes dans les questions et signale-la dans "alertes".
- Seules balises permises dans les textes : <sub>, <sup>, <b>.
- "bonne" est l'index (à partir de 0) de la bonne réponse dans "choix". Varie sa position.
- QCM : les 4 choix doivent avoir à peu près la MÊME LONGUEUR et le même style. La bonne réponse ne doit PAS être la plus longue, la plus précise ou la plus nuancée : un élève ne doit pas pouvoir la deviner à sa forme. Les mauvaises réponses sont plausibles (vraies notions du chapitre, mais pas la bonne ici).
- "variantes" : pour chaque QCM et chaque vrai/faux, donne 2 ou 3 autres façons de poser la même question (autres mots, autre angle, question inversée…), qui ont exactement la même bonne réponse.
- Dans "ordres", donne les étapes dans le BON ordre (l'appli les mélange). Utilise "ordres" pour les frises chronologiques et les protocoles ; [] s'il n'y en a pas.
- "exercices" : seulement si la matière comporte des calculs ou des exercices à réponse précise ; sinon []. "reponse" est une chaîne ; "numerique" vaut true si la réponse est un nombre (mets le nombre seul dans "reponse").`;

export function normPack(p) {
  p = p && typeof p === 'object' ? p : {};
  const A = (k) => (Array.isArray(p[k]) ? p[k] : []);
  const s = (v) => (typeof v === 'string' ? v : String(v ?? ''));
  return {
    titre: s(p.titre),
    alertes: A('alertes').map(s).filter(Boolean),
    resume: A('resume').filter((x) => x && x.texte).map((x) => ({ titre: s(x.titre), texte: s(x.texte) })),
    formules: A('formules').filter((x) => x && x.formule).map((x) => ({ nom: s(x.nom), formule: s(x.formule), note: s(x.note) })),
    vocab: A('vocab').filter((x) => x && x.terme && x.def).map((x) => ({ terme: s(x.terme), def: s(x.def) })),
    qcm: A('qcm').filter((x) => x && x.q && Array.isArray(x.choix) && x.choix.length >= 2).map((x) => {
      const b = Number.isInteger(+x.bonne) && +x.bonne >= 0 && +x.bonne < x.choix.length ? +x.bonne : 0;
      return { q: s(x.q), variantes: (Array.isArray(x.variantes) ? x.variantes : []).map(s).filter(Boolean).slice(0, 4), choix: x.choix.map(s), bonne: b, expl: s(x.expl) };
    }),
    vf: A('vf').filter((x) => x && x.a).map((x) => ({ a: s(x.a), variantes: (Array.isArray(x.variantes) ? x.variantes : []).map(s).filter(Boolean).slice(0, 4), vrai: x.vrai === true || x.vrai === 'true', expl: s(x.expl) })),
    ordres: A('ordres').filter((x) => x && Array.isArray(x.etapes) && x.etapes.length >= 3).map((x) => ({
      titre: s(x.titre),
      etapes: x.etapes.map((e) => (typeof e === 'string' ? { t: e, d: '' } : { t: s(e.t), d: s(e.d) })),
    })),
    exercices: A('exercices').filter((x) => x && x.enonce).map((x) => ({
      enonce: s(x.enonce), reponse: s(x.reponse), unite: s(x.unite),
      numerique: x.numerique === true && !isNaN(num(x.reponse)), correction: s(x.correction),
    })),
    ouvertes: A('ouvertes').filter((x) => x && x.q).map((x) => ({ q: s(x.q), attendus: s(x.attendus) })),
    competences: A('competences').map(s).filter(Boolean),
  };
}
const KEYS = ['alertes', 'resume', 'formules', 'vocab', 'qcm', 'vf', 'ordres', 'exercices', 'ouvertes', 'competences'];
export function mergePack(a, b) { const o = clone(a); KEYS.forEach((k) => { o[k] = (o[k] || []).concat(b[k] || []); }); return o; }
function packSummary(p) {
  return JSON.stringify({
    resume: p.resume.map((r) => r.titre), vocab: p.vocab.map((v) => v.terme), qcm: p.qcm.map((q) => q.q),
    vf: p.vf.map((v) => v.a), exercices: p.exercices.map((e) => e.enonce.slice(0, 80)), ouvertes: p.ouvertes.map((o) => o.q),
  });
}

/* ---------- prompts ---------- */
export function promptNotes({ matiere, titre, text, nImages, existing, consigne }) {
  const intro = existing
    ? `Un élève ajoute de nouvelles notes à son chapitre « ${titre} » (${matiere}). Voici ce que son pack contient déjà : ${packSummary(existing)}
Génère UNIQUEMENT de NOUVEAUX éléments tirés des nouvelles notes, sans doublons avec l'existant.`
    : `Un élève m'envoie ses notes de cours pour le chapitre « ${titre} » en ${matiere}. Crée son pack de révision complet.
Quantités visées (selon la richesse des notes) : resume 3-8 parties, vocab 8-25, qcm 15-30, vf 10-20, ordres 0-4, exercices 0-12, ouvertes 2-5, competences 3-8.`;
  return `${intro}
${consigne ? 'IMPORTANT : le prof a dit de NE PAS apprendre ceci, ne crée AUCUN contenu dessus : ' + consigne + '\n' : ''}${text ? 'Notes tapées par l\'élève :\n"""' + text.slice(0, 20000) + '"""\n' : ''}${nImages ? nImages + ' photo(s) de ses notes sont jointes.\n' : ''}
${RULES}
Format :
${SCHEMA}`;
}
export function promptMore(ch, matiere, kind) {
  const p = ch.pack;
  const want = kind === 'ex'
    ? '8 nouveaux "exercices" variés (autres valeurs, autres situations), et des tableaux vides pour le reste'
    : kind === 'daily'
    ? '6 nouveaux "qcm" et 4 nouveaux "vf" sur des points du cours encore peu ou pas interrogés (angles différents, pièges classiques, applications), et des tableaux vides pour le reste'
    : `12 nouveaux "qcm", 8 nouveaux "vf"${p.exercices.length ? ', 6 nouveaux "exercices"' : ''}, et des tableaux vides pour le reste`;
  return `Tu aides un élève français à réviser le chapitre « ${ch.titre} » (${matiere}).
Cours de l'élève : ${JSON.stringify({ resume: p.resume, formules: p.formules, vocab: p.vocab }).slice(0, 24000)}
Questions qu'il a déjà (ne les répète pas, ne les reformule pas) : ${JSON.stringify({ qcm: p.qcm.map((q) => q.q), vf: p.vf.map((v) => v.a), exercices: p.exercices.map((e) => e.enonce.slice(0, 80)) }).slice(0, 12000)}
Crée ${want}. Reste strictement dans ce cours.${ch.consigne ? '\nIMPORTANT : le prof a dit de NE PAS apprendre ceci, ne crée AUCUNE question dessus : ' + ch.consigne : ''}
${RULES}
Format :
${SCHEMA}`;
}
export function promptCorrect(matiere, titre, x, answer) {
  return `Tu es un professeur bienveillant qui corrige un élève français. Matière : ${matiere}. Chapitre : ${titre}.
Question : ${x.q}
Éléments attendus : ${x.attendus}
Réponse de l'élève : """${answer.slice(0, 6000)}"""
Corrige en français, en tutoyant l'élève, en texte simple sans markdown (pas d'astérisques ni de #), 120 mots maximum, avec exactement ces lignes :
Note : x/10
Ce qui est bien : ...
Ce qui manque : ...
Conseil : ...`;
}

/* ---------- révision espacée ---------- */
const IV = [0, 1, 2, 4, 8, 16];
export function items(ch, all) {
  const p = ch.pack || {}, a = [], skip = ch.skip || {};
  (p.vocab || []).forEach((x, i) => a.push({ id: 'v' + i, t: 'v', x }));
  (p.qcm || []).forEach((x, i) => a.push({ id: 'q' + i, t: 'q', x }));
  (p.vf || []).forEach((x, i) => a.push({ id: 'f' + i, t: 'f', x }));
  return all ? a : a.filter((i) => !skip[i.id]);
}
export function mastery(ch) {
  const it = items(ch); if (!it.length) return 0; const s = ch.srs || {};
  return Math.round((it.filter((i) => ((s[i.id] && s[i.id].b) || 0) >= 3).length / it.length) * 100);
}
// Met à jour la boîte (1 à 5) et la prochaine date de révision d'une question. Toujours avant le DS.
export function grade(ch, id, ok) {
  ch.srs = ch.srs || {};
  const s = ch.srs[id] || { b: 0 };
  const b = ok ? Math.min((s.b || 0) + 1, 5) : 1;
  let due = addDays(today(), ok ? IV[b] : 1);
  if (ch.ds) { const dd = diffDays(today(), ch.ds); if (dd > 1 && diffDays(due, ch.ds) < 1) due = addDays(ch.ds, -1); }
  ch.srs[id] = { b, due, m: (s.m || 0) + (ok ? 0 : 1), l: ok ? 1 : 0 };
  if (hooks.onGrade) hooks.onGrade(ok, ch);
}
// Branché par progress.js : XP et statistiques à chaque réponse
export const hooks = { onGrade: null };
export function weight(ch) {
  if (!ch.ds) return 1; const d = diffDays(today(), ch.ds);
  if (d < 0) return 0.3; if (d <= 1) return 6; if (d <= 3) return 4; if (d <= 7) return 2.5; if (d <= 14) return 1.5; return 1;
}
export const urgent = (chs) => chs.some((c) => c.ds && diffDays(today(), c.ds) >= 0 && diffDays(today(), c.ds) <= 3);
export function buildSession(chs, goal = 15) {
  const N = urgent(chs) ? goal + 5 : goal, t = today();
  const cand = chs.map((c) => {
    const s = c.srs || {}; const d = c.ds ? diffDays(t, c.ds) : 99;
    const its = items(c).map((i) => {
      const st = s[i.id]; let pr;
      if (!st && i.x && i.x.nv === t) pr = 7 + Math.random(); // question du jour : toujours dans la session
      else if (!st) pr = 2 + Math.random();
      else if (st.due <= t) pr = 3 + (5 - st.b) + Math.random();
      else if (d >= 0 && d <= 3 && st.b < 4) pr = 1 + (5 - st.b) * 0.3 + Math.random();
      else pr = -1;
      return { ...i, ch: c, pr };
    }).filter((i) => i.pr > 0).sort((a, b) => b.pr - a.pr);
    return { c, w: weight(c), its };
  }).filter((x) => x.its.length);
  if (!cand.length) return [];
  const W = cand.reduce((a, x) => a + x.w, 0); const out = [];
  cand.sort((a, b) => b.w - a.w).forEach((x) => { const q = Math.max(1, Math.round((N * x.w) / W)); out.push(...x.its.splice(0, q)); });
  const rest = cand.flatMap((x) => x.its).sort((a, b) => b.pr * weight(b.ch) - a.pr * weight(a.ch));
  while (out.length < N && rest.length) out.push(rest.shift());
  return shuffle(out.slice(0, N));
}
// Étiquette "DS J-3" et niveau d'urgence
export function dsInfo(ds) {
  if (!ds) return null; const d = diffDays(today(), ds);
  if (d < 0) return { label: 'DS passé', lvl: 'past' };
  return { label: d === 0 ? "DS aujourd'hui" : d === 1 ? 'DS demain' : 'DS J-' + d, lvl: d <= 3 ? 'hot' : d <= 7 ? 'warm' : 'ok' };
}

/* ---------- modes d'entraînement ---------- */
// Questions au hasard (mode rapide, défi éclair)
export function randomItems(chs, n, types = ['v', 'q', 'f']) {
  return shuffle(chs.flatMap((c) => items(c).filter((i) => types.includes(i.t)).map((i) => ({ ...i, ch: c })))).slice(0, n);
}
// Questions ratées récemment ou plusieurs fois
export function errorItems(chs) {
  return chs.flatMap((c) => {
    const s = c.srs || {};
    return items(c).filter((i) => s[i.id] && (s[i.id].l === 0 || (s[i.id].m || 0) >= 2)).map((i) => ({ ...i, ch: c, m: s[i.id].m || 0 }));
  }).sort((a, b) => b.m - a.m);
}
export const stripTags = (t) => String(t || '').replace(/<[^>]+>/g, '');
export const norm = (t) => stripTags(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Texte à trous : cache les mots de vocabulaire et les dates d'un texte
export function buildCloze(text, terms, max = 8) {
  const clean = stripTags(text);
  const words = terms.map(stripTags).filter((t) => t.length > 3).sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp('(' + [...words, '\\b\\d{3,4}\\b'].join('|') + ')', 'gi');
  const parts = clean.split(re);
  const out = []; let gaps = 0;
  parts.forEach((p, i) => {
    if (!p) return;
    if (i % 2 === 1 && gaps < max) { out.push({ gap: true, ans: p, id: gaps }); gaps++; } else out.push({ gap: false, t: p });
  });
  return { tokens: out, gaps };
}

export const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

export function promptSkip(ch) {
  const p = ch.pack;
  const list = [
    ...p.resume.map((r, i) => ({ id: 'r' + i, texte: r.titre + ' : ' + r.texte.slice(0, 300) })),
    ...items(ch, true).map((it) => ({ id: it.id, texte: it.t === 'v' ? it.x.terme + ' : ' + it.x.def : it.t === 'q' ? it.x.q : it.x.a })),
  ];
  return `Un prof a dit à ses élèves ce qu'il ne faut PAS apprendre pour le chapitre « ${ch.titre} » : « ${ch.consigne} ».
Voici les éléments de révision de l'élève (id + texte) : ${JSON.stringify(list).slice(0, 30000)}
Donne la liste des id des éléments qui portent sur ce qu'il ne faut pas apprendre. Sois prudent : en cas de doute, ne les mets pas.
Réponds UNIQUEMENT en JSON : {"ids": ["q3", "v1", "r2"]}`;
}
export function promptExplain(it, matiere, titre) {
  const x = it.x;
  const q = it.t === 'q' ? `Question : ${x.q}\nBonne réponse : ${x.choix[x.bonne]}` : it.t === 'f' ? `Affirmation : ${x.a}\nElle est ${x.vrai ? 'VRAIE' : 'FAUSSE'}` : `Notion : ${x.terme} = ${x.def}`;
  return `Un élève français s'est trompé en révisant (${matiere}, chapitre « ${titre} »).
${q}
Explication déjà donnée : ${x.expl || '—'}
Explique-lui AUTREMENT, en tutoyant, en 80 mots maximum, très simplement, avec un exemple concret ou une astuce pour retenir (moyen mnémotechnique). Texte simple, sans markdown.`;
}

/* ---------- archivage après le DS ---------- */
// "8h", "8:30", "08h30" -> "08:30" (null si invalide)
export const parseTime = (s) => {
  const m = String(s || '').trim().match(/^(\d{1,2})(?:[:hH](\d{2})?)?$/);
  if (!m || +m[1] > 23 || +(m[2] || 0) > 59) return null;
  return pad(+m[1]) + ':' + (m[2] || '00');
};
// Le DS est-il passé ? (à l'heure indiquée, sinon à la fin de la journée)
export function dsPassed(ch, now = new Date()) {
  if (!ch.ds) return false;
  const [h, mi] = (ch.dsTime || '23:59').split(':').map(Number);
  const d = new Date(ch.ds + 'T00:00:00'); d.setHours(h, mi, 0, 0);
  return now >= d;
}
// Archivé à la main, ou automatiquement quand le DS est passé (sauf si on l'a désarchivé)
export function isArchived(ch) {
  if (ch.archived === true) return true;
  if (ch.archived === false) return false;
  return dsPassed(ch);
}

/* ---------- variantes des questions ---------- */
// Choisit au hasard une des formulations d'une question
export const pickPhrase = (main, variantes) => { const all = [main, ...(variantes || [])].filter(Boolean); return all[Math.floor(Math.random() * all.length)] || main; };

// Demande à l'IA des formulations différentes + des choix de même longueur, pour un lot de questions
export function promptVariants(ch, qIdx, fIdx) {
  const p = ch.pack;
  const qcm = qIdx.map((i) => ({ i, q: stripTags(p.qcm[i].q), choix: p.qcm[i].choix.map(stripTags), bonne: p.qcm[i].bonne }));
  const vf = fIdx.map((i) => ({ i, a: stripTags(p.vf[i].a), vrai: p.vf[i].vrai }));
  return `Tu aides un élève français à réviser le chapitre « ${ch.titre} ». Voici ses questions :
QCM : ${JSON.stringify(qcm)}
Vrai/faux : ${JSON.stringify(vf)}
Pour chaque QCM :
- "variantes" : 3 autres façons de poser la même question (autres mots, autre angle, question inversée…), qui ont EXACTEMENT la même bonne réponse.
- "choix" : réécris les 4 choix pour qu'ils aient à peu près la MÊME LONGUEUR et le même style. La bonne réponse (même sens qu'avant) ne doit PAS être la plus longue ni la plus précise. Mélange l'ordre, et donne "bonne", l'index (à partir de 0) de la bonne réponse dans tes nouveaux choix.
Pour chaque vrai/faux : "variantes" : 3 autres formulations de l'affirmation, avec la MÊME valeur vrai/faux.
Tout en français, au niveau de l'élève. Seules balises permises : <sub>, <sup>.
Réponds UNIQUEMENT en JSON : {"qcm":[{"i":0,"variantes":["..."],"choix":["...","...","...","..."],"bonne":2}],"vf":[{"i":0,"variantes":["..."]}]}`;
}
export function applyVariants(ch, r) {
  const p = ch.pack; let n = 0;
  const str = (a) => (Array.isArray(a) ? a.map((v) => String(v || '')).filter(Boolean).slice(0, 4) : []);
  ((r && r.qcm) || []).forEach((o) => {
    const q = p.qcm[o && o.i]; if (!q) return;
    const v = str(o.variantes); if (v.length) { q.variantes = v; n++; }
    if (Array.isArray(o.choix) && o.choix.length === q.choix.length && Number.isInteger(+o.bonne) && +o.bonne >= 0 && +o.bonne < o.choix.length) {
      q.choix = o.choix.map(String); q.bonne = +o.bonne;
    }
  });
  ((r && r.vf) || []).forEach((o) => { const f = p.vf[o && o.i]; if (!f) return; const v = str(o.variantes); if (v.length) { f.variantes = v; n++; } });
  return n;
}

/* ---------- plan de révision avant le DS ---------- */
// Une tâche par jour, de J-7 (au plus) jusqu'au jour du DS
export function planFor(ch, from = today()) {
  if (!ch.ds) return [];
  const n = diffDays(from, ch.ds);
  if (n < 0 || n > 21) return [];
  const p = ch.pack || {};
  const hasEx = (p.exercices || []).length > 0, hasRed = (p.ouvertes || []).length > 0;
  const task = (d) => {
    if (d === 0) return ['☀️', 'Le matin : 10 min de fiches, rien de nouveau. Tu es prêt !'];
    if (d === 1) return ['🌙', 'Relis le cours, fais le défi 60 s, puis couche-toi tôt 😴'];
    if (d === 2) return ['❌', 'Revois tes erreurs' + (hasRed ? ' et fais une rédaction' : '')];
    if (d === 3) return ['📝', 'Examen blanc : repère ce qui reste à revoir'];
    if (d === 4 && hasEx) return ['✏️', 'Exercices : refais-en au moins 5'];
    if (d % 2 === 0) return ['❓', 'Quiz + vrai/faux du chapitre'];
    return ['🃏', 'Fiches du chapitre (glisse-les toutes)'];
  };
  const out = [];
  for (let d = Math.min(n, 7); d >= 0; d--) out.push({ date: addDays(ch.ds, -d), d, icon: task(d)[0], text: task(d)[1] });
  return out;
}
