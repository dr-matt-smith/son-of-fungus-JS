/**
 * Execution engine for the Fungus-style flowchart.
 *
 * Runs commands sequentially within blocks, handles flow (Call, Menu),
 * variables, audio, and message broadcasting.
 */

import { S } from './state.js';
// No direct inspector import — uses S.onInspectorUpdate callback to avoid circular dependency

// Web Audio API for typing sounds
let audioCtx = null;
const audioBufferCache = {};

function getAudioContext() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

async function loadAudioBuffer(url) {
  if (audioBufferCache[url]) return audioBufferCache[url];
  try {
    const ctx = getAudioContext();
    if (!ctx) return null;
    const resp = await fetch(url);
    const data = await resp.arrayBuffer();
    const buffer = await ctx.decodeAudioData(data);
    audioBufferCache[url] = buffer;
    return buffer;
  } catch (_) { return null; }
}

function playTypingSound(buffer, volume) {
  if (!buffer) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(0);
}

let running     = false;
let stepping    = false;   // step-by-step mode
let paused      = false;   // paused between steps
let callStack   = [];     // [{ node, cmdIdx }] — for Call with mode 'continue'
let currentNode = null;
let currentCmd  = 0;
let waitTimer   = null;
let menuOverlay = null;
let audioElements = {};   // keyed by URL for music control
let ifBranchTaken = [];   // stack: true if a branch in current IF chain was taken
let outputEl    = null;   // dialogue output panel
let runLog      = [];     // timestamped execution log entries

export function isRunning() { return running; }
export function isStepping() { return stepping; }
export function isPaused() { return paused; }
export function getRunLog() { return runLog; }

export function logEntry(message) {
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
  getAudioContext(); // init audio context on user gesture

  // Find the entry point: a node with gameStarted event
  const entryNode = S.nodes.find(n => n.event?.type === 'gameStarted');
  if (!entryNode) {
    appendOutput('<div class="exec-msg exec-error">No block with "Game Started" event found.</div>');
    running = false;
    return;
  }

  clearOutput();
  callStack = [];
  runLog = [];
  ifBranchTaken = [];
  S.executingNode = null;
  S.executingCommandIdx = -1;
  // Log initial variable values, with debug pauses
  if (stepping && S.variables.length > 0) {
    // Chain pauses through variable init
    let idx = 0;
    const pauseInit = () => {
      if (idx === 0) {
        debugPause('── Variable initialisation ──', () => { idx++; pauseInit(); });
      } else if (idx <= S.variables.length) {
        const v = S.variables[idx - 1];
        debugPause(`  ${v.name} (${v.type}) = ${JSON.stringify(v.value)}`, () => { idx++; pauseInit(); });
      } else {
        debugPause(`Execution started — entry block: "${entryNode.label}" (id:${entryNode.id})`, () => { executeBlock(entryNode); });
      }
    };
    pauseInit();
  } else if (stepping) {
    // No variables but stepping — pause on "Execution started"
    debugPause(`Execution started — entry block: "${entryNode.label}" (id:${entryNode.id})`, () => { executeBlock(entryNode); });
  } else {
    // Normal play, no stepping
    if (S.variables.length > 0) {
      logEntry('── Variable initialisation ──');
      for (const v of S.variables) {
        logEntry(`  ${v.name} (${v.type}) = ${JSON.stringify(v.value)}`);
      }
    }
    logEntry(`Execution started — entry block: "${entryNode.label}" (id:${entryNode.id})`);
    executeBlock(entryNode);
  }
}

export function startStepExecution() {
  if (running) return;
  stepping = true;
  paused   = false;
  startExecution();
}

let resuming = false;  // true when stepping past a pause
let pendingContinuation = null; // function to call after debug pause resumes

export function stepNext() {
  if (!running || !stepping || !paused) return;
  paused = false;
  resuming = true;
  if (pendingContinuation) {
    const fn = pendingContinuation;
    pendingContinuation = null;
    fn();
  } else {
    executeNextCommand();
  }
}

