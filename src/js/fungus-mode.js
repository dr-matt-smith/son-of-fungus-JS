import { S } from './state.js';
import { createAutoConnection, deleteConnection } from './connections/conn-model.js';
import { EVENT_TYPES } from './commands.js';

const FUNGUS_CLASSES = ['fungus-event-block', 'fungus-branching-block', 'fungus-standard-block'];

/**
 * Classify a block node.
 * Returns 'event', 'branching', or 'standard'.
 */
export function classifyBlock(node) {
  if (node.event && node.event.type !== 'none') return 'event';

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
 */
export function updateEventAnnotation(node) {
  let label = node.el.querySelector('.fungus-event-label');

  const eventType = node.event?.type;
  if (!eventType || eventType === 'none') {
    if (label) label.remove();
    return;
  }

  const eventInfo = EVENT_TYPES[eventType];
  let text = `<${eventInfo ? eventInfo.label : eventType}>`;
  if (eventType === 'messageReceived' && node.event.message) {
    text += `\n"${node.event.message}"`;
  }

  if (!label) {
    label = document.createElement('span');
    label.className = 'fungus-event-label';
    node.el.appendChild(label);
  }
  label.textContent = text;
}

/**
 * Update the description label below a node's DOM element.
 */
export function updateDescriptionLabel(node) {
  let label = node.el.querySelector('.fungus-desc-label');

  if (!node.description) {
    if (label) label.remove();
    return;
  }

  if (!label) {
    label = document.createElement('span');
    label.className = 'fungus-desc-label';
    node.el.appendChild(label);
  }
  label.textContent = node.description;
}

/**
 * Apply block CSS classes to all state/choice nodes based on classification.
 */
export function applyFungusStyles() {
  for (const node of S.nodes) {
    if (node.type !== 'state' && node.type !== 'choice') continue;
    const kind = classifyBlock(node);
    for (const cls of FUNGUS_CLASSES) node.el.classList.remove(cls);
    node.el.classList.add(`fungus-${kind}-block`);
    updateEventAnnotation(node);
    updateDescriptionLabel(node);
  }
}

/**
 * Get desired auto-connection pairs from all nodes' call/menu commands.
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

  const existing = new Map();
  for (const conn of S.connections) {
    if (!conn.auto) continue;
    existing.set(`${conn.fromId}->${conn.toId}`, conn);
  }

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

  const toRemove = [];
  for (const [key, conn] of existing) {
    if (!desiredKeys.has(key)) toRemove.push(conn);
  }
  for (const conn of toRemove) deleteConnection(conn);
}

/**
 * Initialise the flowchart (called once at startup).
 */
export function initFlowchart() {
  applyFungusStyles();
  syncAutoConnections();
  const stateBtn = document.getElementById('btn-new-state');
  if (stateBtn && stateBtn.lastChild) stateBtn.lastChild.textContent = 'Block';
}
