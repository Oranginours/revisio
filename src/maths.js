// 🧮 Exos de maths à l'infini : des calculs générés au hasard, 5 niveaux (Noob → God).
// Tout marche hors ligne, sans IA. Réponse à taper (pavé numérique) ou à choisir (QCM).
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { useApp, Card, H2, Txt, Btn, Row, Fb, Pop, FadeIn, Progress, toast } from './ui';
import { S, commit } from './store';
import { addXp } from './progress';

/* ================= Outils ================= */
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const nz = (a, b) => { let x = 0; while (x === 0) x = R(a, b); return x; };
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// fraction irréductible { n, d } (d > 0)
const frac = (n, d) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
const fstr = (f) => (f.d === 1 ? fmt(f.n) : `${f.n}/${f.d}`);
// nombre « à la française » : virgule, pas de 0 inutiles
function fmt(x) {
  if (typeof x === 'object' && x) return fstr(x);
  const r = Math.round(x * 1e6) / 1e6;
  return String(r).replace('.', ',');
}
const par = (x) => (x < 0 ? `(${fmt(x)})` : fmt(x));
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
const sup = (n) => String(n).split('').map((c) => SUP[c] || c).join('');
// a·x + b écrit proprement : « 3x − 5 », « −x + 2 », « x² − 4x + 1 »
function poly(coefs, v = 'x') {
  // coefs du plus haut degré au plus bas
  const deg = coefs.length - 1;
  let out = '';
  coefs.forEach((c, i) => {
    if (!c) return;
    const p = deg - i;
    const abs = Math.abs(c);
    const sign = c < 0 ? (out ? ' − ' : '−') : out ? ' + ' : '';
    const coef = p > 0 && abs === 1 ? '' : fmt(abs);
    const xs = p === 0 ? '' : p === 1 ? v : v + sup(p);
    out += sign + coef + xs;
  });
  return out || '0';
}
const lin = (a, b, v = 'x') => poly([a, b], v);

/* ================= Les exercices par niveau =================
   Chaque générateur renvoie :
   { q, ans } (réponse à taper : nombre ou fraction {n,d})  ou  { q, choices, good } (QCM)
   + expl : la correction expliquée. */
