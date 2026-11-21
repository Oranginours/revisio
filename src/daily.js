// ✨ Nouvelles questions chaque jour : une fois par jour, l'IA ajoute des questions inédites
// aux chapitres en cours (en priorité ceux dont le DS approche), ou reformule quand il y en a déjà beaucoup.
import { S, commit, activeChs } from './store';
import { gemini } from './ai';
import { normPack, mergePack, promptMore, promptVariants, applyVariants, weight, today, shuffle } from './logic';
import { toast } from './ui';

let running = false;
const PER_DAY = 2; // chapitres enrichis par jour
const BIG = 160; // au-delà, on reformule plutôt que d'ajouter

const hasCourse = (ch) => ch.pack && ((ch.pack.resume || []).length || (ch.pack.vocab || []).length || (ch.pack.qcm || []).length);
const matName = (ch) => ((S.profil.matieres || []).find((m) => m.id === ch.matiereId) || {}).nom || '';

export function freshPending() {
  return S.settings.daily !== false && !!S.settings.apiKey && S.profil.freshDay !== today();
}

export async function dailyFresh(force) {
  if (running || !S.settings.apiKey || (S.settings.daily === false && !force)) return 0;
  const t = today();
  if (!force && S.profil.freshDay === t) return 0;
  const chs = activeChs().filter(hasCourse)
    .sort((a, b) => weight(b) - weight(a) || (a.freshAt || 0) - (b.freshAt || 0))
    .slice(0, PER_DAY);
  if (!chs.length) { S.profil.freshDay = t; commit(); return 0; }
  running = true;
  let added = 0, varied = 0, ok = 0;
  const names = [];
  try {
    for (const ch of chs) {
      try {
        const p = ch.pack;
        if ((p.qcm || []).length + (p.vf || []).length >= BIG) {
          // déjà beaucoup de questions : on en reformule 15 au hasard
          const qIdx = shuffle(p.qcm.map((_, i) => i)).slice(0, 10), fIdx = shuffle(p.vf.map((_, i) => i)).slice(0, 5);
          const r = await gemini({ apiKey: S.settings.apiKey, model: S.settings.model, prompt: promptVariants(ch, qIdx, fIdx) });
          varied += applyVariants(ch, r);
        } else {
          const add = normPack(await gemini({ apiKey: S.settings.apiKey, model: S.settings.model, prompt: promptMore(ch, matName(ch), 'daily') }));
          add.qcm.forEach((q) => { q.nv = t; });
          add.vf.forEach((q) => { q.nv = t; });
          const n = add.qcm.length + add.vf.length;
          if (n) { ch.pack = mergePack(ch.pack, { qcm: add.qcm, vf: add.vf }); added += n; }
        }
        ch.freshAt = Date.now(); ok++;
        names.push(matName(ch) || ch.titre);
      } catch (e) { /* pas de réseau ou quota : on réessaiera plus tard */ }
    }
  } finally { running = false; }
  if (ok) {
    S.profil.freshDay = t; commit();
    const who = [...new Set(names)].join(', ');
    if (added) toast(`✨ ${added} nouvelles questions du jour (${who})`);
    else if (varied) toast(`🔀 ${varied} questions reformulées pour aujourd'hui (${who})`);
  }
  return added + varied;
}
export const isNew = (x) => !!(x && x.nv && x.nv === today());
