'use strict';

// ── Configuration ─────────────────────────────────────────────────────────────
const WORLD_W    = 4000;   // canvas world dimensions (px)
const WORLD_H    = 3000;
const MM_W       = 200;    // minimap display dimensions (px)
const MM_H       = 150;
const MM_SCALE_X = MM_W / WORLD_W;
const MM_SCALE_Y = MM_H / WORLD_H;
const STATE_W    = 120;    // default state node size (px, must match CSS)
const STATE_H    = 50;
const ZOOM_STEP  = 0.1;
const ZOOM_MIN   = 0.08;
const ZOOM_MAX   = 5;

// ── App state ─────────────────────────────────────────────────────────────────
let zoom       = 1;
let panX       = 0;
let panY       = 0;
let activeTool = 'select';  // 'select' | 'hand'
let nextId     = 1;

const states = [];  // { id, x, y, label, el, mmEl }

// Interaction flags
let isPanning       = false;
let panOrigin       = null;   // { x, y, panX, panY }

let draggingState   = null;   // { state, offsetX, offsetY }

let creatingState   = false;  // dragging from toolbar palette
let ghostEl         = null;

let draggingMinimapVP = false;
let mmVPGrabOffset    = { x: 0, y: 0 };

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvasContainer = document.getElementById('canvas-container');
const canvasEl        = document.getElementById('canvas');
const minimapEl       = document.getElementById('minimap');
const mmStatesEl      = document.getElementById('minimap-states');
const mmVP            = document.getElementById('minimap-viewport');
const zoomLabel       = document.getElementById('zoom-label');
const btnHandTool     = document.getElementById('btn-hand-tool');
const btnNewState     = document.getElementById('btn-new-state');

// ── Transform helpers ─────────────────────────────────────────────────────────

function applyTransform() {
  canvasEl.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  updateMinimapViewport();
}

/**
 * Zoom around a point expressed in canvas-container–relative coordinates.
 * The world point under (relX, relY) stays fixed on screen.
 */
function zoomAround(newZoom, relX, relY) {
  newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
  const worldX = (relX - panX) / zoom;
  const worldY = (relY - panY) / zoom;
  panX = relX - worldX * newZoom;
  panY = relY - worldY * newZoom;
  zoom = newZoom;
  applyTransform();
}

/** Convert client (page) coordinates → world (canvas) coordinates. */
function clientToWorld(clientX, clientY) {
  const rect = canvasContainer.getBoundingClientRect();
  return {
    x: (clientX - rect.left - panX) / zoom,
    y: (clientY - rect.top  - panY) / zoom,
  };
}

