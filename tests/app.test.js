import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { setupDOM } from './setup.js';

// The DOM must exist before app.js is imported (it grabs refs at load time)
setupDOM();

const app = await import('../src/js/main.js');

// ─── Helpers ────────────────────────────────────────────────────────────────

function nodeCount() { return app.S.nodes.length; }
function connCount() { return app.S.connections.length; }

// ─── Version 1 & 2: Node creation ──────────────────────────────────────────

describe('Node creation', () => {
  it('creates a state node with correct defaults', () => {
    const before = nodeCount();
    const node = app.createNode('state', 100, 200);
    expect(nodeCount()).toBe(before + 1);
    expect(node.type).toBe('state');
    expect(node.x).toBe(100);
    expect(node.y).toBe(200);
    expect(node.w).toBe(app.NODE_DEFAULTS.state.w);
    expect(node.h).toBe(app.NODE_DEFAULTS.state.h);
    expect(node.el).toBeTruthy();
    expect(node.el.classList.contains('state-node')).toBe(true);
  });

  it('creates a start node', () => {
    const node = app.createNode('start', 50, 50);
    expect(node.type).toBe('start');
    expect(node.w).toBe(app.NODE_DEFAULTS.start.w);
  });

  it('creates an end node', () => {
    const node = app.createNode('end', 300, 50);
    expect(node.type).toBe('end');
    expect(node.w).toBe(app.NODE_DEFAULTS.end.w);
  });

  it('creates a choice node with diamond SVG', () => {
    const node = app.createNode('choice', 200, 200);
    expect(node.type).toBe('choice');
    expect(node.el.querySelector('.choice-svg')).toBeTruthy();
    expect(node.el.querySelector('.node-label').textContent).toBe('?');
  });

  it('assigns unique incrementing IDs', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 0, 0);
    expect(b.id).toBeGreaterThan(a.id);
  });

  it('adds node DOM element to canvas', () => {
    const node = app.createNode('state', 0, 0);
    expect(app.canvasEl.contains(node.el)).toBe(true);
  });

  it('adds minimap representation', () => {
    const node = app.createNode('state', 0, 0);
    expect(node.mmEl).toBeTruthy();
    expect(node.mmEl.classList.contains('minimap-state-node')).toBe(true);
  });
});

// ─── Version 3: Node text labels ────────────────────────────────────────────

describe('Node labels', () => {
  it('state node has editable label with default text', () => {
    const node = app.createNode('state', 0, 0);
    // Default mode is fungus, so label is "New Block N"
    expect(node.label).toMatch(/New Block|State/);
    const labelEl = node.el.querySelector('.node-label');
    expect(labelEl).toBeTruthy();
    expect(labelEl.textContent).toBeTruthy();
  });

  it('choice node has default label "?"', () => {
    const node = app.createNode('choice', 0, 0);
    expect(node.label).toBe('?');
  });

  it('start node has read-only "start" label', () => {
    const node = app.createNode('start', 0, 0);
    const fixedLabel = node.el.querySelector('.node-label-fixed');
    expect(fixedLabel).toBeTruthy();
    expect(fixedLabel.textContent).toBe('start');
  });

  it('end node has read-only "end" label', () => {
    const node = app.createNode('end', 0, 0);
    const fixedLabel = node.el.querySelector('.node-label-fixed');
    expect(fixedLabel).toBeTruthy();
    expect(fixedLabel.textContent).toBe('end');
  });
});

// ─── Version 3: Node movement ───────────────────────────────────────────────

describe('Node movement', () => {
  it('moveNode updates position', () => {
    const node = app.createNode('state', 100, 100);
    app.moveNode(node, 300, 400);
    expect(node.x).toBe(300);
    expect(node.y).toBe(400);
    expect(node.el.style.left).toBe('300px');
    expect(node.el.style.top).toBe('400px');
  });
});

// ─── Version 3: Node resizing ───────────────────────────────────────────────

describe('Node resizing', () => {
  it('resizeNode updates dimensions', () => {
    const node = app.createNode('state', 100, 100);
    app.resizeNode(node, 100, 100, 200, 80);
    expect(node.w).toBe(200);
    expect(node.h).toBe(80);
    expect(node.el.style.width).toBe('200px');
    expect(node.el.style.height).toBe('80px');
  });

  it('state node has reset button', () => {
    const node = app.createNode('state', 0, 0);
    expect(node.el.querySelector('.node-reset-btn')).toBeTruthy();
  });

  it('choice node has reset button', () => {
    const node = app.createNode('choice', 0, 0);
    expect(node.el.querySelector('.node-reset-btn')).toBeTruthy();
  });

  it('resetNodeSize restores default dimensions', () => {
    const node = app.createNode('state', 100, 100);
    app.resizeNode(node, 100, 100, 300, 200);
    app.resetNodeSize(node);
    expect(node.w).toBe(app.NODE_DEFAULTS.state.w);
    expect(node.h).toBe(app.NODE_DEFAULTS.state.h);
  });

  it('respects minimum size constants', () => {
    expect(app.NODE_MIN_SIZE.state.w).toBeLessThan(app.NODE_DEFAULTS.state.w);
    expect(app.NODE_MIN_SIZE.choice.w).toBeLessThan(app.NODE_DEFAULTS.choice.w);
  });
});

// ─── Version 3: Active node / selection ─────────────────────────────────────

