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
import { updateInspector, showJsonExport, showRunLog } from './inspector.js';
import { startExecution, startStepExecution, stepNext, stopExecution, isRunning, isStepping, isPaused } from './engine.js';
import { enterFungusMode, exitFungusMode, classifyBlock, applyFungusStyles, syncAutoConnections } from './fungus-mode.js';

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
      const name = S.diagramMode === 'fungus' ? `New Block ${S.nextId}` : `State ${S.nextId}`;
      S.ghostEl.innerHTML = `<span class="node-label">${name}</span>`;
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

// ── Context menu for fungus mode ────────────────────────────────────────────

let ctxMenu = null;

function removeCtxMenu() {
  if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
}

function showNodeContextMenu(node, clientX, clientY) {
  removeCtxMenu();

  ctxMenu = document.createElement('div');
  ctxMenu.className = 'fungus-ctx-menu';
  ctxMenu.style.left = `${clientX}px`;
  ctxMenu.style.top  = `${clientY}px`;

  const deleteBtn = document.createElement('div');
  deleteBtn.className = 'fungus-ctx-item';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeCtxMenu();
    deleteNode(node);
    updateInspector();
  });

  const dupBtn = document.createElement('div');
  dupBtn.className = 'fungus-ctx-item';
  dupBtn.textContent = 'Duplicate';
  dupBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeCtxMenu();
    duplicateNode(node);
  });

  ctxMenu.appendChild(deleteBtn);
  ctxMenu.appendChild(dupBtn);
  document.body.appendChild(ctxMenu);

  // Close on next click outside the menu
  const close = (ev) => {
    if (ctxMenu && ctxMenu.contains(ev.target)) return;
    removeCtxMenu();
    document.removeEventListener('mousedown', close);
  };
  setTimeout(() => document.addEventListener('mousedown', close), 0);
}

function duplicateNode(srcNode) {
  const offset = 30;
  const newNode = createNodeWithEvents(srcNode.type, srcNode.x + offset, srcNode.y + offset);
  newNode.label = srcNode.label + ' copy';
  const labelEl = newNode.el.querySelector('.node-label');
  if (labelEl) labelEl.textContent = newNode.label;
  newNode.event = srcNode.event ? { ...srcNode.event } : { type: 'none' };
  newNode.commands = srcNode.commands.map(cmd => JSON.parse(JSON.stringify(cmd)));
  newNode.description = srcNode.description || '';
  if (S.diagramMode === 'fungus') {
    applyFungusStyles();
    syncAutoConnections();
  }
  activateNode(newNode);
  updateInspector();
}

function onNodeContextMenu(e) {
  if (S.diagramMode !== 'fungus') return;
  e.preventDefault();
  e.stopPropagation();
  const id   = Number(e.currentTarget.dataset.id);
  const node = S.nodes.find(n => n.id === id);
  if (!node) return;
  activateNode(node);
  updateInspector();
  showNodeContextMenu(node, e.clientX, e.clientY);
}

// Wire node events when nodes are created — override createNode to add listeners
const _origCreateNode = createNode;

