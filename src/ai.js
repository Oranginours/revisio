// Appels à l'IA (Gemini, ChatGPT, Claude, Mistral, OpenRouter — avec les clés de l'utilisateur) et préparation des photos.
import * as ImageManipulator from 'expo-image-manipulator';
import { S } from './store';

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

/* ---------- Les fournisseurs d'IA ---------- */
// Chaque clé : { p: fournisseur, key, model }. La première de la liste est utilisée en premier ;
// si elle atteint sa limite (ou est refusée), on passe automatiquement à la suivante.
export const PROVIDERS = {
  gemini: { name: 'Gemini (Google)', icon: '✨', hint: 'AIza…', model: DEFAULT_MODEL, fallback: FALLBACK, free: true, url: 'https://aistudio.google.com/apikey' },
  openai: { name: 'ChatGPT (OpenAI)', icon: '🟢', hint: 'sk-…', model: 'gpt-5.6-luna', fallback: ['gpt-6-luna', 'gpt-5.6-luna', 'gpt-5-mini', 'gpt-4.1-mini'], url: 'https://platform.openai.com/api-keys' },
  anthropic: { name: 'Claude (Anthropic)', icon: '🟠', hint: 'sk-ant-…', model: 'claude-haiku-5-5', fallback: ['claude-haiku-5-5', 'claude-sonnet-5-5'], url: 'https://console.anthropic.com/settings/keys' },
  mistral: { name: 'Mistral', icon: '🟣', hint: 'clé Mistral', model: 'mistral-medium-latest', fallback: ['mistral-medium-latest', 'pixtral-large-latest', 'mistral-small-latest'], url: 'https://console.mistral.ai/api-keys' },
  openrouter: { name: 'OpenRouter (tous les modèles)', icon: '🔀', hint: 'sk-or-…', model: 'openrouter/auto', fallback: ['openrouter/auto'], url: 'https://openrouter.ai/keys' },
};
export const providerOf = (k) => PROVIDERS[k && k.p] || PROVIDERS.gemini;

function errText(status, j, prov) {
  const msg = (j && j.error && (j.error.message || (typeof j.error === 'string' ? j.error : ''))) || (j && j.message) || '';
  const n = prov ? prov.name.split(' ')[0] : "l'IA";
  if ((status === 400 && /api.?key|auth/i.test(msg)) || status === 401) return `Ta clé ${n} est invalide. Vérifie-la dans les réglages.`;
  if (status === 402 || /credit|billing|balance|quota/i.test(msg)) return `Plus de crédit sur ta clé ${n}.`;
  if (status === 403) return `Ta clé ${n} n'a pas accès à ce modèle.`;
  if (status === 429) return `Ta clé ${n} a atteint sa limite. Réessaie dans quelques minutes.`;
  if (status === 413) return 'Trop de photos d\'un coup. Essaie avec moins de photos.';
  return `Erreur de ${n} (${status}) ${msg.slice(0, 120)}`;
}

// Toutes les clés enregistrées, dans l'ordre (avec reprise des anciens réglages « Gemini seulement »)
export function keyList() {
  const st = S.settings || {};
  if (!Array.isArray(st.keys)) {
    st.keys = [];
    if (st.apiKey) st.keys.push({ p: 'gemini', key: st.apiKey, model: st.model || '' });
    (st.apiKeys || []).forEach((k) => st.keys.push({ p: 'gemini', key: k, model: '' }));
  }
  return st.keys.filter((k) => k && k.key);
}
export const hasAI = () => keyList().length > 0;
// garde S.settings.apiKey rempli (l'appli s'en sert pour savoir si l'IA est disponible)
export function syncKeys() { const l = keyList(); S.settings.apiKey = l.length ? l[0].key : ''; }

let goodKey = 0; // la dernière clé qui a marché
export async function gemini(opts) {
  let keys = keyList();
  if (!keys.length && opts.apiKey) keys = [{ p: 'gemini', key: opts.apiKey, model: opts.model }];
  if (!keys.length) throw new Error("Ajoute d'abord une clé d'IA dans les réglages (⚙️).");
  let last;
  for (let n = 0; n < keys.length; n++) {
    const i = (goodKey + n) % keys.length;
    try {
      const r = await callOne(keys[i], opts);
      goodKey = i;
      return r;
    } catch (e) {
      last = e;
      // limite atteinte, plus de crédit, clé refusée : on essaie la clé suivante
      if (![400, 401, 402, 403, 429].includes(e.status) || keys.length < 2) throw e;
    }
  }
  if (last && keys.length > 1) last.message = `Aucune de tes ${keys.length} clés ne marche pour l'instant (limites atteintes ?). Dernière erreur : ${last.message}`;
  throw last;
}