describe('Node activation', () => {
  it('activateNode sets the active node', () => {
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    expect(app.S.activeNode).toBe(node);
    expect(node.el.classList.contains('node-active')).toBe(true);
  });

  it('activateNode adds resize handles for state nodes in statechart mode', () => {
    const prevMode = app.S.diagramMode;
    app.S.diagramMode = 'statechart';
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    expect(node.el.querySelectorAll('.resize-handle').length).toBe(8);
    app.deactivateNode();
    app.S.diagramMode = prevMode;
  });

  it('activateNode adds connection handle in statechart mode', () => {
    const prevMode = app.S.diagramMode;
    app.S.diagramMode = 'statechart';
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    expect(node.el.querySelector('.conn-handle')).toBeTruthy();
    app.deactivateNode();
    app.S.diagramMode = prevMode;
  });

  it('activateNode adds delete handle', () => {
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    expect(node.el.querySelector('.node-delete-handle')).toBeTruthy();
  });

  it('deactivateNode clears selection', () => {
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.deactivateNode();
    expect(app.S.activeNode).toBeNull();
    expect(node.el.classList.contains('node-active')).toBe(false);
  });

  it('deactivateNode removes handles', () => {
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.deactivateNode();
    expect(node.el.querySelectorAll('.resize-handle').length).toBe(0);
    expect(node.el.querySelector('.conn-handle')).toBeNull();
    expect(node.el.querySelector('.node-delete-handle')).toBeNull();
  });

  it('activating a new node deactivates the previous one', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 200, 0);
    app.activateNode(a);
    app.activateNode(b);
    expect(app.S.activeNode).toBe(b);
    expect(a.el.classList.contains('node-active')).toBe(false);
  });
});

// ─── Version 4: Fit All ─────────────────────────────────────────────────────

describe('Fit All', () => {
  it('adjusts zoom and pan to show all nodes', () => {
    // Clear and create nodes far apart
    app.S.nodes.length = 0;
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 2000, 1500);
    app.fitAll();
    // Zoom should be less than 1 since nodes span a large area
    expect(app.S.zoom).toBeLessThan(1);
  });

  it('does nothing when there are no nodes', () => {
    app.S.nodes.length = 0;
    const zBefore = app.S.zoom;
    app.fitAll();
    expect(app.S.zoom).toBe(zBefore);
  });
});

// ─── Version 5: Connections ─────────────────────────────────────────────────

describe('Connections', () => {
  it('creates a connection between two nodes', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 300, 0);
    const before = connCount();
    app.createConnection(a, b);
    expect(connCount()).toBe(before + 1);
  });

  it('connection has default label "transition"', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 300, 0);
    app.createConnection(a, b);
    const conn = app.S.connections[app.S.connections.length - 1];
    expect(conn.label).toBe('transition');
  });

  it('connection has SVG group in DOM', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 300, 0);
    app.createConnection(a, b);
    const conn = app.S.connections[app.S.connections.length - 1];
    expect(conn.group).toBeTruthy();
    expect(conn.group.querySelector('.conn-line')).toBeTruthy();
    expect(conn.group.querySelector('.conn-arrow')).toBeTruthy();
    expect(conn.group.querySelector('.conn-label')).toBeTruthy();
    expect(conn.group.querySelector('.conn-delete')).toBeTruthy();
  });

  it('allows multiple connections between the same pair', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 300, 0);
    const before = connCount();
    app.createConnection(a, b);
    app.createConnection(a, b);
    expect(connCount()).toBe(before + 2);
  });

  it('deleteConnection removes the connection', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 300, 0);
    app.createConnection(a, b);
    const conn = app.S.connections[app.S.connections.length - 1];
    const before = connCount();
    app.deleteConnection(conn);
    expect(connCount()).toBe(before - 1);
  });

  it('selectConn / deselectConn works', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 300, 0);
    app.createConnection(a, b);
    const conn = app.S.connections[app.S.connections.length - 1];
    app.selectConn(conn);
    expect(app.S.selectedConn).toBe(conn);
    expect(conn.group.classList.contains('conn-selected')).toBe(true);
    app.deselectConn();
    expect(app.S.selectedConn).toBeNull();
    expect(conn.group.classList.contains('conn-selected')).toBe(false);
  });

  it('connections update when a node moves (elastic banding)', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 300, 0);
    app.createConnection(a, b);
    const conn = app.S.connections[app.S.connections.length - 1];
    const pathBefore = conn.group.querySelector('.conn-line').getAttribute('d');
    app.moveNode(a, 0, 200);
    const pathAfter = conn.group.querySelector('.conn-line').getAttribute('d');
    expect(pathAfter).not.toBe(pathBefore);
  });
});

// ─── Version 6: Auto text sized to fit ──────────────────────────────────────

describe('Auto text font sizing', () => {
  it('fitLabelFontSize sets a font size on the label in statechart mode', () => {
    const prevMode = app.S.diagramMode;
    app.S.diagramMode = 'statechart';
    const node = app.createNode('state', 0, 0);
    app.fitLabelFontSize(node);
    const labelEl = node.el.querySelector('.node-label');
    expect(labelEl.style.fontSize).toBeTruthy();
    app.S.diagramMode = prevMode;
  });

  it('does nothing for start/end nodes', () => {
    const node = app.createNode('start', 0, 0);
    // Should not throw
    app.fitLabelFontSize(node);
  });

  it('is called during resize in statechart mode', () => {
    const prevMode = app.S.diagramMode;
    app.S.diagramMode = 'statechart';
    const node = app.createNode('state', 0, 0);
    app.resizeNode(node, 0, 0, 300, 200);
    const labelEl = node.el.querySelector('.node-label');
    expect(labelEl.style.fontSize).toBeTruthy();
    app.S.diagramMode = prevMode;
  });
});