// We need to hook into node creation to add event listeners.
// Since createNode is imported, we re-export a wrapped version via the facade.
export function createNodeWithEvents(type, worldX, worldY) {
  const node = _origCreateNode(type, worldX, worldY);
  node.el.addEventListener('mousedown', onNodeMouseDown);
  node.el.addEventListener('dblclick',  onNodeDblClick);
  node.el.addEventListener('contextmenu', onNodeContextMenu);

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
        const newNode = createNodeWithEvents(S.creatingNodeType, world.x - def.w / 2, world.y - def.h / 2);
        if (S.diagramMode === 'fungus') {
          activateNode(newNode);
          updateInspector();
        }
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
document.getElementById('btn-run-log').addEventListener('click', showRunLog);

// ── Play / Stop / Step ───────────────────────────────────────────────────────

const btnPlay         = document.getElementById('btn-play');
const btnPlayStep     = document.getElementById('btn-play-step');
const btnStepContinue = document.getElementById('btn-step-continue');
const btnStop         = document.getElementById('btn-stop');
const playLabel       = document.getElementById('play-label');
const modeLabelText   = document.getElementById('mode-label-text');

function showPlayButtons() {
  btnPlay.style.display = '';
  btnPlayStep.style.display = S.diagramMode === 'fungus' ? '' : 'none';
  btnStepContinue.style.display = 'none';
  btnStop.style.display = 'none';
}

function showRunningButtons() {
  btnPlay.style.display = 'none';
  btnPlayStep.style.display = 'none';
  btnStepContinue.style.display = 'none';
  btnStop.style.display = '';
}

function showStepPausedButtons() {
  btnPlay.style.display = 'none';
  btnPlayStep.style.display = 'none';
  btnStepContinue.style.display = '';
  btnStop.style.display = '';
}

btnPlay.addEventListener('click', () => {
  showRunningButtons();
  startExecution();
});

btnPlayStep.addEventListener('click', () => {
  showRunningButtons();
  startStepExecution();
});

btnStepContinue.addEventListener('click', () => {
  showRunningButtons();
  stepNext();
});

btnStop.addEventListener('click', () => {
  stopExecution();
  showPlayButtons();
});

S.onStepPause = () => {
  showStepPausedButtons();
};

S.onExecutionEnd = () => {
  showPlayButtons();
};

// ── Inspector / Settings tabs ────────────────────────────────────────────────

const inspectorPanel  = document.getElementById('inspector-panel');
const settingsPanel   = document.getElementById('settings-panel');
const messagesPanel   = document.getElementById('messages-panel');
const variablesPanel  = document.getElementById('variables-panel');
const enumsPanel      = document.getElementById('enums-panel');
const inspectorTabs   = document.getElementById('inspector-tabs');
const settingsCogBtn  = document.getElementById('btn-settings-cog');
const closeSettingsBtn = document.getElementById('btn-close-settings');

const contentPanels = [inspectorPanel, settingsPanel, messagesPanel, variablesPanel, enumsPanel];

function showTab(tabName) {
  // Exit settings overlay if active
  inspectorTabs.style.display = '';
  for (const p of contentPanels) p.style.display = 'none';
  for (const t of document.querySelectorAll('.inspector-tab')) {
    t.classList.toggle('active', t.dataset.tab === tabName);
  }
  if (tabName === 'inspector') inspectorPanel.style.display = '';
  else if (tabName === 'messages') { messagesPanel.style.display = ''; renderMessagesList(); }
  else if (tabName === 'variables') { variablesPanel.style.display = ''; renderVariablesList(); }
  else if (tabName === 'enums') { enumsPanel.style.display = ''; renderEnumsList(); }
}

for (const tab of document.querySelectorAll('.inspector-tab')) {
  tab.addEventListener('click', () => showTab(tab.dataset.tab));
}

settingsCogBtn.addEventListener('click', () => {
  // Hide tabs and other panels, show settings
  inspectorTabs.style.display = 'none';
  for (const p of contentPanels) p.style.display = 'none';
  settingsPanel.style.display = '';
});

closeSettingsBtn.addEventListener('click', () => {
  // Return to whatever tab was active (default to inspector)
  const activeTab = document.querySelector('.inspector-tab.active');
  showTab(activeTab ? activeTab.dataset.tab : 'inspector');
});

function updateModeUI() {
  if (S.diagramMode === 'fungus') {
    modeLabelText.textContent = 'Fungus Mode';
    playLabel.textContent = 'Play All';
  } else {
    modeLabelText.textContent = 'State Chart Mode';
    playLabel.textContent = 'Play';
  }
  showPlayButtons();
}

for (const radio of document.querySelectorAll('input[name="diagram-mode"]')) {
  radio.addEventListener('change', () => {
    if (radio.value === 'fungus') enterFungusMode();
    else exitFungusMode();
    updateModeUI();
  });
}

// ── Messages tab ────────────────────────────────────────────────────────────

const messagesList   = document.getElementById('messages-list');
const messagesNewInput = document.getElementById('messages-new-input');
const messagesAddBtn = document.getElementById('messages-add-btn');

function renderMessagesList() {
  messagesList.innerHTML = '';
  for (let i = 0; i < S.messages.length; i++) {
    const row = document.createElement('div');
    row.className = 'messages-item';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inspector-input';
    input.value = S.messages[i];
    input.addEventListener('change', () => {
      const val = input.value.trim();
      if (val) S.messages[i] = val;
      else { S.messages.splice(i, 1); renderMessagesList(); }
    });
    input.addEventListener('keydown', (e) => e.stopPropagation());
    row.appendChild(input);

    const delBtn = document.createElement('button');
    delBtn.className = 'messages-delete-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Delete message';
    delBtn.addEventListener('click', () => { S.messages.splice(i, 1); renderMessagesList(); });
    row.appendChild(delBtn);

    messagesList.appendChild(row);
  }
}

messagesAddBtn.addEventListener('click', () => {
  const val = messagesNewInput.value.trim();
  if (val && !S.messages.includes(val)) {
    S.messages.push(val);
    messagesNewInput.value = '';
    renderMessagesList();
  }
});

messagesNewInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') messagesAddBtn.click();
});