// Pause for debug at a non-command point (init, block entry, etc.)
function debugPause(message, continuation) {
  if (!stepping || S.stepOverTarget) {
    // Not stepping or stepping over — just continue
    continuation();
    return;
  }
  logEntry(message);
  paused = true;
  pendingContinuation = continuation;
  S.executingCommandIdx = -1;
  if (S.onInspectorUpdate) S.onInspectorUpdate();
  if (S.onStepPause) S.onStepPause();
}

export function stopExecution() {
  running = false;
  stepping = false;
  paused = false;
  resuming = false;
  pendingContinuation = null;
  if (waitTimer) { clearTimeout(waitTimer); waitTimer = null; }
  if (menuOverlay) { menuOverlay.remove(); menuOverlay = null; }
  document.querySelectorAll('.say-dialog').forEach(d => d.remove());
  if (outputEl) { outputEl.remove(); outputEl = null; }
  S.executingNode = null;
  S.executingCommandIdx = -1;
  callStack = [];
  // Remove highlight from all nodes
  for (const n of S.nodes) n.el.classList.remove('node-executing');
  if (S.onInspectorUpdate) S.onInspectorUpdate();
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

  if (stepping && !S.stepOverTarget) {
    debugPause(`*Enter block*: "${node.label}" (id:${node.id})`, () => {
      executeNextCommand();
    });
  } else {
    logEntry(`*Enter block*: "${node.label}" (id:${node.id})`);
    if (S.onInspectorUpdate) S.onInspectorUpdate();
    executeNextCommand();
  }
}

function executeNextCommand() {
  if (!running) return;

  // In step mode, pause before each command (except when resuming from a pause)
  if (stepping && !resuming) {
    // If stepping over, skip pausing until we return to target
    if (S.stepOverTarget) {
      if (currentNode.id === S.stepOverTarget.nodeId && currentCmd >= S.stepOverTarget.cmdIdx) {
        S.stepOverTarget = null; // reached target, resume normal stepping
      } else {
        // Still inside stepped-over block, continue without pausing
        const cmd = currentNode.commands[currentCmd];
        S.executingCommandIdx = currentCmd;
        currentCmd++;
        executeCommand(cmd);
        return;
      }
    }
    paused = true;
    S.executingCommandIdx = currentCmd;
    if (S.onInspectorUpdate) S.onInspectorUpdate();
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
      if (S.onInspectorUpdate) S.onInspectorUpdate();
      executeNextCommand();
    } else {
      logEntry('Execution complete');
      running = false;
      stepping = false;
      paused = false;
      resuming = false;
      if (S.onInspectorUpdate) S.onInspectorUpdate();
      if (S.onExecutionEnd) S.onExecutionEnd();
    }
    return;
  }

  const cmd = currentNode.commands[currentCmd];
  S.executingCommandIdx = currentCmd;
  if (S.onInspectorUpdate) S.onInspectorUpdate();

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
    case 'ifCondition': execIfCondition(cmd); break;
    case 'elseIf':      execElseIf(cmd); break;
    case 'elseCmd':     execElse(); break;
    case 'endIf':       ifBranchTaken.pop(); executeNextCommand(); break;
    case 'setVarValue': execSetVarValue(cmd); break;
    case 'setVarCopy':  execSetVarCopy(cmd); break;
    case 'wait':      execWait(cmd); break;
    case 'sendMessage': execSendMessage(cmd); break;
    case 'stageBgColor': execStageBgColor(cmd); break;
    case 'stageBgImage': execStageBgImage(cmd); break;
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
  logEntry(`Block ${currentNode.id} "${currentNode.label}": Say: ${cmd.character ? cmd.character + ': ' : ''}${text}`);

  // Create dialog element
  const dialog = document.createElement('div');
  dialog.className = 'say-dialog';

  if (cmd.character) {
    const charEl = document.createElement('div');
    charEl.className = 'say-dialog-character';
    charEl.textContent = cmd.character;
    dialog.appendChild(charEl);
  }

  const textEl = document.createElement('div');
  textEl.className = 'say-dialog-text';
  dialog.appendChild(textEl);

  document.body.appendChild(dialog);

  // Load typing audio buffer then start
  const typingUrl = cmd.typingAudioUrl || '/audio/defaults/MidVoice.wav';
  const wantTypingAudio = cmd.typingAudio !== false && typingUrl;
  (wantTypingAudio ? loadAudioBuffer(typingUrl) : Promise.resolve(null)).then(typingBuffer => {
    startSayContent(dialog, textEl, text, cmd, typingBuffer);
  });
}