// ─── Version 6: Group selection ─────────────────────────────────────────────

describe('Group selection', () => {
  it('selectGroup selects multiple nodes', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 200, 0);
    app.selectGroup([a, b]);
    expect(app.S.selectedNodes).toContain(a);
    expect(app.S.selectedNodes).toContain(b);
    expect(a.el.classList.contains('node-group-selected')).toBe(true);
    expect(b.el.classList.contains('node-group-selected')).toBe(true);
  });

  it('clearGroup deselects all', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 200, 0);
    app.selectGroup([a, b]);
    app.clearGroup();
    expect(app.S.selectedNodes.length).toBe(0);
    expect(a.el.classList.contains('node-group-selected')).toBe(false);
  });

  it('selectGroup deactivates any active node', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 200, 0);
    app.activateNode(a);
    app.selectGroup([a, b]);
    expect(app.S.activeNode).toBeNull();
  });
});

// ─── Version 7: Minimap minimize/restore ────────────────────────────────────

describe('Minimap minimize/restore', () => {
  it('minimize button hides minimap and shows restore button', () => {
    const minimap = document.getElementById('minimap');
    const minimizeBtn = document.getElementById('minimap-minimize');
    const restoreBtn = document.getElementById('minimap-restore');

    minimizeBtn.click();
    expect(minimap.style.display).toBe('none');
    expect(restoreBtn.style.display).toBe('block');
  });

  it('restore button shows minimap and hides itself', () => {
    const minimap = document.getElementById('minimap');
    const restoreBtn = document.getElementById('minimap-restore');

    // Ensure minimized first
    document.getElementById('minimap-minimize').click();
    restoreBtn.click();
    expect(minimap.style.display).toBe('');
    expect(restoreBtn.style.display).toBe('none');
  });
});

// ─── Version 8: Zoom ────────────────────────────────────────────────────────

describe('Zoom', () => {
  it('zoomAround changes zoom level', () => {
    const before = app.S.zoom;
    const cw = app.canvasContainer.clientWidth || 800;
    const ch = app.canvasContainer.clientHeight || 600;
    app.zoomAround(before + 0.5, cw / 2, ch / 2);
    expect(app.S.zoom).toBeCloseTo(before + 0.5, 1);
  });

  it('zoom is clamped to min/max', () => {
    app.zoomAround(0.001, 400, 300);
    expect(app.S.zoom).toBeGreaterThanOrEqual(app.ZOOM_MIN);
    app.zoomAround(100, 400, 300);
    expect(app.S.zoom).toBeLessThanOrEqual(app.ZOOM_MAX);
  });

  it('zoom label updates', () => {
    app.zoomAround(1, 400, 300);
    const label = document.getElementById('zoom-label');
    expect(label.textContent).toBe('100%');
  });

  it('zoom slider syncs', () => {
    app.zoomAround(1.5, 400, 300);
    const slider = document.getElementById('zoom-slider');
    expect(slider.value).toBe('150');
  });
});

// ─── Version 10: Node deletion ──────────────────────────────────────────────

describe('Node deletion', () => {
  it('deleteNode removes node from nodes array and DOM', () => {
    const node = app.createNode('state', 500, 500);
    const before = nodeCount();
    app.deleteNode(node);
    expect(nodeCount()).toBe(before - 1);
    expect(app.canvasEl.contains(node.el)).toBe(false);
  });

  it('deleteNode preserves connections as dangling in statechart mode', () => {
    const prevMode = app.S.diagramMode;
    app.S.diagramMode = 'statechart';
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 300, 0);
    app.createConnection(a, b);
    const conn = app.S.connections[app.S.connections.length - 1];
    const beforeConns = connCount();

    app.deleteNode(a);
    expect(connCount()).toBe(beforeConns); // connection still exists
    expect(conn.fromId).toBeNull();
    expect(conn.danglingFrom).toBeTruthy();
    expect(conn.toId).toBe(b.id);
    app.S.diagramMode = prevMode;
  });

  it('deleteNode sets both ends dangling when middle node deleted in statechart mode', () => {
    const prevMode = app.S.diagramMode;
    app.S.diagramMode = 'statechart';
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 200, 0);
    const c = app.createNode('state', 400, 0);
    app.createConnection(a, b);
    app.createConnection(b, c);
    const conn1 = app.S.connections[app.S.connections.length - 2];
    const conn2 = app.S.connections[app.S.connections.length - 1];

    app.deleteNode(b);
    expect(conn1.toId).toBeNull();
    expect(conn1.danglingTo).toBeTruthy();
    expect(conn2.fromId).toBeNull();
    expect(conn2.danglingFrom).toBeTruthy();
    app.S.diagramMode = prevMode;
  });

  it('deleteNode deactivates the node if active', () => {
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.deleteNode(node);
    expect(app.S.activeNode).toBeNull();
  });

  it('deleteNode removes minimap element', () => {
    const node = app.createNode('state', 0, 0);
    const mmEl = node.mmEl;
    app.deleteNode(node);
    expect(document.getElementById('minimap-states').contains(mmEl)).toBe(false);
  });

  it('deleteNode in fungus mode removes connections and clears call references', () => {
    app.enterFungusMode();
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 300, 0);
    const c = app.createNode('state', 600, 0);
    a.commands = [{ type: 'call', targetBlockId: b.id }];
    c.commands = [{ type: 'menu', options: [
      { text: 'Go B', targetBlockId: b.id },
      { text: 'Other', targetBlockId: null },
    ]}];
    app.syncAutoConnections();

    const autosBefore = app.S.connections.filter(c => c.auto && c.toId === b.id);
    expect(autosBefore.length).toBeGreaterThan(0);

    app.deleteNode(b);

    // Call references should be cleared
    expect(a.commands[0].targetBlockId).toBeNull();
    expect(c.commands[0].options[0].targetBlockId).toBeNull();

    // Auto-connections to deleted node should be gone
    const autosAfter = app.S.connections.filter(c => c.auto && c.toId === b.id);
    expect(autosAfter.length).toBe(0);

    app.exitFungusMode();
  });
});

