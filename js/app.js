'use strict';

// ── Configuration ─────────────────────────────────────────────────────────────
const WORLD_W    = 4000;
const WORLD_H    = 3000;
const MM_W       = 200;
const MM_H       = 150;
const ZOOM_STEP  = 0.1;
const ZOOM_MIN   = 0.08;
const ZOOM_MAX   = 5;

// Default dimensions per node type
const NODE_DEFAULTS = {
  state:  { w: 120, h: 50 },
  start:  { w: 30,  h: 30 },
  end:    { w: 36,  h: 36 },
  choice: { w: 80,  h: 80 },
};

// Minimum resize dimensions for resizable node types
const NODE_MIN_SIZE = {
  state:  { w: 60, h: 30 },
  choice: { w: 40, h: 40 },
};

// ── Dynamic minimap bounds ────────────────────────────────────────────────────

/**
 * Returns the world-space rectangle that the minimap should cover.
 * Always at least as large as the original canvas, and expands to
 * include any nodes that have been placed outside it.
 */
function getMinimapBounds() {
  const PADDING = 200;   // extra world-space margin around the outermost nodes
  let minX = 0, minY = 0, maxX = WORLD_W, maxY = WORLD_H;

  for (const node of nodes) {
    minX = Math.min(minX, node.x - PADDING);
    minY = Math.min(minY, node.y - PADDING);
    maxX = Math.max(maxX, node.x + node.w + PADDING);
    maxY = Math.max(maxY, node.y + node.h + PADDING);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Returns per-axis scale factors for the current minimap bounds. */
function getMinimapScales() {
  const b = getMinimapBounds();
  return { b, sx: MM_W / b.w, sy: MM_H / b.h };
}

// ── App state ─────────────────────────────────────────────────────────────────
let zoom       = 1;
let panX       = 0;
let panY       = 0;
let activeTool = 'select';  // 'select' | 'hand'
let nextId     = 1;

const nodes = [];  // { id, type, x, y, w, h, label, el, mmEl }

// Interaction flags
let isPanning         = false;
let panOrigin         = null;    // { x, y, panX, panY }

let draggingNode      = null;    // { node, offsetX, offsetY }
let didDragNode       = false;   // distinguish click vs drag for activation

let creatingNode      = false;   // dragging from toolbar palette
let creatingNodeType  = null;    // type being created
let ghostEl           = null;

let draggingMinimapVP = false;
let mmVPGrabOffset    = { x: 0, y: 0 };

let activeNode        = null;    // currently selected node
let editingNode       = null;    // node whose label is being edited
let resizingNode      = null;    // { node, handle, startWorldX, startWorldY, startX, startY, startW, startH }

const connections  = [];   // { id, fromId, toId, label, curveOffset, group }
let nextConnId     = 1;
let drawingConn    = null; // { fromNode, group } while rubber-banding a new connection
let selectedConn   = null; // currently selected connection
let editingConn    = null; // connection whose label is being edited
let connLabelInput = null; // floating HTML input for label editing

const CURVE_STEP = 90;     // px of perpendicular offset per parallel connection slot

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvasContainer = document.getElementById('canvas-container');
const canvasEl        = document.getElementById('canvas');
const connSvg         = document.getElementById('connections-svg');
const minimapEl       = document.getElementById('minimap');
const mmStatesEl      = document.getElementById('minimap-states');
const mmVP            = document.getElementById('minimap-viewport');
const zoomLabel       = document.getElementById('zoom-label');
const btnHandTool     = document.getElementById('btn-hand-tool');

// ── Transform helpers ─────────────────────────────────────────────────────────

function applyTransform() {
  if (editingConn) commitConnEditing();   // label input position would go stale
  canvasEl.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  refreshMinimap();
}

function zoomAround(newZoom, relX, relY) {
  newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
  const worldX = (relX - panX) / zoom;
  const worldY = (relY - panY) / zoom;
  panX = relX - worldX * newZoom;
  panY = relY - worldY * newZoom;
  zoom = newZoom;
  applyTransform();
}

function clientToWorld(clientX, clientY) {
  const rect = canvasContainer.getBoundingClientRect();
  return {
    x: (clientX - rect.left - panX) / zoom,
    y: (clientY - rect.top  - panY) / zoom,
  };
}

function relativeToContainer(clientX, clientY) {
  const rect = canvasContainer.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

// ── Node management ───────────────────────────────────────────────────────────

function buildNodeElement(type, id) {
  const el = document.createElement('div');
  el.className = `diagram-node ${type}-node`;
  el.dataset.id   = String(id);
  el.dataset.type = type;

  if (type === 'choice') {
    el.innerHTML =
      '<svg class="choice-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
        '<polygon points="50,2 98,50 50,98 2,50"/>' +
      '</svg>' +
      '<span class="node-label">?</span>';
  } else if (type === 'state') {
    el.innerHTML = `<span class="node-label">State ${id}</span>`;
  }
  // start and end nodes have no label

  // Reset-to-default-size button (state and choice only)
  if (type === 'state' || type === 'choice') {
    const btn = document.createElement('button');
    btn.className = 'node-reset-btn';
    btn.title     = 'Reset to default size';
    btn.textContent = '↺';
    btn.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    el.appendChild(btn);
  }

  return el;
}

function createNode(type, worldX, worldY) {
  const id      = nextId++;
  const def     = NODE_DEFAULTS[type];
  const w       = def.w;
  const h       = def.h;

  let label = '';
  if (type === 'state')  label = `State ${id}`;
  if (type === 'choice') label = '?';

  const el = buildNodeElement(type, id);
  el.style.left   = `${worldX}px`;
  el.style.top    = `${worldY}px`;
  el.style.width  = `${w}px`;
  el.style.height = `${h}px`;
  canvasEl.appendChild(el);

  // Minimap representation
  const mmEl = document.createElement('div');
  mmEl.className = `minimap-node minimap-${type}-node`;
  mmStatesEl.appendChild(mmEl);

  const node = { id, type, x: worldX, y: worldY, w, h, label, el, mmEl };
  nodes.push(node);

  positionMinimapNode(node);

  el.addEventListener('mousedown', onNodeMouseDown);
  el.addEventListener('dblclick',  onNodeDblClick);

  // Wire up reset button now that we have the node reference
  const resetBtn = el.querySelector('.node-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetNodeSize(node);
    });
  }

  fitLabelFontSize(node);

  return node;
}

function moveNode(node, worldX, worldY) {
  node.x = worldX;
  node.y = worldY;
  node.el.style.left = `${worldX}px`;
  node.el.style.top  = `${worldY}px`;
  positionMinimapNode(node);
  updateConnectionsForNode(node);
}

function resizeNode(node, x, y, w, h) {
  node.x = x;
  node.y = y;
  node.w = w;
  node.h = h;
  node.el.style.left   = `${x}px`;
  node.el.style.top    = `${y}px`;
  node.el.style.width  = `${w}px`;
  node.el.style.height = `${h}px`;
  positionMinimapNode(node);
  fitLabelFontSize(node);
  updateConnectionsForNode(node);
}

function positionMinimapNode(node, mmScales) {
  const { b, sx, sy } = mmScales || getMinimapScales();
  const el = node.mmEl;
  // Shrink choice dots slightly so the rotated square fits its bounding box
  const vis = node.type === 'choice' ? 0.7 : 1;
  const mw = node.w * sx * vis;
  const mh = node.h * sy * vis;
  const mx = (node.x - b.x + node.w * (1 - vis) / 2) * sx;
  const my = (node.y - b.y + node.h * (1 - vis) / 2) * sy;
  el.style.left   = `${mx}px`;
  el.style.top    = `${my}px`;
  el.style.width  = `${mw}px`;
  el.style.height = `${mh}px`;
}

/** Reposition every minimap node + the viewport indicator in one pass. */
function refreshMinimap() {
  const mmScales = getMinimapScales();
  for (const node of nodes) {
    positionMinimapNode(node, mmScales);
  }
  updateMinimapViewport(mmScales);
}

// ── Active node / selection ───────────────────────────────────────────────────

function activateNode(node) {
  if (activeNode === node) return;
  if (selectedConn) deselectConn();
  deactivateNode();
  activeNode = node;
  node.el.classList.add('node-active');
  if (node.type === 'state' || node.type === 'choice') {
    addResizeHandles(node);
  }
  addConnHandle(node);
}

function deactivateNode() {
  if (!activeNode) return;
  if (editingNode) commitEditing();
  // Cancel any in-progress connection drawing
  if (drawingConn) {
    drawingConn.group.remove();
    drawingConn = null;
    updateCursor();
  }
  if (activeNode.type === 'state' || activeNode.type === 'choice') {
    removeResizeHandles(activeNode);
  }
  removeConnHandle(activeNode);
  activeNode.el.classList.remove('node-active');
  activeNode = null;
}

// ── Resize handles ────────────────────────────────────────────────────────────

const HANDLE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

function addResizeHandles(node) {
  HANDLE_DIRS.forEach(dir => {
    const h = document.createElement('div');
    h.className  = 'resize-handle';
    h.dataset.dir = dir;
    h.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const world = clientToWorld(e.clientX, e.clientY);
      resizingNode = {
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

function removeResizeHandles(node) {
  node.el.querySelectorAll('.resize-handle').forEach(h => h.remove());
}

// ── Inline text editing ───────────────────────────────────────────────────────

function startEditing(node) {
  if (editingNode) commitEditing();
  editingNode = node;

  const labelEl = node.el.querySelector('.node-label');
  if (!labelEl) { editingNode = null; return; }

  const ta = document.createElement('textarea');
  ta.className = 'node-label-input';
  ta.value     = node.label;

  // Size the textarea to the node's usable content area
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
    e.stopPropagation();   // prevent canvas shortcuts while typing
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        // Insert a newline at the cursor (Shift+Enter = multi-line)
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

function commitEditing() {
  if (!editingNode) return;
  const node  = editingNode;
  editingNode = null;

  const ta = node.el.querySelector('.node-label-input');
  if (ta) {
    const newLabel = ta.value.trim();
    if (newLabel) node.label = newLabel;
    const span = document.createElement('span');
    span.className   = 'node-label';
    span.textContent = node.label;   // pre-wrap CSS renders \n as line-breaks
    ta.replaceWith(span);
  }
  fitLabelFontSize(node);
}

function cancelEditing() {
  if (!editingNode) return;
  const node  = editingNode;
  editingNode = null;

  const ta = node.el.querySelector('.node-label-input');
  if (ta) {
    const span = document.createElement('span');
    span.className   = 'node-label';
    span.textContent = node.label;
    ta.replaceWith(span);
  }
}

// ── Connections ───────────────────────────────────────────────────────────────

/** World → screen conversion (used to position the floating label editor). */
function worldToScreen(wx, wy) {
  const rect = canvasContainer.getBoundingClientRect();
  return { x: wx * zoom + panX + rect.left, y: wy * zoom + panY + rect.top };
}

/** Point on `node`'s visible border facing toward (targetX, targetY). */
function getBorderPoint(node, targetX, targetY) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy };
  const len = Math.sqrt(dx * dx + dy * dy);
  const ndx = dx / len;
  const ndy = dy / len;
  const hw  = node.w / 2;
  const hh  = node.h / 2;
  if (node.type === 'start' || node.type === 'end') {
    return { x: cx + ndx * hw, y: cy + ndy * hh };
  }
  if (node.type === 'choice') {
    const t = (hw * hh) / (Math.abs(ndy) * hw + Math.abs(ndx) * hh);
    return { x: cx + ndx * t, y: cy + ndy * t };
  }
  const tx = Math.abs(ndx) > 0.001 ? hw / Math.abs(ndx) : Infinity;
  const ty = Math.abs(ndy) > 0.001 ? hh / Math.abs(ndy) : Infinity;
  return { x: cx + ndx * Math.min(tx, ty), y: cy + ndy * Math.min(tx, ty) };
}

/** Filled arrowhead polygon whose TIP is at (px,py) pointing in direction `angle`. */
function makeArrowPoints(px, py, angle) {
  const LEN = 11, HALF = 5;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const bx = px - LEN * cos, by = py - LEN * sin;
  return `${px},${py} ${bx + HALF * sin},${by - HALF * cos} ${bx - HALF * sin},${by + HALF * cos}`;
}

/**
 * Returns the perpendicular unit vector for an unordered node pair.
 * Always defined relative to lower-id → higher-id so it is the same for
 * both A→B and B→A connections in the same pair.
 */
function getPairPerpendicular(from, to) {
  const ref = from.id < to.id ? { from, to } : { from: to, to: from };
  const dx  = (ref.to.x + ref.to.w / 2) - (ref.from.x + ref.from.w / 2);
  const dy  = (ref.to.y + ref.to.h / 2) - (ref.from.y + ref.from.h / 2);
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { px: -dy / len, py: dx / len };  // 90° left of reference direction
}

/** Creates the full SVG group structure for one connection (hitarea + line + arrow + label + delete). */
function makeConnGroup() {
  const NS = 'http://www.w3.org/2000/svg';
  const g  = document.createElementNS(NS, 'g');
  g.classList.add('conn-group');

  const hit = document.createElementNS(NS, 'path');
  hit.classList.add('conn-hitarea');
  g.appendChild(hit);

  const line = document.createElementNS(NS, 'path');
  line.classList.add('conn-line');
  g.appendChild(line);

  const arrow = document.createElementNS(NS, 'polygon');
  arrow.classList.add('conn-arrow');
  g.appendChild(arrow);

  const lbl = document.createElementNS(NS, 'text');
  lbl.classList.add('conn-label');
  g.appendChild(lbl);

  const del = document.createElementNS(NS, 'g');
  del.classList.add('conn-delete');
  del.style.visibility = 'hidden';
  const delCirc = document.createElementNS(NS, 'circle');
  delCirc.setAttribute('r', '8');
  delCirc.classList.add('conn-delete-bg');
  const delTxt = document.createElementNS(NS, 'text');
  delTxt.classList.add('conn-delete-x');
  delTxt.textContent = '×';
  del.appendChild(delCirc);
  del.appendChild(delTxt);
  g.appendChild(del);

  connSvg.appendChild(g);
  return g;
}

/**
 * Redraws a connection group using a quadratic bezier (p1 → ctrl → p2).
 * Also positions the label and delete button.
 */
function renderConnGroup(group, p1, p2, ctrlX, ctrlY, label, isSelected) {
  const d = `M ${p1.x} ${p1.y} Q ${ctrlX} ${ctrlY} ${p2.x} ${p2.y}`;
  group.querySelector('.conn-hitarea').setAttribute('d', d);
  group.querySelector('.conn-line').setAttribute('d', d);

  // Arrowhead at t = 2/3 along the quadratic bezier
  const t = 2 / 3, mt = 1 - t;
  const ax = mt*mt*p1.x + 2*mt*t*ctrlX + t*t*p2.x;
  const ay = mt*mt*p1.y + 2*mt*t*ctrlY + t*t*p2.y;
  const tx = 2*mt*(ctrlX - p1.x) + 2*t*(p2.x - ctrlX);   // tangent
  const ty = 2*mt*(ctrlY - p1.y) + 2*t*(p2.y - ctrlY);
  group.querySelector('.conn-arrow').setAttribute('points', makeArrowPoints(ax, ay, Math.atan2(ty, tx)));

  // Label at t = 0.5, offset slightly along the perpendicular
  const lx = 0.25*p1.x + 0.5*ctrlX + 0.25*p2.x;
  const ly = 0.25*p1.y + 0.5*ctrlY + 0.25*p2.y;
  const labelEl = group.querySelector('.conn-label');
  labelEl.setAttribute('x', lx);
  labelEl.setAttribute('y', ly - 10);
  if (label !== undefined) labelEl.textContent = label;

  // Delete button near the DESTINATION end (t = 0.88 along the bezier),
  // offset perpendicular so it doesn't sit on top of the target node border.
  const td = 0.88, mtd = 1 - td;
  const dx  = mtd*mtd*p1.x + 2*mtd*td*ctrlX + td*td*p2.x;
  const dy  = mtd*mtd*p1.y + 2*mtd*td*ctrlY + td*td*p2.y;
  // Tangent at td – used to build a perpendicular offset so the button
  // sits beside the line rather than on it.
  const ttx = 2*mtd*(ctrlX - p1.x) + 2*td*(p2.x - ctrlX);
  const tty = 2*mtd*(ctrlY - p1.y) + 2*td*(p2.y - ctrlY);
  const tlen = Math.sqrt(ttx*ttx + tty*tty) || 1;
  const DEL_OFFSET = 16;   // px away from the line
  const delX = dx + (-tty / tlen) * DEL_OFFSET;
  const delY = dy + ( ttx / tlen) * DEL_OFFSET;
  const delGroup = group.querySelector('.conn-delete');
  delGroup.setAttribute('transform', `translate(${delX}, ${delY})`);
  delGroup.style.visibility = isSelected ? 'visible' : 'hidden';
}

/** Recalculates all connections for one node (elastic banding). */
function updateConnectionsForNode(node) {
  for (const conn of connections) {
    if (conn.fromId === node.id || conn.toId === node.id) updateConnection(conn);
  }
}

/** Recomputes geometry for a single stored connection. */
function updateConnection(conn) {
  const from = nodes.find(n => n.id === conn.fromId);
  const to   = nodes.find(n => n.id === conn.toId);
  if (!from || !to) return;
  const toC   = { x: to.x   + to.w / 2, y: to.y   + to.h / 2 };
  const fromC = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const p1    = getBorderPoint(from, toC.x, toC.y);
  const p2    = getBorderPoint(to, fromC.x, fromC.y);
  const { px, py } = getPairPerpendicular(from, to);
  const off   = conn.curveOffset || 0;
  const mx    = (p1.x + p2.x) / 2 + px * off;
  const my    = (p1.y + p2.y) / 2 + py * off;
  renderConnGroup(conn.group, p1, p2, mx, my, conn.label, conn === selectedConn);
}

/**
 * After any connection is added/removed, reassign curve offsets for all pairs so
 * parallel arrows (same or opposite direction) are fanned out symmetrically.
 */
function recalcPairOffsets() {
  const groups = new Map();
  for (const conn of connections) {
    const key = `${Math.min(conn.fromId, conn.toId)}-${Math.max(conn.fromId, conn.toId)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(conn);
  }
  for (const group of groups.values()) {
    const N = group.length;
    group.forEach((conn, i) => {
      // Symmetric: -offset…0…+offset centred on 0 (straight when N=1)
      conn.curveOffset = (i - (N - 1) / 2) * CURVE_STEP;
    });
  }
  for (const conn of connections) updateConnection(conn);
}

/** Creates a new connection (allows multiple; curves assigned by recalcPairOffsets). */
function createConnection(fromNode, toNode) {
  const group = makeConnGroup();
  const conn  = { id: nextConnId++, fromId: fromNode.id, toId: toNode.id,
                  label: 'transition', curveOffset: 0, group };
  connections.push(conn);

  // Click on hitarea or label → select
  group.querySelector('.conn-hitarea').addEventListener('click', (e) => {
    e.stopPropagation();
    selectConn(conn);
  });
  const lblEl = group.querySelector('.conn-label');
  lblEl.addEventListener('click', (e) => { e.stopPropagation(); selectConn(conn); });
  lblEl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    selectConn(conn);
    startConnEditing(conn);
  });

  // Delete button
  group.querySelector('.conn-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteConnection(conn);
  });

  recalcPairOffsets();   // also calls updateConnection for all
}

function deleteConnection(conn) {
  if (selectedConn === conn) deselectConn();
  if (editingConn  === conn) cancelConnEditing();
  conn.group.remove();
  connections.splice(connections.indexOf(conn), 1);
  recalcPairOffsets();
}

// ── Connection selection ──────────────────────────────────────────────────────

function selectConn(conn) {
  if (selectedConn === conn) return;
  if (selectedConn) deselectConn();
  if (activeNode)   deactivateNode();
  selectedConn = conn;
  conn.group.classList.add('conn-selected');
  updateConnection(conn);
}

function deselectConn() {
  if (!selectedConn) return;
  if (editingConn) commitConnEditing();
  const prev = selectedConn;
  selectedConn = null;              // clear BEFORE re-rendering so isSelected = false
  prev.group.classList.remove('conn-selected');
  updateConnection(prev);           // hides the × button
}

// ── Connection label editing ──────────────────────────────────────────────────

function startConnEditing(conn) {
  if (editingConn) commitConnEditing();
  editingConn = conn;

  const lblEl = conn.group.querySelector('.conn-label');
  const lx    = parseFloat(lblEl.getAttribute('x'));
  const ly    = parseFloat(lblEl.getAttribute('y')) + 10;   // undo the -10 render offset
  const sc    = worldToScreen(lx, ly);

  const input = document.createElement('input');
  input.type       = 'text';
  input.className  = 'conn-label-input';
  input.value      = conn.label;
  input.style.left = `${sc.x}px`;
  input.style.top  = `${sc.y}px`;
  document.body.appendChild(input);
  connLabelInput = input;
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

function commitConnEditing() {
  if (!editingConn) return;
  const conn   = editingConn;
  editingConn  = null;
  if (connLabelInput) {
    const v = connLabelInput.value.trim();
    if (v) conn.label = v;
    connLabelInput.remove();
    connLabelInput = null;
  }
  const lblEl = conn.group.querySelector('.conn-label');
  if (lblEl) lblEl.style.visibility = '';
  updateConnection(conn);
}

function cancelConnEditing() {
  if (!editingConn) return;
  const conn  = editingConn;
  editingConn = null;
  if (connLabelInput) { connLabelInput.remove(); connLabelInput = null; }
  const lblEl = conn.group.querySelector('.conn-label');
  if (lblEl) lblEl.style.visibility = '';
}

// ── Connection drag-handle ────────────────────────────────────────────────────

function addConnHandle(node) {
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

function removeConnHandle(node) {
  node.el.querySelector('.conn-handle')?.remove();
}

function startDrawingConnection(fromNode) {
  if (selectedConn) deselectConn();
  const group = makeConnGroup();
  group.classList.add('conn-drawing');
  drawingConn = { fromNode, group };
  canvasContainer.style.cursor = 'crosshair';
}

// ── Auto-fit label font size ──────────────────────────────────────────────────

/**
 * Reduces the label's font size (down to MIN_FONT) until all text fits
 * vertically inside the node's content area.  Scales back up if there is
 * room, so removing text makes the font grow again.
 */
function fitLabelFontSize(node) {
  if (node.type !== 'state' && node.type !== 'choice') return;
  const labelEl = node.el.querySelector('.node-label');
  if (!labelEl) return;

  const MAX_FONT = 14;
  const MIN_FONT = 6;

  // Available height (and width for diamonds) for the text block
  let availH, availW;
  if (node.type === 'choice') {
    // Largest axis-aligned rectangle inscribed in the diamond is w/2 × h/2
    availH = node.h * 0.48 - 4;
    availW = node.w * 0.48 - 4;
  } else {
    availH = node.h - 14;
    availW = node.w - 18;
  }

  // Binary-search the largest font size that fits
  let lo = MIN_FONT, hi = MAX_FONT, best = MIN_FONT;
  while (lo <= hi) {
    const mid = (lo + hi) / 2;
    labelEl.style.fontSize = `${mid}px`;
    if (labelEl.scrollHeight <= availH && labelEl.scrollWidth <= availW) {
      best = mid;
      lo = mid + 0.5;
    } else {
      hi = mid - 0.5;
    }
  }
  labelEl.style.fontSize = `${best}px`;
}

// ── Reset node to default size ────────────────────────────────────────────────

function resetNodeSize(node) {
  const def  = NODE_DEFAULTS[node.type];
  // Keep the node visually centred on its current position
  const newX = node.x + (node.w - def.w) / 2;
  const newY = node.y + (node.h - def.h) / 2;
  resizeNode(node, newX, newY, def.w, def.h);
  // Refresh resize handles so they reposition correctly
  if (activeNode === node) {
    removeResizeHandles(node);
    addResizeHandles(node);
  }
}

// ── Minimap viewport indicator ────────────────────────────────────────────────

function updateMinimapViewport(mmScales) {
  const { b, sx, sy } = mmScales || getMinimapScales();
  const cw = canvasContainer.clientWidth;
  const ch = canvasContainer.clientHeight;

  const viewX = -panX / zoom;
  const viewY = -panY / zoom;
  const viewW =  cw   / zoom;
  const viewH =  ch   / zoom;

  mmVP.style.left   = `${(viewX - b.x) * sx}px`;
  mmVP.style.top    = `${(viewY - b.y) * sy}px`;
  mmVP.style.width  = `${viewW * sx}px`;
  mmVP.style.height = `${viewH * sy}px`;
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

// ── Fit All ───────────────────────────────────────────────────────────────────

function fitAll() {
  if (nodes.length === 0) return;

  // Compute bounding box of all nodes in world space
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + node.w);
    maxY = Math.max(maxY, node.y + node.h);
  }

  const PADDING  = 48;   // world-space padding around the content
  minX -= PADDING;
  minY -= PADDING;
  maxX += PADDING;
  maxY += PADDING;

  const contentW = maxX - minX;
  const contentH = maxY - minY;

  const cw = canvasContainer.clientWidth;
  const ch = canvasContainer.clientHeight;

  // Largest zoom that still fits content in the viewport
  const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(cw / contentW, ch / contentH)));

  // Pan so the content is centred in the viewport
  panX = (cw - contentW * newZoom) / 2 - minX * newZoom;
  panY = (ch - contentH * newZoom) / 2 - minY * newZoom;
  zoom = newZoom;

  applyTransform();
}

document.getElementById('btn-fit-all').addEventListener('click', fitAll);

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

// ── Toolbar: palette buttons (drag-to-create) ─────────────────────────────────

function setupPaletteBtn(btnId, type) {
  const btn = document.getElementById(btnId);

  btn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    creatingNode     = true;
    creatingNodeType = type;

    const def = NODE_DEFAULTS[type];
    ghostEl = document.createElement('div');
    ghostEl.className = `diagram-node ${type}-node node-ghost`;
    ghostEl.style.width  = `${def.w}px`;
    ghostEl.style.height = `${def.h}px`;

    if (type === 'choice') {
      ghostEl.innerHTML =
        '<svg class="choice-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
          '<polygon points="50,2 98,50 50,98 2,50"/>' +
        '</svg>' +
        '<span class="node-label">?</span>';
    } else if (type === 'state') {
      ghostEl.innerHTML = `<span class="node-label">State ${nextId}</span>`;
    }

    positionGhost(e.clientX, e.clientY);
    document.body.appendChild(ghostEl);
  });

  btn.addEventListener('dragstart', (e) => e.preventDefault());
}

setupPaletteBtn('btn-new-state',  'state');
setupPaletteBtn('btn-new-start',  'start');
setupPaletteBtn('btn-new-end',    'end');
setupPaletteBtn('btn-new-choice', 'choice');

function positionGhost(clientX, clientY) {
  const def = NODE_DEFAULTS[creatingNodeType];
  ghostEl.style.left = `${clientX - def.w / 2}px`;
  ghostEl.style.top  = `${clientY - def.h / 2}px`;
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
  if (creatingNode) return;
  if (drawingConn)  return;   // mid-draw: don't deselect or pan

  // Deselect connection / node when clicking on empty canvas area
  if (e.button === 0 && !e.target.closest('.conn-group') && !e.target.closest('.diagram-node')) {
    if (selectedConn) deselectConn();
    if (activeNode)   deactivateNode();
  }

  if (e.button === 1) {           // middle mouse button
    e.preventDefault();
    startPan(e);
  } else if (e.button === 0 && activeTool === 'hand') {
    startPan(e);
  }
});

canvasContainer.addEventListener('auxclick', (e) => {
  if (e.button === 1) e.preventDefault();
});

function startPan(e) {
  isPanning = true;
  panOrigin = { x: e.clientX, y: e.clientY, panX, panY };
  canvasContainer.style.cursor = 'grabbing';
  e.preventDefault();
}

// ── Node: mousedown (drag + select) ──────────────────────────────────────────

function onNodeMouseDown(e) {
  if (e.button !== 0) return;
  if (activeTool === 'hand') return;
  if (creatingNode) return;
  if (drawingConn)  return;   // mid-draw: let mouseup handle the target hit-test
  if (e.target.classList.contains('resize-handle')) return;

  e.preventDefault();
  e.stopPropagation();

  // Commit any in-progress edit on a different node
  if (editingNode && editingNode !== e.currentTarget._node) commitEditing();

  const id   = Number(e.currentTarget.dataset.id);
  const node = nodes.find(n => n.id === id);
  if (!node) return;

  activateNode(node);

  // Don't start dragging if we clicked inside the live text editor
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const world = clientToWorld(e.clientX, e.clientY);
  draggingNode = {
    node,
    offsetX: world.x - node.x,
    offsetY: world.y - node.y,
  };
  didDragNode = false;
  node.el.classList.add('dragging');
}

// ── Node: double-click (edit label) ──────────────────────────────────────────

function onNodeDblClick(e) {
  const id   = Number(e.currentTarget.dataset.id);
  const node = nodes.find(n => n.id === id);
  if (!node) return;
  if (node.type !== 'state' && node.type !== 'choice') return;

  e.preventDefault();
  activateNode(node);
  startEditing(node);
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
  if (creatingNode && ghostEl) {
    positionGhost(e.clientX, e.clientY);
  }

  // Rubber-band ghost connection while drawing (straight ghost – no curve offset yet)
  if (drawingConn) {
    const world = clientToWorld(e.clientX, e.clientY);
    const p1    = getBorderPoint(drawingConn.fromNode, world.x, world.y);
    const mx    = (p1.x + world.x) / 2;
    const my    = (p1.y + world.y) / 2;
    renderConnGroup(drawingConn.group, p1, world, mx, my, '', false);
  }

  // Canvas panning
  if (isPanning && panOrigin) {
    panX = panOrigin.panX + (e.clientX - panOrigin.x);
    panY = panOrigin.panY + (e.clientY - panOrigin.y);
    applyTransform();
  }

  // Moving a node
  if (draggingNode) {
    const world = clientToWorld(e.clientX, e.clientY);
    const newX = world.x - draggingNode.offsetX;
    const newY = world.y - draggingNode.offsetY;
    if (!didDragNode &&
        (Math.abs(newX - draggingNode.node.x) > 2 ||
         Math.abs(newY - draggingNode.node.y) > 2)) {
      didDragNode = true;
    }
    moveNode(draggingNode.node, newX, newY);
  }

  // Resizing a node
  if (resizingNode) {
    const { node, handle, startWorldX, startWorldY,
            startX, startY, startW, startH } = resizingNode;
    const world = clientToWorld(e.clientX, e.clientY);
    const dx    = world.x - startWorldX;
    const dy    = world.y - startWorldY;

    const min = NODE_MIN_SIZE[node.type] || { w: 20, h: 20 };
    let newX = startX, newY = startY, newW = startW, newH = startH;

    if (handle.includes('e')) {
      newW = Math.max(min.w, startW + dx);
    }
    if (handle.includes('s')) {
      newH = Math.max(min.h, startH + dy);
    }
    if (handle.includes('w')) {
      newW = Math.max(min.w, startW - dx);
      newX = startX + startW - newW;
    }
    if (handle.includes('n')) {
      newH = Math.max(min.h, startH - dy);
      newY = startY + startH - newH;
    }

    resizeNode(node, newX, newY, newW, newH);
  }

  // Dragging the minimap viewport rectangle
  if (draggingMinimapVP) {
    const { b, sx, sy } = getMinimapScales();
    const mmRect = minimapEl.getBoundingClientRect();
    let mx = e.clientX - mmRect.left - mmVPGrabOffset.x;
    let my = e.clientY - mmRect.top  - mmVPGrabOffset.y;

    const vpW = parseFloat(mmVP.style.width)  || 0;
    const vpH = parseFloat(mmVP.style.height) || 0;
    mx = Math.max(0, Math.min(mx, MM_W - vpW));
    my = Math.max(0, Math.min(my, MM_H - vpH));

    // Convert minimap position back to world space (accounting for dynamic bounds offset)
    const worldX = mx / sx + b.x;
    const worldY = my / sy + b.y;
    panX = -worldX * zoom;
    panY = -worldY * zoom;
    applyTransform();
  }
});

// ── Global: mouseup ───────────────────────────────────────────────────────────

document.addEventListener('mouseup', (e) => {

  // Finish drawing a connection
  if (drawingConn) {
    const world = clientToWorld(e.clientX, e.clientY);
    // Hit-test: find a node under the cursor that isn't the source
    const target = nodes.find(n => {
      if (n.id === drawingConn.fromNode.id) return false;
      return world.x >= n.x && world.x <= n.x + n.w &&
             world.y >= n.y && world.y <= n.y + n.h;
    });
    drawingConn.group.remove();
    if (target) createConnection(drawingConn.fromNode, target);
    drawingConn = null;
    updateCursor();
  }

  // Finish dragging from toolbar – place node if released over canvas
  if (creatingNode) {
    if (ghostEl) {
      const rect = canvasContainer.getBoundingClientRect();
      const overCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom;

      if (overCanvas) {
        const def   = NODE_DEFAULTS[creatingNodeType];
        const world = clientToWorld(e.clientX, e.clientY);
        createNode(creatingNodeType, world.x - def.w / 2, world.y - def.h / 2);
      }

      ghostEl.remove();
      ghostEl = null;
    }
    creatingNode     = false;
    creatingNodeType = null;
  }

  // Finish panning
  if (isPanning) {
    isPanning = false;
    panOrigin = null;
    updateCursor();
  }

  // Finish moving a node
  if (draggingNode) {
    draggingNode.node.el.classList.remove('dragging');
    draggingNode = null;
  }

  // Finish resizing
  if (resizingNode) {
    resizingNode = null;
  }

  // Finish dragging minimap viewport
  if (draggingMinimapVP) {
    draggingMinimapVP = false;
  }
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
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
    case 'f':
    case 'F':
      fitAll();
      break;
    case 'h':
    case 'H':
      btnHandTool.click();
      break;
    case 'Escape':
      if (editingConn) { cancelConnEditing(); break; }
      // Cancel in-progress connection drawing
      if (drawingConn) {
        drawingConn.group.remove();
        drawingConn = null;
        updateCursor();
        break;
      }
      // Cancel in-progress toolbar drag
      if (creatingNode && ghostEl) {
        ghostEl.remove();
        ghostEl          = null;
        creatingNode     = false;
        creatingNodeType = null;
        break;
      }
      if (selectedConn) { deselectConn(); break; }
      if (activeNode)   { deactivateNode(); break; }
      break;
  }
});

// ── Window resize ─────────────────────────────────────────────────────────────

window.addEventListener('resize', updateMinimapViewport);

// ── Initialise ────────────────────────────────────────────────────────────────

applyTransform();