/** Returns container-relative coords from a mouse event. */
function relativeToContainer(clientX, clientY) {
  const rect = canvasContainer.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

// ── State node management ─────────────────────────────────────────────────────

function createState(worldX, worldY) {
  const id    = nextId++;
  const label = `State ${id}`;

  // Main canvas element
  const el = document.createElement('div');
  el.className = 'state-node';
  el.dataset.id = String(id);
  el.innerHTML  = `<span class="state-label">${label}</span>`;
  el.style.left = `${worldX}px`;
  el.style.top  = `${worldY}px`;
  canvasEl.appendChild(el);

  // Minimap representation
  const mmEl = document.createElement('div');
  mmEl.className = 'minimap-state';
  mmStatesEl.appendChild(mmEl);

  const state = { id, x: worldX, y: worldY, label, el, mmEl };
  states.push(state);

  positionMinimapState(state);

  // Start moving the state on mousedown
  el.addEventListener('mousedown', onStateMouseDown);

  return state;
}

function moveState(state, worldX, worldY) {
  state.x = worldX;
  state.y = worldY;
  state.el.style.left = `${worldX}px`;
  state.el.style.top  = `${worldY}px`;
  positionMinimapState(state);
}

function positionMinimapState(state) {
  const el = state.mmEl;
  el.style.left   = `${state.x * MM_SCALE_X}px`;
  el.style.top    = `${state.y * MM_SCALE_Y}px`;
  el.style.width  = `${STATE_W * MM_SCALE_X}px`;
  el.style.height = `${STATE_H * MM_SCALE_Y}px`;
}

// ── Minimap viewport indicator ────────────────────────────────────────────────

function updateMinimapViewport() {
  const cw = canvasContainer.clientWidth;
  const ch = canvasContainer.clientHeight;

  // Visible world rectangle
  const viewX = -panX / zoom;
  const viewY = -panY / zoom;
  const viewW =  cw   / zoom;
  const viewH =  ch   / zoom;

  mmVP.style.left   = `${viewX * MM_SCALE_X}px`;
  mmVP.style.top    = `${viewY * MM_SCALE_Y}px`;
  mmVP.style.width  = `${viewW * MM_SCALE_X}px`;
  mmVP.style.height = `${viewH * MM_SCALE_Y}px`;
}

// ── Cursor management ─────────────────────────────────────────────────────────

function updateCursor() {
  if (isPanning) {
    canvasContainer.style.cursor = 'grabbing';
  } else if (activeTool === 'hand') {
    canvasContainer.style.cursor = 'grab';
  } else {
    canvasContainer.style.cursor = '';
  }
}

// ── Toolbar: zoom buttons ─────────────────────────────────────────────────────

document.getElementById('btn-zoom-in').addEventListener('click', () => {
  const { clientWidth: cw, clientHeight: ch } = canvasContainer;
  zoomAround(zoom + ZOOM_STEP, cw / 2, ch / 2);
});

document.getElementById('btn-zoom-out').addEventListener('click', () => {
  const { clientWidth: cw, clientHeight: ch } = canvasContainer;
  zoomAround(zoom - ZOOM_STEP, cw / 2, ch / 2);
});

// ── Toolbar: hand tool ────────────────────────────────────────────────────────

btnHandTool.addEventListener('click', () => {
  activeTool = activeTool === 'hand' ? 'select' : 'hand';
  btnHandTool.classList.toggle('active', activeTool === 'hand');
  updateCursor();
});

// ── Toolbar: new State palette button (drag-to-create) ────────────────────────

btnNewState.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();

  creatingState = true;

  // Create a floating ghost that follows the cursor
  ghostEl = document.createElement('div');
  ghostEl.className = 'state-node state-ghost';
  ghostEl.innerHTML = `<span class="state-label">State ${nextId}</span>`;
  positionGhost(e.clientX, e.clientY);
  document.body.appendChild(ghostEl);
});

// Prevent browser's native drag on this button
btnNewState.addEventListener('dragstart', (e) => e.preventDefault());

function positionGhost(clientX, clientY) {
  ghostEl.style.left = `${clientX - STATE_W / 2}px`;
  ghostEl.style.top  = `${clientY - STATE_H / 2}px`;
}

// ── Canvas: scroll-wheel zoom (Version 2) ─────────────────────────────────────

canvasContainer.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rel   = relativeToContainer(e.clientX, e.clientY);
  const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
  zoomAround(zoom + delta, rel.x, rel.y);
}, { passive: false });

// ── Canvas: pan via hand tool (left-click) or middle mouse (Version 2) ────────

canvasContainer.addEventListener('mousedown', (e) => {
  if (creatingState) return;   // don't start panning while placing a node

  if (e.button === 1) {        // middle mouse button
    e.preventDefault();
    startPan(e);
  } else if (e.button === 0 && activeTool === 'hand') {
    startPan(e);
  }
});

// Suppress the autoscroll cursor that some browsers show on middle-mousedown
canvasContainer.addEventListener('auxclick', (e) => {
  if (e.button === 1) e.preventDefault();
});

function startPan(e) {
  isPanning = true;
  panOrigin = { x: e.clientX, y: e.clientY, panX, panY };
  canvasContainer.style.cursor = 'grabbing';
  e.preventDefault();
}

// ── State node: start drag ────────────────────────────────────────────────────

