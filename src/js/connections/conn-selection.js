import { S } from '../state.js';
import { canvasContainer } from '../dom-refs.js';
import { deactivateNode } from '../nodes/node-selection.js';
import { updateConnection } from './conn-render.js';
import { commitConnEditing } from './conn-editing.js';

export function selectConn(conn) {
  if (S.selectedConn === conn) return;
  if (S.selectedConn) deselectConn();
  if (S.activeNode) deactivateNode();
  S.selectedConn = conn;
  conn.group.classList.add('conn-selected');
  updateConnection(conn);
  if (S.onSelectionChange) S.onSelectionChange();
}

export function deselectConn() {
  if (!S.selectedConn) return;
  if (S.editingConn) commitConnEditing();
  const prev = S.selectedConn;
  S.selectedConn = null;
  prev.group.classList.remove('conn-selected');
  updateConnection(prev);
  if (S.onSelectionChange) S.onSelectionChange();
}

export function updateReconnHandles(conn) {
  const isSelected = conn === S.selectedConn;
  const NS = 'http://www.w3.org/2000/svg';
  const g  = conn.group;

  g.querySelectorAll('.reconn-handle').forEach(h => h.remove());

  if (!isSelected) return;

  const hasDanglingFrom = conn.fromId == null;
  const hasDanglingTo   = conn.toId   == null;
  if (!hasDanglingFrom && !hasDanglingTo) return;

  const line = g.querySelector('.conn-line');
  const d = line.getAttribute('d');
  const nums = d.match(/-?[\d.]+/g).map(Number);
  const p1 = { x: nums[0], y: nums[1] };
  const p2 = { x: nums[4], y: nums[5] };

  function makeHandle(pos, end) {
    const handle = document.createElementNS(NS, 'circle');
    handle.classList.add('reconn-handle');
    handle.setAttribute('cx', pos.x);
    handle.setAttribute('cy', pos.y);
    handle.setAttribute('r', '7');
    handle.dataset.end = end;
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      S.reconnDrag = { conn, end };
      canvasContainer.style.cursor = 'crosshair';
    });
    g.appendChild(handle);
  }

  if (hasDanglingFrom) makeHandle(p1, 'from');
  if (hasDanglingTo)   makeHandle(p2, 'to');
}
