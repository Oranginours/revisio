// Composants visuels de Corvéo (thème sombre, barres de progression façon jeu).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Animated, Easing, Platform, Alert } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const C = {
  bg: '#0F1420', card: '#1A2131', card2: '#232C40', line: '#2C364D', ink: '#F1F5F9', muted: '#8A93A6',
  green: '#44D62C', greenDark: '#2E9E1C', red: '#EF4444', yellow: '#FACC15', blue: '#60A5FA', pri: '#44D62C',
};

/* ---------- Confirmation (marche aussi dans le navigateur) ---------- */
export function ask(title, msg, buttons) {
  if (!isWeb) return Alert.alert(title, msg, buttons);
  const b = buttons || [{ text: 'OK' }];
  const ok = b.find((x) => x.style !== 'cancel');
  if (b.length === 1) { window.alert(`${title}\n\n${msg || ''}`); if (ok && ok.onPress) ok.onPress(); return; }
  if (window.confirm(`${title}\n\n${msg || ''}`)) { if (ok && ok.onPress) ok.onPress(); } else { const c = b.find((x) => x.style === 'cancel'); if (c && c.onPress) c.onPress(); }
}

/* ---------- Petit message en bas ---------- */
let toastFn = null;
export const toast = (msg, kind) => toastFn && toastFn(msg, kind);
export function ToastHost() {
  const [m, setM] = useState(null);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let t;
    toastFn = (msg, kind) => {
      setM({ msg, kind }); v.setValue(0);
      Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 16 }).start();
      clearTimeout(t); t = setTimeout(() => Animated.timing(v, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setM(null)), 2400);
    };
    return () => { toastFn = null; clearTimeout(t); };
  }, []);
  if (!m) return null;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: 110, alignItems: 'center', opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
      <View style={{ backgroundColor: m.kind === 'bad' ? C.red : '#F8FAFC', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, maxWidth: 520 }}>
        <Text style={{ color: m.kind === 'bad' ? '#fff' : '#0F1420', fontWeight: '800', textAlign: 'center' }}>{m.msg}</Text>
      </View>
    </Animated.View>
  );
}

/* ---------- Textes ---------- */
export const Txt = ({ style, muted, bold, center, ...p }) => (
  <Text {...p} style={[{ color: muted ? C.muted : C.ink, fontSize: 15, lineHeight: 21, fontWeight: bold ? '800' : '400', textAlign: center ? 'center' : 'left' }, style]} />
);
export const H1 = ({ style, ...p }) => <Text {...p} style={[{ color: C.ink, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }, style]} />;
export const H2 = ({ style, ...p }) => <Text {...p} style={[{ color: C.ink, fontSize: 19, fontWeight: '900', marginBottom: 8 }, style]} />;
export const Label = ({ children }) => <Text style={{ color: C.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 14, marginBottom: 6 }}>{String(children).toUpperCase()}</Text>;
export const Card = ({ style, ...p }) => <View {...p} style={[{ backgroundColor: C.card, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line }, style]} />;
export const Row = ({ style, ...p }) => <View {...p} style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, style]} />;

export function Btn({ label, onPress, kind = 'pri', small, style, disabled }) {
  const bg = { pri: C.green, sec: C.card2, ghost: 'transparent', danger: '#3B1518' }[kind];
  const fg = { pri: '#0B1A06', sec: C.ink, ghost: C.muted, danger: '#FCA5A5' }[kind];
  return (
    <Pressable onPress={disabled ? null : onPress}
      style={({ pressed }) => [{ backgroundColor: bg, paddingVertical: small ? 9 : 14, paddingHorizontal: small ? 14 : 20, borderRadius: small ? 12 : 16, alignItems: 'center', opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.96 : 1 }],
        borderBottomWidth: kind === 'pri' ? 4 : 0, borderBottomColor: C.greenDark }, style]}>
      <Text style={{ color: fg, fontWeight: '900', fontSize: small ? 14 : 16 }}>{label}</Text>
    </Pressable>
  );
}
export function Input(props) {
  const [f, setF] = useState(false);
  return (
    <TextInput placeholderTextColor="#5B6478" {...props}
      onFocus={(e) => { setF(true); props.onFocus && props.onFocus(e); }} onBlur={(e) => { setF(false); props.onBlur && props.onBlur(e); }}
      style={[{ backgroundColor: C.bg, color: C.ink, borderWidth: 2, borderColor: f ? C.green : C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 }, props.style]} />
  );
}
export const Err = ({ children }) => (children ? <Text style={{ color: '#FCA5A5', marginTop: 10, fontWeight: '700' }}>{children}</Text> : null);

export function Stepper({ value, onChange, min = 0, max = 30, fmt }) {
  const B = ({ d, l }) => (
    <Pressable onPress={() => onChange(Math.max(min, Math.min(max, value + d)))} hitSlop={6}
      style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 12, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.9 : 1 }] })}>
      <Text style={{ color: C.ink, fontSize: 22, fontWeight: '900' }}>{l}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <B d={-1} l="−" />
      <Text style={{ color: C.ink, fontSize: 18, fontWeight: '900', minWidth: 80, textAlign: 'center' }}>{fmt ? fmt(value) : value}</Text>
      <B d={1} l="+" />
    </View>
  );
}

export function Pop({ trigger, children, style }) {
  const v = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } v.setValue(0.7); Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 16 }).start(); }, [trigger]);
  return <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>;
}

/* ---------- La barre de tâches façon jeu ---------- */
export function TaskBar({ label, done, total, small }) {
  const ratio = total ? done / total : 0;
  const v = useRef(new Animated.Value(ratio)).current;
  useEffect(() => { Animated.timing(v, { toValue: ratio, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [ratio]);
  const H = small ? 22 : 36;
  const outline = { textShadowColor: '#000', textShadowRadius: 3, textShadowOffset: { width: 1, height: 1 } };
  return (
    <View style={{ marginBottom: small ? 0 : 10 }}>
      <View style={{ height: H, backgroundColor: '#3A3F4B', borderWidth: small ? 2 : 3, borderColor: '#000', borderRadius: small ? 4 : 6, overflow: 'hidden', justifyContent: 'center' }}>
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: C.green }}>
          <View style={{ height: '35%', backgroundColor: 'rgba(255,255,255,0.22)' }} />
        </Animated.View>
        {/* petites graduations */}
        {!small && total > 1 && total <= 40 && Array.from({ length: total - 1 }).map((_, i) => (
          <View key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${((i + 1) / total) * 100}%`, width: 1, backgroundColor: 'rgba(0,0,0,0.25)' }} />
        ))}
        {!!label && <Text numberOfLines={1} style={[{ position: 'absolute', left: 10, right: 10, color: '#fff', fontWeight: '900', fontSize: small ? 11 : 14, letterSpacing: 1 }, outline]}>{label}</Text>}
        <Text style={[{ position: 'absolute', right: 10, color: '#fff', fontWeight: '900', fontSize: small ? 11 : 14 }, outline]}>{done}/{total}</Text>
      </View>
    </View>
  );
}

export function Avatar({ m, size = 44 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: (m && m.color) || C.card2, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#000' }}>
      <Text style={{ fontSize: size * 0.5 }}>{(m && m.avatar) || '🙂'}</Text>
    </View>
  );
}
export const Chip = ({ children, color = C.card2, ink = C.ink }) => (
  <View style={{ backgroundColor: color, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: ink, fontWeight: '800', fontSize: 12 }}>{children}</Text></View>
);