const GEN = {
  /* ---------- 🐣 NOOB ---------- */
  noob: [
    () => { const a = R(12, 89), b = R(11, 79); return { t: 'Addition', q: `${a} + ${b} = ?`, ans: a + b, expl: `${a} + ${b} = ${a + b}` }; },
    () => { const a = R(40, 120), b = R(11, a - 5); return { t: 'Soustraction', q: `${a} − ${b} = ?`, ans: a - b, expl: `${a} − ${b} = ${a - b}` }; },
    () => { const a = R(2, 10), b = R(2, 10); return { t: 'Tables', q: `${a} × ${b} = ?`, ans: a * b, expl: `${a} × ${b} = ${a * b}` }; },
    () => { const b = R(2, 9), r = R(2, 12); return { t: 'Division', q: `${b * r} ÷ ${b} = ?`, ans: r, expl: `${b} × ${r} = ${b * r}, donc ${b * r} ÷ ${b} = ${r}` }; },
    () => { const a = R(2, 9), b = R(2, 9), c = R(2, 9); return { t: 'Priorités', q: `${a} + ${b} × ${c} = ?`, ans: a + b * c, expl: `On fait d'abord la multiplication : ${b} × ${c} = ${b * c}, puis ${a} + ${b * c} = ${a + b * c}` }; },
    () => { const n = R(2, 13); return { t: 'Carrés', q: `${n}² = ?`, ans: n * n, expl: `${n}² = ${n} × ${n} = ${n * n}` }; },
    () => { const a = R(11, 89); return { t: 'Complément', q: `${a} + ? = 100`, ans: 100 - a, expl: `100 − ${a} = ${100 - a}` }; },
    () => { const a = R(2, 9) * 10, b = R(2, 9); return { t: 'Calcul mental', q: `${a} × ${b} = ?`, ans: a * b, expl: `${a / 10} × ${b} = ${(a / 10) * b}, puis × 10 : ${a * b}` }; },
    () => { const a = R(1, 9) + R(1, 9) / 10, b = R(1, 9) + R(1, 9) / 10; return { t: 'Décimaux', q: `${fmt(a)} + ${fmt(b)} = ?`, ans: Math.round((a + b) * 10) / 10, expl: `${fmt(a)} + ${fmt(b)} = ${fmt(Math.round((a + b) * 10) / 10)}` }; },
    () => { const a = R(2, 9), b = R(2, 9); return { t: 'Parenthèses', q: `(${a} + ${b}) × 2 = ?`, ans: (a + b) * 2, expl: `D'abord la parenthèse : ${a} + ${b} = ${a + b}, puis × 2 = ${(a + b) * 2}` }; },
  ],

  /* ---------- 🙂 NORMAL ---------- */
  normal: [
    () => { const a = nz(-15, 15), b = nz(-15, 15); return { t: 'Relatifs', q: `${par(a)} + ${par(b)} = ?`, ans: a + b, expl: `${par(a)} + ${par(b)} = ${a + b}` }; },
    () => { const a = nz(-12, 12), b = nz(-12, 12); return { t: 'Relatifs', q: `${par(a)} − ${par(b)} = ?`, ans: a - b, expl: `Soustraire ${par(b)}, c'est ajouter son opposé : ${par(a)} + ${par(-b)} = ${a - b}` }; },
    () => { const a = nz(-9, 9), b = nz(-9, 9); return { t: 'Relatifs', q: `${par(a)} × ${par(b)} = ?`, ans: a * b, expl: `Règle des signes : ${a * b > 0 ? 'mêmes signes → positif' : 'signes contraires → négatif'}. ${par(a)} × ${par(b)} = ${a * b}` }; },
    () => { const d = R(3, 12), a = R(1, d - 1), b = R(1, d - 1); const f = frac(a + b, d); return { t: 'Fractions', q: `${a}/${d} + ${b}/${d} = ?`, hint: 'fraction simplifiée', ans: f, expl: `Même dénominateur : on ajoute les numérateurs. ${a + b}/${d}${gcd(a + b, d) > 1 ? ` = ${fstr(f)} (simplifiée)` : ''}` }; },
    () => { const b = R(2, 7), d = R(2, 7), a = R(1, b - 1), c = R(1, d - 1); const f = frac(a * c, b * d); return { t: 'Fractions', q: `${a}/${b} × ${c}/${d} = ?`, hint: 'fraction simplifiée', ans: f, expl: `On multiplie en haut et en bas : ${a * c}/${b * d}${gcd(a * c, b * d) > 1 ? ` = ${fstr(f)}` : ''}` }; },
    () => { const d = pick([2, 3, 4, 5, 10]), n = R(1, d - 1), k = R(2, 12) * d; return { t: 'Fraction de', q: `${n}/${d} de ${k} = ?`, ans: (n * k) / d, expl: `${k} ÷ ${d} = ${k / d}, puis × ${n} = ${(n * k) / d}` }; },
    () => { const p = pick([10, 20, 25, 50, 75, 5, 15]), k = R(2, 20) * 20; return { t: 'Pourcentages', q: `${p} % de ${k} = ?`, ans: (p * k) / 100, expl: `${p} % de ${k} = ${k} × ${p}/100 = ${fmt((p * k) / 100)}` }; },
    () => { const p = pick([10, 20, 25, 30, 50]), k = R(2, 30) * 10; return { t: 'Soldes', q: `Un article à ${k} € est soldé à −${p} %. Nouveau prix (€) ?`, ans: (k * (100 - p)) / 100, expl: `On paie ${100 - p} % du prix : ${k} × ${fmt((100 - p) / 100)} = ${fmt((k * (100 - p)) / 100)} €` }; },
    () => { const a = R(2, 9), b = R(-20, 20), x = R(-9, 9); return { t: 'Équation', q: `${lin(a, b)} = ${a * x + b}\nx = ?`, ans: x, expl: `${a}x = ${a * x + b} ${b >= 0 ? '−' : '+'} ${Math.abs(b)} = ${a * x}, donc x = ${a * x} ÷ ${a} = ${x}` }; },
    () => { const m = R(1, 9) + R(1, 9) / 10, e = R(2, 5); return { t: 'Puissances de 10', q: `${fmt(m)} × 10${sup(e)} = ?`, ans: Math.round(m * 10 ** e), expl: `× 10${sup(e)} : la virgule avance de ${e} rangs → ${fmt(Math.round(m * 10 ** e))}` }; },
    () => { const a = R(2, 7), b = R(-4, 6); return { t: 'Puissances de 10', q: `10${sup(a)} × 10${sup(b)} = 10^?`, hint: "l'exposant", ans: a + b, expl: `On ajoute les exposants : ${a} + ${par(b)} = ${a + b}` }; },
    () => { const a = R(2, 9), x = R(-6, 6); return { t: 'Calcul littéral', q: `Si x = ${x}, combien vaut ${a}x − ${2 * a} ?`, ans: a * x - 2 * a, expl: `${a} × ${par(x)} − ${2 * a} = ${a * x} − ${2 * a} = ${a * x - 2 * a}` }; },
  ],

  /* ---------- 😎 PRO ---------- */
  pro: [
    () => { const b = R(2, 9), d = R(2, 9), a = R(1, b - 1), c = R(1, d - 1); const f = frac(a * d + c * b, b * d); return { t: 'Fractions', q: `${a}/${b} + ${c}/${d} = ?`, hint: 'fraction irréductible', ans: f, expl: `Dénominateur commun ${b * d} : ${a * d}/${b * d} + ${c * b}/${b * d} = ${a * d + c * b}/${b * d}${gcd(a * d + c * b, b * d) > 1 ? ` = ${fstr(f)}` : ''}` }; },
    () => { const b = R(2, 8), d = R(2, 8), a = R(1, b - 1), c = R(1, d - 1); const f = frac(a * d, b * c); return { t: 'Fractions', q: `${a}/${b} ÷ ${c}/${d} = ?`, hint: 'fraction irréductible', ans: f, expl: `Diviser = multiplier par l'inverse : ${a}/${b} × ${d}/${c} = ${a * d}/${b * c}${gcd(a * d, b * c) > 1 ? ` = ${fstr(f)}` : ''}` }; },
    () => { const a = R(2, 5), n = R(2, 6), m = R(2, 6); return { t: 'Puissances', q: `${a}${sup(n)} × ${a}${sup(m)} = ${a}^?`, hint: "l'exposant", ans: n + m, expl: `aⁿ × aᵐ = aⁿ⁺ᵐ : ${n} + ${m} = ${n + m}` }; },
    () => { const a = R(2, 5), n = R(2, 4), m = R(2, 4); return { t: 'Puissances', q: `(${a}${sup(n)})${sup(m)} = ${a}^?`, hint: "l'exposant", ans: n * m, expl: `(aⁿ)ᵐ = aⁿˣᵐ : ${n} × ${m} = ${n * m}` }; },
    () => { const a = R(2, 3), n = R(3, 7); return { t: 'Puissances', q: `${a}${sup(n)} = ?`, ans: a ** n, expl: `${Array(n).fill(a).join(' × ')} = ${a ** n}` }; },
    () => { const k = pick([2, 3, 5, 6, 7]), s = R(2, 9); const good = `${s}√${k}`; return { t: 'Racines', q: `Simplifie √${s * s * k}`, choices: shuffle([good, `${k}√${s}`, `${s * k}√${s}`, `${s}√${k * 2}`]), good, expl: `${s * s * k} = ${s * s} × ${k}, donc √${s * s * k} = √${s * s} × √${k} = ${s}√${k}` }; },
    () => { const k = R(2, 9) * pick([1, -1]), a = nz(-6, 6), b = nz(-9, 9); const good = lin(k * a, k * b); return { t: 'Développer', q: `Développe ${k}(${lin(a, b)})`, choices: shuffle([good, lin(k * a, b), lin(a, k * b), lin(k * a, -k * b)]).filter((v, i, arr) => arr.indexOf(v) === i), good, expl: `On distribue ${k} : ${k} × ${a === 1 ? '' : a}x = ${k * a}x et ${k} × ${par(b)} = ${k * b}` }; },
    () => { const a = R(2, 9), b = R(-9, 9), c = nz(-5, 5), x = R(-8, 8); const d = (a - c) * x + b; if (a === c) return GEN.pro[7](); return { t: 'Équation', q: `${lin(a, b)} = ${lin(c, d)}\nx = ?`, ans: x, expl: `On regroupe les x : ${a - c}x = ${d - b}, donc x = ${x}` }; },
    () => { const p = pick([10, 20, 25, 50]), q = pick([10, 20, 25, 50]); const g = Math.round(((1 + p / 100) * (1 - q / 100) - 1) * 1000) / 10; return { t: 'Évolutions', q: `Un prix augmente de ${p} % puis baisse de ${q} %. Évolution totale (en %) ?`, hint: 'ex. −5 ou 12,5', ans: g, expl: `On multiplie les coefficients : ${fmt(1 + p / 100)} × ${fmt(1 - q / 100)} = ${fmt((1 + p / 100) * (1 - q / 100))}, soit ${g > 0 ? '+' : ''}${fmt(g)} %` }; },
    () => { const a = R(2, 9), b = R(2, 9) * a, c = R(2, 12); return { t: 'Proportionnalité', q: `${a} cahiers coûtent ${b} €. Combien coûtent ${c} cahiers (€) ?`, ans: (b / a) * c, expl: `1 cahier : ${b} ÷ ${a} = ${b / a} €, donc ${c} cahiers : ${(b / a) * c} €` }; },
    () => { const n = R(2, 15); return { t: 'Racines', q: `√${n * n} = ?`, ans: n, expl: `${n}² = ${n * n}, donc √${n * n} = ${n}` }; },
    () => { const v = pick([[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [7, 24, 25], [12, 16, 20]]); return { t: 'Pythagore', q: `Triangle rectangle : les côtés de l'angle droit mesurent ${v[0]} et ${v[1]}. Hypoténuse ?`, ans: v[2], expl: `h² = ${v[0]}² + ${v[1]}² = ${v[0] ** 2 + v[1] ** 2}, donc h = √${v[0] ** 2 + v[1] ** 2} = ${v[2]}` }; },
  ],

  /* ---------- 💻 HACKER ---------- */
  hacker: [
    () => { const a = nz(-9, 9); const good = poly([1, 2 * a, a * a]); return { t: 'Identités remarquables', q: `Développe (x ${a < 0 ? '−' : '+'} ${Math.abs(a)})²`, choices: shuffle([good, poly([1, 0, a * a]), poly([1, a, a * a]), poly([1, 2 * a, -a * a])]), good, expl: `(a + b)² = a² + 2ab + b² : x² ${a < 0 ? '−' : '+'} ${Math.abs(2 * a)}x + ${a * a}` }; },
    () => { const a = R(1, 9), k = R(1, 4); const good = `(${k === 1 ? '' : k}x − ${a})(${k === 1 ? '' : k}x + ${a})`; return { t: 'Factoriser', q: `Factorise ${poly([k * k, 0, -a * a])}`, choices: shuffle([good, `(${k === 1 ? '' : k}x − ${a})²`, `(${k === 1 ? '' : k}x + ${a})²`, `${k === 1 ? '' : k}x(${k === 1 ? '' : k}x − ${a * a})`]), good, expl: `a² − b² = (a − b)(a + b) avec a = ${k === 1 ? '' : k}x et b = ${a}` }; },
    () => { const a = nz(-4, 4), b = R(-9, 9), c = R(-9, 9); return { t: 'Discriminant', q: `Δ de ${poly([a, b, c])} = ?`, ans: b * b - 4 * a * c, expl: `Δ = b² − 4ac = ${par(b)}² − 4 × ${par(a)} × ${par(c)} = ${b * b} − ${4 * a * c} = ${b * b - 4 * a * c}` }; },
    () => { const a = nz(-3, 3), b = R(-8, 8), c = R(-8, 8); const D = b * b - 4 * a * c; const good = D > 0 ? '2 solutions' : D === 0 ? '1 solution' : 'Aucune solution'; return { t: 'Second degré', q: `${poly([a, b, c])} = 0 a combien de solutions réelles ?`, choices: ['Aucune solution', '1 solution', '2 solutions'], good, expl: `Δ = ${b * b} − ${4 * a * c} = ${D} ${D > 0 ? '> 0 → 2 solutions' : D === 0 ? '= 0 → 1 solution' : '< 0 → aucune solution'}` }; },
    () => { const a = nz(-3, 3), b = R(-6, 6), c = R(-9, 9), k = R(-4, 4); return { t: 'Fonctions', q: `f(x) = ${poly([a, b, c])}\nf(${k}) = ?`, ans: a * k * k + b * k + c, expl: `f(${k}) = ${a} × ${par(k)}² + ${par(b)} × ${par(k)} + ${par(c)} = ${a * k * k} + ${b * k} + ${c} = ${a * k * k + b * k + c}` }; },
    () => { const a = R(-3, 3), b = R(-5, 5), c = R(-9, 9), d = R(-9, 9), k = R(-3, 3); const v = 3 * a * k * k + 2 * b * k + c; return { t: 'Dérivées', q: `f(x) = ${poly([a, b, c, d])}\nf'(${k}) = ?`, ans: v, expl: `f'(x) = ${poly([3 * a, 2 * b, c])}, donc f'(${k}) = ${3 * a * k * k} + ${2 * b * k} + ${c} = ${v}` }; },
    () => { const x = R(-6, 6), y = R(-6, 6), a = nz(-4, 4), b = nz(-4, 4), c = nz(-4, 4), d = nz(-4, 4); if (a * d - b * c === 0) return GEN.hacker[6](); return { t: 'Systèmes', q: `${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)}y = ${a * x + b * y}\n${c}x ${d < 0 ? '−' : '+'} ${Math.abs(d)}y = ${c * x + d * y}\nx = ?`, ans: x, expl: `Par combinaison ou substitution : x = ${x} et y = ${y}` }; },
    () => { const u0 = R(-10, 20), r = nz(-6, 9), n = R(5, 30); return { t: 'Suites', q: `Suite arithmétique : u₀ = ${u0}, raison r = ${r}.\nu${n.toString().split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[c]).join('')} = ?`, ans: u0 + n * r, expl: `uₙ = u₀ + n × r = ${u0} + ${n} × ${par(r)} = ${u0 + n * r}` }; },
    () => { const a = R(-9, 9), b = R(-9, 9); if (a === b) return GEN.hacker[8](); return { t: 'Produit nul', q: `(x ${a < 0 ? '+' : '−'} ${Math.abs(a)})(x ${b < 0 ? '+' : '−'} ${Math.abs(b)}) = 0\nPlus grande solution ?`, ans: Math.max(a, b), expl: `Un produit est nul si un facteur est nul : x = ${a} ou x = ${b}. La plus grande : ${Math.max(a, b)}` }; },
    () => { const a = nz(-5, 5), b = R(-9, 9), c = R(-9, 9); return { t: 'Inéquations', q: `${lin(a, b)} > ${c}`, choices: shuffle([`x ${a > 0 ? '>' : '<'} ${fstr(frac(c - b, a))}`, `x ${a > 0 ? '<' : '>'} ${fstr(frac(c - b, a))}`, `x ${a > 0 ? '>' : '<'} ${fstr(frac(c + b, a))}`, `x ${a > 0 ? '>' : '<'} ${fstr(frac(b - c, a))}`]).filter((v, i, arr) => arr.indexOf(v) === i), good: `x ${a > 0 ? '>' : '<'} ${fstr(frac(c - b, a))}`, expl: `${a}x > ${c - b}. On divise par ${a}${a < 0 ? ' (négatif : le sens change !)' : ''} → x ${a > 0 ? '>' : '<'} ${fstr(frac(c - b, a))}` }; },
    () => { const a = nz(-3, 3), x0 = R(-5, 5), y0 = R(-9, 9); const b = -2 * a * x0; const c = y0 - a * x0 * x0 - b * x0; return { t: 'Parabole', q: `f(x) = ${poly([a, b, c])}\nAbscisse du sommet ?`, ans: x0, expl: `Sommet en x = −b/(2a) = ${-b}/${2 * a} = ${x0}` }; },
  ],

  /* ---------- 🔱 GOD ---------- */
  god: [
    () => { const r1 = R(-9, 9), r2 = R(-9, 9), a = pick([1, 1, 2, -1]); return { t: 'Second degré', q: `${poly([a, -a * (r1 + r2), a * r1 * r2])} = 0\nPlus petite solution ?`, ans: Math.min(r1, r2), expl: `Δ = ${a * a * (r1 + r2) ** 2 - 4 * a * a * r1 * r2} → x = ${r1} ou x = ${r2} (on peut vérifier : somme ${r1 + r2}, produit ${r1 * r2}). La plus petite : ${Math.min(r1, r2)}` }; },
    () => { const a = nz(-3, 3), b = R(-5, 5), c = nz(-3, 3), d = R(-5, 5), k = R(-3, 3); const v = a * (c * k * k + d) + (a * k + b) * 2 * c * k; return { t: 'Dérivée d\'un produit', q: `f(x) = (${lin(a, b)})(${poly([c, 0, d])})\nf'(${k}) = ?`, ans: v, expl: `(uv)' = u'v + uv' : f'(x) = ${a}(${poly([c, 0, d])}) + (${lin(a, b)})(${2 * c}x). En ${k} : ${a * (c * k * k + d)} + ${(a * k + b) * 2 * c * k} = ${v}` }; },
    () => { const a = nz(-4, 4), b = R(-6, 6), c = nz(-3, 3), d = R(-6, 6), k = R(-2, 2); const den = c * k + d; if (!den) return GEN.god[2](); const f = frac(a * d - b * c, den * den); return { t: 'Dérivée d\'un quotient', q: `f(x) = (${lin(a, b)}) / (${lin(c, d)})\nf'(${k}) = ?`, hint: 'fraction irréductible', ans: f, expl: `(u/v)' = (u'v − uv')/v² = (${a}×${par(d)} − ${par(b)}×${c}) / (${lin(c, d)})² = ${a * d - b * c}/(${den})² = ${fstr(f)}` }; },
    () => { const u0 = R(1, 5), q = pick([2, 3]), n = R(3, 7); const s = (u0 * (q ** (n + 1) - 1)) / (q - 1); return { t: 'Suites géométriques', q: `u₀ = ${u0}, raison q = ${q}.\nu₀ + u₁ + … + u${'₀₁₂₃₄₅₆₇₈₉'[n]} = ?`, ans: s, expl: `S = u₀ × (qⁿ⁺¹ − 1)/(q − 1) = ${u0} × (${q}${sup(n + 1)} − 1)/${q - 1} = ${s}` }; },
    () => { const T = [['cos(π/3)', '1/2'], ['sin(π/6)', '1/2'], ['cos(π/6)', '√3/2'], ['sin(π/3)', '√3/2'], ['cos(π/4)', '√2/2'], ['sin(π/2)', '1'], ['cos(π)', '−1'], ['cos(2π/3)', '−1/2'], ['sin(5π/6)', '1/2'], ['cos(3π/4)', '−√2/2'], ['sin(−π/6)', '−1/2'], ['cos(0)', '1'], ['sin(4π/3)', '−√3/2']]; const [q, good] = pick(T); const all = ['1/2', '−1/2', '√3/2', '−√3/2', '√2/2', '−√2/2', '1', '−1', '0']; return { t: 'Trigonométrie', q: `${q} = ?`, choices: shuffle([good, ...shuffle(all.filter((x) => x !== good)).slice(0, 3)]), good, expl: `Valeur remarquable du cercle trigonométrique : ${q} = ${good}` }; },
    () => { const a = R(-5, 9), b = R(-5, 9), c = R(-5, 9); return { t: 'Exponentielle', q: `e${sup(a)} × e${sup(b)} / e${sup(c)} = e^?`, hint: "l'exposant", ans: a + b - c, expl: `eᵃ × eᵇ = eᵃ⁺ᵇ et eᵃ / eᶜ = eᵃ⁻ᶜ : ${a} + ${par(b)} − ${par(c)} = ${a + b - c}` }; },
    () => { const a = nz(-6, 6), b = nz(-6, 6), c = nz(-6, 6), d = nz(-6, 6); return { t: 'Produit scalaire', q: `u⃗(${a} ; ${b}) · v⃗(${c} ; ${d}) = ?`, ans: a * c + b * d, expl: `u⃗·v⃗ = xx' + yy' = ${a}×${par(c)} + ${b}×${par(d)} = ${a * c + b * d}` }; },
    () => { const pa = pick([0.2, 0.3, 0.4, 0.5, 0.6]), pb = pick([0.2, 0.5, 0.25, 0.4]); return { t: 'Probabilités', q: `A et B indépendants, P(A) = ${fmt(pa)} et P(B) = ${fmt(pb)}.\nP(A ∩ B) = ?`, ans: Math.round(pa * pb * 1000) / 1000, expl: `Indépendants : P(A ∩ B) = P(A) × P(B) = ${fmt(pa)} × ${fmt(pb)} = ${fmt(Math.round(pa * pb * 1000) / 1000)}` }; },
    () => { const pab = pick([0.12, 0.1, 0.2, 0.15, 0.06]), pa = pick([0.3, 0.4, 0.5, 0.6]); const r = Math.round((pab / pa) * 1000) / 1000; return { t: 'Probabilités conditionnelles', q: `P(A ∩ B) = ${fmt(pab)} et P(A) = ${fmt(pa)}.\nP_A(B) = ? (arrondi au millième)`, ans: r, tol: 0.0015, expl: `P_A(B) = P(A ∩ B) / P(A) = ${fmt(pab)} / ${fmt(pa)} ≈ ${fmt(r)}` }; },
    () => { const a = nz(-2, 2), b = R(-4, 4), c = R(-5, 5), x0 = R(-3, 3); const fx = a * x0 * x0 + b * x0 + c, m = 2 * a * x0 + b; return { t: 'Tangente', q: `f(x) = ${poly([a, b, c])}\nTangente en x = ${x0} : y = mx + p.\np = ?`, ans: fx - m * x0, expl: `f(${x0}) = ${fx}, f'(${x0}) = ${m}. y = ${m}(x − ${par(x0)}) + ${fx}, donc p = ${fx} − ${m}×${par(x0)} = ${fx - m * x0}` }; },
    () => { const a = nz(-5, 5), b = R(-9, 9); return { t: 'Limites', q: `lim (x → +∞) de (${a}x² + ${b < 0 ? '(' + b + ')' : b}) / (x² + 1) = ?`, ans: a, expl: `On factorise par x² : le terme de plus haut degré l'emporte → ${a}/1 = ${a}` }; },
    () => { const n = R(4, 8), k = R(2, n - 2); let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); return { t: 'Combinatoire', q: `Combien de façons de choisir ${k} élèves parmi ${n} ?`, ans: c, expl: `C(${n}, ${k}) = ${n}! / (${k}! × ${n - k}!) = ${c}` }; },
  ],
};

