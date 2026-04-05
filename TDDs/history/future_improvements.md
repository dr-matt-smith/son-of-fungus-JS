# Future Improvements — Architectural Refactoring

This document suggests architectural refactoring to make the StateGen project easier to extend and test.

---

## 1. Split `app.js` into modules

**Problem:** All 1,600+ lines of logic live in a single `src/js/app.js` file. This makes it hard to find, test, or extend individual features without reading the entire file.

**Suggestion:** Split into focused modules by concern:

```
src/js/
  main.js              — entry point: imports modules, wires up event listeners, initialises
  config.js            — constants (WORLD_W, ZOOM_MIN, NODE_DEFAULTS, NODE_MIN_SIZE, etc.)
  state.js             — shared mutable state (nodes[], connections[], zoom, pan, activeNode, etc.)
  dom-refs.js          — getElementById calls, exported as named constants
  transform.js         — applyTransform, zoomAround, clientToWorld, relativeToContainer, fitAll
  nodes/
    node-model.js      — createNode, moveNode, resizeNode, deleteNode, resetNodeSize
    node-element.js    — buildNodeElement, fitLabelFontSize
    node-editing.js    — startEditing, commitEditing, cancelEditing
    node-selection.js  — activateNode, deactivateNode, selectGroup, clearGroup
    resize-handles.js  — addResizeHandles, removeResizeHandles
  connections/
    conn-model.js      — createConnection, deleteConnection, recalcPairOffsets
    conn-render.js     — makeConnGroup, renderConnGroup, updateConnection, updateConnectionsForNode
    conn-selection.js  — selectConn, deselectConn, reconnection handle logic
    conn-editing.js    — startConnEditing, commitConnEditing, cancelConnEditing
    conn-geometry.js   — getBorderPoint, getPairPerpendicular, makeArrowPoints
  minimap.js           — refreshMinimap, positionMinimapNode, updateMinimapViewport, minimize/restore
  toolbar.js           — palette button setup, hand tool toggle, zoom button handlers
  events.js            — global mousedown/mousemove/mouseup/keydown/wheel handlers
```

**Why this helps:**
- Each module can be unit-tested independently by importing just that module
- New features (e.g. undo/redo, save/load) slot into a clear location
- Developers can work on connections without scrolling past unrelated node code

---

## 2. Extract state into a central store

**Problem:** Mutable state is scattered across 15+ `let` variables at the top of app.js. It is hard to track what modifies what, and tests need getter functions to read current values.

**Suggestion:** Create a single state object:

```js
// state.js
export const appState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  activeTool: 'select',
  activeNode: null,
  selectedConn: null,
  selectedNodes: [],
  editingNode: null,
  editingConn: null,
  nodes: [],
  connections: [],
  // interaction flags
  isPanning: false,
  draggingNode: null,
  resizingNode: null,
  selectionRect: null,
  draggingGroup: null,
  reconnDrag: null,
  drawingConn: null,
  creatingNode: false,
};
```

**Why this helps:**
- One place to inspect/debug all state
- Tests import `appState` directly — no getter functions needed
- Enables future features like undo/redo (snapshot/restore the state object)
- Makes it easy to add save/load (serialise `appState` to JSON)

---

## 3. Separate geometry from DOM

**Problem:** Geometry functions like `getBorderPoint` and `getPairPerpendicular` are pure math, but they live alongside DOM-manipulating code. This makes them harder to test in isolation.

**Suggestion:** Move all pure geometry into `conn-geometry.js` (or `geometry.js`). These functions take plain objects `{ x, y, w, h, type }` and return plain objects — no DOM dependency. They can be tested with fast Vitest unit tests without jsdom.

Functions to extract:
- `getBorderPoint(node, targetX, targetY)` 
- `getPairPerpendicular(from, to)`
- `makeArrowPoints(px, py, angle)`
- `getMinimapBounds(nodes)` — change to accept nodes as a parameter
- `getMinimapScales(nodes)` — same

---

## 4. Use command pattern

**Problem:** The global mousemove/mouseup handlers are 120+ line functions with deeply nested `if` chains checking every possible interaction state. Adding a new interaction mode means adding another branch to each handler.

**Suggestion:** Use an interaction mode / state machine approach:

```js
const modes = {
  idle:       { mousemove() {}, mouseup() {} },
  panning:    { mousemove(e) { /* pan logic */ }, mouseup() { /* finish */ } },
  dragging:   { mousemove(e) { /* move node */ }, mouseup() { /* finish */ } },
  resizing:   { mousemove(e) { /* resize */ },    mouseup() { /* finish */ } },
  drawing:    { mousemove(e) { /* rubber-band */ }, mouseup() { /* connect */ } },
  selecting:  { mousemove(e) { /* rect */ },       mouseup() { /* finish */ } },
  reconnecting: { ... },
};

let currentMode = modes.idle;

document.addEventListener('mousemove', (e) => currentMode.mousemove(e));
document.addEventListener('mouseup',   (e) => { currentMode.mouseup(e); currentMode = modes.idle; });
```

**Why this helps:**
- Each mode is self-contained and testable
- Adding a new interaction (e.g. lasso select, text drag) means adding a new mode object, not editing a giant if/else chain
- No risk of one mode's logic accidentally running during another

---

## 5. Introduce a render layer abstraction

**Problem:** Node creation directly builds DOM elements with `createElement`, sets inline styles, and appends to the canvas. This tightly couples data and presentation.

**Suggestion:** Separate the node data model from its DOM representation:

```js
// Node data (plain object, no DOM)
function createNodeData(type, x, y) {
  return { id: nextId++, type, x, y, w: defaults.w, h: defaults.h, label };
}

// Renderer (creates/updates DOM from data)
function renderNode(node) {
  if (!node.el) { node.el = buildNodeElement(node); canvasEl.appendChild(node.el); }
  node.el.style.left = `${node.x}px`;
  // ...
}
```

**Why this helps:**
- Data-only node objects are easy to serialise (save/load, undo/redo)
- Could swap DOM rendering for Canvas/WebGL in the future without changing the data layer
- Unit tests can test data logic without needing jsdom

---

## 6. Add save/load capability

**Problem:** All diagram state is lost on page refresh.

**Suggestion:** Serialise `nodes` and `connections` to JSON and save to `localStorage` (or allow file export/import). The state store (improvement #2) makes this straightforward:

```js
function serialise() {
  return JSON.stringify({
    nodes: appState.nodes.map(({ id, type, x, y, w, h, label }) => ({ id, type, x, y, w, h, label })),
    connections: appState.connections.map(({ id, fromId, toId, label, curveOffset, danglingFrom, danglingTo }) =>
      ({ id, fromId, toId, label, curveOffset, danglingFrom, danglingTo })),
    zoom: appState.zoom, panX: appState.panX, panY: appState.panY,
  });
}
```

**Why this helps:**
- Essential for real-world use
- Enables undo/redo (store state snapshots)
- Enables sharing diagrams

---

## 7. Add undo/redo

**Problem:** No way to undo accidental deletions or moves.

**Suggestion:** Implement a command stack. Each user action (move, resize, delete, create, connect) pushes a command object with `execute()` and `undo()` methods. Ctrl+Z pops and undoes; Ctrl+Shift+Z redoes.

This is significantly easier to implement after improvements #2 (central state) and #5 (data/render separation).

---

## 8. Add `data-testid` attributes

**Problem:** Playwright tests rely on CSS classes (`.state-node`, `.conn-handle`) which could change during styling work, breaking tests.

**Suggestion:** Add `data-testid` attributes to interactive elements:

```html
<div data-testid="node-state-1" class="diagram-node state-node">
```

```js
// In tests:
page.locator('[data-testid="node-state-1"]')
```

**Why this helps:**
- Decouples test selectors from visual styling
- CSS refactoring won't break tests
- Standard practice for component testing

---

## Priority order

| Priority | Improvement | Effort | Impact |
|----------|------------|--------|--------|
| 1 | Split app.js into modules | Medium | High — unlocks all other improvements |
| 2 | Central state store | Low | High — simplifies testing, enables save/undo |
| 3 | Separate geometry from DOM | Low | Medium — fast pure unit tests |
| 4 | Interaction mode / state machine | Medium | High — cleaner event handling, easier to extend |
| 5 | Data/render separation | Medium | Medium — enables save/load and future renderers |
| 6 | Add data-testid attributes | Low | Low-Medium — more robust tests |
| 7 | Save/load | Low (after #2) | High — essential for real use |
| 8 | Undo/redo | Medium (after #2, #5) | High — essential for real use |
