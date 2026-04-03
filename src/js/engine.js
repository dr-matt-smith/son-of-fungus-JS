/**
 * Execution engine for the Fungus-style flowchart.
 *
 * Runs commands sequentially within blocks, handles flow (Call, Menu),
 * variables, audio, and message broadcasting.
 */

import { S } from './state.js';
import { updateInspector } from './inspector.js';

let running     = false;
let stepping    = false;   // step-by-step mode
let paused      = false;   // paused between steps
let callStack   = [];     // [{ node, cmdIdx }] — for Call with mode 'continue'
let currentNode = null;
let currentCmd  = 0;
let waitTimer   = null;
let menuOverlay = null;
let audioElements = {};   // keyed by URL for music control
let outputEl    = null;   // dialogue output panel
let runLog      = [];     // timestamped execution log entries

export function isRunning() { return running; }
export function isStepping() { return stepping; }
export function isPaused() { return paused; }
export function getRunLog() { return runLog; }

function logEntry(message) {
  const now = new Date();
  const ts = now.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
  runLog.push({ ts, message });
}

// ── Output panel (for Say commands) ──────────────────────────────────────────

function ensureOutputPanel() {
  if (outputEl) return;
  outputEl = document.createElement('div');
  outputEl.id = 'execution-output';
  outputEl.innerHTML = `
    <div id="exec-output-header">
      <span>Output</span>
      <button id="exec-output-close" title="Close">&times;</button>
    </div>
    <div id="exec-output-body"></div>
  `;
  document.body.appendChild(outputEl);
  outputEl.querySelector('#exec-output-close').addEventListener('click', stopExecution);
}

function appendOutput(html) {
  ensureOutputPanel();
  const body = outputEl.querySelector('#exec-output-body');
  body.innerHTML += html;
  body.scrollTop = body.scrollHeight;
}

