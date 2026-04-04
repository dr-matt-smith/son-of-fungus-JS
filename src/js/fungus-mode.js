import { S } from './state.js';
import { createAutoConnection, deleteConnection } from './connections/conn-model.js';
import { deactivateNode } from './nodes/node-selection.js';
import { deselectConn } from './connections/conn-selection.js';
import { EVENT_TYPES } from './commands.js';

const FUNGUS_CLASSES = ['fungus-event-block', 'fungus-branching-block', 'fungus-standard-block'];

/**
 * Classify a block node for Fungus mode.
 * Returns 'event', 'branching', or 'standard'.
 */
export function classifyBlock(node) {
  // Event overrides everything
  if (node.event && node.event.type !== 'none') return 'event';

  // Count unique non-null target block IDs from call + menu commands
  const targets = new Set();
  for (const cmd of node.commands) {
    if (cmd.type === 'call' && cmd.targetBlockId != null) {
      targets.add(cmd.targetBlockId);
    }
    if (cmd.type === 'menu') {
      for (const opt of cmd.options) {
        if (opt.targetBlockId != null) targets.add(opt.targetBlockId);
      }
    }
  }

  if (targets.size >= 2) return 'branching';
  return 'standard';
}

/**
 * Update the event annotation label on a node's DOM element.
 * Shows `<Event Name>` above the block when the node has an event trigger.
 */
export function updateEventAnnotation(node) {
  let label = node.el.querySelector('.fungus-event-label');

  const eventType = node.event?.type;
  if (!eventType || eventType === 'none' || S.diagramMode !== 'fungus') {
    if (label) label.remove();
    return;
  }

  const eventInfo = EVENT_TYPES[eventType];
  const text = `<${eventInfo ? eventInfo.label : eventType}>`;

  if (!label) {
    label = document.createElement('span');
    label.className = 'fungus-event-label';
    node.el.appendChild(label);
  }
  label.textContent = text;
}

/**
 * Apply Fungus CSS classes to all state/choice nodes based on classification.
 */
export function applyFungusStyles() {
  for (const node of S.nodes) {
    if (node.type !== 'state' && node.type !== 'choice') continue;
    const kind = classifyBlock(node);
    for (const cls of FUNGUS_CLASSES) node.el.classList.remove(cls);
    node.el.classList.add(`fungus-${kind}-block`);
    updateEventAnnotation(node);
  }
}

/**
 * Remove all Fungus CSS classes from nodes.
 */
function clearFungusStyles() {
  for (const node of S.nodes) {
    for (const cls of FUNGUS_CLASSES) node.el.classList.remove(cls);
    const label = node.el.querySelector('.fungus-event-label');
    if (label) label.remove();
  }
}

/**
 * Get desired auto-connection pairs from all nodes' call/menu commands.
 * Returns array of { fromId, toId } (deduplicated).
 */
function getDesiredAutoConnections() {
  const pairs = [];
  const seen = new Set();
  for (const node of S.nodes) {
    if (node.type !== 'state' && node.type !== 'choice') continue;
    for (const cmd of node.commands) {
      if (cmd.type === 'call' && cmd.targetBlockId != null) {
        const key = `${node.id}->${cmd.targetBlockId}`;
        if (!seen.has(key)) { seen.add(key); pairs.push({ fromId: node.id, toId: cmd.targetBlockId }); }
      }
      if (cmd.type === 'menu') {
        for (const opt of cmd.options) {
          if (opt.targetBlockId != null) {
            const key = `${node.id}->${opt.targetBlockId}`;
            if (!seen.has(key)) { seen.add(key); pairs.push({ fromId: node.id, toId: opt.targetBlockId }); }
          }
        }
      }
    }
  }
  return pairs;
}

/**
 * Sync auto-connections to match current call/menu commands.
 */
export function syncAutoConnections() {
  const desired = getDesiredAutoConnections();

  // Index existing auto-connections
  const existing = new Map();
  for (const conn of S.connections) {
    if (!conn.auto) continue;
    existing.set(`${conn.fromId}->${conn.toId}`, conn);
  }

  // Create missing
  const desiredKeys = new Set();
  for (const { fromId, toId } of desired) {
    const key = `${fromId}->${toId}`;
    desiredKeys.add(key);
    if (!existing.has(key)) {
      const fromNode = S.nodes.find(n => n.id === fromId);
      const toNode = S.nodes.find(n => n.id === toId);
      if (fromNode && toNode) createAutoConnection(fromNode, toNode);
    }
  }

  // Remove stale
  const toRemove = [];
  for (const [key, conn] of existing) {
    if (!desiredKeys.has(key)) toRemove.push(conn);
  }
  for (const conn of toRemove) deleteConnection(conn);
}

/**
 * Remove all auto-connections.
 */
function removeAllAutoConnections() {
  const autos = S.connections.filter(c => c.auto);
  for (const conn of autos) deleteConnection(conn);
}

/**
 * Enter Fungus FlowChart mode.
 */
export function enterFungusMode() {
  S.diagramMode = 'fungus';
  document.body.dataset.mode = 'fungus';
  if (S.activeNode) deactivateNode();
  if (S.selectedConn) deselectConn();
  applyFungusStyles();
  syncAutoConnections();
  const stateBtn = document.getElementById('btn-new-state');
  if (stateBtn && stateBtn.lastChild) stateBtn.lastChild.textContent = 'Block';
}

/**
 * Exit Fungus FlowChart mode (back to State Chart).
 */
export function exitFungusMode() {
  S.diagramMode = 'statechart';
  delete document.body.dataset.mode;
  if (S.activeNode) deactivateNode();
  if (S.selectedConn) deselectConn();
  clearFungusStyles();
  removeAllAutoConnections();
  const stateBtn = document.getElementById('btn-new-state');
  if (stateBtn && stateBtn.lastChild) stateBtn.lastChild.textContent = 'State';
}
