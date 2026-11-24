// Appels à l'IA Gemini (avec la clé de chaque utilisateur) et préparation des photos.
import * as ImageManipulator from 'expo-image-manipulator';

export const DEFAULT_MODEL = 'gemini-3.6-flash';
// Si un modèle n'existe plus (Google en change souvent), on essaie les suivants.
const FALLBACK = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];

function parseJSON(text) {
  try { return JSON.parse(text); } catch (e) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    const err = new Error("L'IA a renvoyé une réponse illisible. Réessaie."); err.retry = true; throw err;
  }
}

function errText(status, j) {
  const msg = (j && j.error && j.error.message) || '';
  if (status === 400 && /api key/i.test(msg)) return 'Ta clé API est invalide. Vérifie-la dans les réglages.';
  if (status === 403) return "Ta clé API n'a pas accès à ce modèle. Vérifie-la dans les réglages.";
  if (status === 429) return "Tu as atteint la limite gratuite de Gemini. Réessaie dans quelques minutes (ou demain).";
  if (status === 413) return 'Trop de photos d\'un coup. Essaie avec moins de photos.';
  return `Erreur de l'IA (${status}) ${msg.slice(0, 120)}`;
}

// images : tableau de chaînes base64 (JPEG)
export async function gemini({ apiKey, model, prompt, images = [], json = true }) {
  if (!apiKey) throw new Error("Ajoute d'abord ta clé Gemini dans les réglages (⚙️).");
  const parts = [{ text: prompt }, ...images.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } }))];
  const body = { contents: [{ role: 'user', parts }], generationConfig: json ? { responseMimeType: 'application/json' } : {} };
  const models = [model || DEFAULT_MODEL, ...FALLBACK.filter((m) => m !== model)];
  for (const m of models) {
    let r;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 150000) : null; // connexion coupée : on n'attend pas indéfiniment
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
        body: JSON.stringify(body),
        ...(ctrl ? { signal: ctrl.signal } : {}),
      });
    } catch (e) {
      const err = new Error("Pas de connexion internet. L'IA a besoin d'internet, mais tu peux réviser hors ligne.");
      err.retry = true;
      throw err;
    } finally { if (timer) clearTimeout(timer); }
    if (r.status === 404) continue;
    let j = null;
    try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error(errText(r.status, j)); err.status = r.status; err.retry = r.status === 429 || r.status >= 500; throw err; }
    const text = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts || [])
      .map((p) => p.text || '').join('');
    if (!text) { const err = new Error("L'IA n'a rien répondu (contenu bloqué ?). Réessaie."); err.retry = true; throw err; }
    return json ? parseJSON(text) : text;
  }
  throw new Error('Modèle introuvable : change le nom du modèle dans les réglages.');
}

// Réduit une photo à 1600 px de large et la renvoie en base64.
export async function prepareImage(uri) {
  try {
    if (ImageManipulator.ImageManipulator && ImageManipulator.ImageManipulator.manipulate) {
      const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
      ctx.resize({ width: 1600 });
      const img = await ctx.renderAsync();
      const res = await img.saveAsync({ compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (res.base64) return res.base64;
    }
  } catch (e) {}
  const res = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true,
  });
  return res.base64;
}
