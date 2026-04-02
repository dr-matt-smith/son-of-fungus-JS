import { S } from '../state.js';
import { clientToWorld } from '../transform.js';

const HANDLE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

export function addResizeHandles(node) {
  HANDLE_DIRS.forEach(dir => {
    const h = document.createElement('div');
    h.className  = 'resize-handle';
    h.dataset.dir = dir;
    h.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const world = clientToWorld(e.clientX, e.clientY);
      S.resizingNode = {
        node,
        handle: dir,
        startWorldX: world.x,
        startWorldY: world.y,
        startX: node.x,
        startY: node.y,
        startW: node.w,
        startH: node.h,
      };
    });
    node.el.appendChild(h);
  });
}

export function removeResizeHandles(node) {
  node.el.querySelectorAll('.resize-handle').forEach(h => h.remove());
}
