import { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from './config.js';
import { S } from './state.js';
import { canvasContainer, canvasEl, zoomLabel, zoomSlider } from './dom-refs.js';
import { commitConnEditing } from './connections/conn-editing.js';
import { refreshMinimap } from './minimap.js';

export function applyTransform() {
  if (S.editingConn) commitConnEditing();
  canvasEl.style.transform = `translate(${S.panX}px, ${S.panY}px) scale(${S.zoom})`;
  zoomLabel.textContent = `${Math.round(S.zoom * 100)}%`;
  zoomSlider.value = Math.round(S.zoom * 100);
  refreshMinimap();
}

export function zoomAround(newZoom, relX, relY) {
  newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
  const worldX = (relX - S.panX) / S.zoom;
  const worldY = (relY - S.panY) / S.zoom;
  S.panX = relX - worldX * newZoom;
  S.panY = relY - worldY * newZoom;
  S.zoom = newZoom;
  applyTransform();
}

export function clientToWorld(clientX, clientY) {
  const rect = canvasContainer.getBoundingClientRect();
  return {
    x: (clientX - rect.left - S.panX) / S.zoom,
    y: (clientY - rect.top  - S.panY) / S.zoom,
  };
}

export function relativeToContainer(clientX, clientY) {
  const rect = canvasContainer.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

export function worldToScreen(wx, wy) {
  const rect = canvasContainer.getBoundingClientRect();
  return { x: wx * S.zoom + S.panX + rect.left, y: wy * S.zoom + S.panY + rect.top };
}

export function fitAll() {
  if (S.nodes.length === 0) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of S.nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.w);
    maxY = Math.max(maxY, node.y + node.h);
  }
  const PADDING = 48;
  minX -= PADDING; minY -= PADDING; maxX += PADDING; maxY += PADDING;
  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const cw = canvasContainer.clientWidth;
  const ch = canvasContainer.clientHeight;
  const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(cw / contentW, ch / contentH)));
  S.panX = (cw - contentW * newZoom) / 2 - minX * newZoom;
  S.panY = (ch - contentH * newZoom) / 2 - minY * newZoom;
  S.zoom = newZoom;
  applyTransform();
}

export function updateCursor() {
  if (S.isPanning) {
    canvasContainer.style.cursor = 'grabbing';
  } else if (S.activeTool === 'hand') {
    canvasContainer.style.cursor = 'grab';
  } else {
    canvasContainer.style.cursor = '';
  }
}
