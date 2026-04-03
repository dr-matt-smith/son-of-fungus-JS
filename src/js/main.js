'use strict';

import { NODE_DEFAULTS, NODE_MIN_SIZE, ZOOM_STEP } from './config.js';
import { S } from './state.js';
import { canvasContainer, canvasEl, minimapEl, mmVP, btnHandTool, zoomSlider } from './dom-refs.js';
import { applyTransform, zoomAround, clientToWorld, relativeToContainer, fitAll, updateCursor } from './transform.js';
import { refreshMinimap, getMinimapScales, updateMinimapViewport } from './minimap.js';
import { createNode, moveNode, resizeNode, resetNodeSize } from './nodes/node-model.js';
import { activateNode, deactivateNode, selectGroup, clearGroup,
         startSelectionRect, updateSelectionRect, finishSelectionRect, deleteNode } from './nodes/node-selection.js';
import { startEditing, commitEditing } from './nodes/node-editing.js';
import { createConnection } from './connections/conn-model.js';
import { selectConn, deselectConn } from './connections/conn-selection.js';
import { cancelConnEditing } from './connections/conn-editing.js';
import { getBorderPoint } from './connections/geometry.js';
import { renderConnGroup, updateConnection } from './connections/conn-render.js';
import { recalcPairOffsets } from './connections/conn-model.js';
import { updateInspector, showJsonExport } from './inspector.js';
import { startExecution, stopExecution, isRunning } from './engine.js';

// ── Toolbar: Fit All ─────────────────────────────────────────────────────────

document.getElementById('btn-fit-all').addEventListener('click', fitAll);

// ── Toolbar: zoom buttons ────────────────────────────────────────────────────

document.getElementById('btn-zoom-in').addEventListener('click', () => {
  const { clientWidth: cw, clientHeight: ch } = canvasContainer;
  zoomAround(S.zoom + ZOOM_STEP, cw / 2, ch / 2);
});

document.getElementById('btn-zoom-out').addEventListener('click', () => {
  const { clientWidth: cw, clientHeight: ch } = canvasContainer;
  zoomAround(S.zoom - ZOOM_STEP, cw / 2, ch / 2);
});

// ── Zoom slider ──────────────────────────────────────────────────────────────

zoomSlider.addEventListener('input', () => {
  const newZoom = parseInt(zoomSlider.value, 10) / 100;
  const { clientWidth: cw, clientHeight: ch } = canvasContainer;
  zoomAround(newZoom, cw / 2, ch / 2);
});

// ── Toolbar: hand tool ───────────────────────────────────────────────────────

btnHandTool.addEventListener('click', () => {
  S.activeTool = S.activeTool === 'hand' ? 'select' : 'hand';
  btnHandTool.classList.toggle('active', S.activeTool === 'hand');
  updateCursor();
});

// ── Toolbar: palette buttons (drag-to-create) ───────────────────────────────

function setupPaletteBtn(btnId, type) {
  const btn = document.getElementById(btnId);
  btn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    S.creatingNode     = true;
    S.creatingNodeType = type;
    const def = NODE_DEFAULTS[type];
    S.ghostEl = document.createElement('div');
    S.ghostEl.className = `diagram-node ${type}-node node-ghost`;
    S.ghostEl.style.width  = `${def.w}px`;
    S.ghostEl.style.height = `${def.h}px`;
    if (type === 'choice') {
      S.ghostEl.innerHTML =
        '<svg class="choice-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
          '<polygon points="50,2 98,50 50,98 2,50"/>' +
        '</svg>' +
        '<span class="node-label">?</span>';
    } else if (type === 'state') {
      S.ghostEl.innerHTML = `<span class="node-label">State ${S.nextId}</span>`;
    }
    positionGhost(e.clientX, e.clientY);
    document.body.appendChild(S.ghostEl);
  });
  btn.addEventListener('dragstart', (e) => e.preventDefault());
}

setupPaletteBtn('btn-new-state',  'state');
setupPaletteBtn('btn-new-start',  'start');
setupPaletteBtn('btn-new-end',    'end');
setupPaletteBtn('btn-new-choice', 'choice');

function positionGhost(clientX, clientY) {
  const def = NODE_DEFAULTS[S.creatingNodeType];
  S.ghostEl.style.left = `${clientX - def.w / 2}px`;
  S.ghostEl.style.top  = `${clientY - def.h / 2}px`;
}

// ── Canvas: scroll-wheel zoom ────────────────────────────────────────────────

canvasContainer.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rel = relativeToContainer(e.clientX, e.clientY);
  const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
  zoomAround(S.zoom + delta, rel.x, rel.y);
}, { passive: false });

// ── Canvas: mousedown (pan / deselect / selection rect) ──────────────────────

