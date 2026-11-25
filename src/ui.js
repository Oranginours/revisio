// Couleurs, animations et petits composants réutilisés partout.
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Animated, Easing, Alert, Platform } from 'react-native';

// Palette du logo Révisio (indigo + lavande). La couleur principale peut être changée dans les réglages.
export const LIGHT = { bg: '#F4F4F8', card: '#FFFFFF', ink: '#14151F', muted: '#6B7080', line: '#E6E7EE', pri: '#4F46E5', priSoft: '#EEF0FF', priInk: '#3730A3', soft: '#C7D2FE', ok: '#16A34A', okSoft: '#E7F7EC', bad: '#E5484D', badSoft: '#FDECEC', warn: '#B7791F', warnSoft: '#FFF6E0', shadow: 0.06, dark: false };
export const DARK = { bg: '#0E1016', card: '#181B24', ink: '#ECEEF5', muted: '#9097A8', line: '#262A36', pri: '#7C74FF', priSoft: '#23244A', priInk: '#C7D2FE', soft: '#3B3F8F', ok: '#4ADE80', okSoft: '#16301F', bad: '#FF6B6B', badSoft: '#3A1C1C', warn: '#F5C451', warnSoft: '#3A3016', shadow: 0, dark: true };
export const ACCENTS = [['indigo', '#4F46E5'], ['violet', '#7C3AED'], ['bleu', '#2563EB'], ['vert', '#059669'], ['rose', '#DB2777'], ['orange', '#EA580C']];
// Mélange deux couleurs hexadécimales (t = part de la 2e couleur)
export function mix(a, b, t) {
  const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
  const [r1, g1, b1] = h(a), [r2, g2, b2] = h(b);
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return '#' + c(r1, r2) + c(g1, g2) + c(b1, b2);
}
export function makeTheme(dark, accentName) {
  const acc = (ACCENTS.find((a) => a[0] === accentName) || ACCENTS[0])[1];
  if (accentName === 'indigo' || !accentName) return dark ? DARK : LIGHT;
  return dark
    ? { ...DARK, pri: mix(acc, '#FFFFFF', 0.25), priSoft: mix(acc, '#0E1016', 0.72), priInk: mix(acc, '#FFFFFF', 0.7), soft: mix(acc, '#0E1016', 0.45) }
    : { ...LIGHT, pri: acc, priSoft: mix(acc, '#FFFFFF', 0.9), priInk: mix(acc, '#000000', 0.35), soft: mix(acc, '#FFFFFF', 0.7) };
}

/* ---------- messages éphémères (toasts) et « tirer pour actualiser » ---------- */
let toastFn = null;
export const setToastFn = (f) => { toastFn = f; };
// toast('Ajouté ✨') ou toast('Pas de connexion', 'bad')
export const toast = (msg, kind = 'ok') => { if (toastFn) toastFn(String(msg), kind); };
// L'écran affiché enregistre ici sa fonction d'actualisation (emploi du temps, notes)
export const pull = { fn: null };

export const isWeb = Platform.OS === 'web';
// Boîte de confirmation qui marche aussi dans le navigateur (Alert ne fait rien sur le web)
export function ask(title, msg, buttons) {
  if (!isWeb) return Alert.alert(title, msg, buttons);
  const act = (buttons || []).filter((b) => b.style !== 'cancel');
  if (!act.length) { window.alert(title + (msg ? '\n\n' + msg : '')); return; }
  if (window.confirm(title + (msg ? '\n\n' + msg : ''))) act[act.length - 1].onPress && act[act.length - 1].onPress();
  else { const c = (buttons || []).find((b) => b.style === 'cancel'); if (c && c.onPress) c.onPress(); }
}

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

/* ---------- animations ---------- */
// Petit rebond quand on appuie
export function useScale() {
  const v = useRef(new Animated.Value(1)).current;
  return {
    style: { transform: [{ scale: v }] },
    onPressIn: () => Animated.spring(v, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 0 }).start(),
    onPressOut: () => Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }).start(),
  };
}
// Apparition en glissant (pour les cartes et les messages)
export function FadeIn({ children, delay = 0, style, from = 12 }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 280, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, []);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>{children}</Animated.View>;
}
// Fait « pop » un élément à chaque changement de `trigger`
export function Pop({ trigger, children, style }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => { v.setValue(0.6); Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }).start(); }, [trigger]);
  return <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>;
}

