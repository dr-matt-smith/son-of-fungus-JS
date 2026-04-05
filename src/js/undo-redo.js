/**
 * Undo/Redo system using a snapshot-based approach.
 *
 * Instead of wrapping every mutation in a command object (which would require
 * refactoring every state change across the codebase), this uses serialisable
 * snapshots of the model state. A snapshot is taken before each user action.
 *
 * This is simpler and works with the existing direct-mutation pattern.
 */
import { S } from './state.js';

const MAX_HISTORY = 50;
let undoStack = [];
let redoStack = [];

/**
 * Take a snapshot of the current model state.
 * Call this BEFORE making a change the user might want to undo.
 */
export function saveSnapshot() {
  const snapshot = {
    nodes: JSON.parse(JSON.stringify(S.nodes.map(n => ({
      id: n.id, type: n.type, x: n.x, y: n.y, w: n.w, h: n.h,
      label: n.label, event: n.event, commands: n.commands,
      description: n.description || '',
    })))),
    variables: JSON.parse(JSON.stringify(S.variables)),
    messages: [...S.messages],
    enums: JSON.parse(JSON.stringify(S.enums)),
    nextId: S.nextId,
    nextConnId: S.nextConnId,
  };
  undoStack.push(snapshot);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = []; // clear redo on new action
}

/**
 * Undo the last action by restoring the previous snapshot.
 * Returns true if undo was performed.
 */
export function undo() {
  if (undoStack.length === 0) return false;

  // Save current state to redo stack
  redoStack.push(takeCurrentSnapshot());

  // Restore previous state
  const snapshot = undoStack.pop();
  restoreSnapshot(snapshot);
  S.emit('modelChanged');
  return true;
}

/**
 * Redo the last undone action.
 * Returns true if redo was performed.
 */
export function redo() {
  if (redoStack.length === 0) return false;

  // Save current state to undo stack
  undoStack.push(takeCurrentSnapshot());

  const snapshot = redoStack.pop();
  restoreSnapshot(snapshot);
  S.emit('modelChanged');
  return true;
}

export function canUndo() { return undoStack.length > 0; }
export function canRedo() { return redoStack.length > 0; }
export function clearHistory() { undoStack = []; redoStack = []; }

// ── Internal helpers ────────────────────────────────────────────────────────

function takeCurrentSnapshot() {
  return {
    nodes: JSON.parse(JSON.stringify(S.nodes.map(n => ({
      id: n.id, type: n.type, x: n.x, y: n.y, w: n.w, h: n.h,
      label: n.label, event: n.event, commands: n.commands,
      description: n.description || '',
    })))),
    variables: JSON.parse(JSON.stringify(S.variables)),
    messages: [...S.messages],
    enums: JSON.parse(JSON.stringify(S.enums)),
    nextId: S.nextId,
    nextConnId: S.nextConnId,
  };
}

function restoreSnapshot(snapshot) {
  // Clear existing DOM elements
  for (const n of S.nodes) {
    n.el.remove();
    n.mmEl.remove();
  }
  for (const c of S.connections) {
    if (c.group) c.group.remove();
  }

  S.nodes.length = 0;
  S.connections.length = 0;
  S.activeNode = null;
  S.selectedConn = null;
  S.selectedNodes = [];

  S.variables = snapshot.variables;
  S.messages = snapshot.messages;
  S.enums = snapshot.enums;
  S.nextId = snapshot.nextId;
  S.nextConnId = snapshot.nextConnId;

  // Rebuild nodes — use the onRestoreNode callback set by main.js
  if (S.onRestoreNode) {
    for (const nd of snapshot.nodes) {
      S.onRestoreNode(nd);
    }
  }
}