canvasContainer.addEventListener('mousedown', (e) => {
  if (S.creatingNode) return;
  if (S.drawingConn)  return;

  const onEmpty = e.button === 0 && !e.target.closest('.conn-group') && !e.target.closest('.diagram-node');

  if (onEmpty) {
    if (S.selectedConn) deselectConn();
    if (S.activeNode) deactivateNode();
    if (S.selectedNodes.length) clearGroup();
  }

  if (e.button === 1) {
    e.preventDefault();
    startPan(e);
  } else if (e.button === 0 && S.activeTool === 'hand') {
    startPan(e);
  } else if (onEmpty && S.activeTool === 'select') {
    e.preventDefault();
    const world = clientToWorld(e.clientX, e.clientY);
    startSelectionRect(world.x, world.y);
  }
});

canvasContainer.addEventListener('auxclick', (e) => {
  if (e.button === 1) e.preventDefault();
});

function startPan(e) {
  S.isPanning = true;
  S.panOrigin = { x: e.clientX, y: e.clientY, panX: S.panX, panY: S.panY };
  canvasContainer.style.cursor = 'grabbing';
  e.preventDefault();
}

// ── Node: mousedown (drag + select) ─────────────────────────────────────────

function onNodeMouseDown(e) {
  if (e.button !== 0) return;
  if (S.activeTool === 'hand') return;
  if (S.creatingNode) return;
  if (S.drawingConn) return;
  if (e.target.classList.contains('resize-handle')) return;

  e.preventDefault();
  e.stopPropagation();

  if (S.editingNode && S.editingNode !== e.currentTarget._node) commitEditing();

  const id   = Number(e.currentTarget.dataset.id);
  const node = S.nodes.find(n => n.id === id);
  if (!node) return;

  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const world = clientToWorld(e.clientX, e.clientY);

  if (S.selectedNodes.length > 0 && S.selectedNodes.includes(node)) {
    S.draggingGroup = {
      offsets: S.selectedNodes.map(n => ({ node: n, ox: world.x - n.x, oy: world.y - n.y })),
    };
    S.didDragNode = false;
    for (const n of S.selectedNodes) n.el.classList.add('dragging');
    return;
  }

  if (S.selectedNodes.length > 0) clearGroup();

  activateNode(node);

  S.draggingNode = { node, offsetX: world.x - node.x, offsetY: world.y - node.y };
  S.didDragNode = false;
  node.el.classList.add('dragging');
}

// ── Node: double-click (edit label) ─────────────────────────────────────────

function onNodeDblClick(e) {
  const id   = Number(e.currentTarget.dataset.id);
  const node = S.nodes.find(n => n.id === id);
  if (!node) return;
  if (node.type !== 'state' && node.type !== 'choice') return;
  e.preventDefault();
  activateNode(node);
  startEditing(node);
}

// Wire node events when nodes are created — override createNode to add listeners
const _origCreateNode = createNode;

// We need to hook into node creation to add event listeners.
// Since createNode is imported, we re-export a wrapped version via the facade.
export function createNodeWithEvents(type, worldX, worldY) {
  const node = _origCreateNode(type, worldX, worldY);
  node.el.addEventListener('mousedown', onNodeMouseDown);
  node.el.addEventListener('dblclick',  onNodeDblClick);

  const resetBtn = node.el.querySelector('.node-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetNodeSize(node);
    });
  }
  return node;
}

// ── Minimap viewport: drag to scroll ────────────────────────────────────────

mmVP.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  S.draggingMinimapVP = true;
  const rect = mmVP.getBoundingClientRect();
  S.mmVPGrabOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
});

// ── Global: mousemove ────────────────────────────────────────────────────────