async function post(url, headers, body) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 300000) : null; // connexion coupée : on n'attend pas indéfiniment
  try {
    return await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), ...(ctrl ? { signal: ctrl.signal } : {}) });
  } catch (e) {
    const err = new Error("Pas de connexion internet. L'IA a besoin d'internet, mais tu peux réviser hors ligne.");
    err.retry = true;
    throw err;
  } finally { if (timer) clearTimeout(timer); }
}
function fail(r, j, prov) { const err = new Error(errText(r.status, j, prov)); err.status = r.status; err.retry = r.status === 429 || r.status >= 500; return err; }
function finish(text, json) {
  if (!text) { const err = new Error("L'IA n'a rien répondu (contenu bloqué ?). Réessaie."); err.retry = true; throw err; }
  return json ? parseJSON(text) : text;
}
const JSON_NOTE = '\n\nRéponds uniquement avec un objet JSON valide, sans texte autour.';

// Un appel avec une clé ; si le modèle n'existe pas (404), on essaie les modèles de secours du fournisseur
async function callOne(k, { prompt, images = [], json = true }) {
  const prov = providerOf(k);
  const key = String(k.key).trim();
  const models = [k.model || prov.model, ...prov.fallback.filter((m) => m !== (k.model || prov.model))];
  for (const m of models) {
    let r, j = null;
    if (prov === PROVIDERS.gemini) {
      const parts = [{ text: prompt }, ...images.map((data) => ({ inline_data: { mime_type: 'image/jpeg', data } }))];
      r = await post(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { 'x-goog-api-key': key },
        { contents: [{ role: 'user', parts }], generationConfig: json ? { responseMimeType: 'application/json' } : {} });
      if (r.status === 404) continue;
      try { j = await r.json(); } catch (e) { /* vide */ }
      if (!r.ok) throw fail(r, j, prov);
      return finish(((j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map((x) => x.text || '').join(''), json);
    }
    if (prov === PROVIDERS.anthropic) {
      const content = [...images.map((data) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })), { type: 'text', text: prompt + (json ? JSON_NOTE : '') }];
      r = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        { model: m, max_tokens: 16000, messages: [{ role: 'user', content }] });
      if (r.status === 404) continue;
      try { j = await r.json(); } catch (e) { /* vide */ }
      if (!r.ok) { if (r.status === 400 && /model/i.test(JSON.stringify(j || ''))) continue; throw fail(r, j, prov); }
      return finish(((j && j.content) || []).filter((x) => x.type === 'text').map((x) => x.text).join(''), json);
    }
    // OpenAI, Mistral, OpenRouter : même format (« chat completions »)
    const url = prov === PROVIDERS.openai ? 'https://api.openai.com/v1/chat/completions'
      : prov === PROVIDERS.mistral ? 'https://api.mistral.ai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
    const content = [{ type: 'text', text: prompt + (json ? JSON_NOTE : '') }, ...images.map((data) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${data}` } }))];
    const headers = { Authorization: `Bearer ${key}`, ...(prov === PROVIDERS.openrouter ? { 'HTTP-Referer': 'https://oranginours.github.io/revisio/', 'X-Title': 'Revisio' } : {}) };
    const body = { model: m, messages: [{ role: 'user', content: images.length ? content : content[0].text }] };
    if (json) body.response_format = { type: 'json_object' };
    r = await post(url, headers, body);
    if (r.status === 404) continue;
    try { j = await r.json(); } catch (e) { /* vide */ }
    if (!r.ok) {
      const txt = JSON.stringify(j || '');
      if (r.status === 400 && /model/i.test(txt) && /not.?(exist|found)|invalid model|unknown/i.test(txt)) continue;
      throw fail(r, j, prov);
    }
    return finish(j && j.choices && j.choices[0] && j.choices[0].message ? (typeof j.choices[0].message.content === 'string' ? j.choices[0].message.content : (j.choices[0].message.content || []).map((x) => x.text || '').join('')) : '', json);
  }
  const e = new Error(`Modèle introuvable chez ${prov.name} : change le nom du modèle dans les réglages.`);
  e.status = 404;
  throw e;
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