export const LEVELS = [
  { id: 'noob', name: 'Noob', icon: '🐣', color: '#22C55E', desc: 'Calcul mental, tables, priorités', mult: 1 },
  { id: 'normal', name: 'Normal', icon: '🙂', color: '#3B82F6', desc: 'Relatifs, fractions, %, équations', mult: 2 },
  { id: 'pro', name: 'Pro', icon: '😎', color: '#A855F7', desc: 'Puissances, racines, développer', mult: 3 },
  { id: 'hacker', name: 'Hacker', icon: '💻', color: '#F97316', desc: 'Second degré, dérivées, systèmes', mult: 4 },
  { id: 'god', name: 'God', icon: '🔱', color: '#EF4444', desc: 'Trigo, exp, proba, tangentes…', mult: 5 },
];
const N_Q = 10, UNLOCK = 7;

function newQ(lvl, last) {
  for (let k = 0; k < 20; k++) {
    const q = pick(GEN[lvl])();
    if (q.choices) q.choices = q.choices.filter((v, i, a) => a.indexOf(v) === i);
    if (q.choices && q.choices.length < 2) continue;
    if (last && last.q === q.q) continue;
    return q;
  }
  return pick(GEN[lvl])();
}

// Lit ce que l'élève a tapé : « 3/4 », « -2 », « 0,75 »
function parseAns(s) {
  const t = String(s).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
  if (!t) return null;
  const m = t.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (m) { const d = parseFloat(m[2]); return d ? parseFloat(m[1]) / d : null; }
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}
function isRight(q, typed) {
  const v = parseAns(typed);
  if (v === null) return false;
  const good = typeof q.ans === 'object' ? q.ans.n / q.ans.d : q.ans;
  return Math.abs(v - good) <= (q.tol || 1e-9) + 1e-9;
}

