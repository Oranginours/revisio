// Glisser-déposer une tâche vers quelqu'un d'autre (appui long, puis on glisse sur un avatar).
import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { View, Text, Animated, PanResponder } from 'react-native';
import { C, Avatar } from './ui';

const DragCtx = createContext(null);
export const useDrag = () => useContext(DragCtx);

export function DragProvider({ children, members, onDrop, onState }) {
  const [drag, setDragS] = useState(null); // { uid, i, t }
  const dragRef = useRef(null);
  const setDrag = (d) => { dragRef.current = d; setDragS(d); };
  const [hover, setHover] = useState(null);
  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const zones = useRef({});
  const hoverRef = useRef(null);
  const hit = (x, y) => {
    for (const [uid, r] of Object.entries(zones.current)) {
      if (r && x >= r.x - 6 && x <= r.x + r.w + 6 && y >= r.y - 16 && y <= r.y + r.h + 16) return uid;
    }
    return null;
  };
  const api = {
    drag,
    start: (info, x, y) => { zones.current = {}; pos.setValue({ x, y }); hoverRef.current = null; setHover(null); setDrag(info); onState && onState(true); },
    move: (x, y) => { pos.setValue({ x, y }); const h = hit(x, y); if (h !== hoverRef.current) { hoverRef.current = h; setHover(h); } },
    end: (x, y) => {
      const target = x === undefined ? hoverRef.current : hit(x, y) || hoverRef.current;
      const d = dragRef.current;
      setDrag(null); setHover(null); hoverRef.current = null; onState && onState(false);
      if (d && target && target !== d.uid) onDrop(d, target);
    },
    cancel: () => { setDrag(null); setHover(null); hoverRef.current = null; onState && onState(false); },
  };
  const targets = drag ? members.filter((m) => m.id !== drag.uid && m.active !== false) : [];
  return (
    <DragCtx.Provider value={api}>
      {children}
      {drag && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
          <View style={{ position: 'absolute', left: 12, right: 12, bottom: 96, backgroundColor: '#0B0F18', borderRadius: 22, borderWidth: 2, borderColor: C.green, padding: 12, maxWidth: 640, alignSelf: 'center' }}>
            <Text style={{ color: C.muted, fontWeight: '800', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>DÉPOSE LA TÂCHE SUR QUELQU'UN</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              {targets.map((m) => (
                <Zone key={m.id} m={m} on={hover === m.id} reg={(r) => { zones.current[m.id] = r; }} />
              ))}
            </View>
          </View>
          <Animated.View style={{ position: 'absolute', left: -110, top: -34, transform: [{ translateX: pos.x }, { translateY: pos.y }] }}>
            <View style={{ width: 220, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card2, borderRadius: 16, padding: 12, borderWidth: 2, borderColor: C.green, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, elevation: 12, transform: [{ rotate: '-3deg' }] }}>
              <Text style={{ fontSize: 22 }}>{drag.t.e}</Text>
              <Text numberOfLines={2} style={{ color: C.ink, fontWeight: '800', flex: 1 }}>{drag.t.n}</Text>
            </View>
          </Animated.View>
        </View>
      )}
    </DragCtx.Provider>
  );
}

function Zone({ m, on, reg }) {
  const ref = useRef(null);
  const measure = () => { if (ref.current && ref.current.measureInWindow) ref.current.measureInWindow((x, y, w, h) => reg({ x, y, w, h })); };
  return (
    <View ref={ref} onLayout={() => setTimeout(measure, 30)} style={{ alignItems: 'center', width: 68, transform: [{ scale: on ? 1.2 : 1 }] }}>
      <View style={{ borderRadius: 30, borderWidth: on ? 3 : 0, borderColor: C.green, padding: on ? 2 : 5 }}>
        <Avatar m={m} size={46} />
      </View>
      <Text numberOfLines={1} style={{ color: on ? C.green : C.ink, fontWeight: '800', fontSize: 12, marginTop: 4 }}>{m.name}</Text>
    </View>
  );
}

// Enveloppe une ligne de tâche : appui long pour l'attraper, puis glisser
export function Draggable({ uid, i, t, enabled, children }) {
  const dnd = useDrag();
  const active = useRef(false);
  const grabbed = useRef(false);
  const dndRef = useRef(dnd); dndRef.current = dnd;
  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture: () => active.current,
    onMoveShouldSetPanResponder: () => active.current,
    onPanResponderGrant: () => { grabbed.current = true; },
    onPanResponderMove: (e, g) => dndRef.current.move(g.moveX, g.moveY),
    onPanResponderRelease: (e, g) => { active.current = false; grabbed.current = false; dndRef.current.end(g.moveX, g.moveY); },
    onPanResponderTerminate: () => { active.current = false; grabbed.current = false; dndRef.current.cancel(); },
    onPanResponderTerminationRequest: () => false,
  })).current;
  if (!enabled || !dnd) return children;
  return (
    <View {...pr.panHandlers}>
      {React.cloneElement(children, {
        delayLongPress: 350,
        onLongPress: (e) => { active.current = true; grabbed.current = false; dnd.start({ uid, i, t }, e.nativeEvent.pageX, e.nativeEvent.pageY); },
        onPressOut: () => { if (!active.current) return; setTimeout(() => { if (active.current && !grabbed.current) { active.current = false; dndRef.current.cancel(); } }, 80); },
      })}
    </View>
  );
}
