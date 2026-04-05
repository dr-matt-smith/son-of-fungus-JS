import { NODE_DEFAULTS } from '../config.js';
import { S } from '../state.js';
import { canvasEl, mmStatesEl } from '../dom-refs.js';
import { buildNodeElement, fitLabelFontSize } from './node-element.js';
import { positionMinimapNode } from '../minimap.js';
import { updateConnectionsForNode } from '../connections/conn-render.js';
import { classifyBlock, updateEventAnnotation } from '../fungus-mode.js';

export function createNode(type, worldX, worldY) {
  const id  = S.nextId++;
  const def = NODE_DEFAULTS[type];
  const w   = def.w;
  const h   = def.h;

  let label = '';
  if (type === 'state')  label = `New Block ${id}`;
  if (type === 'choice') label = '?';

  const el = buildNodeElement(type, id);
  el.style.left   = `${worldX}px`;
  el.style.top    = `${worldY}px`;
  el.style.width  = `${w}px`;
  el.style.height = `${h}px`;
  canvasEl.appendChild(el);

  const mmEl = document.createElement('div');
  mmEl.className = `minimap-node minimap-${type}-node`;
  mmStatesEl.appendChild(mmEl);

  let event = { type: 'none' };
  if (type === 'start') event = { type: 'gameStarted' };

  const node = { id, type, x: worldX, y: worldY, w, h, label, el, mmEl,
                 event, commands: [] };
  S.nodes.push(node);

  positionMinimapNode(node);
  fitLabelFontSize(node);

  // Apply block style immediately
  if (type === 'state' || type === 'choice') {
    const kind = classifyBlock(node);
    node.el.classList.add(`fungus-${kind}-block`);
    updateEventAnnotation(node);
  }

  return node;
}

export function moveNode(node, worldX, worldY) {
  node.x = worldX;
  node.y = worldY;
  node.el.style.left = `${worldX}px`;
  node.el.style.top  = `${worldY}px`;
  positionMinimapNode(node);
  updateConnectionsForNode(node);
}

export function resizeNode(node, x, y, w, h) {
  node.x = x; node.y = y; node.w = w; node.h = h;
  node.el.style.left   = `${x}px`;
  node.el.style.top    = `${y}px`;
  node.el.style.width  = `${w}px`;
  node.el.style.height = `${h}px`;
  positionMinimapNode(node);
  fitLabelFontSize(node);
  updateConnectionsForNode(node);
}
