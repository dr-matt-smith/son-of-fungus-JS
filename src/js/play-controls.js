'use strict';

import { S } from './state.js';
import { startExecution, startStepExecution, stepNext, stopExecution, getRunLog } from './engine.js';
import { activateNode } from './nodes/node-selection.js';
import { updateInspector } from './inspector.js';
import { renderVariablesList, showTab, attachDividerResize } from './data-panel-ui.js';

// ── Play / Stop / Step ───────────────────────────────────────────────────────

const btnPlay         = document.getElementById('btn-play');
const btnPlayStep     = document.getElementById('btn-play-step');
const btnStepContinue = document.getElementById('btn-step-continue');
const btnStop         = document.getElementById('btn-stop');
const playLabel       = document.getElementById('play-label');

export function showPlayButtons() {
  btnPlay.style.display = '';
  btnPlayStep.style.display = '';
  btnStepContinue.style.display = 'none';
  btnStop.style.display = 'none';
  if (btnStepInto) btnStepInto.style.display = 'none';
  if (btnStepOver) btnStepOver.style.display = 'none';
}

function showRunningButtons() {
  btnPlay.style.display = 'none';
  btnPlayStep.style.display = 'none';
  btnStepContinue.style.display = 'none';
  btnStop.style.display = '';
  if (btnStepInto) btnStepInto.style.display = 'none';
  if (btnStepOver) btnStepOver.style.display = 'none';
}

function showStepPausedButtons() {
  btnPlay.style.display = 'none';
  btnPlayStep.style.display = 'none';
  btnStepContinue.style.display = '';
  btnStop.style.display = '';
  if (btnStepInto) btnStepInto.style.display = 'none';
  if (btnStepOver) btnStepOver.style.display = 'none';
}

const runStage = document.getElementById('run-stage');
const mainArea = document.getElementById('main-area');

function enterRunStage() {
  if (runStage) runStage.style.display = '';
  if (mainArea) mainArea.style.display = 'none';
}

function exitRunStage() {
  if (runStage) {
    runStage.style.display = 'none';
    runStage.style.backgroundColor = '';
    runStage.style.backgroundImage = '';
  }
  if (mainArea) mainArea.style.display = '';
}

btnPlay.addEventListener('click', () => {
  enterRunStage();
  showRunningButtons();
  startExecution();
});

const btnStepInto     = document.getElementById('btn-step-into');
const btnStepOver     = document.getElementById('btn-step-over');
const debugStatusBar  = document.getElementById('debug-status-bar');
const debugStatusText = document.getElementById('debug-status-text');

export let debugMode = false;
export let debugEditedVars = new Set();

function enterDebugMode() {
  debugMode = true;
  debugEditedVars = new Set();
  document.body.classList.add('debug-active');
  if (debugStatusBar) debugStatusBar.style.display = '';

  // Close settings if open
  showTab('inspector');

  // Show only Variables + Stage Preview in data panel
  const enumSection = document.getElementById('data-enums');
  const eventSection = document.getElementById('data-events');
  const charSection = document.getElementById('data-characters');
  if (enumSection) enumSection.style.display = 'none';
  if (eventSection) eventSection.style.display = 'none';
  if (charSection) charSection.style.display = 'none';

  // Hide all static section dividers (between enums/events/characters)
  for (const d of document.querySelectorAll('#data-panel-body > .data-section-divider:not(#debug-stage-divider)')) {
    d.style.display = 'none';
  }

  // Expand Variables section
  const varSection = document.getElementById('data-variables');
  if (varSection) { varSection.classList.remove('collapsed'); const t = varSection.querySelector('.data-section-toggle'); if (t) t.textContent = '−'; }

  // Create debug stage preview
  createDebugStagePreview();

  renderVariablesList();
}

function exitDebugMode() {
  debugMode = false;
  document.body.classList.remove('debug-active');
  if (debugStatusBar) debugStatusBar.style.display = 'none';
  if (debugStatusText) debugStatusText.textContent = '';

  // Restore data sections and dividers
  const enumSection = document.getElementById('data-enums');
  const eventSection = document.getElementById('data-events');
  const charSection = document.getElementById('data-characters');
  if (enumSection) enumSection.style.display = '';
  if (eventSection) eventSection.style.display = '';
  if (charSection) charSection.style.display = '';
  for (const d of document.querySelectorAll('#data-panel-body > .data-section-divider')) {
    d.style.display = '';
  }

  // Remove debug stage preview
  removeDebugStagePreview();

  // Clear highlights
  clearDebugHighlights();
  renderVariablesList();
}

function createDebugStagePreview() {
  const body = document.getElementById('data-panel-body');
  if (!body || document.getElementById('debug-stage-preview')) return;

  const divider = document.createElement('div');
  divider.className = 'data-section-divider';
  divider.id = 'debug-stage-divider';
  body.appendChild(divider);
  attachDividerResize(divider);

  const section = document.createElement('div');
  section.className = 'data-section';
  section.id = 'debug-stage-preview';
  section.style.flex = '1 1 50%';
  section.innerHTML = `
    <div class="data-section-header">
      <span class="data-section-title">Stage Preview</span>
    </div>
    <div class="data-section-content" style="padding:0;position:relative;overflow:hidden;background:#000;">
      <div id="debug-stage" style="position:absolute;inset:0;"></div>
    </div>
  `;
  body.appendChild(section);
}

