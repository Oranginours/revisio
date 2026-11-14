// Couleurs et petits composants réutilisés partout.
import React, { createContext, useContext } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';

export const LIGHT = { bg: '#f4f7fb', card: '#ffffff', ink: '#1c2533', muted: '#5d6b80', line: '#dde4ee', pri: '#2563eb', priSoft: '#e6eeff', ok: '#15803d', okSoft: '#e3f6e9', bad: '#c2410c', badSoft: '#fdeee5', warn: '#a16207', warnSoft: '#fdf6dc' };
export const DARK = { bg: '#10151d', card: '#1a212c', ink: '#e8edf5', muted: '#9aa7ba', line: '#2c3644', pri: '#6b9bff', priSoft: '#1e2c47', ok: '#4ade80', okSoft: '#173225', bad: '#fb923c', badSoft: '#3a2416', warn: '#facc15', warnSoft: '#3a3214' };

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

// Texte qui comprend <sub>, <sup>, <b>, <i> et les retours à la ligne
export function Rich({ children, style }) {
  const { C } = useApp();
  const flat = StyleSheet.flatten([{ color: C.ink, fontSize: 16, lineHeight: 22 }, style]);
  const parts = String(children ?? '').split(/(<\/?(?:sub|sup|b|i)>)/);
  let st = { b: 0, i: 0, sub: 0, sup: 0 };
  const out = [];
  parts.forEach((p, k) => {
    const m = p.match(/^<(\/?)(sub|sup|b|i)>$/);
    if (m) { st = { ...st, [m[2]]: Math.max(0, st[m[2]] + (m[1] ? -1 : 1)) }; return; }
    if (!p) return;
    out.push(
      <Text key={k} style={[st.b > 0 && { fontWeight: '700' }, st.i > 0 && { fontStyle: 'italic' }, (st.sub > 0 || st.sup > 0) && { fontSize: flat.fontSize * 0.7 }]}>
        {p}
      </Text>
    );
  });
  return <Text style={flat}>{out}</Text>;
}

export function Txt({ children, muted, style, bold, center }) {
  const { C } = useApp();
  return <Text style={[{ color: muted ? C.muted : C.ink, fontSize: muted ? 14 : 16, lineHeight: muted ? 20 : 22 }, bold && { fontWeight: '700' }, center && { textAlign: 'center' }, style]}>{children}</Text>;
}
export function H2({ children, style }) {
  const { C } = useApp();
  return <Text style={[{ color: C.ink, fontSize: 18, fontWeight: '700', marginBottom: 10 }, style]}>{children}</Text>;
}
export function Card({ children, style }) {
  const { C } = useApp();
  return <View style={[{ backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 }, style]}>{children}</View>;
}
export function Row({ children, style }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, style]}>{children}</View>;
}
export function Btn({ label, onPress, kind = 'pri', flex, disabled, small, style }) {
  const { C } = useApp();
  const bg = { pri: C.pri, sec: C.priSoft, ghost: 'transparent', danger: C.bad }[kind];
  const fg = { pri: '#fff', sec: C.pri, ghost: C.muted, danger: '#fff' }[kind];
  return (
    <Pressable onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [{ backgroundColor: bg, paddingVertical: small ? 7 : 11, paddingHorizontal: small ? 10 : 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        kind === 'ghost' && { borderWidth: 1, borderColor: C.line }, flex && { flex: 1 }, style]}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 14 : 15, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}
export function Opt({ label, state, onPress, center }) {
  const { C } = useApp();
  const bg = state === 'good' ? C.okSoft : state === 'wrong' ? C.badSoft : C.bg;
  const bc = state === 'good' ? C.ok : state === 'wrong' ? C.bad : C.line;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ backgroundColor: bg, borderColor: bc, borderWidth: 1, borderRadius: 10, padding: 12, marginVertical: 4, opacity: pressed ? 0.8 : 1 }, center && { flex: 1, alignItems: 'center' }]}>
      <Rich style={{ fontSize: 15 }}>{label}</Rich>
    </Pressable>
  );
}
export function Fb({ ok, children }) {
  const { C } = useApp();
  return <View style={{ backgroundColor: ok ? C.okSoft : C.badSoft, borderLeftWidth: 4, borderLeftColor: ok ? C.ok : C.bad, padding: 12, borderRadius: 10, marginTop: 10 }}>{children}</View>;
}
export function Note({ children }) {
  const { C } = useApp();
  return <View style={{ backgroundColor: C.warnSoft, borderLeftWidth: 4, borderLeftColor: C.warn, padding: 12, borderRadius: 8, marginBottom: 10 }}>{children}</View>;
}
export function Progress({ value, color }) {
  const { C } = useApp();
  return <View style={{ height: 8, backgroundColor: C.line, borderRadius: 99, overflow: 'hidden', marginVertical: 8 }}><View style={{ height: '100%', width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color || C.pri }} /></View>;
}
export function Chip({ children, color }) {
  const { C } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 99, backgroundColor: C.priSoft }}>
      {color ? <Dot color={color} /> : null}
      <Text style={{ color: C.ink, fontSize: 13, fontWeight: '600' }}>{children}</Text>
    </View>
  );
}
export function Dot({ color, size = 10 }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}
export function DsBadge({ info }) {
  const { C } = useApp();
  if (!info) return null;
  const s = { hot: [C.badSoft, C.bad], warm: [C.warnSoft, C.warn], ok: [C.priSoft, C.pri], past: [C.line, C.muted] }[info.lvl];
  return <View style={{ backgroundColor: s[0], paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 }}><Text style={{ color: s[1], fontWeight: '700', fontSize: 12 }}>{info.label}</Text></View>;
}
export function Label({ children }) {
  const { C } = useApp();
  return <Text style={{ color: C.muted, fontSize: 14, marginTop: 12, marginBottom: 4 }}>{children}</Text>;
}
export function Input(props) {
  const { C } = useApp();
  return (
    <TextInput placeholderTextColor={C.muted} {...props}
      style={[{ borderWidth: 1, borderColor: C.line, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9, fontSize: 16, color: C.ink, backgroundColor: C.bg }, props.multiline && { minHeight: 120, textAlignVertical: 'top' }, props.style]} />
  );
}
export function Err({ children }) {
  const { C } = useApp();
  return children ? <Text style={{ color: C.bad, fontSize: 13, marginTop: 6 }}>{children}</Text> : null;
}
