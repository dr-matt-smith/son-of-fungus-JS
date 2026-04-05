import { S } from './state.js';
import { COMMAND_TYPES, createCommand } from './commands.js';
import { AUDIO_FILES } from './audio-manifest.js';
import { IMAGE_FILES } from './image-manifest.js';

// Callbacks set by inspector-core
let _onNodeDataChanged = () => {};
let _updateInspector = () => {};
let _updateCmdSummaryRow = () => {};

export function initCommandFieldCallbacks({ onNodeDataChanged, updateInspector, updateCmdSummaryRow }) {
  _onNodeDataChanged = onNodeDataChanged;
  _updateInspector = updateInspector;
  _updateCmdSummaryRow = updateCmdSummaryRow;
}

// ── Field builders ───────────────────────────────────────────────────────────

export function createInput(value, onChange) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inspector-input';
  input.value = value;
  input.addEventListener('input', () => onChange(input.value));
  input.addEventListener('keydown', (e) => e.stopPropagation());
  return input;
}

export function labeledInput(label, value, onChange) {
  const row = document.createElement('div');
  row.className = 'cmd-field';
  row.innerHTML = `<span class="cmd-field-label">${label}</span>`;
  row.appendChild(createInput(String(value ?? ''), onChange));
  return row;
}

function labeledIntegerInput(label, value, onChange) {
  const row = document.createElement('div');
  row.className = 'cmd-field';
  row.innerHTML = `<span class="cmd-field-label">${label}</span>`;
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.className = 'inspector-input';
  input.value = String(value ?? 0);
  input.addEventListener('change', () => { const v = parseInt(input.value, 10) || 0; input.value = String(v); onChange(v); });
  input.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    if (e.key === '-') return;
    if (e.key >= '0' && e.key <= '9') return;
    e.preventDefault();
  });
  row.appendChild(input);
  return row;
}

function labeledFloatInput(label, value, onChange) {
  const row = document.createElement('div');
  row.className = 'cmd-field';
  row.innerHTML = `<span class="cmd-field-label">${label}</span>`;
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.className = 'inspector-input';
  input.value = String(value ?? 0);
  input.addEventListener('change', () => { const v = parseFloat(input.value) || 0; input.value = String(v); onChange(v); });
  input.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    if (e.key === '-' || e.key === '.') return;
    if (e.key >= '0' && e.key <= '9') return;
    e.preventDefault();
  });
  row.appendChild(input);
  return row;
}

function labeledTextarea(label, value, onChange) {
  const row = document.createElement('div');
  row.className = 'cmd-field';
  row.innerHTML = `<span class="cmd-field-label">${label}</span>`;
  const ta = document.createElement('textarea');
  ta.className = 'inspector-textarea';
  ta.value = value;
  ta.rows = 3;
  ta.addEventListener('input', () => onChange(ta.value));
  ta.addEventListener('keydown', (e) => e.stopPropagation());
  row.appendChild(ta);
  return row;
}

export function labeledSelect(label, value, options, onChange) {
  const row = document.createElement('div');
  row.className = 'cmd-field';
  row.innerHTML = `<span class="cmd-field-label">${label}</span>`;
  const sel = document.createElement('select');
  sel.className = 'inspector-select';
  for (const [val, text] of options) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = text;
    if (val === value) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  row.appendChild(sel);
  return row;
}

export function labeledCheckbox(label, checked, onChange) {
  const row = document.createElement('div');
  row.className = 'cmd-field';
  const lbl = document.createElement('label');
  lbl.className = 'cmd-checkbox-label';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = checked;
  cb.addEventListener('change', () => onChange(cb.checked));
  lbl.appendChild(cb);
  lbl.appendChild(document.createTextNode(' ' + label));
  row.appendChild(lbl);
  return row;
}

function labeledBlockSelect(label, currentId, onChange, excludeNode) {
  const options = S.nodes
    .filter(n => n !== excludeNode && (n.type === 'state' || n.type === 'choice'))
    .map(n => [String(n.id), `${n.label || n.type} (${n.id})`]);
  options.unshift(['', '— none —']);
  return labeledSelect(label, currentId != null ? String(currentId) : '', options, v => {
    onChange(v ? Number(v) : null);
  });
}

// ── Condition renderers ─────────────────────────────────────────────────────