function removeDebugStagePreview() {
  const preview = document.getElementById('debug-stage-preview');
  const divider = document.getElementById('debug-stage-divider');
  if (preview) preview.remove();
  if (divider) divider.remove();
}

function clearDebugHighlights() {
  for (const el of document.querySelectorAll('.var-highlighted, .var-edited')) {
    el.classList.remove('var-highlighted', 'var-edited');
  }
  for (const el of document.querySelectorAll('.conn-debug-highlight')) {
    el.classList.remove('conn-debug-highlight');
  }
}

function updateDebugStatus(msg) {
  if (debugStatusText) debugStatusText.textContent = msg ? `DEBUG run: ${msg}` : '';
}

S.on('variableChanged', () => {
  renderVariablesList();
});

S.on('waitingForInput', () => {
  if (debugMode && debugStatusText) {
    debugStatusText.textContent += ' (waiting for user input)';
  }
});

function highlightReferencedVars(cmd) {
  clearDebugHighlights();
  if (!cmd) return;
  const varNames = new Set();
  if (cmd.variableName) varNames.add(cmd.variableName);
  if (cmd.compareVarName) varNames.add(cmd.compareVarName);
  if (cmd.sourceVariableName) varNames.add(cmd.sourceVariableName);
  if (cmd.extraConditions) {
    for (const ec of cmd.extraConditions) {
      if (ec.variableName) varNames.add(ec.variableName);
      if (ec.compareVarName) varNames.add(ec.compareVarName);
    }
  }

  // Highlight matching variable rows
  const varItems = document.querySelectorAll('#variables-list .variable-wrapper');
  varItems.forEach((item) => {
    const nameInput = item.querySelector('.variable-name-input');
    if (nameInput && varNames.has(nameInput.value)) {
      item.querySelector('.variable-item')?.classList.add('var-highlighted');
    }
  });

  // Highlight edited vars
  for (const name of debugEditedVars) {
    varItems.forEach((item) => {
      const nameInput = item.querySelector('.variable-name-input');
      if (nameInput && nameInput.value === name) {
        item.querySelector('.variable-item')?.classList.add('var-edited');
      }
    });
  }

  // Highlight connection for call commands
  if (cmd.type === 'call' && cmd.targetBlockId != null) {
    const fromNode = S.executingNode;
    if (fromNode) {
      for (const conn of S.connections) {
        if (conn.fromId === fromNode.id && conn.toId === cmd.targetBlockId && conn.group) {
          conn.group.classList.add('conn-debug-highlight');
        }
      }
    }
  }
}

btnPlayStep.addEventListener('click', () => {
  enterDebugMode();
  showRunningButtons();
  startStepExecution();
});

btnStepContinue.addEventListener('click', () => {
  showRunningButtons();
  stepNext();
});

if (btnStepInto) {
  btnStepInto.addEventListener('click', () => {
    showRunningButtons();
    stepNext();
  });
}

if (btnStepOver) {
  btnStepOver.addEventListener('click', () => {
    // Step over: run until we return to the same block
    showRunningButtons();
    S.stepOverTarget = { nodeId: S.executingNode?.id, cmdIdx: S.executingCommandIdx + 1 };
    stepNext();
  });
}

btnStop.addEventListener('click', () => {
  stopExecution();
  if (debugMode) exitDebugMode();
  exitRunStage();
  showPlayButtons();
});

S.onStepPause = () => {
  showStepPausedButtons();

  if (debugMode) {
    // Always update status bar from latest log entry
    const lastLog = getRunLog();
    const lastEntry = lastLog.length > 0 ? lastLog[lastLog.length - 1].message : '';
    updateDebugStatus(lastEntry);
  }

  if (debugMode && S.executingNode) {
    const cmd = S.executingNode ? S.executingNode.commands[S.executingCommandIdx] : null;

    // Highlight referenced variables
    if (cmd) highlightReferencedVars(cmd);

    // Show Step Into / Step Over for call commands
    if (cmd && cmd.type === 'call' && btnStepInto && btnStepOver) {
      btnStepInto.style.display = '';
      btnStepOver.style.display = '';
      btnStepContinue.style.display = 'none';
    } else {
      if (btnStepInto) btnStepInto.style.display = 'none';
      if (btnStepOver) btnStepOver.style.display = 'none';
    }

    // Select the executing node and show command in inspector
    activateNode(S.executingNode);
    updateInspector();
  }
};

S.onExecutionEnd = () => {
  if (debugMode) exitDebugMode();
  exitRunStage();
  showPlayButtons();
};

playLabel.textContent = 'Play';
