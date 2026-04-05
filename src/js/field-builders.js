/**
 * Reusable field-builder helpers for command inspector fields.
 *
 * Extracted from command-fields.js so that both command-registry.js and
 * command-fields.js can import them without circular dependencies.
 */

import { S } from './state.js';

// ── Callbacks (set once by inspector-core via initFieldBuilderCallbacks) ─────

let _onNodeDataChanged = () => {};
let _updateInspector = () => {};
let _updateCmdSummaryRow = () => {};

export function initFieldBuilderCallbacks({ onNodeDataChanged, updateInspector, updateCmdSummaryRow }) {
  _onNodeDataChanged = onNodeDataChanged;
  _updateInspector = updateInspector;
  _updateCmdSummaryRow = updateCmdSummaryRow;
}

export function getFieldCallbacks() {
  return {
    onNodeDataChanged: _onNodeDataChanged,
    updateInspector: _updateInspector,
    updateCmdSummaryRow: _updateCmdSummaryRow,
  };
}

// ── Field builders ──────────────────────────────────────────────────────────

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

export function labeledIntegerInput(label, value, onChange) {
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

export function labeledFloatInput(label, value, onChange) {
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

export function labeledTextarea(label, value, onChange) {
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

export function labeledBlockSelect(label, currentId, onChange, excludeNode) {
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

export function renderConditionFields(container, cmd) {
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