function startSayContent(dialog, textEl, text, cmd, typingBuffer) {
  function finishDialog() {
    if (cmd.waitForNext !== false) {
      // Show next button and wait for click
      const nextBtn = document.createElement('button');
      nextBtn.className = 'say-dialog-next';
      nextBtn.innerHTML = '▼';
      nextBtn.addEventListener('click', () => {
        dialog.style.opacity = '0';
        setTimeout(() => { dialog.remove(); executeNextCommand(); }, 250);
      });
      dialog.appendChild(nextBtn);
    } else {
      // Auto-advance after brief delay
      waitTimer = setTimeout(() => {
        waitTimer = null;
        dialog.style.opacity = '0';
        setTimeout(() => { dialog.remove(); executeNextCommand(); }, 250);
      }, 600);
    }
  }

  if (cmd.typingAnimation !== false) {
    // Typing animation
    let i = 0;
    const speed = 30;
    function typeChar() {
      if (!running) { dialog.remove(); return; }
      if (i < text.length) {
        textEl.textContent += text[i];
        if (typingBuffer && text[i] !== ' ') {
          playTypingSound(typingBuffer, 0.3);
        }
        i++;
        waitTimer = setTimeout(typeChar, speed);
      } else {
        waitTimer = null;
        finishDialog();
      }
    }
    typeChar();
  } else {
    textEl.textContent = text;
    finishDialog();
  }
}

function execCall(cmd) {
  const target = S.nodes.find(n => n.id === cmd.targetBlockId);
  if (!target) {
    logEntry(`Block ${currentNode.id} "${currentNode.label}": Call: target block not found`);
    appendOutput('<div class="exec-msg exec-error">Call: target block not found.</div>');
    executeNextCommand();
    return;
  }
  logEntry(`Block ${currentNode.id} "${currentNode.label}": Call: "${target.label}" (mode: ${cmd.mode})`);
  if (cmd.mode === 'continue') {
    callStack.push({ node: currentNode, cmdIdx: currentCmd });
  }
  executeBlock(target);
}

function execMenu(cmd) {
  // Collect consecutive menu commands (including this one)
  const choices = [{ text: cmd.text, targetBlockId: cmd.targetBlockId }];
  let peekIdx = currentCmd;
  while (peekIdx < currentNode.commands.length && currentNode.commands[peekIdx].type === 'menu') {
    choices.push({ text: currentNode.commands[peekIdx].text, targetBlockId: currentNode.commands[peekIdx].targetBlockId });
    peekIdx++;
  }
  currentCmd = peekIdx;

  logEntry(`Block ${currentNode.id} "${currentNode.label}": Menu: ${choices.map(c => c.text).join(' / ')}`);

  // Create centered menu overlay
  menuOverlay = document.createElement('div');
  menuOverlay.className = 'menu-choices-overlay';

  for (const choice of choices) {
    const btn = document.createElement('button');
    btn.className = 'menu-choice-btn';
    btn.textContent = choice.text;
    btn.addEventListener('click', () => {
      menuOverlay.remove();
      menuOverlay = null;
      if (choice.targetBlockId != null) {
        const target = S.nodes.find(n => n.id === choice.targetBlockId);
        if (target) {
          executeBlock(target);
          return;
        }
      }
      executeNextCommand();
    });
    menuOverlay.appendChild(btn);
  }

  document.body.appendChild(menuOverlay);
}