function renderOneCondition(container, cond, label) {
  const varOpts = [['', '— select variable —'], ...S.variables.map(v => [v.name, `${v.name} (${v.type})`])];
  const operators = [['==', '=='], ['!=', '!='], ['<', '<'], ['<=', '<='], ['>', '>'], ['>=', '>=']];
  const compareTypes = [['literal', 'Value'], ['variable', 'Variable']];

  if (label) {
    const lbl = document.createElement('div');
    lbl.className = 'inspector-section-title';
    lbl.textContent = label;
    container.appendChild(lbl);
  }
  container.appendChild(labeledSelect('Variable', cond.variableName || '', varOpts, v => { cond.variableName = v; }));
  container.appendChild(labeledSelect('Operator', cond.operator || '==', operators, v => { cond.operator = v; }));
  container.appendChild(labeledSelect('Compare to', cond.compareType || 'literal', compareTypes, v => { cond.compareType = v; _updateInspector(); }));
  if (cond.compareType === 'variable') {
    container.appendChild(labeledSelect('Compare Variable', cond.compareVarName || '', varOpts, v => { cond.compareVarName = v; }));
  } else {
    container.appendChild(labeledInput('Value', cond.compareValue ?? '', v => { cond.compareValue = v; }));
  }
}

function renderConditionFields(container, cmd) {
  // Primary condition
  renderOneCondition(container, cmd, null);

  // Extra conditions (AND/OR)
  if (!cmd.extraConditions) cmd.extraConditions = [];
  for (let i = 0; i < cmd.extraConditions.length; i++) {
    const ec = cmd.extraConditions[i];
    const logicOpts = [['AND', 'AND'], ['OR', 'OR']];
    container.appendChild(labeledSelect('', ec.logic || 'AND', logicOpts, v => { ec.logic = v; }));
    renderOneCondition(container, ec, null);
    const delBtn = document.createElement('button');
    delBtn.className = 'cmd-btn cmd-btn-del';
    delBtn.textContent = '\u00d7 Remove condition';
    delBtn.addEventListener('click', () => { cmd.extraConditions.splice(i, 1); _updateInspector(); });
    container.appendChild(delBtn);
  }

  // Add AND/OR button
  const addCondBtn = document.createElement('button');
  addCondBtn.className = 'cmd-btn';
  addCondBtn.textContent = '+ AND/OR condition';
  addCondBtn.addEventListener('click', () => {
    if (!cmd.extraConditions) cmd.extraConditions = [];
    cmd.extraConditions.push({ logic: 'AND', variableName: '', operator: '==', compareType: 'literal', compareValue: '', compareVarName: '' });
    _updateInspector();
  });
  container.appendChild(addCondBtn);
}

// ── Command field rendering switch ──────────────────────────────────────────

