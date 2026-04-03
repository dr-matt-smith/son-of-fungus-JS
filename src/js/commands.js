/**
 * Command and event type definitions for the Fungus-style execution model.
 *
 * Each block (node) has:
 *   - An optional event trigger (what starts it)
 *   - An ordered list of commands (what it does)
 *
 * Connections between blocks are implicit in Call/Menu commands.
 */

// ── Event types (triggers for a block) ───────────────────────────────────────

export const EVENT_TYPES = {
  none:             { label: 'None',             description: 'No trigger — only callable from another block' },
  gameStarted:      { label: 'Game Started',     description: 'Fires when execution begins' },
  messageReceived:  { label: 'Message Received', description: 'Fires when a named message is broadcast' },
  keyPressed:       { label: 'Key Pressed',      description: 'Fires on a keyboard key press' },
};

// ── Command types (steps inside a block) ─────────────────────────────────────

export const COMMAND_TYPES = {
  say:          { label: 'Say',           category: 'Narrative',  description: 'Display dialogue text' },
  menu:         { label: 'Menu',          category: 'Flow',       description: 'Present a player choice' },
  call:         { label: 'Call',          category: 'Flow',       description: 'Transfer execution to another block' },
  setVariable:  { label: 'Set Variable',  category: 'Variables',  description: 'Assign a value to a variable' },
  playMusic:    { label: 'Play Music',    category: 'Audio',      description: 'Play a looping music track' },
  playSound:    { label: 'Play Sound',    category: 'Audio',      description: 'Play a one-shot sound effect' },
  stopAudio:    { label: 'Stop Audio',    category: 'Audio',      description: 'Stop currently playing audio' },
  wait:         { label: 'Wait',          category: 'Flow',       description: 'Pause execution for a duration' },
  sendMessage:  { label: 'Send Message',  category: 'Flow',       description: 'Broadcast a named message' },
};

// ── Factory functions for creating command instances ─────────────────────────

export function createCommand(type) {
  const base = { type, id: crypto.randomUUID?.() || String(Date.now() + Math.random()) };
  switch (type) {
    case 'say':
      return { ...base, character: '', text: 'Hello!', portrait: '' };
    case 'menu':
      return { ...base, options: [
        { text: 'Option 1', targetBlockId: null },
        { text: 'Option 2', targetBlockId: null },
      ]};
    case 'call':
      return { ...base, targetBlockId: null, mode: 'stop' }; // 'stop' | 'continue'
    case 'setVariable':
      return { ...base, variableName: '', value: '' };
    case 'playMusic':
      return { ...base, audioUrl: '', volume: 1.0, loop: true };
    case 'playSound':
      return { ...base, audioUrl: '', volume: 1.0, waitUntilFinished: false };
    case 'stopAudio':
      return { ...base };
    case 'wait':
      return { ...base, duration: 1.0 };
    case 'sendMessage':
      return { ...base, message: '' };
    default:
      return base;
  }
}

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