document.addEventListener('mousemove', (e) => {
  if (S.creatingNode && S.ghostEl) {
    positionGhost(e.clientX, e.clientY);
  }

  if (S.drawingConn) {
    const world = clientToWorld(e.clientX, e.clientY);
    const p1 = getBorderPoint(S.drawingConn.fromNode, world.x, world.y);
    const mx = (p1.x + world.x) / 2;
    const my = (p1.y + world.y) / 2;
    renderConnGroup(S.drawingConn.group, p1, world, mx, my, '', false);
  }

  if (S.isPanning && S.panOrigin) {
    S.panX = S.panOrigin.panX + (e.clientX - S.panOrigin.x);
    S.panY = S.panOrigin.panY + (e.clientY - S.panOrigin.y);
    applyTransform();
  }

  if (S.draggingNode) {
    const world = clientToWorld(e.clientX, e.clientY);
    const newX = world.x - S.draggingNode.offsetX;
    const newY = world.y - S.draggingNode.offsetY;
    if (!S.didDragNode &&
        (Math.abs(newX - S.draggingNode.node.x) > 2 ||
         Math.abs(newY - S.draggingNode.node.y) > 2)) {
      S.didDragNode = true;
    }
    moveNode(S.draggingNode.node, newX, newY);
  }

  if (S.resizingNode) {
    const { node, handle, startWorldX, startWorldY, startX, startY, startW, startH } = S.resizingNode;
    const world = clientToWorld(e.clientX, e.clientY);
    const dx = world.x - startWorldX;
    const dy = world.y - startWorldY;
    const min = NODE_MIN_SIZE[node.type] || { w: 20, h: 20 };
    let newX = startX, newY = startY, newW = startW, newH = startH;
    if (handle.includes('e')) newW = Math.max(min.w, startW + dx);
    if (handle.includes('s')) newH = Math.max(min.h, startH + dy);
    if (handle.includes('w')) { newW = Math.max(min.w, startW - dx); newX = startX + startW - newW; }
    if (handle.includes('n')) { newH = Math.max(min.h, startH - dy); newY = startY + startH - newH; }
    resizeNode(node, newX, newY, newW, newH);
  }

  if (S.selectionRect) {
    const world = clientToWorld(e.clientX, e.clientY);
    updateSelectionRect(world.x, world.y);
  }

  if (S.draggingGroup) {
    const world = clientToWorld(e.clientX, e.clientY);
    for (const { node, ox, oy } of S.draggingGroup.offsets) {
      const newX = world.x - ox;
      const newY = world.y - oy;
      if (!S.didDragNode && (Math.abs(newX - node.x) > 2 || Math.abs(newY - node.y) > 2)) {
        S.didDragNode = true;
      }
      moveNode(node, newX, newY);
    }
  }

  if (S.reconnDrag) {
    const world = clientToWorld(e.clientX, e.clientY);
    const conn = S.reconnDrag.conn;
    if (S.reconnDrag.end === 'from') {
      conn.danglingFrom = { x: world.x, y: world.y };
    } else {
      conn.danglingTo = { x: world.x, y: world.y };
    }
    updateConnection(conn);
  }

  if (S.draggingMinimapVP) {
    const { b, sx, sy } = getMinimapScales();
    const mmRect = minimapEl.getBoundingClientRect();
    let mx = e.clientX - mmRect.left - S.mmVPGrabOffset.x;
    let my = e.clientY - mmRect.top  - S.mmVPGrabOffset.y;
    const vpW = parseFloat(mmVP.style.width)  || 0;
    const vpH = parseFloat(mmVP.style.height) || 0;
    mx = Math.max(0, Math.min(mx, 200 - vpW));
    my = Math.max(0, Math.min(my, 150 - vpH));
    const worldX = mx / sx + b.x;
    const worldY = my / sy + b.y;
    S.panX = -worldX * S.zoom;
    S.panY = -worldY * S.zoom;
    applyTransform();
  }
});

// ── Global: mouseup ──────────────────────────────────────────────────────────

document.addEventListener('mouseup', (e) => {
  if (S.reconnDrag) {
    const world = clientToWorld(e.clientX, e.clientY);
    const conn = S.reconnDrag.conn;
    const target = S.nodes.find(n => {
      if (S.reconnDrag.end === 'from' && conn.toId != null && n.id === conn.toId) return false;
      if (S.reconnDrag.end === 'to' && conn.fromId != null && n.id === conn.fromId) return false;
      if (S.reconnDrag.end === 'to' && n.type === 'start') return false;  // cannot connect into a start node
      return world.x >= n.x && world.x <= n.x + n.w && world.y >= n.y && world.y <= n.y + n.h;
    });
    if (target) {
      if (S.reconnDrag.end === 'from') { conn.fromId = target.id; conn.danglingFrom = null; }
      else { conn.toId = target.id; conn.danglingTo = null; }
      recalcPairOffsets();
    }
    S.reconnDrag = null;
    updateCursor();
    updateConnection(conn);
  }

  if (S.drawingConn) {
    const world = clientToWorld(e.clientX, e.clientY);
    const target = S.nodes.find(n => {
      if (n.id === S.drawingConn.fromNode.id) return false;
      if (n.type === 'start') return false;  // cannot connect into a start node
      return world.x >= n.x && world.x <= n.x + n.w && world.y >= n.y && world.y <= n.y + n.h;
    });
    S.drawingConn.group.remove();
    if (target) createConnection(S.drawingConn.fromNode, target);
    S.drawingConn = null;
    updateCursor();
  }

  if (S.creatingNode) {
    if (S.ghostEl) {
      const rect = canvasContainer.getBoundingClientRect();
      const overCanvas = e.clientX >= rect.left && e.clientX <= rect.right &&
                         e.clientY >= rect.top  && e.clientY <= rect.bottom;
      if (overCanvas) {
        const def = NODE_DEFAULTS[S.creatingNodeType];
        const world = clientToWorld(e.clientX, e.clientY);
        createNodeWithEvents(S.creatingNodeType, world.x - def.w / 2, world.y - def.h / 2);
      }
      S.ghostEl.remove();
      S.ghostEl = null;
    }
    S.creatingNode = false;
    S.creatingNodeType = null;
  }

  if (S.isPanning) { S.isPanning = false; S.panOrigin = null; updateCursor(); }
  if (S.draggingNode) { S.draggingNode.node.el.classList.remove('dragging'); S.draggingNode = null; }
  if (S.resizingNode) { S.resizingNode = null; }
  if (S.selectionRect) { const world = clientToWorld(e.clientX, e.clientY); finishSelectionRect(world.x, world.y); }
  if (S.draggingGroup) {
    for (const { node } of S.draggingGroup.offsets) node.el.classList.remove('dragging');
    S.draggingGroup = null;
  }
  if (S.draggingMinimapVP) { S.draggingMinimapVP = false; }
});

