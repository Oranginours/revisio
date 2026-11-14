// XP, niveaux, statistiques et badges : un peu de jeu pour donner envie de revenir.
import { hooks, today, diffDays, mastery } from './logic';
import { S, setAfterCommit } from './store';
import { toast } from './ui';

/* ---------- XP et niveaux ---------- */
// Niveau n atteint à 50·(n-1)² XP : 0, 50, 200, 450, 800…
export const levelOf = (xp) => Math.floor(Math.sqrt((xp || 0) / 50)) + 1;
export const xpFor = (lvl) => 50 * (lvl - 1) * (lvl - 1);
export function levelInfo(xp = S.profil.xp || 0) {
  const lvl = levelOf(xp), a = xpFor(lvl), b = xpFor(lvl + 1);
  return { lvl, xp, into: xp - a, need: b - a, pct: Math.round(((xp - a) / (b - a)) * 100) };
}
const TITLES = ['Débutant', 'Curieux', 'Studieux', 'Motivé', 'Assidu', 'Bosseur', 'Expert', 'Crack', 'Génie', 'Légende'];
export const levelTitle = (lvl) => TITLES[Math.min(TITLES.length - 1, Math.floor((lvl - 1) / 2))];

export function addXp(n) {
  const before = levelOf(S.profil.xp || 0);
  S.profil.xp = (S.profil.xp || 0) + n;
  const after = levelOf(S.profil.xp);
  if (after > before) setTimeout(() => toast(`⬆️ Niveau ${after} ! Tu passes « ${levelTitle(after)} »`), 400);
}

/* ---------- statistiques ---------- */
function stats() {
  const P = S.profil;
  P.stats = P.stats || { a: 0, c: 0, days: {}, mats: {}, sessions: 0 };
  return P.stats;
}
hooks.onGrade = (ok, ch) => {
  const st = stats(), d = today();
  st.a++; if (ok) st.c++;
  st.days[d] = st.days[d] || { a: 0, c: 0 }; st.days[d].a++; if (ok) st.days[d].c++;
  const mid = ch && ch.matiereId;
  if (mid) { st.mats[mid] = st.mats[mid] || { a: 0, c: 0 }; st.mats[mid].a++; if (ok) st.mats[mid].c++; }
  Object.keys(st.days).forEach((k) => { if (diffDays(k, d) > 90) delete st.days[k]; });
  addXp(ok ? 10 : 2);
};
export function sessionDone(n, ok) {
  const st = stats(); st.sessions++;
  const h = new Date().getHours();
  if (h >= 22 || h < 4) S.profil.flags = { ...(S.profil.flags || {}), night: 1 };
  if (h >= 4 && h < 8) S.profil.flags = { ...(S.profil.flags || {}), morning: 1 };
  if (n >= 10 && ok === n) S.profil.flags = { ...(S.profil.flags || {}), perfect: 1 };
  addXp(50);
}
export const flag = (k) => { S.profil.flags = { ...(S.profil.flags || {}), [k]: 1 }; };
export const getStats = () => stats();

/* ---------- badges ---------- */
const chs = () => Object.values(S.chs);
export const BADGES = [
  ['first', '🌱', 'Premier pas', 'Finir une première session', () => stats().sessions >= 1],
  ['s3', '🔥', 'En feu', '3 jours de suite', () => (S.profil.streak || 0) >= 3],
  ['s7', '⚡', 'Une semaine', '7 jours de suite', () => (S.profil.streak || 0) >= 7],
  ['s30', '🏆', 'Inarrêtable', '30 jours de suite', () => (S.profil.streak || 0) >= 30],
  ['c100', '💯', 'Centurion', '100 bonnes réponses', () => stats().c >= 100],
  ['c500', '🧠', 'Cerveau', '500 bonnes réponses', () => stats().c >= 500],
  ['c1000', '🎓', 'Diplômé', '1000 bonnes réponses', () => stats().c >= 1000],
  ['perfect', '✨', 'Sans faute', 'Une session d\'au moins 10 questions sans erreur', () => !!(S.profil.flags || {}).perfect],
  ['eclair', '⏱️', 'Éclair', '20 bonnes réponses au défi 60 s', () => ((S.profil.best || {}).eclair || 0) >= 20],
  ['exam', '📝', 'Major', '16/20 ou plus à un examen blanc', () => chs().some((c) => (c.exams || []).some((e) => e.note >= 16))],
  ['master', '⭐', 'Maîtrise', 'Un chapitre maîtrisé à 80 %', () => chs().some((c) => mastery(c) >= 80)],
  ['lib', '📚', 'Bibliothèque', '5 chapitres créés', () => chs().length >= 5],
  ['share', '🤝', 'Entraide', 'Partager un chapitre', () => !!(S.profil.flags || {}).share],
  ['pomo', '🍅', 'Concentré', '4 pomodoros dans la journée', () => Object.values(S.profil.pomo || {}).some((n) => n >= 4)],
  ['night', '🦉', 'Couche-tard', 'Réviser après 22 h', () => !!(S.profil.flags || {}).night],
  ['morning', '🐦', 'Lève-tôt', 'Réviser avant 8 h', () => !!(S.profil.flags || {}).morning],
  ['lvl5', '🚀', 'Décollage', 'Atteindre le niveau 5', () => levelOf(S.profil.xp) >= 5],
  ['lvl10', '👑', 'Légende', 'Atteindre le niveau 10', () => levelOf(S.profil.xp) >= 10],
];
// Vérifié après chaque modification : annonce les nouveaux badges
setAfterCommit(() => {
  const got = (S.profil.badges = S.profil.badges || {});
  const fresh = [];
  BADGES.forEach(([id, icon, name, , test]) => {
    if (got[id]) return;
    let ok = false; try { ok = test(); } catch (e) {}
    if (ok) { got[id] = today(); fresh.push(icon + ' ' + name); }
  });
  if (fresh.length) setTimeout(() => toast(fresh.length === 1 ? `🏅 Badge débloqué : ${fresh[0]}` : `🏅 ${fresh.length} badges débloqués ! (${fresh.join(', ')})`), 900);
});