export { renderMessagesList };

// ── Variables tab ───────────────────────────────────────────────────────────

const VAR_TYPES = ['Boolean', 'Integer', 'Float', 'String', 'Enum'];
const VAR_DEFAULTS = { Boolean: false, Integer: 0, Float: 0.0, String: '', Enum: '' };

const variablesList    = document.getElementById('variables-list');
const variablesNewType = document.getElementById('variables-new-type');
const variablesNewName = document.getElementById('variables-new-name');
const variablesAddBtn  = document.getElementById('variables-add-btn');

function renderVariablesList() {
  variablesList.innerHTML = '';

  // Column headers
  if (S.variables.length > 0) {
    const header = document.createElement('div');
    header.className = 'variable-item variable-header';
    header.innerHTML = '<span class="variable-col-type">Data Type</span>' +
                       '<span class="variable-col-name">Variable Name</span>' +
                       '<span class="variable-col-value"></span>' +
                       '<span class="variable-col-del"></span>';
    variablesList.appendChild(header);
  }

  for (let i = 0; i < S.variables.length; i++) {
    const v = S.variables[i];
    const wrapper = document.createElement('div');
    wrapper.className = 'variable-wrapper';

    const row = document.createElement('div');
    row.className = 'variable-item';

    // Type select (first)
    const typeSelect = document.createElement('select');
    typeSelect.className = 'inspector-select variable-type-select';
    for (const t of VAR_TYPES) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      if (t === v.type) opt.selected = true;
      typeSelect.appendChild(opt);
    }
    typeSelect.addEventListener('change', () => {
      const oldType = v.type;
      const oldValue = v.value;
      v.type = typeSelect.value;
      // Convert value intelligently
      if (v.type === 'Integer') {
        const n = parseFloat(oldValue);
        v.value = isNaN(n) ? 0 : Math.trunc(n);
      } else if (v.type === 'Float') {
        const n = parseFloat(oldValue);
        v.value = isNaN(n) ? 0 : n;
      } else if (v.type === 'Boolean') {
        v.value = !!oldValue;
      } else if (v.type === 'Enum') {
        v.value = '';
        v.enumName = S.enums.length > 0 ? S.enums[0].name : '';
      } else {
        v.value = String(oldValue ?? '');
      }
      renderVariablesList();
    });
    row.appendChild(typeSelect);

    // Name input (second)
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'inspector-input variable-name-input';
    nameInput.value = v.name;
    nameInput.addEventListener('change', () => {
      const val = nameInput.value.trim();
      if (val) v.name = val;
      else { S.variables.splice(i, 1); renderVariablesList(); }
    });
    nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    row.appendChild(nameInput);

    // Value input (third)
    if (v.type === 'Enum') {
      // Enum set selector (compact)
      const enumSelect = document.createElement('select');
      enumSelect.className = 'inspector-select variable-enum-set-select';
      const noEnum = document.createElement('option');
      noEnum.value = '';
      noEnum.textContent = '— set —';
      enumSelect.appendChild(noEnum);
      for (const es of S.enums) {
        const opt = document.createElement('option');
        opt.value = es.name;
        opt.textContent = es.name;
        if (es.name === v.enumName) opt.selected = true;
        enumSelect.appendChild(opt);
      }
      enumSelect.addEventListener('change', () => { v.enumName = enumSelect.value; v.value = ''; renderVariablesList(); });
      row.appendChild(enumSelect);

      // Enum value selector (inline)
      const enumSet = v.enumName ? S.enums.find(e => e.name === v.enumName) : null;
      const valSelect = document.createElement('select');
      valSelect.className = 'inspector-select variable-enum-val-select';
      const none = document.createElement('option');
      none.value = '';
      none.textContent = '— value —';
      valSelect.appendChild(none);
      if (enumSet) {
        for (const ev of enumSet.values) {
          const opt = document.createElement('option');
          opt.value = ev.key;
          opt.textContent = ev.label || ev.key;
          if (ev.key === v.value) opt.selected = true;
          valSelect.appendChild(opt);
        }
      }
      valSelect.addEventListener('change', () => { v.value = valSelect.value; });
      row.appendChild(valSelect);
    } else {
      row.appendChild(buildValueInput(v));
    }

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'messages-delete-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Delete variable';
    delBtn.addEventListener('click', () => { S.variables.splice(i, 1); renderVariablesList(); });
    row.appendChild(delBtn);

    wrapper.appendChild(row);

    // String: if value is long, show a textarea on a second line
    if (v.type === 'String' && String(v.value ?? '').length > 12) {
      const textRow = document.createElement('div');
      textRow.className = 'variable-string-row';
      const textarea = document.createElement('textarea');
      textarea.className = 'inspector-input variable-string-textarea';
      textarea.rows = 2;
      textarea.value = String(v.value ?? '');
      textarea.addEventListener('input', () => {
        v.value = textarea.value;
        // Re-render if crossing the threshold
        if (textarea.value.length <= 12) renderVariablesList();
      });
      textarea.addEventListener('keydown', (e) => e.stopPropagation());
      textRow.appendChild(textarea);
      wrapper.appendChild(textRow);
    }

    variablesList.appendChild(wrapper);
  }
}

