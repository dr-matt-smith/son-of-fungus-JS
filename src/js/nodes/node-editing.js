import { S } from '../state.js';
import { fitLabelFontSize } from './node-element.js';

export function startEditing(node) {
  if (S.editingNode) commitEditing();
  S.editingNode = node;

  const labelEl = node.el.querySelector('.node-label');
  if (!labelEl) { S.editingNode = null; return; }

  const ta = document.createElement('textarea');
  ta.className = 'node-label-input';
  ta.value     = node.label;

  if (node.type === 'choice') {
    ta.style.width  = `${Math.max(40, node.w  * 0.46)}px`;
    ta.style.height = `${Math.max(24, node.h  * 0.46)}px`;
  } else {
    ta.style.width  = `${Math.max(40, node.w  - 18)}px`;
    ta.style.height = `${Math.max(20, node.h  - 12)}px`;
  }

  labelEl.replaceWith(ta);
  ta.focus();
  ta.select();

  ta.addEventListener('blur', () => commitEditing());
  ta.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        const s = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '\n' + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = s + 1;
      } else {
        commitEditing();
      }
    }
    if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
  });
}

export function commitEditing() {
  if (!S.editingNode) return;
  const node = S.editingNode;
  S.editingNode = null;

  const ta = node.el.querySelector('.node-label-input');
  if (ta) {
    const newLabel = ta.value.trim();
    if (newLabel) node.label = newLabel;
    const span = document.createElement('span');
    span.className   = 'node-label';
    span.textContent = node.label;
    ta.replaceWith(span);
  }
  fitLabelFontSize(node);
}

export function cancelEditing() {
  if (!S.editingNode) return;
  const node = S.editingNode;
  S.editingNode = null;

  const ta = node.el.querySelector('.node-label-input');
  if (ta) {
    const span = document.createElement('span');
    span.className   = 'node-label';
    span.textContent = node.label;
    ta.replaceWith(span);
  }
}