const stats = () => (S.profil.maths = S.profil.maths || { best: {}, done: 0, good: 0, chrono: {} });
const unlocked = (i) => i === 0 || (stats().best[LEVELS[i - 1].id] || 0) >= UNLOCK || !!stats().open?.[LEVELS[i].id];

/* ================= Écran principal ================= */
export function Maths() {
  const { C } = useApp();
  const [lvl, setLvl] = useState(null);
  const [mode, setMode] = useState('serie');
  const st = stats();
  if (lvl) return <Play lvl={lvl} mode={mode} quit={() => setLvl(null)} />;
  return (
    <View>
      <Card>
        <H2>🧮 Exos de maths</H2>
        <Txt muted>Des calculs à l'infini, jamais les mêmes. Fais {UNLOCK}/{N_Q} pour débloquer le niveau suivant.</Txt>
        <Row style={{ marginTop: 12 }}>
          {[['serie', '📝 Série de 10'], ['chrono', '⏱️ Chrono 60 s']].map(([k, l]) => (
            <Btn key={k} small kind={mode === k ? 'pri' : 'sec'} label={l} onPress={() => setMode(k)} />
          ))}
        </Row>
        <Txt muted style={{ fontSize: 12, marginTop: 8 }}>{st.done} exos faits · {st.done ? Math.round((st.good / st.done) * 100) : 0} % de réussite</Txt>
      </Card>
      {LEVELS.map((L, i) => {
        const open = unlocked(i);
        const best = st.best[L.id], rec = (st.chrono || {})[L.id];
        return (
          <Pressable key={L.id} onPress={() => (open ? setLvl(L.id) : toast(`Fais ${UNLOCK}/${N_Q} au niveau ${LEVELS[i - 1].name} pour débloquer ${L.name} 🔒`, 'info'))}
            onLongPress={() => { if (!open) { st.open = { ...(st.open || {}), [L.id]: true }; commit(); toast(`${L.icon} ${L.name} débloqué`); } }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: open ? L.color : C.line, opacity: open ? 1 : 0.55, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
            <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: L.color + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 30 }}>{open ? L.icon : '🔒'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ink, fontWeight: '900', fontSize: 18 }}>{L.name} <Text style={{ color: L.color, fontSize: 13 }}>×{L.mult} XP</Text></Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>{L.desc}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {best !== undefined && <Text style={{ color: best >= UNLOCK ? C.ok : C.muted, fontWeight: '900' }}>{best}/{N_Q}</Text>}
              {rec ? <Text style={{ color: C.muted, fontSize: 11 }}>⏱️ {rec}</Text> : null}
            </View>
          </Pressable>
        );
      })}
      <Txt muted style={{ fontSize: 12, textAlign: 'center' }}>Appui long sur un niveau verrouillé pour le débloquer quand même.</Txt>
    </View>
  );
}

