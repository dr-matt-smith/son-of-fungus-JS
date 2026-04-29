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

// ── Path normalisation on load ──────────────────────────────────────────────
//
// Older saved projects store absolute paths like "/audio/foo.mp3" that only
// resolve correctly when the page is served at the site root. Relative paths
// ("audio/foo.mp3") resolve against document.baseURI and work at any sub-path.
// Strip the leading "/" from any path that points into audio/ or images/.

const RELATIVE_PREFIXES = ['/audio/', '/images/'];

function relativisePath(value) {
  if (typeof value !== 'string') return value;
  for (const prefix of RELATIVE_PREFIXES) {
    if (value.startsWith(prefix)) return value.slice(1);
  }
  return value;
}

export function normaliseProjectPaths(data) {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data.characters)) {
    for (const ch of data.characters) {
      if (ch && typeof ch === 'object') {
        if ('soundUrl' in ch) ch.soundUrl = relativisePath(ch.soundUrl);
        if (Array.isArray(ch.portraits)) {
          for (const p of ch.portraits) {
            if (p && typeof p === 'object' && 'imageUrl' in p) p.imageUrl = relativisePath(p.imageUrl);
          }
        }
      }
    }
  }

  if (Array.isArray(data.nodes)) {
    for (const n of data.nodes) {
      if (!n || !Array.isArray(n.commands)) continue;
      for (const cmd of n.commands) {
        if (!cmd || typeof cmd !== 'object') continue;
        if ('audioUrl' in cmd) cmd.audioUrl = relativisePath(cmd.audioUrl);
        if ('imageUrl' in cmd) cmd.imageUrl = relativisePath(cmd.imageUrl);
        if ('typingAudioUrl' in cmd) cmd.typingAudioUrl = relativisePath(cmd.typingAudioUrl);
      }
    }
  }

  return data;
}
