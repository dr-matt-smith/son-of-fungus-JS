import { S } from '../state.js';
import { worldToScreen } from '../transform.js';
import { selectConn } from './conn-selection.js';
import { updateConnection } from './conn-render.js';

export function startConnEditing(conn) {
  if (S.editingConn) commitConnEditing();
  S.editingConn = conn;

  const lblEl = conn.group.querySelector('.conn-label');
  const lx    = parseFloat(lblEl.getAttribute('x'));
  const ly    = parseFloat(lblEl.getAttribute('y')) + 10;
  const sc    = worldToScreen(lx, ly);

  const input = document.createElement('input');
  input.type       = 'text';
  input.className  = 'conn-label-input';
  input.value      = conn.label;
  input.style.left = `${sc.x}px`;
  input.style.top  = `${sc.y}px`;
  document.body.appendChild(input);
  S.connLabelInput = input;
  lblEl.style.visibility = 'hidden';

  input.focus();
  input.select();
  input.addEventListener('blur',    () => commitConnEditing());
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter')  { e.preventDefault(); commitConnEditing(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelConnEditing(); }
  });
}

export function commitConnEditing() {
  if (!S.editingConn) return;
  const conn = S.editingConn;
  S.editingConn = null;
  if (S.connLabelInput) {
    const v = S.connLabelInput.value.trim();
    if (v) conn.label = v;
    S.connLabelInput.remove();
    S.connLabelInput = null;
  }
  const lblEl = conn.group.querySelector('.conn-label');
  if (lblEl) lblEl.style.visibility = '';
  updateConnection(conn);
}

export function cancelConnEditing() {
  if (!S.editingConn) return;
  const conn = S.editingConn;
  S.editingConn = null;
  if (S.connLabelInput) { S.connLabelInput.remove(); S.connLabelInput = null; }
  const lblEl = conn.group.querySelector('.conn-label');
  if (lblEl) lblEl.style.visibility = '';
}