// Texte qui comprend <sub>, <sup>, <b>, <i> et les retours à la ligne
export function Rich({ children, style }) {
  const { C } = useApp();
  const flat = StyleSheet.flatten([{ color: C.ink, fontSize: 16, lineHeight: 23 }, style]);
  const parts = String(children ?? '').split(/(<\/?(?:sub|sup|b|i)>)/);
  let st = { b: 0, i: 0, sub: 0, sup: 0 };
  const out = [];
  parts.forEach((p, k) => {
    const m = p.match(/^<(\/?)(sub|sup|b|i)>$/);
    if (m) { st = { ...st, [m[2]]: Math.max(0, st[m[2]] + (m[1] ? -1 : 1)) }; return; }
    if (!p) return;
    out.push(<Text key={k} style={[st.b > 0 && { fontWeight: '700' }, st.i > 0 && { fontStyle: 'italic' }, (st.sub > 0 || st.sup > 0) && { fontSize: flat.fontSize * 0.7 }]}>{p}</Text>);
  });
  return <Text style={flat}>{out}</Text>;
}

export function Txt({ children, muted, style, bold, center }) {
  const { C } = useApp();
  return <Text style={[{ color: muted ? C.muted : C.ink, fontSize: muted ? 14 : 16, lineHeight: muted ? 20 : 23 }, bold && { fontWeight: '700' }, center && { textAlign: 'center' }, style]}>{children}</Text>;
}
export function H2({ children, style }) {
  const { C } = useApp();
  return <Text style={[{ color: C.ink, fontSize: 19, fontWeight: '800', marginBottom: 10, letterSpacing: -0.3 }, style]}>{children}</Text>;
}
export function Card({ children, style }) {
  const { C } = useApp();
  return (
    <View style={[{ backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: C.shadow ? 0 : 1, borderColor: C.line,
      shadowColor: '#1B1D3A', shadowOpacity: C.shadow, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: C.shadow ? 2 : 0 }, style]}>
      {children}
    </View>
  );
}
export function Row({ children, style }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, style]}>{children}</View>;
}
export function Btn({ label, onPress, kind = 'pri', flex, disabled, small, style }) {
  const { C } = useApp();
  const sc = useScale();
  const bg = { pri: C.pri, sec: C.priSoft, ghost: 'transparent', danger: C.bad, white: '#FFFFFF' }[kind];
  const fg = { pri: '#fff', sec: C.priInk, ghost: C.muted, danger: '#fff', white: C.pri }[kind];
  return (
    <Animated.View style={[sc.style, flex && { flex: 1 }, style]}>
      <Pressable onPress={disabled ? undefined : onPress} onPressIn={sc.onPressIn} onPressOut={sc.onPressOut}
        style={[{ backgroundColor: bg, paddingVertical: small ? 8 : 13, paddingHorizontal: small ? 12 : 18, borderRadius: small ? 12 : 14, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1 },
          kind === 'ghost' && { borderWidth: 1, borderColor: C.line }]}>
        <Text style={{ color: fg, fontWeight: '800', fontSize: small ? 14 : 16, textAlign: 'center' }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}
// Bouton rond avec une icône et un petit texte dessous (barre d'actions)
export function IconBtn({ icon, label, onPress }) {
  const { C } = useApp();
  const sc = useScale();
  return (
    <Pressable onPress={onPress} onPressIn={sc.onPressIn} onPressOut={sc.onPressOut} style={{ alignItems: 'center', flex: 1 }}>
      <Animated.View style={[sc.style, { width: 50, height: 50, borderRadius: 16, backgroundColor: C.priSoft, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </Animated.View>
      <Text style={{ color: C.muted, fontSize: 11, marginTop: 4, fontWeight: '600' }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}
// Choix de réponse : rebondit si juste, tremble si faux
export function Opt({ label, state, onPress, center, letter }) {
  const { C } = useApp();
  const sc = useScale();
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state === 'wrong') Animated.sequence([-8, 8, -6, 6, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 55, useNativeDriver: true }))).start();
    if (state === 'good') { pop.setValue(0.94); Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 16 }).start(); }
  }, [state]);
  const bg = state === 'good' ? C.okSoft : state === 'wrong' ? C.badSoft : C.card;
  const bc = state === 'good' ? C.ok : state === 'wrong' ? C.bad : C.line;
  const badgeBg = state === 'good' ? C.ok : state === 'wrong' ? C.bad : C.priSoft;
  return (
    <Animated.View style={[center && { flex: 1 }, { transform: [{ translateX: shake }, { scale: Animated.multiply(pop, sc.style.transform[0].scale) }] }]}>
      <Pressable onPress={onPress} onPressIn={sc.onPressIn} onPressOut={sc.onPressOut}
        style={[{ backgroundColor: bg, borderColor: bc, borderWidth: 1.5, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 14, marginVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 12 }, center && { justifyContent: 'center' }]}>
        {letter ? (
          <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: badgeBg, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: state ? '#fff' : C.priInk, fontWeight: '800' }}>{state === 'good' ? '✓' : state === 'wrong' ? '✕' : letter}</Text>
          </View>
        ) : null}
        <View style={center ? null : { flex: 1 }}><Rich style={{ fontSize: 16, fontWeight: center ? '800' : '500' }}>{label}</Rich></View>
      </Pressable>
    </Animated.View>
  );
}
export function Fb({ ok, children }) {
  const { C } = useApp();
  return (
    <FadeIn>
      <View style={{ backgroundColor: ok ? C.okSoft : C.badSoft, padding: 14, borderRadius: 16, marginTop: 10 }}>{children}</View>
    </FadeIn>
  );
}
export function Note({ children }) {
  const { C } = useApp();
  return <View style={{ backgroundColor: C.warnSoft, padding: 14, borderRadius: 16, marginBottom: 12 }}>{children}</View>;
}
export function Progress({ value, color, height = 10 }) {
  const { C } = useApp();
  const v = useRef(new Animated.Value(value)).current;
  useEffect(() => { Animated.timing(v, { toValue: value, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [value]);
  const w = v.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  return <View style={{ height, backgroundColor: C.line, borderRadius: 99, overflow: 'hidden', marginVertical: 8 }}><Animated.View style={{ height: '100%', width: w, backgroundColor: color || C.pri, borderRadius: 99 }} /></View>;
}
export function Chip({ children, color, style }) {
  const { C } = useApp();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 99, backgroundColor: C.priSoft }, style]}>
      {color ? <Dot color={color} /> : null}
      <Text style={{ color: C.priInk, fontSize: 13, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}
export function Dot({ color, size = 10 }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}
export function DsBadge({ info }) {
  const { C } = useApp();
  if (!info) return null;
  const s = { hot: [C.badSoft, C.bad], warm: [C.warnSoft, C.warn], ok: [C.priSoft, C.priInk], past: [C.line, C.muted] }[info.lvl];
  return <View style={{ backgroundColor: s[0], paddingVertical: 4, paddingHorizontal: 9, borderRadius: 10 }}><Text style={{ color: s[1], fontWeight: '800', fontSize: 12 }}>{info.label}</Text></View>;
}
export function Label({ children }) {
  const { C } = useApp();
  return <Text style={{ color: C.muted, fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{children}</Text>;
}
export function Input(props) {
  const { C } = useApp();
  return (
    <TextInput placeholderTextColor={C.muted} {...props}
      style={[{ minWidth: 0, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: C.ink, backgroundColor: C.card }, props.multiline && { minHeight: 120, textAlignVertical: 'top' }, props.style]} />
  );
}
export function Err({ children }) {
  const { C } = useApp();
  return children ? <Text style={{ color: C.bad, fontSize: 13, marginTop: 6, fontWeight: '600' }}>{children}</Text> : null;
}

// Affiche les toasts en haut de l'écran, en glissant
export function ToastHost({ C, top }) {
  const [m, setM] = React.useState(null);
  const y = useRef(new Animated.Value(-120)).current;
  const timer = useRef(null);
  useEffect(() => {
    setToastFn((msg, kind) => {
      clearTimeout(timer.current);
      setM({ msg, kind, k: Date.now() });
      y.setValue(-120);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
      timer.current = setTimeout(() => Animated.timing(y, { toValue: -140, duration: 220, useNativeDriver: true }).start(() => setM(null)), kind === 'bad' ? 4200 : 2600);
    });
    return () => setToastFn(null);
  }, []);
  if (!m) return null;
  const bg = m.kind === 'bad' ? C.bad : m.kind === 'info' ? C.ink : C.ok;
  return (
    <Animated.View pointerEvents="box-none" style={{ position: 'absolute', left: 14, right: 14, top: top + 6, transform: [{ translateY: y }], zIndex: 50 }}>
      <Pressable onPress={() => Animated.timing(y, { toValue: -140, duration: 180, useNativeDriver: true }).start(() => setM(null))}
        style={{ backgroundColor: bg, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
        <Text style={{ color: C.dark && m.kind === 'info' ? C.bg : '#fff', fontWeight: '800', fontSize: 15 }}>{m.msg}</Text>
      </Pressable>
    </Animated.View>
  );
}