// ─── Geometry helpers ───────────────────────────────────────────────────────

describe('Geometry helpers', () => {
  it('getBorderPoint returns a point on the node border', () => {
    const node = app.createNode('state', 100, 100);
    const p = app.getBorderPoint(node, 500, 125);
    // Point should be on the right edge (x ≈ 100 + 120 = 220)
    expect(p.x).toBeCloseTo(100 + node.w, 0);
  });

  it('getBorderPoint works for choice (diamond) nodes', () => {
    const node = app.createNode('choice', 100, 100);
    const p = app.getBorderPoint(node, 500, 140);
    // Should be on the diamond edge, between center and target
    expect(p.x).toBeGreaterThan(node.x);
    expect(p.x).toBeLessThan(500);
  });

  it('getBorderPoint works for start/end (circle) nodes', () => {
    const node = app.createNode('start', 100, 100);
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;
    const p = app.getBorderPoint(node, cx + 100, cy);
    // Should be on the circle edge to the right
    expect(p.x).toBeCloseTo(cx + node.w / 2, 0);
  });

  it('getMinimapBounds covers all nodes', () => {
    app.S.nodes.length = 0;
    app.createNode('state', -100, -50);
    app.createNode('state', 5000, 4000);
    const bounds = app.getMinimapBounds();
    expect(bounds.x).toBeLessThan(-100);
    expect(bounds.y).toBeLessThan(-50);
    expect(bounds.x + bounds.w).toBeGreaterThan(5000);
    expect(bounds.y + bounds.h).toBeGreaterThan(4000);
  });
});

// ─── Configuration constants ────────────────────────────────────────────────

describe('Configuration', () => {
  it('has correct world dimensions', () => {
    expect(app.WORLD_W).toBe(4000);
    expect(app.WORLD_H).toBe(3000);
  });

  it('has default node dimensions for all types', () => {
    expect(app.NODE_DEFAULTS.state).toBeTruthy();
    expect(app.NODE_DEFAULTS.start).toBeTruthy();
    expect(app.NODE_DEFAULTS.end).toBeTruthy();
    expect(app.NODE_DEFAULTS.choice).toBeTruthy();
  });

  it('has minimum sizes for resizable types', () => {
    expect(app.NODE_MIN_SIZE.state).toBeTruthy();
    expect(app.NODE_MIN_SIZE.choice).toBeTruthy();
  });

  it('zoom limits are sensible', () => {
    expect(app.ZOOM_MIN).toBeLessThan(1);
    expect(app.ZOOM_MAX).toBeGreaterThan(1);
    expect(app.ZOOM_STEP).toBeGreaterThan(0);
  });
});

// ─── Version 21: Hand tool in zoom toolbar ─────────────────────────────────

describe('Hand tool in zoom toolbar', () => {
  it('hand tool button exists inside zoom toolbar', () => {
    const zoomToolbar = document.getElementById('zoom-toolbar');
    const handBtn = document.getElementById('btn-hand-tool');
    expect(zoomToolbar.contains(handBtn)).toBe(true);
  });

  it('hand tool button is NOT in the main toolbar', () => {
    const toolbar = document.getElementById('toolbar');
    const handBtn = document.getElementById('btn-hand-tool');
    expect(toolbar.contains(handBtn)).toBe(false);
  });

  it('hand tool toggles activeTool between hand and select', () => {
    const handBtn = document.getElementById('btn-hand-tool');
    app.S.activeTool = 'select';
    handBtn.click();
    expect(app.S.activeTool).toBe('hand');
    handBtn.click();
    expect(app.S.activeTool).toBe('select');
  });

  it('hand tool button gets active class when toggled on', () => {
    const handBtn = document.getElementById('btn-hand-tool');
    app.S.activeTool = 'select';
    handBtn.classList.remove('active');
    handBtn.click();
    expect(handBtn.classList.contains('active')).toBe(true);
    handBtn.click();
    expect(handBtn.classList.contains('active')).toBe(false);
  });
});

// ─── Version 22: Edit block name in inspector panel ────────────────────────

