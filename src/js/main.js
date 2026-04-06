'use strict';

import { S } from './state.js';
import { applyTransform } from './transform.js';
import { refreshMinimap } from './minimap.js';
import { updateInspector, showJsonExport, showRunLog, showJsonLoad } from './inspector.js';
import { buildRuntime } from './build-runtime.js';
import { initFlowchart, applyFungusStyles, syncAutoConnections } from './fungus-mode.js';
import { undo, redo, saveSnapshot } from './undo-redo.js';

// ── Import modules (side-effects wire up event listeners) ───────────────────

import './toolbar.js';
import { createNodeWithEvents } from './canvas-interactions.js';
import { showPlayButtons } from './play-controls.js';
import { renderVariablesList, renderEnumsList, renderMessagesList, renderCharactersList, showTab } from './data-panel-ui.js';

// ── Inspector ────────────────────────────────────────────────────────────────

S.onSelectionChange = () => { updateInspector(); S.emit('selectionChanged'); };
S.onInspectorUpdate = () => { updateInspector(); S.emit('inspectorUpdate'); };
document.getElementById('btn-export-json').addEventListener('click', showJsonExport);
document.getElementById('btn-run-log').addEventListener('click', showRunLog);
const btnBuild = document.getElementById('btn-build');
if (btnBuild) btnBuild.addEventListener('click', buildRuntime);

// ── Undo/Redo ───────────────────────────────────────────────────────────────

S.onRestoreNode = (nd) => {
  const node = createNodeWithEvents(nd.type, nd.x, nd.y);
  node.id = nd.id;
  node.el.dataset.id = String(nd.id);
  if (nd.label) {
    node.label = nd.label;
    const labelEl = node.el.querySelector('.node-label');
    if (labelEl) labelEl.textContent = nd.label;
  }
  node.w = nd.w; node.h = nd.h;
  node.el.style.width = `${nd.w}px`;
  node.el.style.height = `${nd.h}px`;
  node.event = nd.event || { type: 'none' };
  node.commands = nd.commands || [];
  node.description = nd.description || '';
  const idLabel = node.el.querySelector('.node-id-label');
  if (idLabel) idLabel.textContent = `id: ${nd.id}`;
};

S.on('modelChanged', () => {
  applyFungusStyles();
  syncAutoConnections();
  refreshMinimap();
  renderVariablesList();
  renderEnumsList();
  renderMessagesList();
  renderCharactersList();
  updateInspector();
});

document.addEventListener('keydown', (e) => {
  // Ctrl+Z / Cmd+Z = undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    e.preventDefault();
    undo();
  }
  // Ctrl+Shift+Z / Cmd+Shift+Z = redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    e.preventDefault();
    redo();
  }
});

// ── Load from JSON ──────────────────────────────────────────────────────────

function loadDiagram(data) {
  // Clear existing
  while (S.nodes.length > 0) {
    const n = S.nodes[0];
    n.el.remove();
    n.mmEl.remove();
    S.nodes.splice(0, 1);
  }
  while (S.connections.length > 0) {
    const c = S.connections[0];
    if (c.group) c.group.remove();
    S.connections.splice(0, 1);
  }
  S.activeNode = null;
  S.selectedConn = null;
  S.selectedNodes = [];

  // Load variables, messages, enums
  S.variables = data.variables || [];
  S.messages = data.messages || [];
  S.enums = data.enums || [];
  S.characters = data.characters || [];

  // Load nodes
  let maxId = 0;
  for (const nd of data.nodes) {
    const node = createNodeWithEvents(nd.type, nd.x, nd.y);
    // Override the auto-generated id and label
    node.id = nd.id;
    node.el.dataset.id = String(nd.id);
    if (nd.label) {
      node.label = nd.label;
      const labelEl = node.el.querySelector('.node-label');
      if (labelEl) labelEl.textContent = nd.label;
    }
    node.w = nd.w; node.h = nd.h;
    node.el.style.width = `${nd.w}px`;
    node.el.style.height = `${nd.h}px`;
    node.event = nd.event || { type: 'none' };
    node.commands = nd.commands || [];
    node.description = nd.description || '';
    const idLabel = node.el.querySelector('.node-id-label');
    if (idLabel) idLabel.textContent = `id: ${nd.id}`;
    if (nd.id >= maxId) maxId = nd.id + 1;
  }
  S.nextId = maxId;

  // Apply styles and sync connections
  applyFungusStyles();
  syncAutoConnections();
  refreshMinimap();
  renderVariablesList();
  renderEnumsList();
  renderMessagesList();
  renderCharactersList();
  updateInspector();
}

const btnLoadJson = document.getElementById('btn-load-json');
if (btnLoadJson) {
  btnLoadJson.addEventListener('click', () => {
    showJsonLoad(loadDiagram);
  });
}

// ── Settings cog / close settings ───────────────────────────────────────────

const inspectorTabs   = document.getElementById('inspector-tabs');
const settingsPanel   = document.getElementById('settings-panel');
const settingsCogBtn  = document.getElementById('btn-settings-cog');
const closeSettingsBtn = document.getElementById('btn-close-settings');

const contentPanels = [document.getElementById('inspector-panel'), settingsPanel];

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

// ── Theme toggle ────────────────────────────────────────────────────────────

// Default to light theme
document.documentElement.dataset.theme = 'light';

for (const radio of document.querySelectorAll('input[name="theme"]')) {
  radio.addEventListener('change', () => {
    if (radio.value === 'light') {
      document.documentElement.dataset.theme = 'light';
    } else {
      delete document.documentElement.dataset.theme;
    }
  });
}

showPlayButtons();

// ── Initialise ───────────────────────────────────────────────────────────────

initFlowchart();
applyTransform();
renderVariablesList();
renderEnumsList();
renderMessagesList();
renderCharactersList();

// ── Re-exports (facade for tests) ───────────────────────────────────────────

export { S } from './state.js';
export { WORLD_W, WORLD_H, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, NODE_DEFAULTS, NODE_MIN_SIZE } from './config.js';
export { canvasContainer, canvasEl, connSvg, minimapEl } from './dom-refs.js';
export { applyTransform, zoomAround, clientToWorld, relativeToContainer, fitAll } from './transform.js';
export { refreshMinimap, getMinimapBounds, getMinimapScales } from './minimap.js';
export { createNode, moveNode, resizeNode } from './nodes/node-model.js';
export { buildNodeElement, fitLabelFontSize } from './nodes/node-element.js';
export { activateNode, deactivateNode, selectGroup, clearGroup, deleteNode } from './nodes/node-selection.js';
export { startEditing, commitEditing, cancelEditing } from './nodes/node-editing.js';
export { createConnection, deleteConnection, createAutoConnection } from './connections/conn-model.js';
export { updateConnection } from './connections/conn-render.js';
export { selectConn, deselectConn } from './connections/conn-selection.js';
export { getBorderPoint, getPairPerpendicular } from './connections/geometry.js';
export { updateInspector } from './inspector.js';
export { classifyBlock, applyFungusStyles, syncAutoConnections, initFlowchart } from './fungus-mode.js';
export { startExecution, startStepExecution, stepNext, stopExecution, isRunning, isStepping, isPaused, getRunLog } from './engine.js';
export { createNodeWithEvents } from './canvas-interactions.js';
export { renderVariablesList, renderEnumsList, renderMessagesList, VAR_TYPES, attachDividerResize } from './data-panel-ui.js';
export { showPlayButtons, debugMode, debugEditedVars } from './play-controls.js';