function coerceToType(val, varType) {
  if (varType === 'Integer') return parseInt(val, 10) || 0;
  if (varType === 'Float')   return parseFloat(val) || 0;
  if (varType === 'Boolean') return val === true || val === 'true';
  return String(val ?? '');
}

function evaluateOneCondition(cond) {
  const v = S.variables.find(v => v.name === cond.variableName);
  const varType = v ? v.type : 'String';
  const leftVal = v ? coerceToType(v.value, varType) : undefined;

  let rightVal;
  if (cond.compareType === 'variable') {
    const rv = S.variables.find(v => v.name === cond.compareVarName);
    rightVal = rv ? coerceToType(rv.value, varType) : undefined;
  } else {
    rightVal = coerceToType(cond.compareValue, varType);
  }

  switch (cond.operator) {
    case '==': return leftVal == rightVal;
    case '!=': return leftVal != rightVal;
    case '<':  return leftVal < rightVal;
    case '<=': return leftVal <= rightVal;
    case '>':  return leftVal > rightVal;
    case '>=': return leftVal >= rightVal;
    default:   return false;
  }
}

function evaluateCondition(cmd) {
  let result = evaluateOneCondition(cmd);
  if (cmd.extraConditions) {
    for (const ec of cmd.extraConditions) {
      const ecResult = evaluateOneCondition(ec);
      if (ec.logic === 'OR') result = result || ecResult;
      else result = result && ecResult;
    }
  }
  return result;
}

function conditionSummary(cmd) {
  let s = `${cmd.variableName} ${cmd.operator} ${cmd.compareType === 'variable' ? cmd.compareVarName : cmd.compareValue}`;
  if (cmd.extraConditions) {
    for (const ec of cmd.extraConditions) {
      s += ` ${ec.logic} ${ec.variableName} ${ec.operator} ${ec.compareType === 'variable' ? ec.compareVarName : ec.compareValue}`;
    }
  }
  return s;
}

// Skip forward to the next ELSE-IF, ELSE, or END-IF at current depth
function skipToNextBranch() {
  let depth = 1;
  for (let i = currentCmd; i < currentNode.commands.length; i++) {
    const c = currentNode.commands[i];
    if (c.type === 'ifCondition') depth++;
    if (c.type === 'endIf') {
      depth--;
      if (depth === 0) { currentCmd = i + 1; executeNextCommand(); return; }
    }
    if (depth === 1 && (c.type === 'elseIf' || c.type === 'elseCmd')) {
      currentCmd = i; // point to the elseIf/else command itself
      executeNextCommand(); // executeNextCommand will increment and call executeCommand
      return;
    }
  }
  executeNextCommand();
}

// Skip forward to the matching END-IF (past all ELSE-IF/ELSE branches)
function skipToEndIf() {
  let depth = 1;
  for (let i = currentCmd; i < currentNode.commands.length; i++) {
    const c = currentNode.commands[i];
    if (c.type === 'ifCondition') depth++;
    if (c.type === 'endIf') {
      depth--;
      if (depth === 0) { currentCmd = i + 1; executeNextCommand(); return; }
    }
  }
  executeNextCommand();
}

function execIfCondition(cmd) {
  const result = evaluateCondition(cmd);
  logEntry(`Block ${currentNode.id} "${currentNode.label}": If: ${conditionSummary(cmd)} → ${result}`);

  ifBranchTaken.push(result);
  if (result) {
    executeNextCommand(); // execute body
  } else {
    skipToNextBranch(); // skip to else-if / else / end-if
  }
}