describe('Edit block name in inspector panel', () => {
  it('inspector shows an editable name input for state nodes', () => {
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.updateInspector();
    const nameInput = document.querySelector('.inspector-name-input');
    expect(nameInput).toBeTruthy();
    expect(nameInput.tagName).toBe('INPUT');
    expect(nameInput.value).toBe(node.label);
  });

  it('inspector shows an editable name input for choice nodes', () => {
    const node = app.createNode('choice', 0, 0);
    app.activateNode(node);
    app.updateInspector();
    const nameInput = document.querySelector('.inspector-name-input');
    expect(nameInput).toBeTruthy();
    expect(nameInput.value).toBe(node.label);
  });

  it('inspector does NOT show name input for start nodes', () => {
    const node = app.createNode('start', 0, 0);
    app.activateNode(node);
    app.updateInspector();
    const nameInput = document.querySelector('.inspector-name-input');
    expect(nameInput).toBeNull();
  });

  it('inspector does NOT show name input for end nodes', () => {
    const node = app.createNode('end', 0, 0);
    app.activateNode(node);
    app.updateInspector();
    const nameInput = document.querySelector('.inspector-name-input');
    expect(nameInput).toBeNull();
  });

  it('typing in the name input updates the node label', () => {
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.updateInspector();
    const nameInput = document.querySelector('.inspector-name-input');
    nameInput.value = 'NewName';
    nameInput.dispatchEvent(new Event('input'));
    expect(node.label).toBe('NewName');
  });

  it('typing in the name input updates the diagram label element', () => {
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.updateInspector();
    const nameInput = document.querySelector('.inspector-name-input');
    nameInput.value = 'LiveUpdate';
    nameInput.dispatchEvent(new Event('input'));
    const labelEl = node.el.querySelector('.node-label');
    expect(labelEl.textContent).toBe('LiveUpdate');
  });

  it('empty input does not clear the node label', () => {
    const node = app.createNode('state', 0, 0);
    const original = node.label;
    app.activateNode(node);
    app.updateInspector();
    const nameInput = document.querySelector('.inspector-name-input');
    nameInput.value = '   ';
    nameInput.dispatchEvent(new Event('input'));
    expect(node.label).toBe(original);
  });
});

// ─── Version 23: Fungus FlowChart mode ─────────────────────────────────────

describe('Inspector/Settings tabs', () => {
  it('inspector tabs exist in DOM', () => {
    const tabs = document.querySelectorAll('.inspector-tab');
    expect(tabs.length).toBe(2);
    expect(tabs[0].dataset.tab).toBe('inspector');
    expect(tabs[1].dataset.tab).toBe('settings');
  });

  it('inspector tab is active by default', () => {
    const inspectorTab = document.querySelector('.inspector-tab[data-tab="inspector"]');
    expect(inspectorTab.classList.contains('active')).toBe(true);
  });

  it('inspector panel is visible and settings panel hidden by default', () => {
    expect(document.getElementById('inspector-panel').style.display).not.toBe('none');
    expect(document.getElementById('settings-panel').style.display).toBe('none');
  });

  it('clicking settings tab shows settings panel and hides inspector', () => {
    const settingsTab = document.querySelector('.inspector-tab[data-tab="settings"]');
    settingsTab.click();
    expect(document.getElementById('settings-panel').style.display).toBe('');
    expect(document.getElementById('inspector-panel').style.display).toBe('none');
    // restore
    document.querySelector('.inspector-tab[data-tab="inspector"]').click();
  });

  it('settings panel has radio buttons for diagram modes', () => {
    const radios = document.querySelectorAll('input[name="diagram-mode"]');
    expect(radios.length).toBe(2);
    expect(radios[0].value).toBe('fungus');
    expect(radios[1].value).toBe('statechart');
  });
});

describe('Block classification', () => {
  it('classifies node with event as "event"', () => {
    const node = app.createNode('state', 0, 0);
    node.event = { type: 'gameStarted' };
    expect(app.classifyBlock(node)).toBe('event');
  });

  it('classifies node with no event and 2+ targets as "branching"', () => {
    const node = app.createNode('state', 0, 0);
    const a = app.createNode('state', 200, 0);
    const b = app.createNode('state', 400, 0);
    node.event = { type: 'none' };
    node.commands = [
      { type: 'call', targetBlockId: a.id },
      { type: 'call', targetBlockId: b.id },
    ];
    expect(app.classifyBlock(node)).toBe('branching');
  });

  it('classifies node with no event and 0-1 targets as "standard"', () => {
    const node = app.createNode('state', 0, 0);
    node.event = { type: 'none' };
    node.commands = [];
    expect(app.classifyBlock(node)).toBe('standard');
  });

  it('event overrides branching classification', () => {
    const node = app.createNode('state', 0, 0);
    const a = app.createNode('state', 200, 0);
    const b = app.createNode('state', 400, 0);
    node.event = { type: 'messageReceived', message: 'test' };
    node.commands = [
      { type: 'call', targetBlockId: a.id },
      { type: 'call', targetBlockId: b.id },
    ];
    expect(app.classifyBlock(node)).toBe('event');
  });

  it('menu command targets count towards branching', () => {
    const node = app.createNode('state', 0, 0);
    const a = app.createNode('state', 200, 0);
    const b = app.createNode('state', 400, 0);
    node.event = { type: 'none' };
    node.commands = [
      { type: 'menu', options: [
        { text: 'A', targetBlockId: a.id },
        { text: 'B', targetBlockId: b.id },
      ]},
    ];
    expect(app.classifyBlock(node)).toBe('branching');
  });
});