function buildValueInput(v) {
  if (v.type === 'Boolean') {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'variable-value-checkbox';
    cb.checked = !!v.value;
    cb.addEventListener('change', () => { v.value = cb.checked; });
    return cb;
  }
  const input = document.createElement('input');
  input.className = 'inspector-input variable-value-input';
  if (v.type === 'Integer') {
    input.type = 'number';
    input.step = '1';
    input.value = String(v.value ?? 0);
    input.addEventListener('change', () => { v.value = parseInt(input.value, 10) || 0; input.value = String(v.value); });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      // Block decimal point and 'e'
      if (e.key === '.' || e.key === 'e' || e.key === 'E') e.preventDefault();
    });
    return input;
  } else if (v.type === 'Float') {
    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = String(v.value ?? 0);
    input.addEventListener('change', () => { v.value = parseFloat(input.value) || 0; input.value = String(v.value); });
    input.addEventListener('keydown', (e) => {
      // Allow navigation, backspace, delete, tab, arrows, minus, decimal
      if (e.ctrlKey || e.metaKey || ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      if (e.key === '-' || e.key === '.') return;
      if (e.key >= '0' && e.key <= '9') return;
      e.preventDefault();
    });
  } else {
    input.type = 'text';
    input.value = String(v.value ?? '');
    input.addEventListener('change', () => {
      v.value = input.value;
      if (input.value.length > 12) renderVariablesList();
    });
  }
  input.addEventListener('keydown', (e) => e.stopPropagation());
  return input;
}

variablesAddBtn.addEventListener('click', () => {
  const name = variablesNewName.value.trim();
  if (name) {
    const type = variablesNewType.value;
    const v = { name, type, value: VAR_DEFAULTS[type] };
    if (type === 'Enum') v.enumName = S.enums.length > 0 ? S.enums[0].name : '';
    S.variables.push(v);
    variablesNewName.value = '';
    renderVariablesList();
  }
});

variablesNewName.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') variablesAddBtn.click();
});

export { renderVariablesList, VAR_TYPES };