/* ================= Une partie ================= */
function Play({ lvl, mode, quit }) {
  const { C } = useApp();
  const L = LEVELS.find((x) => x.id === lvl);
  const [q, setQ] = useState(() => newQ(lvl));
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [res, setRes] = useState(null); // null | { ok, pickd }
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [end, setEnd] = useState(false);
  const [left, setLeft] = useState(60);
  const shake = useRef(new Animated.Value(0)).current;
  const endRef = useRef(Date.now() + 60000);
  const chrono = mode === 'chrono';

  useEffect(() => {
    if (!chrono || end) return;
    const t = setInterval(() => { const l = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000)); setLeft(l); if (l <= 0) finish(scoreRef.current); }, 250);
    return () => clearInterval(t);
  }, [chrono, end]);
  const scoreRef = useRef(0);

  const finish = (sc) => {
    if (end) return;
    setEnd(true);
    const st = stats();
    if (chrono) { st.chrono = st.chrono || {}; if (sc > (st.chrono[lvl] || 0)) { st.chrono[lvl] = sc; toast('🏆 Nouveau record !'); } }
    else {
      const before = st.best[lvl] || 0;
      if (sc > before) st.best[lvl] = sc;
      const idx = LEVELS.findIndex((x) => x.id === lvl);
      if (sc >= UNLOCK && before < UNLOCK && LEVELS[idx + 1]) setTimeout(() => toast(`🔓 Niveau ${LEVELS[idx + 1].icon} ${LEVELS[idx + 1].name} débloqué !`), 600);
    }
    addXp(sc * 3 * L.mult);
    commit();
  };

  const answer = (choice) => {
    if (res || end) return;
    const ok = q.choices ? choice === q.good : isRight(q, typed);
    const st = stats(); st.done++; if (ok) st.good++;
    if (ok) { scoreRef.current++; setScore(scoreRef.current); setCombo((c) => c + 1); }
    else { setCombo(0); Animated.sequence([10, -10, 7, -7, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true }))).start(); }
    if (chrono) {
      // en chrono : on enchaîne tout de suite
      setRes({ ok, pickd: choice, flash: true });
      setTimeout(() => { setRes(null); setTyped(''); setQ((p) => newQ(lvl, p)); setI((x) => x + 1); }, ok ? 350 : 1100);
    } else setRes({ ok, pickd: choice });
  };
  const next = () => {
    if (i + 1 >= N_Q) { finish(scoreRef.current); return; }
    setI(i + 1); setRes(null); setTyped(''); setQ((p) => newQ(lvl, p));
  };

  if (end) {
    const st = stats();
    const best = chrono ? (st.chrono || {})[lvl] : st.best[lvl];
    const great = chrono ? score >= 10 : score >= UNLOCK;
    return (
      <FadeIn>
        <Card style={{ alignItems: 'center' }}>
          <Pop trigger={1}><Text style={{ fontSize: 64 }}>{chrono ? (score >= 15 ? '🚀' : score >= 8 ? '🔥' : '💪') : score === N_Q ? '🏆' : great ? '🔥' : '💪'}</Text></Pop>
          <Text style={{ color: C.ink, fontSize: 40, fontWeight: '900' }}>{chrono ? score : `${score}/${N_Q}`}</Text>
          <Txt muted center>{chrono ? `bonnes réponses en 60 s · record : ${best || score}` : great ? 'Bien joué !' : `Encore un effort : ${UNLOCK}/${N_Q} pour valider le niveau.`}</Txt>
          <Text style={{ color: L.color, fontWeight: '900', marginTop: 6 }}>+{score * 3 * L.mult} XP</Text>
        </Card>
        <Btn label="🔁 Rejouer" onPress={() => { setEnd(false); setI(0); scoreRef.current = 0; setScore(0); setCombo(0); setRes(null); setTyped(''); setQ(newQ(lvl)); endRef.current = Date.now() + 60000; setLeft(60); }} />
        <Btn kind="ghost" label="Changer de niveau" style={{ marginTop: 10 }} onPress={quit} />
      </FadeIn>
    );
  }

  return (
    <View>
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: L.color, fontWeight: '900' }}>{L.icon} {L.name} · {q.t}</Text>
        <Text style={{ color: C.muted, fontWeight: '800' }}>{chrono ? `⏱️ ${left} s · ${score} ✓` : `${i + 1}/${N_Q} · ${score} ✓`}{combo >= 3 ? `  🔥${combo}` : ''}</Text>
      </Row>
      <Progress value={(chrono ? left / 60 : (i + (res ? 1 : 0)) / N_Q) * 100} />
      <Animated.View style={{ transform: [{ translateX: shake }] }}>
        <Card style={{ marginTop: 12, alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ color: C.ink, fontSize: q.q.length > 40 ? 19 : 26, fontWeight: '900', textAlign: 'center', lineHeight: q.q.length > 40 ? 27 : 34 }}>{q.q}</Text>
          {q.hint ? <Text style={{ color: C.muted, marginTop: 6, fontSize: 13 }}>({q.hint})</Text> : null}
          {!q.choices && (
            <View style={{ marginTop: 16, minWidth: 160, borderBottomWidth: 3, borderColor: res ? (res.ok ? C.ok : C.bad) : L.color, paddingBottom: 4 }}>
              <Text style={{ color: C.ink, fontSize: 32, fontWeight: '900', textAlign: 'center' }}>{typed || ' '}</Text>
            </View>
          )}
        </Card>
      </Animated.View>

      {q.choices ? (
        <View>
          {q.choices.map((c) => {
            const isGood = res && c === q.good, isBad = res && c === res.pickd && !res.ok;
            return (
              <Pressable key={c} onPress={() => answer(c)} style={({ pressed }) => ({ padding: 16, borderRadius: 16, marginBottom: 8, borderWidth: 2, borderColor: isGood ? C.ok : isBad ? C.bad : C.line, backgroundColor: isGood ? C.okSoft : isBad ? C.badSoft : C.card, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                <Text style={{ color: C.ink, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : !res || chrono ? <Keypad value={typed} onChange={setTyped} onOk={() => typed && answer()} color={L.color} /> : null}

      {res && !chrono && (
        <FadeIn>
          <Fb ok={res.ok}>
            <Txt bold>{res.ok ? pick(['Bien vu ! ✅', 'Exact ! 🎯', 'Parfait ! 🔥', 'Carton plein ! 💯']) : `Raté… la réponse : ${q.choices ? q.good : fstrAny(q.ans)}`}</Txt>
            <Txt muted style={{ marginTop: 4 }}>{q.expl}</Txt>
          </Fb>
          <Btn label={i + 1 >= N_Q ? 'Voir mon score' : 'Suivant →'} style={{ marginTop: 10 }} onPress={next} />
        </FadeIn>
      )}
      {res && chrono && !res.ok && <Txt muted center style={{ marginTop: 6 }}>Réponse : {q.choices ? q.good : fstrAny(q.ans)}</Txt>}
      {!res && <Btn kind="ghost" small label="Abandonner" style={{ marginTop: 14, alignSelf: 'center' }} onPress={quit} />}
    </View>
  );
}
const fstrAny = (a) => (typeof a === 'object' ? fstr(a) : fmt(a));

/* ================= Pavé numérique ================= */
function Keypad({ value, onChange, onOk, color }) {
  const { C } = useApp();
  const press = (k) => {
    if (k === '⌫') return onChange(value.slice(0, -1));
    if (k === '±') return onChange(value.startsWith('-') ? value.slice(1) : '-' + value);
    if (value.length >= 12) return;
    if (k === ',' && /[,]/.test(value.split('/').pop())) return;
    if (k === '/' && (value.includes('/') || !value || value === '-')) return;
    onChange(value + k);
  };
  // au clavier de l'ordinateur aussi (version web)
  const ref = useRef({ value, onOk }); ref.current = { value, onOk };
  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const h = (e) => {
      const k = e.key;
      if (/^[0-9]$/.test(k)) press(k);
      else if (k === ',' || k === '.') press(',');
      else if (k === '/') press('/');
      else if (k === '-') press('±');
      else if (k === 'Backspace') press('⌫');
      else if (k === 'Enter') ref.current.value && ref.current.onOk();
      else return;
      e.preventDefault && e.preventDefault();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  const rows = [['7', '8', '9', '⌫'], ['4', '5', '6', '/'], ['1', '2', '3', ','], ['±', '0', 'OK']];
  return (
    <View style={{ marginTop: 6 }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {r.map((k) => {
            const ok = k === 'OK';
            return (
              <Pressable key={k} onPress={() => (ok ? onOk() : press(k))}
                style={({ pressed }) => ({ flex: ok ? 2.08 : 1, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: ok ? color : C.card, borderWidth: ok ? 0 : 1, borderColor: C.line, transform: [{ scale: pressed ? 0.93 : 1 }] })}>
                <Text style={{ color: ok ? '#fff' : C.ink, fontSize: ok ? 18 : 24, fontWeight: '900' }}>{ok ? 'Valider' : k}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// Pour les tests : tous les générateurs
export const _GEN = GEN;
export const _isRight = isRight;