function onStateMouseDown(e) {
  if (e.button !== 0 || activeTool === 'hand' || creatingState) return;
  e.preventDefault();
  e.stopPropagation();

  const id    = Number(e.currentTarget.dataset.id);
  const state = states.find(s => s.id === id);
  if (!state) return;

  const world = clientToWorld(e.clientX, e.clientY);
  draggingState = {
    state,
    offsetX: world.x - state.x,
    offsetY: world.y - state.y,
  };
  state.el.classList.add('dragging');
}

// ── Minimap viewport: drag to scroll ─────────────────────────────────────────

mmVP.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();

  draggingMinimapVP = true;
  const rect = mmVP.getBoundingClientRect();
  mmVPGrabOffset = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
});

// ── Global: mousemove ─────────────────────────────────────────────────────────

document.addEventListener('mousemove', (e) => {

  // Ghost follows cursor while dragging from toolbar
  if (creatingState && ghostEl) {
    positionGhost(e.clientX, e.clientY);
  }

  // Canvas panning
  if (isPanning && panOrigin) {
    panX = panOrigin.panX + (e.clientX - panOrigin.x);
    panY = panOrigin.panY + (e.clientY - panOrigin.y);
    applyTransform();
  }

  // Moving a state node
  if (draggingState) {
    const world = clientToWorld(e.clientX, e.clientY);
    moveState(draggingState.state,
              world.x - draggingState.offsetX,
              world.y - draggingState.offsetY);
  }

  // Dragging the minimap viewport rectangle
  if (draggingMinimapVP) {
    const mmRect = minimapEl.getBoundingClientRect();
    let mx = e.clientX - mmRect.left - mmVPGrabOffset.x;
    let my = e.clientY - mmRect.top  - mmVPGrabOffset.y;

    // Clamp so the viewport rect stays within the minimap
    const vpW = parseFloat(mmVP.style.width)  || 0;
    const vpH = parseFloat(mmVP.style.height) || 0;
    mx = Math.max(0, Math.min(mx, MM_W - vpW));
    my = Math.max(0, Math.min(my, MM_H - vpH));

    // Convert minimap position back to world → pan offset
    const worldX = mx / MM_SCALE_X;
    const worldY = my / MM_SCALE_Y;
    panX = -worldX * zoom;
    panY = -worldY * zoom;
    applyTransform();
  }
});

// ── Global: mouseup ───────────────────────────────────────────────────────────

document.addEventListener('mouseup', (e) => {

  // Finish dragging from toolbar – place state if released over canvas
  if (creatingState) {
    if (ghostEl) {
      const rect = canvasContainer.getBoundingClientRect();
      const overCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom;

      if (overCanvas) {
        const world = clientToWorld(e.clientX, e.clientY);
        createState(world.x - STATE_W / 2, world.y - STATE_H / 2);
      }

      ghostEl.remove();
      ghostEl = null;
    }
    creatingState = false;
  }

  // Finish panning
  if (isPanning) {
    isPanning = false;
    panOrigin = null;
    updateCursor();
  }

  // Finish moving a state
  if (draggingState) {
    draggingState.state.el.classList.remove('dragging');
    draggingState = null;
  }

  // Finish dragging minimap viewport
  if (draggingMinimapVP) {
    draggingMinimapVP = false;
  }
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  // Ignore if focus is in a text input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const { clientWidth: cw, clientHeight: ch } = canvasContainer;

  switch (e.key) {
    case '=':
    case '+':
      zoomAround(zoom + ZOOM_STEP, cw / 2, ch / 2);
      break;
    case '-':
      zoomAround(zoom - ZOOM_STEP, cw / 2, ch / 2);
      break;
    case 'h':
    case 'H':
      btnHandTool.click();
      break;
    case 'Escape':
      // Cancel in-progress toolbar drag
      if (creatingState && ghostEl) {
        ghostEl.remove();
        ghostEl = null;
        creatingState = false;
      }
      break;
  }
});

// ── Window resize ─────────────────────────────────────────────────────────────

window.addEventListener('resize', updateMinimapViewport);

// ── Initialise ────────────────────────────────────────────────────────────────

applyTransform();