// ── Enums tab ───────────────────────────────────────────────────────────────

const enumsList    = document.getElementById('enums-list');
const enumsNewName = document.getElementById('enums-new-name');
const enumsAddBtn  = document.getElementById('enums-add-btn');

function toUpperSnake(s) {
  return s.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
}

function renderEnumsList() {
  enumsList.innerHTML = '';
  for (let i = 0; i < S.enums.length; i++) {
    const es = S.enums[i];
    const card = document.createElement('div');
    card.className = 'enum-card';

    // Header: name + delete
    const header = document.createElement('div');
    header.className = 'enum-card-header';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'inspector-input enum-name-input';
    nameInput.value = es.name;
    nameInput.addEventListener('change', () => {
      const val = nameInput.value.trim();
      if (val) es.name = val;
      else { S.enums.splice(i, 1); renderEnumsList(); }
    });
    nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    header.appendChild(nameInput);

    const delBtn = document.createElement('button');
    delBtn.className = 'messages-delete-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Delete enum set';
    delBtn.addEventListener('click', () => { S.enums.splice(i, 1); renderEnumsList(); });
    header.appendChild(delBtn);
    card.appendChild(header);

    // Column headers
    const colHeader = document.createElement('div');
    colHeader.className = 'enum-value-row enum-col-header';
    colHeader.innerHTML = '<span class="enum-col-key">ENUM_KEY</span><span class="enum-col-label">String Alternative</span><span class="enum-col-del"></span>';
    card.appendChild(colHeader);

    // Values
    for (let j = 0; j < es.values.length; j++) {
      const ev = es.values[j];
      const row = document.createElement('div');
      row.className = 'enum-value-row';

      const keyInput = document.createElement('input');
      keyInput.type = 'text';
      keyInput.className = 'inspector-input enum-key-input';
      keyInput.value = ev.key;
      keyInput.addEventListener('change', () => {
        ev.key = toUpperSnake(keyInput.value);
        keyInput.value = ev.key;
      });
      keyInput.addEventListener('keydown', (e) => e.stopPropagation());
      row.appendChild(keyInput);

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'inspector-input enum-label-input';
      labelInput.value = ev.label || '';
      labelInput.placeholder = 'display text…';
      labelInput.addEventListener('change', () => { ev.label = labelInput.value; });
      labelInput.addEventListener('keydown', (e) => e.stopPropagation());
      row.appendChild(labelInput);

      const vDelBtn = document.createElement('button');
      vDelBtn.className = 'messages-delete-btn';
      vDelBtn.textContent = '×';
      vDelBtn.addEventListener('click', () => { es.values.splice(j, 1); renderEnumsList(); });
      row.appendChild(vDelBtn);

      card.appendChild(row);
    }

    // Add value button
    const addValBtn = document.createElement('button');
    addValBtn.className = 'cmd-btn';
    addValBtn.textContent = '+ Add Value';
    addValBtn.addEventListener('click', () => {
      es.values.push({ key: `VALUE_${es.values.length + 1}`, label: '' });
      renderEnumsList();
    });
    card.appendChild(addValBtn);

    enumsList.appendChild(card);
  }
}

enumsAddBtn.addEventListener('click', () => {
  const name = enumsNewName.value.trim();
  if (name) {
    S.enums.push({ name, values: [] });
    enumsNewName.value = '';
    renderEnumsList();
  }
});

enumsNewName.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') enumsAddBtn.click();
});

export { renderEnumsList };

// ── Initialise ───────────────────────────────────────────────────────────────

enterFungusMode();
updateModeUI();
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
export { createConnection, deleteConnection, createAutoConnection } from './connections/conn-model.js';
export { updateConnection } from './connections/conn-render.js';
export { selectConn, deselectConn } from './connections/conn-selection.js';
export { getBorderPoint, getPairPerpendicular } from './connections/geometry.js';
export { updateInspector } from './inspector.js';
export { classifyBlock, applyFungusStyles, syncAutoConnections, enterFungusMode, exitFungusMode } from './fungus-mode.js';
export { startExecution, startStepExecution, stepNext, stopExecution, isRunning, isStepping, isPaused, getRunLog } from './engine.js';
