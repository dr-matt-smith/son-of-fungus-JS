import { S } from '../state.js';
import { canvasEl } from '../dom-refs.js';
import { commitEditing } from './node-editing.js';
import { addResizeHandles, removeResizeHandles } from './resize-handles.js';
import { addConnHandle, removeConnHandle } from '../connections/conn-handle.js';
import { deselectConn } from '../connections/conn-selection.js';
import { deleteConnection } from '../connections/conn-model.js';
import { syncAutoConnections, applyFungusStyles } from '../fungus-mode.js';
import { updateCursor } from '../transform.js';

export function addNodeDeleteHandle(node) {
  if (node.el.querySelector('.node-delete-handle')) return;
  const btn = document.createElement('div');
  btn.className = 'node-delete-handle';
  btn.title     = 'Delete this node';
  btn.textContent = '×';
  btn.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteNode(node);
  });
  node.el.appendChild(btn);
}

export function removeNodeDeleteHandle(node) {
  node.el.querySelector('.node-delete-handle')?.remove();
}

export function activateNode(node) {
  if (S.activeNode === node) return;
  if (S.selectedConn) deselectConn();
  deactivateNode();
  S.activeNode = node;
  node.el.classList.add('node-active');
  if ((node.type === 'state' || node.type === 'choice') && S.diagramMode !== 'fungus') {
    addResizeHandles(node);
  }
  if (node.type !== 'end' && S.diagramMode !== 'fungus') addConnHandle(node);
  addNodeDeleteHandle(node);
  if (S.onSelectionChange) S.onSelectionChange();
}

export function deactivateNode() {
  if (!S.activeNode) return;
  if (S.editingNode) commitEditing();
  if (S.drawingConn) {
    S.drawingConn.group.remove();
    S.drawingConn = null;
    updateCursor();
  }
  if (S.activeNode.type === 'state' || S.activeNode.type === 'choice') {
    removeResizeHandles(S.activeNode);
  }
  removeConnHandle(S.activeNode);
  removeNodeDeleteHandle(S.activeNode);
  S.activeNode.el.classList.remove('node-active');
  S.activeNode = null;
  if (S.onSelectionChange) S.onSelectionChange();
}

// Group selection

export function selectGroup(nodesToSelect) {
  clearGroup();
  if (S.activeNode) deactivateNode();
  if (S.selectedConn) deselectConn();
  S.selectedNodes = nodesToSelect;
  for (const node of S.selectedNodes) {
    node.el.classList.add('node-group-selected');
  }
}

export function clearGroup() {
  for (const node of S.selectedNodes) {
    node.el.classList.remove('node-group-selected');
  }
  S.selectedNodes = [];
  S.draggingGroup = null;
}

export function startSelectionRect(worldX, worldY) {
  S.selectionRect = { startX: worldX, startY: worldY };
  S.selectionBoxEl = document.createElement('div');
  S.selectionBoxEl.className = 'selection-rect';
  S.selectionBoxEl.style.left   = `${worldX}px`;
  S.selectionBoxEl.style.top    = `${worldY}px`;
  S.selectionBoxEl.style.width  = '0px';
  S.selectionBoxEl.style.height = '0px';
  canvasEl.appendChild(S.selectionBoxEl);
}

export function updateSelectionRect(worldX, worldY) {
  if (!S.selectionRect || !S.selectionBoxEl) return;
  const x = Math.min(S.selectionRect.startX, worldX);
  const y = Math.min(S.selectionRect.startY, worldY);
  const w = Math.abs(worldX - S.selectionRect.startX);
  const h = Math.abs(worldY - S.selectionRect.startY);
  S.selectionBoxEl.style.left   = `${x}px`;
  S.selectionBoxEl.style.top    = `${y}px`;
  S.selectionBoxEl.style.width  = `${w}px`;
  S.selectionBoxEl.style.height = `${h}px`;
}

export function finishSelectionRect(worldX, worldY) {
  if (!S.selectionRect) return;
  const rx = Math.min(S.selectionRect.startX, worldX);
  const ry = Math.min(S.selectionRect.startY, worldY);
  const rw = Math.abs(worldX - S.selectionRect.startX);
  const rh = Math.abs(worldY - S.selectionRect.startY);

  if (S.selectionBoxEl) { S.selectionBoxEl.remove(); S.selectionBoxEl = null; }
  S.selectionRect = null;

  if (rw < 4 && rh < 4) return;

  const hits = S.nodes.filter(n => {
    const cx = n.x + n.w / 2;
    const cy = n.y + n.h / 2;
    return cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh;
  });

  if (hits.length === 1) {
    activateNode(hits[0]);
  } else if (hits.length > 1) {
    selectGroup(hits);
  }
}

// Node deletion

import { getBorderPoint } from '../connections/geometry.js';
import { updateConnection } from '../connections/conn-render.js';
import { refreshMinimap } from '../minimap.js';

export function deleteNode(node) {
  if (S.activeNode === node) {
    if (S.editingNode === node) commitEditing();
    if (node.type === 'state' || node.type === 'choice') removeResizeHandles(node);
    removeConnHandle(node);
    removeNodeDeleteHandle(node);
    node.el.classList.remove('node-active');
    S.activeNode = null;
  }

  if (S.diagramMode === 'fungus') {
    // In fungus mode: clear call/menu references to this block, delete connections
    for (const n of S.nodes) {
      for (const cmd of n.commands) {
        if (cmd.type === 'call' && cmd.targetBlockId === node.id) {
          cmd.targetBlockId = null;
        }
        if (cmd.type === 'menu') {
          for (const opt of cmd.options) {
            if (opt.targetBlockId === node.id) opt.targetBlockId = null;
          }
        }
      }
    }
    // Delete all connections to/from this node
    const toDelete = S.connections.filter(c => c.fromId === node.id || c.toId === node.id);
    for (const conn of toDelete) deleteConnection(conn);
  } else {
    // In statechart mode: leave connections as dangling
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;
    for (const conn of S.connections) {
      if (conn.fromId === node.id) {
        const to = S.nodes.find(n => n.id === conn.toId);
        if (to) {
          const toC = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
          const bp = getBorderPoint(node, toC.x, toC.y);
          conn.danglingFrom = { x: bp.x, y: bp.y };
        } else {
          conn.danglingFrom = { x: cx, y: cy };
        }
        conn.fromId = null;
      }
      if (conn.toId === node.id) {
        const from = S.nodes.find(n => n.id === conn.fromId);
        if (from) {
          const fromC = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
          const bp = getBorderPoint(node, fromC.x, fromC.y);
          conn.danglingTo = { x: bp.x, y: bp.y };
        } else {
          conn.danglingTo = { x: cx, y: cy };
        }
        conn.toId = null;
      }
    }
  }

  node.el.remove();
  node.mmEl.remove();
  S.nodes.splice(S.nodes.indexOf(node), 1);

  if (S.diagramMode === 'fungus') {
    applyFungusStyles();
    syncAutoConnections();
  } else {
    for (const conn of S.connections) {
      updateConnection(conn);
    }
  }
  refreshMinimap();
  if (S.onSelectionChange) S.onSelectionChange();
}