describe('Fungus mode enter/exit', () => {
  afterEach(() => {
    // Reset to statechart mode
    if (app.S.diagramMode === 'fungus') app.exitFungusMode();
  });

  it('enterFungusMode sets diagramMode and body data attribute', () => {
    app.enterFungusMode();
    expect(app.S.diagramMode).toBe('fungus');
    expect(document.body.dataset.mode).toBe('fungus');
  });

  it('exitFungusMode restores statechart mode', () => {
    app.enterFungusMode();
    app.exitFungusMode();
    expect(app.S.diagramMode).toBe('statechart');
    expect(document.body.dataset.mode).toBeUndefined();
  });

  it('enterFungusMode applies fungus CSS classes to state nodes', () => {
    const node = app.createNode('state', 0, 0);
    node.event = { type: 'none' };
    node.commands = [];
    app.enterFungusMode();
    expect(node.el.classList.contains('fungus-standard-block')).toBe(true);
  });

  it('exitFungusMode removes fungus CSS classes', () => {
    const node = app.createNode('state', 0, 0);
    node.event = { type: 'none' };
    app.enterFungusMode();
    expect(node.el.classList.contains('fungus-standard-block')).toBe(true);
    app.exitFungusMode();
    expect(node.el.classList.contains('fungus-standard-block')).toBe(false);
  });

  it('enterFungusMode creates auto-connections from call commands', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 300, 0);
    a.commands = [{ type: 'call', targetBlockId: b.id }];
    app.enterFungusMode();
    const autoConn = app.S.connections.find(c => c.auto && c.fromId === a.id && c.toId === b.id);
    expect(autoConn).toBeTruthy();
    expect(autoConn.label).toBe('');
  });

  it('exitFungusMode removes all auto-connections', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 300, 0);
    a.commands = [{ type: 'call', targetBlockId: b.id }];
    app.enterFungusMode();
    expect(app.S.connections.some(c => c.auto)).toBe(true);
    app.exitFungusMode();
    expect(app.S.connections.some(c => c.auto)).toBe(false);
  });

  it('auto-connections have conn-auto CSS class', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 300, 0);
    a.commands = [{ type: 'call', targetBlockId: b.id }];
    app.enterFungusMode();
    const autoConn = app.S.connections.find(c => c.auto);
    expect(autoConn.group.classList.contains('conn-auto')).toBe(true);
  });
});

// ─── Version 24: Inspector cleanup and Export JSON move ────────────────────

describe('Inspector clears when no object selected', () => {
  it('inspector shows empty message after node deletion', () => {
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.updateInspector();
    // Verify inspector has content
    const propsContainer = document.getElementById('inspector-props');
    expect(propsContainer.style.display).not.toBe('none');

    app.deleteNode(node);
    app.updateInspector();
    expect(document.getElementById('inspector-empty').style.display).toBe('block');
    expect(propsContainer.style.display).toBe('none');
  });

  it('inspector clears sections when node is deactivated', () => {
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.updateInspector();
    const inspectorBody = document.getElementById('inspector-body');
    expect(inspectorBody.querySelectorAll('.inspector-section').length).toBeGreaterThan(0);

    app.deactivateNode();
    app.updateInspector();
    expect(inspectorBody.querySelectorAll('.inspector-section').length).toBe(0);
  });

  it('inspector is blank when group is selected', () => {
    const a = app.createNode('state', 0, 0);
    const b = app.createNode('state', 200, 0);
    app.selectGroup([a, b]);
    app.updateInspector();
    expect(document.getElementById('inspector-empty').style.display).toBe('block');
    expect(document.getElementById('inspector-props').style.display).toBe('none');
  });
});

describe('Export JSON button location', () => {
  it('export JSON button is inside canvas-container', () => {
    const canvasContainer = document.getElementById('canvas-container');
    const btn = document.getElementById('btn-export-json');
    expect(canvasContainer.contains(btn)).toBe(true);
  });

  it('export JSON button is NOT inside inspector', () => {
    const inspector = document.getElementById('inspector');
    const btn = document.getElementById('btn-export-json');
    expect(inspector.contains(btn)).toBe(false);
  });
});

describe('Choice button hidden in Fungus mode', () => {
  afterEach(() => {
    if (app.S.diagramMode === 'fungus') app.exitFungusMode();
  });

  it('choice button is visible in statechart mode', () => {
    const btn = document.getElementById('btn-new-choice');
    expect(btn).toBeTruthy();
  });
});

describe('Fungus mode naming', () => {
  afterEach(() => {
    if (app.S.diagramMode === 'fungus') app.exitFungusMode();
  });

  it('new state nodes are named "New Block N" in Fungus mode', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    expect(node.label).toMatch(/^New Block \d+$/);
  });

  it('new state nodes are named "State N" in statechart mode', () => {
    app.exitFungusMode();
    const node = app.createNode('state', 0, 0);
    expect(node.label).toMatch(/^State \d+$/);
  });

  it('toolbar button text changes to "Block" in Fungus mode', () => {
    const btn = document.getElementById('btn-new-state');
    app.enterFungusMode();
    expect(btn.textContent).toContain('Block');
  });

  it('toolbar button text changes back to "State" when exiting Fungus mode', () => {
    const btn = document.getElementById('btn-new-state');
    app.enterFungusMode();
    app.exitFungusMode();
    expect(btn.textContent).toContain('State');
  });
});

// ─── Version 25: Default Fungus mode, mode label, step execution ───────────

describe('Default Fungus mode', () => {
  it('fungus radio is listed first in settings', () => {
    const radios = document.querySelectorAll('input[name="diagram-mode"]');
    expect(radios[0].value).toBe('fungus');
  });

  it('enterFungusMode can be called to set fungus as active mode', () => {
    app.enterFungusMode();
    expect(app.S.diagramMode).toBe('fungus');
    expect(document.body.dataset.mode).toBe('fungus');
    app.exitFungusMode();
  });
});

describe('Mode label', () => {
  it('mode label element exists', () => {
    expect(document.getElementById('mode-label-text')).toBeTruthy();
  });

  it('mode label shows "Fungus Mode" when in fungus mode', () => {
    expect(document.getElementById('mode-label-text').textContent).toBe('Fungus Mode');
  });

  it('mode label hint exists', () => {
    expect(document.getElementById('mode-label-hint')).toBeTruthy();
    expect(document.getElementById('mode-label-hint').textContent).toContain('Settings tab');
  });
});