function execElseIf(cmd) {
  // If a previous branch in this IF chain was already taken, skip to END-IF
  if (ifBranchTaken.length > 0 && ifBranchTaken[ifBranchTaken.length - 1]) {
    skipToEndIf();
    return;
  }

  const result = evaluateCondition(cmd);
  logEntry(`Block ${currentNode.id} "${currentNode.label}": Else-If: ${conditionSummary(cmd)} → ${result}`);

  if (result) {
    ifBranchTaken[ifBranchTaken.length - 1] = true;
    executeNextCommand();
  } else {
    skipToNextBranch();
  }
}

function execElse() {
  // If a previous branch was already taken, skip to END-IF
  if (ifBranchTaken.length > 0 && ifBranchTaken[ifBranchTaken.length - 1]) {
    skipToEndIf();
    return;
  }

  logEntry(`Block ${currentNode.id} "${currentNode.label}": Else`);
  ifBranchTaken[ifBranchTaken.length - 1] = true;
  executeNextCommand();
}

function execSetVarValue(cmd) {
  const v = S.variables.find(v => v.name === cmd.variableName);
  if (v) {
    v.value = coerceToType(cmd.value, v.type);
    logEntry(`Block ${currentNode.id} "${currentNode.label}": Set variable: ${cmd.variableName} = ${cmd.value}`);
  } else {
    logEntry(`Block ${currentNode.id} "${currentNode.label}": Set variable: "${cmd.variableName}" not found`);
  }
  executeNextCommand();
}

function execSetVarCopy(cmd) {
  const target = S.variables.find(v => v.name === cmd.variableName);
  const source = S.variables.find(v => v.name === cmd.sourceVariableName);
  if (target && source) {
    target.value = source.value;
    logEntry(`Block ${currentNode.id} "${currentNode.label}": Copy variable: ${cmd.variableName} ← ${cmd.sourceVariableName} (${source.value})`);
  } else {
    logEntry(`Block ${currentNode.id} "${currentNode.label}": Copy variable: variable not found`);
  }
  executeNextCommand();
}

function execWait(cmd) {
  logEntry(`Block ${currentNode.id} "${currentNode.label}": Wait: ${cmd.duration}s`);
  const ms = (cmd.duration || 1) * 1000;
  waitTimer = setTimeout(() => { waitTimer = null; executeNextCommand(); }, ms);
}

function execSendMessage(cmd) {
  logEntry(`Block ${currentNode.id} "${currentNode.label}": Send message: "${cmd.message}"`);
  const targets = S.nodes.filter(n => n.event?.type === 'messageReceived' && n.event.message === cmd.message);
  if (targets.length > 0) {
    callStack.push({ node: currentNode, cmdIdx: currentCmd });
    executeBlock(targets[0]);
  } else {
    executeNextCommand();
  }
}

function execStageBgColor(cmd) {
  logEntry(`Block ${currentNode.id} "${currentNode.label}": Stage BG Color: ${cmd.color}`);
  const stage = document.getElementById('run-stage');
  if (stage) {
    stage.style.backgroundColor = cmd.color;
    stage.style.backgroundImage = '';
  }
  executeNextCommand();
}

function execStageBgImage(cmd) {
  logEntry(`Block ${currentNode.id} "${currentNode.label}": Stage BG Image: ${cmd.imageUrl || '(none)'}`);
  const stage = document.getElementById('run-stage');
  if (stage && cmd.imageUrl) {
    stage.style.backgroundImage = `url(${cmd.imageUrl})`;
    stage.style.backgroundSize = 'cover';
    stage.style.backgroundPosition = 'center';
  }
  executeNextCommand();
}

function execPlayMusic(cmd) {
  logEntry(`Block ${currentNode.id} "${currentNode.label}": Play music: ${cmd.audioUrl || '(none)'}`);
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
  logEntry(`Block ${currentNode.id} "${currentNode.label}": Play sound: ${cmd.audioUrl || '(none)'}`);
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
  logEntry(`Block ${currentNode.id} "${currentNode.label}": Stop audio`);
  for (const [url, audio] of Object.entries(audioElements)) {
    audio.pause();
    audio.currentTime = 0;
    delete audioElements[url];
  }
  executeNextCommand();
}
