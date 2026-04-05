/**
 * Command and event type definitions for the Fungus-style execution model.
 *
 * Each block (node) has:
 *   - An optional event trigger (what starts it)
 *   - An ordered list of commands (what it does)
 *
 * Connections between blocks are implicit in Call/Menu commands.
 *
 * COMMAND_TYPES and createCommand are re-exported from command-registry.js
 * which is now the single source of truth for command definitions.
 */

// ── Event types (triggers for a block) ───────────────────────────────────────

export const EVENT_TYPES = {
  none:             { label: 'None',             description: 'No trigger — only callable from another block' },
  gameStarted:      { label: 'Game Started',     description: 'Fires when execution begins' },
  messageReceived:  { label: 'Message Received', description: 'Fires when a named message is broadcast' },
  keyPressed:       { label: 'Key Pressed',      description: 'Fires on a keyboard key press' },
};

// ── Command types & factory — delegated to registry ─────────────────────────

export { COMMAND_TYPES, createCommand } from './command-registry.js';

// ── Variable types ───────────────────────────────────────────────────────────

export const VARIABLE_TYPES = ['boolean', 'string', 'integer', 'float'];

export function createVariable(name, type, value) {
  return {
    name: name || 'myVar',
    type: type || 'string',
    value: value ?? defaultValue(type),
  };
}

function defaultValue(type) {
  switch (type) {
    case 'boolean': return false;
    case 'integer': return 0;
    case 'float':   return 0.0;
    default:        return '';
  }
}