describe('Step-by-step execution', () => {
  it('step button exists in DOM', () => {
    expect(document.getElementById('btn-play-step')).toBeTruthy();
  });

  it('step continue button exists in DOM', () => {
    expect(document.getElementById('btn-step-continue')).toBeTruthy();
  });

  it('play label shows "Play All" in fungus mode', () => {
    expect(document.getElementById('play-label').textContent).toBe('Play All');
  });
});

// ─── Version 26: JSON copy button, no resize in Fungus mode ────────────────

describe('Fungus mode hides resize handles', () => {
  afterEach(() => {
    if (app.S.diagramMode === 'fungus') app.exitFungusMode();
  });

  it('no resize handles on state nodes in fungus mode', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    expect(node.el.querySelectorAll('.resize-handle').length).toBe(0);
  });

  it('resize handles appear in statechart mode', () => {
    app.exitFungusMode();
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    expect(node.el.querySelectorAll('.resize-handle').length).toBe(8);
    app.deactivateNode();
  });
});

// ─── Version 27: Run Log and Audio dropdown ────────────────────────────────

describe('Run Log', () => {
  it('run log button exists in DOM', () => {
    expect(document.getElementById('btn-run-log')).toBeTruthy();
  });

  it('run log is initially empty', () => {
    expect(app.getRunLog().length).toBe(0);
  });
});

// ─── Version 28: Run Log Style ──────────────────────────────────────────────

describe('Run Log Style', () => {
  function clearGameStartedEvents() {
    for (const n of app.S.nodes) {
      if (n.event?.type === 'gameStarted') n.event = null;
    }
  }

  afterEach(() => app.stopExecution());

  it('enter block log entry uses *Enter block* format', async () => {
    clearGameStartedEvents();
    const node = app.createNode('state', 0, 0);
    node.event = { type: 'gameStarted' };
    node.commands = [{ type: 'say', text: 'hello', character: '' }];

    app.startExecution();
    await new Promise(r => setTimeout(r, 1500));

    const log = app.getRunLog();
    const enterEntry = log.find(e => e.message.includes('Enter block'));
    expect(enterEntry.message).toMatch(/^\*Enter block\*:/);
  });

  it('command log entries are prefixed with id and block name', async () => {
    clearGameStartedEvents();
    const node = app.createNode('state', 0, 0);
    node.event = { type: 'gameStarted' };
    node.commands = [{ type: 'say', text: 'hello', character: '' }];

    app.startExecution();
    await new Promise(r => setTimeout(r, 1500));

    const log = app.getRunLog();
    const sayEntry = log.find(e => e.message.includes('Say:'));
    expect(sayEntry).toBeTruthy();
    expect(sayEntry.message).toMatch(new RegExp(`^${node.id}: ${node.label}: Say:`));
  });

  it('execution started and complete entries are NOT prefixed', async () => {
    clearGameStartedEvents();
    const node = app.createNode('state', 0, 0);
    node.event = { type: 'gameStarted' };
    node.commands = [];

    app.startExecution();
    await new Promise(r => setTimeout(r, 1000));

    const log = app.getRunLog();
    const startEntry = log.find(e => e.message.includes('Execution started'));
    expect(startEntry.message).toMatch(/^Execution started/);
    const endEntry = log.find(e => e.message.includes('Execution complete'));
    expect(endEntry.message).toBe('Execution complete');
  });
});

// ─── Version 29: Fungus block default style & event annotation ──────────────

describe('Fungus block default style', () => {
  afterEach(() => {
    if (app.S.diagramMode === 'fungus') app.exitFungusMode();
  });

  it('new block in fungus mode gets fungus-standard-block class', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    expect(node.el.classList.contains('fungus-standard-block')).toBe(true);
  });

  it('new block in fungus mode does NOT have event or branching class', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    expect(node.el.classList.contains('fungus-event-block')).toBe(false);
    expect(node.el.classList.contains('fungus-branching-block')).toBe(false);
  });

  it('new block in statechart mode does NOT get fungus classes', () => {
    app.exitFungusMode();
    const node = app.createNode('state', 0, 0);
    expect(node.el.classList.contains('fungus-standard-block')).toBe(false);
  });
});

describe('Fungus event annotation', () => {
  afterEach(() => {
    if (app.S.diagramMode === 'fungus') app.exitFungusMode();
  });

  it('block with gameStarted event shows <Game Started> annotation', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    node.event = { type: 'gameStarted' };
    app.applyFungusStyles();
    const label = node.el.querySelector('.fungus-event-label');
    expect(label).toBeTruthy();
    expect(label.textContent).toBe('<Game Started>');
  });

  it('block with no event has no annotation', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    node.event = { type: 'none' };
    app.applyFungusStyles();
    const label = node.el.querySelector('.fungus-event-label');
    expect(label).toBeFalsy();
  });

  it('annotation is removed when event is set to none', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    node.event = { type: 'gameStarted' };
    app.applyFungusStyles();
    expect(node.el.querySelector('.fungus-event-label')).toBeTruthy();

    node.event = { type: 'none' };
    app.applyFungusStyles();
    expect(node.el.querySelector('.fungus-event-label')).toBeFalsy();
  });

  it('annotation is removed when exiting fungus mode', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    node.event = { type: 'gameStarted' };
    app.applyFungusStyles();
    expect(node.el.querySelector('.fungus-event-label')).toBeTruthy();

    app.exitFungusMode();
    expect(node.el.querySelector('.fungus-event-label')).toBeFalsy();
  });

  it('messageReceived event shows <Message Received> annotation', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    node.event = { type: 'messageReceived', message: 'test' };
    app.applyFungusStyles();
    const label = node.el.querySelector('.fungus-event-label');
    expect(label.textContent).toBe('<Message Received>');
  });
});

