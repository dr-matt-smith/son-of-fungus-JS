import { S } from './state.js';

// ── JSON serialisation ───────────────────────────────────────────────────────

export function serialiseDiagram() {
  return {
    variables: S.variables.map(v => ({ name: v.name, type: v.type, value: v.value, ...(v.enumName ? { enumName: v.enumName } : {}) })),
    messages: [...S.messages],
    enums: S.enums.map(e => ({ name: e.name, values: e.values.map(v => ({ key: v.key, label: v.label })) })),
    characters: S.characters.map(c => ({ name: c.name, color: c.color, soundUrl: c.soundUrl, portraits: c.portraits || [] })),
    nodes: S.nodes.map(n => ({
      id: n.id,
      type: n.type,
      x: Math.round(n.x),
      y: Math.round(n.y),
      w: n.w,
      h: n.h,
      label: n.label || undefined,
      event: n.event,
      commands: n.commands,
    })),
    connections: S.connections.map(c => ({
      id: c.id,
      fromId: c.fromId,
      toId: c.toId,
      label: c.label,
      ...(c.danglingFrom ? { danglingFrom: c.danglingFrom } : {}),
      ...(c.danglingTo   ? { danglingTo:   c.danglingTo }   : {}),
    })),
  };
}