export function renderCommandFields(container, cmd, node) {
  switch (cmd.type) {
    case 'say':
      container.appendChild(labeledInput('Character', cmd.character, v => { cmd.character = v; _updateCmdSummaryRow(); }));
      container.appendChild(labeledTextarea('Text', cmd.text, v => { cmd.text = v; _updateCmdSummaryRow(); }));
      container.appendChild(labeledCheckbox('Wait for next', cmd.waitForNext ?? true, v => { cmd.waitForNext = v; }));
      container.appendChild(labeledCheckbox('Typing animation', cmd.typingAnimation ?? true, v => { cmd.typingAnimation = v; }));
      container.appendChild(labeledCheckbox('Typing audio', cmd.typingAudio ?? true, v => { cmd.typingAudio = v; }));
      if (cmd.typingAudio !== false) {
        const audioOpts = [['', '— none —'], ...AUDIO_FILES.map(f => [f, f])];
        container.appendChild(labeledSelect('Typing sound', cmd.typingAudioUrl || '/audio/defaults/MidVoice.wav', audioOpts, v => { cmd.typingAudioUrl = v; }));
      }
      break;
    case 'call':
      container.appendChild(labeledBlockSelect('Target Block', cmd.targetBlockId, v => { cmd.targetBlockId = v; _onNodeDataChanged(); }, node));
      container.appendChild(labeledSelect('Mode', cmd.mode, [['stop', 'Stop'], ['continue', 'Continue']], v => { cmd.mode = v; }));
      break;
    case 'menu':
      container.appendChild(labeledInput('Button Text', cmd.text, v => { cmd.text = v; _updateCmdSummaryRow(); }));
      container.appendChild(labeledBlockSelect('\u2192 Block', cmd.targetBlockId, v => { cmd.targetBlockId = v; _onNodeDataChanged(); }, node));
      break;
    case 'ifCondition':
    case 'elseIf':
      renderConditionFields(container, cmd);
      break;
    case 'elseCmd':
    case 'endIf':
      break;
    case 'setVarValue': {
      const varOpts = [['', '— select variable —'], ...S.variables.map(v => [v.name, `${v.name} (${v.type})`])];
      container.appendChild(labeledSelect('Variable', cmd.variableName || '', varOpts, v => { cmd.variableName = v; _updateInspector(); }));
      // Show appropriate value input based on selected variable's type
      const selVar = S.variables.find(v => v.name === cmd.variableName);
      if (selVar) {
        if (selVar.type === 'Boolean') {
          container.appendChild(labeledSelect('Value', String(cmd.value ?? false), [['false', 'false'], ['true', 'true']], v => { cmd.value = v === 'true'; }));
        } else if (selVar.type === 'Enum' && selVar.enumName) {
          const enumSet = S.enums.find(e => e.name === selVar.enumName);
          if (enumSet) {
            const enumOpts = [['', '— select —'], ...enumSet.values.map(ev => [ev.key, ev.label || ev.key])];
            container.appendChild(labeledSelect('Value', cmd.value || '', enumOpts, v => { cmd.value = v; }));
          }
        } else if (selVar.type === 'Integer') {
          container.appendChild(labeledIntegerInput('Value', cmd.value ?? 0, v => { cmd.value = v; }));
        } else if (selVar.type === 'Float') {
          container.appendChild(labeledFloatInput('Value', cmd.value ?? 0, v => { cmd.value = v; }));
        } else {
          container.appendChild(labeledInput('Value', cmd.value ?? '', v => { cmd.value = v; }));
        }
      }
      break;
    }
    case 'setVarCopy': {
      const varOpts2 = [['', '— select variable —'], ...S.variables.map(v => [v.name, `${v.name} (${v.type})`])];
      container.appendChild(labeledSelect('Set Variable', cmd.variableName || '', varOpts2, v => { cmd.variableName = v; }));
      container.appendChild(labeledSelect('Copy From', cmd.sourceVariableName || '', varOpts2, v => { cmd.sourceVariableName = v; }));
      break;
    }
    case 'playMusic': {
      const audioOptions = [['', '— none —'], ...AUDIO_FILES.map(f => [f, f])];
      container.appendChild(labeledSelect('Audio File', cmd.audioUrl || '', audioOptions, v => { cmd.audioUrl = v; }));
      container.appendChild(labeledInput('Volume', cmd.volume, v => { cmd.volume = parseFloat(v) || 0; }));
      break;
    }
    case 'playSound': {
      const audioOptions = [['', '— none —'], ...AUDIO_FILES.map(f => [f, f])];
      container.appendChild(labeledSelect('Audio File', cmd.audioUrl || '', audioOptions, v => { cmd.audioUrl = v; }));
      container.appendChild(labeledInput('Volume', cmd.volume, v => { cmd.volume = parseFloat(v) || 0; }));
      container.appendChild(labeledCheckbox('Wait for sound to finish playing', cmd.waitUntilFinished ?? false, v => { cmd.waitUntilFinished = v; }));
      break;
    }
    case 'stageBgColor': {
      const colorRow = document.createElement('div');
      colorRow.className = 'cmd-field';
      colorRow.innerHTML = '<span class="cmd-field-label">Color</span>';
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'inspector-input';
      colorInput.value = cmd.color || '#ffffff';
      colorInput.addEventListener('input', () => { cmd.color = colorInput.value; });
      colorInput.addEventListener('keydown', (e) => e.stopPropagation());
      colorRow.appendChild(colorInput);
      container.appendChild(colorRow);
      break;
    }
    case 'stageBgImage': {
      const imgOptions = [['', '— none —'], ...IMAGE_FILES.map(f => [f, f])];
      container.appendChild(labeledSelect('Image', cmd.imageUrl || '', imgOptions, v => { cmd.imageUrl = v; }));
      break;
    }
    case 'wait':
      container.appendChild(labeledInput('Duration (s)', cmd.duration, v => { cmd.duration = parseFloat(v) || 0; }));
      break;
    case 'sendMessage': {
      const msgOptions = [['', '— select message —'], ...S.messages.map(m => [m, m])];
      container.appendChild(labeledSelect('Message', cmd.message || '', msgOptions, v => { cmd.message = v; }));
      break;
    }
  }
}