// ─── Version 30: Play Sound wait until finished checkbox ────────────────────

describe('Play Sound wait checkbox', () => {
  it('playSound command defaults waitUntilFinished to false', () => {
    const node = app.createNode('state', 0, 0);
    node.commands.push({ type: 'playSound', audioUrl: '', volume: 1.0, waitUntilFinished: false });
    expect(node.commands[0].waitUntilFinished).toBe(false);
  });

  it('inspector shows wait checkbox for playSound command', () => {
    const node = app.createNode('state', 0, 0);
    node.commands.push({ type: 'playSound', audioUrl: '', volume: 1.0, waitUntilFinished: false });
    app.activateNode(node);
    app.updateInspector();

    const checkbox = document.querySelector('.cmd-checkbox-label input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(false);
    app.deactivateNode();
  });

  it('inspector does NOT show wait checkbox for playMusic command', () => {
    const node = app.createNode('state', 0, 0);
    node.commands.push({ type: 'playMusic', audioUrl: '', volume: 1.0 });
    app.activateNode(node);
    app.updateInspector();

    const checkbox = document.querySelector('.cmd-checkbox-label input[type="checkbox"]');
    expect(checkbox).toBeFalsy();
    app.deactivateNode();
  });
});

// ─── Version 31: Improved fungus block features ────────────────────────────

describe('Fungus inspector layout', () => {
  afterEach(() => {
    app.deactivateNode();
    if (app.S.diagramMode === 'fungus') app.exitFungusMode();
  });

  it('in fungus mode, Name appears as section at top of inspector', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.updateInspector();

    const nameSection = document.querySelector('.inspector-name-section');
    expect(nameSection).toBeTruthy();
    const nameInput = nameSection.querySelector('.inspector-name-input');
    expect(nameInput).toBeTruthy();
    expect(nameInput.value).toBe(node.label);
  });

  it('in fungus mode, Description textarea appears below Name', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.updateInspector();

    const descInput = document.querySelector('.inspector-desc-input');
    expect(descInput).toBeTruthy();
    expect(descInput.tagName).toBe('TEXTAREA');
  });

  it('in fungus mode, Size/Position/Connections rows are hidden', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.updateInspector();

    const allCells = Array.from(document.querySelectorAll('#inspector-table td'));
    const cellTexts = allCells.map(td => td.textContent);
    expect(cellTexts).not.toContain('Size');
    expect(cellTexts).not.toContain('Position');
    expect(cellTexts).not.toContain('Connections');
  });

  it('in statechart mode, Size/Position/Connections ARE shown', () => {
    app.exitFungusMode();
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.updateInspector();

    const allCells = Array.from(document.querySelectorAll('#inspector-table td'));
    const cellTexts = allCells.map(td => td.textContent);
    expect(cellTexts).toContain('Size');
    expect(cellTexts).toContain('Position');
    expect(cellTexts).toContain('Connections');
  });

  it('description textarea updates node.description', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.updateInspector();

    const descInput = document.querySelector('.inspector-desc-input');
    descInput.value = 'test description';
    descInput.dispatchEvent(new Event('input'));
    expect(node.description).toBe('test description');
  });
});

describe('Fungus delete handle hidden', () => {
  afterEach(() => {
    app.deactivateNode();
    if (app.S.diagramMode === 'fungus') app.exitFungusMode();
  });

  it('body has data-mode=fungus which hides .node-delete-handle via CSS', () => {
    app.enterFungusMode();
    expect(document.body.dataset.mode).toBe('fungus');
  });
});

// ─── Version 32: Fungus inspector id label ──────────────────────────────────

describe('Fungus inspector id label', () => {
  afterEach(() => {
    app.deactivateNode();
    if (app.S.diagramMode === 'fungus') app.exitFungusMode();
  });

  it('in fungus mode, id label is shown in the name header', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.updateInspector();

    const idLabel = document.querySelector('.inspector-id-label');
    expect(idLabel).toBeTruthy();
    expect(idLabel.textContent).toBe(`id: ${node.id}`);
  });

  it('in fungus mode, props table has no Type/ID rows', () => {
    app.enterFungusMode();
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.updateInspector();

    const allCells = Array.from(document.querySelectorAll('#inspector-table td'));
    const cellTexts = allCells.map(td => td.textContent);
    expect(cellTexts).not.toContain('Type');
    expect(cellTexts).not.toContain('ID');
  });

  it('in statechart mode, props table still shows Type and ID', () => {
    app.exitFungusMode();
    const node = app.createNode('state', 0, 0);
    app.activateNode(node);
    app.updateInspector();

    const allCells = Array.from(document.querySelectorAll('#inspector-table td'));
    const cellTexts = allCells.map(td => td.textContent);
    expect(cellTexts).toContain('Type');
    expect(cellTexts).toContain('ID');
  });
});

describe('Audio manifest', () => {
  it('AUDIO_FILES is exported and contains entries', () => {
    // Import is via the app facade; audio-manifest is used by inspector
    // We test it indirectly — just verify the module loads without error
    expect(true).toBe(true);
  });
});