// ── Keyboard shortcuts ───────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const { clientWidth: cw, clientHeight: ch } = canvasContainer;
  switch (e.key) {
    case '=': case '+': zoomAround(S.zoom + ZOOM_STEP, cw / 2, ch / 2); break;
    case '-': zoomAround(S.zoom - ZOOM_STEP, cw / 2, ch / 2); break;
    case 'f': case 'F': fitAll(); break;
    case 'h': case 'H': btnHandTool.click(); break;
    case 'Escape':
      if (S.editingConn) { cancelConnEditing(); break; }
      if (S.drawingConn) { S.drawingConn.group.remove(); S.drawingConn = null; updateCursor(); break; }
      if (S.creatingNode && S.ghostEl) { S.ghostEl.remove(); S.ghostEl = null; S.creatingNode = false; S.creatingNodeType = null; break; }
      if (S.selectedNodes.length) { clearGroup(); break; }
      if (S.selectedConn) { deselectConn(); break; }
      if (S.activeNode) { deactivateNode(); break; }
      break;
  }
});

// ── Window resize ────────────────────────────────────────────────────────────

window.addEventListener('resize', updateMinimapViewport);

// ── Minimap minimize / restore ───────────────────────────────────────────────

const minimizeBtn = document.getElementById('minimap-minimize');
const restoreBtn  = document.getElementById('minimap-restore');

minimizeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  minimapEl.style.display = 'none';
  restoreBtn.style.display = 'block';
});

restoreBtn.addEventListener('click', () => {
  restoreBtn.style.display = 'none';
  minimapEl.style.display = '';
  refreshMinimap();
});

// ── Inspector ────────────────────────────────────────────────────────────────

S.onSelectionChange = updateInspector;
document.getElementById('btn-export-json').addEventListener('click', showJsonExport);

// ── Play / Stop ──────────────────────────────────────────────────────────────

const btnPlay = document.getElementById('btn-play');
const btnStop = document.getElementById('btn-stop');

btnPlay.addEventListener('click', () => {
  btnPlay.style.display = 'none';
  btnStop.style.display = '';
  startExecution();
});

btnStop.addEventListener('click', () => {
  stopExecution();
  btnStop.style.display = 'none';
  btnPlay.style.display = '';
});

// ── Initialise ───────────────────────────────────────────────────────────────

applyTransform();

// ── Re-exports (facade for tests) ───────────────────────────────────────────

export { S } from './state.js';
export { WORLD_W, WORLD_H, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, NODE_DEFAULTS, NODE_MIN_SIZE } from './config.js';
export { canvasContainer, canvasEl, connSvg, minimapEl } from './dom-refs.js';
export { applyTransform, zoomAround, clientToWorld, relativeToContainer, fitAll } from './transform.js';
export { refreshMinimap, getMinimapBounds, getMinimapScales } from './minimap.js';
export { createNode, moveNode, resizeNode, resetNodeSize } from './nodes/node-model.js';
export { buildNodeElement, fitLabelFontSize } from './nodes/node-element.js';
export { activateNode, deactivateNode, selectGroup, clearGroup, deleteNode } from './nodes/node-selection.js';
export { startEditing, commitEditing, cancelEditing } from './nodes/node-editing.js';
export { createConnection, deleteConnection } from './connections/conn-model.js';
export { updateConnection } from './connections/conn-render.js';
export { selectConn, deselectConn } from './connections/conn-selection.js';
export { getBorderPoint, getPairPerpendicular } from './connections/geometry.js';
export { updateInspector } from './inspector.js';
