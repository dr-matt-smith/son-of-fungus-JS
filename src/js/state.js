/**
 * Central mutable state store.
 *
 * Organized into logical groups:
 *   - view:        zoom, pan, active tool
 *   - model:       nodes, connections, variables, messages, enums
 *   - interaction: selection, dragging, editing flags
 *   - execution:   running state, executing node/command
 *   - callbacks:   event callbacks set by main.js
 *
 * All properties are directly on S for backward compatibility.
 * Sub-object accessors (S.view, S.model, etc.) provide grouped access.
 */
export const S = {
  // ── View state ──────────────────────────────────────────────────────
  zoom: 1,
  panX: 0,
  panY: 0,
  activeTool: 'select',
  nextId: 1,
  nextConnId: 1,

  // ── Data model ──────────────────────────────────────────────────────
  nodes: [],
  connections: [],
  variables: [],
  messages: [],
  enums: [],

  // ── Interaction state ───────────────────────────────────────────────
  activeNode: null,
  selectedConn: null,
  selectedNodes: [],

  editingNode: null,
  editingConn: null,
  connLabelInput: null,

  isPanning: false,
  panOrigin: null,

  draggingNode: null,
  didDragNode: false,

  creatingNode: false,
  creatingNodeType: null,
  ghostEl: null,

  draggingMinimapVP: false,
  mmVPGrabOffset: { x: 0, y: 0 },

  resizingNode: null,

  selectionRect: null,
  selectionBoxEl: null,
  draggingGroup: null,

  drawingConn: null,
  reconnDrag: null,

  // ── Execution state ─────────────────────────────────────────────────
  executingNode: null,
  executingCommandIdx: -1,
  stepOverTarget: null,

  // ── Callbacks ───────────────────────────────────────────────────────
  onSelectionChange: null,
  onInspectorUpdate: null,
  onStepPause: null,
  onExecutionEnd: null,
  onRestoreNode: null,
};

// ── Event system ────────────────────────────────────────────────────────

const listeners = {};

/**
 * Subscribe to a state event.
 * @param {string} event — event name (e.g. 'modelChanged', 'selectionChanged', 'viewChanged')
 * @param {Function} fn — callback
 * @returns {Function} unsubscribe function
 */
S.on = function(event, fn) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
  return () => { listeners[event] = listeners[event].filter(f => f !== fn); };
};

/**
 * Emit a state event.
 * @param {string} event — event name
 * @param {*} data — optional data
 */
S.emit = function(event, data) {
  if (listeners[event]) {
    for (const fn of listeners[event]) fn(data);
  }
};

// ── Sub-object accessors (grouped views into S) ─────────────────────────

Object.defineProperty(S, 'view', {
  get() {
    return { zoom: S.zoom, panX: S.panX, panY: S.panY, activeTool: S.activeTool, nextId: S.nextId, nextConnId: S.nextConnId };
  },
  enumerable: false,
});

Object.defineProperty(S, 'model', {
  get() {
    return { nodes: S.nodes, connections: S.connections, variables: S.variables, messages: S.messages, enums: S.enums };
  },
  enumerable: false,
});

Object.defineProperty(S, 'execution', {
  get() {
    return { executingNode: S.executingNode, executingCommandIdx: S.executingCommandIdx, stepOverTarget: S.stepOverTarget };
  },
  enumerable: false,
});