function clearOutput() {
  if (outputEl) {
    outputEl.querySelector('#exec-output-body').innerHTML = '';
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function startExecution() {
  if (running) return;
  running = true;

  // Find the entry point: a node with gameStarted event
  const entryNode = S.nodes.find(n => n.event?.type === 'gameStarted');
  if (!entryNode) {
    appendOutput('<div class="exec-msg exec-error">No block with "Game Started" event found.</div>');
    running = false;
    return;
  }

  clearOutput();
  ensureOutputPanel();
  callStack = [];
  runLog = [];
  S.executingNode = null;
  S.executingCommandIdx = -1;
  logEntry(`Execution started — entry block: "${entryNode.label}" (id:${entryNode.id})`);
  executeBlock(entryNode);
}

export function startStepExecution() {
  if (running) return;
  stepping = true;
  paused   = false;
  startExecution();
}

let resuming = false;  // true when stepping past a pause

export function stepNext() {
  if (!running || !stepping || !paused) return;
  paused = false;
  resuming = true;
  executeNextCommand();
}

export function stopExecution() {
  running = false;
  stepping = false;
  paused = false;
  resuming = false;
  if (waitTimer) { clearTimeout(waitTimer); waitTimer = null; }
  if (menuOverlay) { menuOverlay.remove(); menuOverlay = null; }
  if (outputEl) { outputEl.remove(); outputEl = null; }
  S.executingNode = null;
  S.executingCommandIdx = -1;
  callStack = [];
  // Remove highlight from all nodes
  for (const n of S.nodes) n.el.classList.remove('node-executing');
  updateInspector();
}

// ── Block execution ──────────────────────────────────────────────────────────

function executeBlock(node) {
  if (!running) return;

  // Remove highlight from previous node
  if (currentNode) currentNode.el.classList.remove('node-executing');

  currentNode = node;
  currentCmd  = 0;
  node.el.classList.add('node-executing');
  S.executingNode = node;
  S.executingCommandIdx = 0;
  logEntry(`Enter block: "${node.label}" (id:${node.id})`);
  updateInspector();

  executeNextCommand();
}

function executeNextCommand() {
  if (!running) return;

  // In step mode, pause before each command (except when resuming from a pause)
  if (stepping && currentCmd > 0 && !resuming) {
    paused = true;
    S.executingCommandIdx = currentCmd;
    updateInspector();
    if (S.onStepPause) S.onStepPause();
    return;
  }
  resuming = false;

  if (currentCmd >= currentNode.commands.length) {
    // Block finished — check call stack
    currentNode.el.classList.remove('node-executing');
    S.executingNode = null;
    S.executingCommandIdx = -1;

    if (callStack.length > 0) {
      const frame = callStack.pop();
      currentNode = frame.node;
      currentCmd  = frame.cmdIdx;
      currentNode.el.classList.add('node-executing');
      S.executingNode = currentNode;
      S.executingCommandIdx = currentCmd;
      updateInspector();
      executeNextCommand();
    } else {
      logEntry('Execution complete');
      appendOutput('<div class="exec-msg exec-info">Execution complete.</div>');
      running = false;
      stepping = false;
      paused = false;
      resuming = false;
      updateInspector();
      if (S.onExecutionEnd) S.onExecutionEnd();
    }
    return;
  }

  const cmd = currentNode.commands[currentCmd];
  S.executingCommandIdx = currentCmd;
  updateInspector();

  currentCmd++;
  executeCommand(cmd);
}

// ── Command dispatch ─────────────────────────────────────────────────────────

function executeCommand(cmd) {
  if (!running) return;

  switch (cmd.type) {
    case 'say':       execSay(cmd); break;
    case 'call':      execCall(cmd); break;
    case 'menu':      execMenu(cmd); break;
    case 'setVariable': execSetVariable(cmd); break;
    case 'wait':      execWait(cmd); break;
    case 'sendMessage': execSendMessage(cmd); break;
    case 'playMusic': execPlayMusic(cmd); break;
    case 'playSound': execPlaySound(cmd); break;
    case 'stopAudio': execStopAudio(cmd); break;
    default:
      appendOutput(`<div class="exec-msg exec-error">Unknown command: ${cmd.type}</div>`);
      executeNextCommand();
  }
}

// ── Command implementations ──────────────────────────────────────────────────

function substituteVars(text) {
  return text.replace(/\{\$(\w+)\}/g, (_, name) => {
    const v = S.variables.find(v => v.name === name);
    return v ? String(v.value) : `{$${name}}`;
  });
}

function execSay(cmd) {
  const text = substituteVars(cmd.text);
  const charName = cmd.character ? `<strong>${cmd.character}:</strong> ` : '';
  logEntry(`Say: ${cmd.character ? cmd.character + ': ' : ''}${text}`);
  appendOutput(`<div class="exec-say">${charName}${text}</div>`);
  waitTimer = setTimeout(() => { waitTimer = null; executeNextCommand(); }, 600);
}

function execCall(cmd) {
  const target = S.nodes.find(n => n.id === cmd.targetBlockId);
  if (!target) {
    logEntry('Call: target block not found');
    appendOutput('<div class="exec-msg exec-error">Call: target block not found.</div>');
    executeNextCommand();
    return;
  }
  logEntry(`Call: "${target.label}" (mode: ${cmd.mode})`);
  if (cmd.mode === 'continue') {
    callStack.push({ node: currentNode, cmdIdx: currentCmd });
  }
  executeBlock(target);
}

function execMenu(cmd) {
  logEntry(`Menu: ${cmd.options.map(o => o.text).join(' / ')}`);
  ensureOutputPanel();
  menuOverlay = document.createElement('div');
  menuOverlay.className = 'exec-menu';
  menuOverlay.innerHTML = '<div class="exec-menu-title">Choose:</div>';

  for (const opt of cmd.options) {
    const btn = document.createElement('button');
    btn.className = 'exec-menu-btn';
    btn.textContent = opt.text;
    btn.addEventListener('click', () => {
      menuOverlay.remove();
      menuOverlay = null;
      appendOutput(`<div class="exec-say exec-choice">&gt; ${opt.text}</div>`);
      if (opt.targetBlockId != null) {
        const target = S.nodes.find(n => n.id === opt.targetBlockId);
        if (target) {
          executeBlock(target);
          return;
        }
      }
      executeNextCommand();
    });
    menuOverlay.appendChild(btn);
  }

  const body = outputEl.querySelector('#exec-output-body');
  body.appendChild(menuOverlay);
  body.scrollTop = body.scrollHeight;
}

function execSetVariable(cmd) {
  let v = S.variables.find(v => v.name === cmd.variableName);
  if (!v) {
    v = { name: cmd.variableName, type: 'string', value: '' };
    S.variables.push(v);
  }
  v.value = cmd.value;
  logEntry(`Set variable: ${cmd.variableName} = ${cmd.value}`);
  executeNextCommand();
}

function execWait(cmd) {
  logEntry(`Wait: ${cmd.duration}s`);
  const ms = (cmd.duration || 1) * 1000;
  waitTimer = setTimeout(() => { waitTimer = null; executeNextCommand(); }, ms);
}

function execSendMessage(cmd) {
  logEntry(`Send message: "${cmd.message}"`);
  const targets = S.nodes.filter(n => n.event?.type === 'messageReceived' && n.event.message === cmd.message);
  if (targets.length > 0) {
    callStack.push({ node: currentNode, cmdIdx: currentCmd });
    executeBlock(targets[0]);
  } else {
    executeNextCommand();
  }
}

function execPlayMusic(cmd) {
  logEntry(`Play music: ${cmd.audioUrl || '(none)'}`);
  if (!cmd.audioUrl) { executeNextCommand(); return; }
  try {
    if (audioElements[cmd.audioUrl]) audioElements[cmd.audioUrl].pause();
    const audio = new Audio(cmd.audioUrl);
    audio.loop = cmd.loop ?? true;
    audio.volume = cmd.volume ?? 1;
    audio.play().catch(() => {});
    audioElements[cmd.audioUrl] = audio;
  } catch (_) {}
  executeNextCommand();
}

function execPlaySound(cmd) {
  logEntry(`Play sound: ${cmd.audioUrl || '(none)'}`);
  if (!cmd.audioUrl) { executeNextCommand(); return; }
  try {
    const audio = new Audio(cmd.audioUrl);
    audio.volume = cmd.volume ?? 1;
    if (cmd.waitUntilFinished) {
      audio.addEventListener('ended', () => executeNextCommand());
      audio.play().catch(() => executeNextCommand());
      return;
    }
    audio.play().catch(() => {});
  } catch (_) {}
  executeNextCommand();
}

function execStopAudio() {
  logEntry('Stop audio');
  for (const [url, audio] of Object.entries(audioElements)) {
    audio.pause();
    audio.currentTime = 0;
    delete audioElements[url];
  }
  executeNextCommand();
}
