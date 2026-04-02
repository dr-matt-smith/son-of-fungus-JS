import { CURVE_STEP } from '../config.js';
import { S } from '../state.js';
import { makeConnGroup, updateConnection } from './conn-render.js';
import { selectConn, deselectConn } from './conn-selection.js';
import { startConnEditing, cancelConnEditing } from './conn-editing.js';

export function createConnection(fromNode, toNode) {
  const group = makeConnGroup();
  const conn  = {
    id: S.nextConnId++,
    fromId: fromNode.id,
    toId: toNode.id,
    label: 'transition',
    curveOffset: 0,
    group,
  };
  S.connections.push(conn);

  group.querySelector('.conn-hitarea').addEventListener('click', (e) => {
    e.stopPropagation();
    selectConn(conn);
  });
  const lblEl = group.querySelector('.conn-label');
  lblEl.addEventListener('click', (e) => { e.stopPropagation(); selectConn(conn); });
  lblEl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    selectConn(conn);
    startConnEditing(conn);
  });

  group.querySelector('.conn-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteConnection(conn);
  });

  recalcPairOffsets();
}

export function deleteConnection(conn) {
  if (S.selectedConn === conn) deselectConn();
  if (S.editingConn  === conn) cancelConnEditing();
  conn.group.remove();
  S.connections.splice(S.connections.indexOf(conn), 1);
  recalcPairOffsets();
}

export function recalcPairOffsets() {
  const groups = new Map();
  for (const conn of S.connections) {
    if (conn.fromId == null || conn.toId == null) continue;
    const key = `${Math.min(conn.fromId, conn.toId)}-${Math.max(conn.fromId, conn.toId)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(conn);
  }
  for (const group of groups.values()) {
    const N = group.length;
    group.forEach((conn, i) => {
      conn.curveOffset = (i - (N - 1) / 2) * CURVE_STEP;
    });
  }
  for (const conn of S.connections) updateConnection(conn);
}
