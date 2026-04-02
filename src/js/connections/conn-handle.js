import { S } from '../state.js';
import { canvasContainer } from '../dom-refs.js';
import { deselectConn } from './conn-selection.js';
import { makeConnGroup } from './conn-render.js';

export function addConnHandle(node) {
  if (node.el.querySelector('.conn-handle')) return;
  const btn = document.createElement('div');
  btn.className = 'conn-handle';
  btn.title     = 'Drag to connect to another node';
  btn.innerHTML =
    '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" ' +
        'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="1" y1="5" x2="8" y2="5"/><polyline points="5,2 8,5 5,8"/>' +
    '</svg>';
  btn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    startDrawingConnection(node);
  });
  node.el.appendChild(btn);
}

export function removeConnHandle(node) {
  node.el.querySelector('.conn-handle')?.remove();
}

function startDrawingConnection(fromNode) {
  if (S.selectedConn) deselectConn();
  const group = makeConnGroup();
  group.classList.add('conn-drawing');
  S.drawingConn = { fromNode, group };
  canvasContainer.style.cursor = 'crosshair';
}
