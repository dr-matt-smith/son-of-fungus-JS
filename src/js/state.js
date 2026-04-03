/**
 * Central mutable state store.
 * All app state lives here — import and mutate directly.
 */
export const S = {
  zoom: 1,
  panX: 0,
  panY: 0,
  activeTool: 'select',
  diagramMode: 'statechart',  // 'statechart' | 'fungus'
  nextId: 1,
  nextConnId: 1,

  nodes: [],
  connections: [],
  variables: [],    // flowchart-level variables: { name, type, value }

  // Currently active / selected
  activeNode: null,
  selectedConn: null,
  selectedNodes: [],

  // Editing
  editingNode: null,
  editingConn: null,
  connLabelInput: null,

  // Interaction flags
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

  // Execution state
  executingNode: null,
  executingCommandIdx: -1,

  // Callback invoked whenever selection changes (set by main.js)
  onSelectionChange: null,
};
