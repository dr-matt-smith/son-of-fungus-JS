'use strict';

import { S } from './state.js';
import { logEntry, isRunning } from './engine.js';
import { debugMode, debugEditedVars } from './play-controls.js';
import { AUDIO_FILES } from './audio-manifest.js';

// ── Inspector / Settings tabs ────────────────────────────────────────────────

const inspectorPanel  = document.getElementById('inspector-panel');
const settingsPanel   = document.getElementById('settings-panel');
const inspectorTabs   = document.getElementById('inspector-tabs');

const contentPanels = [inspectorPanel, settingsPanel];

export function showTab(tabName) {
  inspectorTabs.style.display = '';
  for (const p of contentPanels) p.style.display = 'none';
  for (const t of document.querySelectorAll('.inspector-tab')) {
    t.classList.toggle('active', t.dataset.tab === tabName);
  }
  if (tabName === 'inspector') inspectorPanel.style.display = '';
}

for (const tab of document.querySelectorAll('.inspector-tab')) {
  tab.addEventListener('click', () => showTab(tab.dataset.tab));
}

// ── Data panel (left) ───────────────────────────────────────────────────────

const dataPanel       = document.getElementById('data-panel');
const dataPanelBody   = document.getElementById('data-panel-body');
const btnCollapseData = document.getElementById('btn-collapse-data');
const btnExpandData   = document.getElementById('btn-expand-data');
const dividerLeft     = document.getElementById('divider-left');

// Collapse / expand
if (btnCollapseData) {
  btnCollapseData.addEventListener('click', () => {
    dataPanel.style.display = 'none';
    dividerLeft.style.display = 'none';
    btnExpandData.style.display = '';
  });
}
if (btnExpandData) {
  btnExpandData.addEventListener('click', () => {
    dataPanel.style.display = '';
    dividerLeft.style.display = '';
    btnExpandData.style.display = 'none';
    renderVariablesList();
    renderEnumsList();
    renderMessagesList();
  });
}

// Section toggle (minimize/expand)
for (const section of document.querySelectorAll('.data-section')) {
  const toggle = section.querySelector('.data-section-toggle');
  if (!toggle) continue;
  toggle.addEventListener('click', () => {
    section.classList.toggle('collapsed');
    toggle.textContent = section.classList.contains('collapsed') ? '+' : '\u2212';
  });
}

// Left divider drag (resize data panel)
if (dividerLeft) {
  let draggingLeft = false;
  dividerLeft.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    draggingLeft = true;
    dividerLeft.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
  });
  document.addEventListener('mousemove', (e) => {
    if (!draggingLeft) return;
    const mainArea = document.getElementById('main-area');
    const rect = mainArea.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    dataPanel.style.width = `${Math.max(10, Math.min(50, pct))}%`;
  });
  document.addEventListener('mouseup', () => {
    if (!draggingLeft) return;
    draggingLeft = false;
    dividerLeft.classList.remove('dragging');
    document.body.style.cursor = '';
  });
}

// Section divider drag (resize sections vertically)
for (const divider of document.querySelectorAll('.data-section-divider')) {
  let dragging = false;
  let prevSection = null;
  let nextSection = null;
  divider.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    prevSection = divider.previousElementSibling;
    nextSection = divider.nextElementSibling;
    document.body.style.cursor = 'row-resize';
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging || !prevSection || !nextSection) return;
    const bodyRect = dataPanelBody.getBoundingClientRect();
    const y = e.clientY - bodyRect.top;
    const total = bodyRect.height;
    const prevTop = prevSection.getBoundingClientRect().top - bodyRect.top;
    const nextBottom = nextSection.getBoundingClientRect().bottom - bodyRect.top;
    const newPrevH = Math.max(30, y - prevTop);
    const newNextH = Math.max(30, nextBottom - y);
    prevSection.style.flex = `0 0 ${newPrevH}px`;
    nextSection.style.flex = `0 0 ${newNextH}px`;
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
  });
}

// ── Messages tab ────────────────────────────────────────────────────────────

const messagesList   = document.getElementById('messages-list');
const messagesNewInput = document.getElementById('messages-new-input');
const messagesAddBtn = document.getElementById('messages-add-btn');

export function renderMessagesList() {
  messagesList.innerHTML = '';
  for (let i = 0; i < S.messages.length; i++) {
    const row = document.createElement('div');
    row.className = 'messages-item';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inspector-input';
    input.value = S.messages[i];
    input.addEventListener('change', () => {
      const val = input.value.trim();
      if (val) S.messages[i] = val;
      else { S.messages.splice(i, 1); renderMessagesList(); }
    });
    input.addEventListener('keydown', (e) => e.stopPropagation());
    row.appendChild(input);

    const delBtn = document.createElement('button');
    delBtn.className = 'messages-delete-btn';
    delBtn.textContent = '\u00D7';
    delBtn.title = 'Delete message';
    delBtn.addEventListener('click', () => { S.messages.splice(i, 1); renderMessagesList(); });
    row.appendChild(delBtn);

    messagesList.appendChild(row);
  }
}

messagesAddBtn.addEventListener('click', () => {
  const val = messagesNewInput.value.trim();
  if (val && !S.messages.includes(val)) {
    S.messages.push(val);
    messagesNewInput.value = '';
    renderMessagesList();
  }
});

messagesNewInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') messagesAddBtn.click();
});

// ── Variables tab ───────────────────────────────────────────────────────────

export const VAR_TYPES = ['Boolean', 'Integer', 'Float', 'String', 'Enum'];
const VAR_DEFAULTS = { Boolean: false, Integer: 0, Float: 0.0, String: '', Enum: '' };

const variablesList    = document.getElementById('variables-list');
const variablesNewType = document.getElementById('variables-new-type');
const variablesNewName = document.getElementById('variables-new-name');
const variablesAddBtn  = document.getElementById('variables-add-btn');

// debugMode and debugEditedVars are imported from play-controls.
// This creates a circular dependency (play-controls -> data-panel-ui -> play-controls),
// but it works because these values are only accessed at runtime from event handlers,
// not during module initialization.

function logVarEdit(varName, newValue) {
  if (debugMode && isRunning()) {
    logEntry(`\u26A1 User edited variable: ${varName} = ${JSON.stringify(newValue)}`);
    debugEditedVars.add(varName);
  }
}

export function renderVariablesList() {
  variablesList.innerHTML = '';

  // Column headers
  if (S.variables.length > 0) {
    const header = document.createElement('div');
    header.className = 'variable-item variable-header';
    header.innerHTML = '<span class="variable-col-type">Data Type</span>' +
                       '<span class="variable-col-name">Variable Name</span>' +
                       '<span class="variable-col-value"></span>' +
                       '<span class="variable-col-del"></span>';
    variablesList.appendChild(header);
  }

  for (let i = 0; i < S.variables.length; i++) {
    const v = S.variables[i];
    const wrapper = document.createElement('div');
    wrapper.className = 'variable-wrapper';

    const row = document.createElement('div');
    row.className = 'variable-item';

    // Type select (first)
    const typeSelect = document.createElement('select');
    typeSelect.className = 'inspector-select variable-type-select';
    for (const t of VAR_TYPES) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      if (t === v.type) opt.selected = true;
      typeSelect.appendChild(opt);
    }
    typeSelect.addEventListener('change', () => {
      const oldType = v.type;
      const oldValue = v.value;
      v.type = typeSelect.value;
      // Convert value intelligently
      if (v.type === 'Integer') {
        const n = parseFloat(oldValue);
        v.value = isNaN(n) ? 0 : Math.trunc(n);
      } else if (v.type === 'Float') {
        const n = parseFloat(oldValue);
        v.value = isNaN(n) ? 0 : n;
      } else if (v.type === 'Boolean') {
        v.value = !!oldValue;
      } else if (v.type === 'Enum') {
        v.value = '';
        v.enumName = S.enums.length > 0 ? S.enums[0].name : '';
      } else {
        v.value = String(oldValue ?? '');
      }
      renderVariablesList();
    });
    row.appendChild(typeSelect);

    // Name input (second)
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'inspector-input variable-name-input';
    nameInput.value = v.name;
    nameInput.addEventListener('change', () => {
      const val = nameInput.value.trim();
      if (val) v.name = val;
      else { S.variables.splice(i, 1); renderVariablesList(); }
    });
    nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    row.appendChild(nameInput);

    // Value input (third)
    if (v.type === 'Enum') {
      // Enum set selector (compact)
      const enumSelect = document.createElement('select');
      enumSelect.className = 'inspector-select variable-enum-set-select';
      const noEnum = document.createElement('option');
      noEnum.value = '';
      noEnum.textContent = '\u2014 set \u2014';
      enumSelect.appendChild(noEnum);
      for (const es of S.enums) {
        const opt = document.createElement('option');
        opt.value = es.name;
        opt.textContent = es.name;
        if (es.name === v.enumName) opt.selected = true;
        enumSelect.appendChild(opt);
      }
      enumSelect.addEventListener('change', () => { v.enumName = enumSelect.value; v.value = ''; renderVariablesList(); });
      row.appendChild(enumSelect);

      // Enum value selector (inline)
      const enumSet = v.enumName ? S.enums.find(e => e.name === v.enumName) : null;
      const valSelect = document.createElement('select');
      valSelect.className = 'inspector-select variable-enum-val-select';
      const none = document.createElement('option');
      none.value = '';
      none.textContent = '\u2014 value \u2014';
      valSelect.appendChild(none);
      if (enumSet) {
        for (const ev of enumSet.values) {
          const opt = document.createElement('option');
          opt.value = ev.key;
          opt.textContent = ev.label || ev.key;
          if (ev.key === v.value) opt.selected = true;
          valSelect.appendChild(opt);
        }
      }
      valSelect.addEventListener('change', () => { v.value = valSelect.value; logVarEdit(v.name, v.value); });
      row.appendChild(valSelect);
    } else {
      row.appendChild(buildValueInput(v));
    }

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'messages-delete-btn';
    delBtn.textContent = '\u00D7';
    delBtn.title = 'Delete variable';
    delBtn.addEventListener('click', () => { S.variables.splice(i, 1); renderVariablesList(); });
    row.appendChild(delBtn);

    wrapper.appendChild(row);

    // String: if value is long, show a textarea on a second line
    if (v.type === 'String' && String(v.value ?? '').length > 12) {
      const textRow = document.createElement('div');
      textRow.className = 'variable-string-row';
      const textarea = document.createElement('textarea');
      textarea.className = 'inspector-input variable-string-textarea';
      textarea.rows = 2;
      textarea.value = String(v.value ?? '');
      textarea.addEventListener('input', () => {
        v.value = textarea.value;
        logVarEdit(v.name, v.value);
        if (textarea.value.length <= 12) renderVariablesList();
      });
      textarea.addEventListener('keydown', (e) => e.stopPropagation());
      textRow.appendChild(textarea);
      wrapper.appendChild(textRow);
    }

    variablesList.appendChild(wrapper);
  }
}

function buildValueInput(v) {
  if (v.type === 'Boolean') {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'variable-value-checkbox';
    cb.checked = !!v.value;
    cb.addEventListener('change', () => { v.value = cb.checked; logVarEdit(v.name, v.value); });
    return cb;
  }
  const input = document.createElement('input');
  input.className = 'inspector-input variable-value-input';
  if (v.type === 'Integer') {
    input.type = 'text';
    input.inputMode = 'numeric';
    input.value = String(v.value ?? 0);
    input.addEventListener('change', () => { v.value = parseInt(input.value, 10) || 0; input.value = String(v.value); logVarEdit(v.name, v.value); });
    input.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      if (e.key === '-') return;
      if (e.key >= '0' && e.key <= '9') return;
      e.preventDefault();
    });
    return input;
  } else if (v.type === 'Float') {
    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = String(v.value ?? 0);
    input.addEventListener('change', () => { v.value = parseFloat(input.value) || 0; input.value = String(v.value); logVarEdit(v.name, v.value); });
    input.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      if (e.key === '-' || e.key === '.') return;
      if (e.key >= '0' && e.key <= '9') return;
      e.preventDefault();
    });
  } else {
    input.type = 'text';
    input.value = String(v.value ?? '');
    input.addEventListener('change', () => {
      v.value = input.value;
      logVarEdit(v.name, v.value);
      if (input.value.length > 12) renderVariablesList();
    });
  }
  input.addEventListener('keydown', (e) => e.stopPropagation());
  return input;
}

variablesAddBtn.addEventListener('click', () => {
  const name = variablesNewName.value.trim();
  if (name) {
    const type = variablesNewType.value;
    const v = { name, type, value: VAR_DEFAULTS[type] };
    if (type === 'Enum') v.enumName = S.enums.length > 0 ? S.enums[0].name : '';
    S.variables.push(v);
    variablesNewName.value = '';
    renderVariablesList();
  }
});

variablesNewName.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') variablesAddBtn.click();
});

// ── Enums tab ───────────────────────────────────────────────────────────────

const enumsList    = document.getElementById('enums-list');
const enumsNewName = document.getElementById('enums-new-name');
const enumsAddBtn  = document.getElementById('enums-add-btn');

function toUpperSnake(s) {
  return s.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
}

export function renderEnumsList() {
  enumsList.innerHTML = '';
  for (let i = 0; i < S.enums.length; i++) {
    const es = S.enums[i];
    const card = document.createElement('div');
    card.className = 'enum-card';

    // Header: name + delete
    const header = document.createElement('div');
    header.className = 'enum-card-header';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'inspector-input enum-name-input';
    nameInput.value = es.name;
    nameInput.addEventListener('change', () => {
      const val = nameInput.value.trim();
      if (val) es.name = val;
      else { S.enums.splice(i, 1); renderEnumsList(); }
    });
    nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    header.appendChild(nameInput);

    const delBtn = document.createElement('button');
    delBtn.className = 'messages-delete-btn';
    delBtn.textContent = '\u00D7';
    delBtn.title = 'Delete enum set';
    delBtn.addEventListener('click', () => { S.enums.splice(i, 1); renderEnumsList(); });
    header.appendChild(delBtn);
    card.appendChild(header);

    // Column headers
    const colHeader = document.createElement('div');
    colHeader.className = 'enum-value-row enum-col-header';
    colHeader.innerHTML = '<span class="enum-col-key">ENUM_KEY</span><span class="enum-col-label">String Alternative</span><span class="enum-col-del"></span>';
    card.appendChild(colHeader);

    // Values
    for (let j = 0; j < es.values.length; j++) {
      const ev = es.values[j];
      const row = document.createElement('div');
      row.className = 'enum-value-row';

      const keyInput = document.createElement('input');
      keyInput.type = 'text';
      keyInput.className = 'inspector-input enum-key-input';
      keyInput.value = ev.key;
      keyInput.addEventListener('change', () => {
        ev.key = toUpperSnake(keyInput.value);
        keyInput.value = ev.key;
      });
      keyInput.addEventListener('keydown', (e) => e.stopPropagation());
      row.appendChild(keyInput);

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'inspector-input enum-label-input';
      labelInput.value = ev.label || '';
      labelInput.placeholder = 'display text\u2026';
      labelInput.addEventListener('change', () => { ev.label = labelInput.value; });
      labelInput.addEventListener('keydown', (e) => e.stopPropagation());
      row.appendChild(labelInput);

      const vDelBtn = document.createElement('button');
      vDelBtn.className = 'messages-delete-btn';
      vDelBtn.textContent = '\u00D7';
      vDelBtn.addEventListener('click', () => { es.values.splice(j, 1); renderEnumsList(); });
      row.appendChild(vDelBtn);

      card.appendChild(row);
    }

    // Add value button
    const addValBtn = document.createElement('button');
    addValBtn.className = 'cmd-btn';
    addValBtn.textContent = '+ Add Value';
    addValBtn.addEventListener('click', () => {
      es.values.push({ key: `VALUE_${es.values.length + 1}`, label: '' });
      renderEnumsList();
    });
    card.appendChild(addValBtn);

    enumsList.appendChild(card);
  }
}

enumsAddBtn.addEventListener('click', () => {
  const name = enumsNewName.value.trim();
  if (name) {
    S.enums.push({ name, values: [] });
    enumsNewName.value = '';
    renderEnumsList();
  }
});

enumsNewName.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') enumsAddBtn.click();
});

// ── Characters tab ──────────────────────────────────────────────────────────

const charactersList   = document.getElementById('characters-list');
const charsNewName     = document.getElementById('characters-new-name');
const charsAddBtn      = document.getElementById('characters-add-btn');

export function renderCharactersList() {
  if (!charactersList) return;
  charactersList.innerHTML = '';
  for (let i = 0; i < S.characters.length; i++) {
    const ch = S.characters[i];
    const card = document.createElement('div');
    card.className = 'character-card';

    // Name
    const nameRow = document.createElement('div');
    nameRow.className = 'character-row';
    nameRow.innerHTML = '<span class="character-field-label">Name</span>';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'inspector-input';
    nameInput.value = ch.name;
    nameInput.addEventListener('change', () => { ch.name = nameInput.value.trim() || ch.name; });
    nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    nameRow.appendChild(nameInput);

    const delBtn = document.createElement('button');
    delBtn.className = 'messages-delete-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Delete character';
    delBtn.addEventListener('click', () => { S.characters.splice(i, 1); renderCharactersList(); });
    nameRow.appendChild(delBtn);
    card.appendChild(nameRow);

    // Color
    const colorRow = document.createElement('div');
    colorRow.className = 'character-row';
    colorRow.innerHTML = '<span class="character-field-label">Color</span>';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'inspector-input character-color-input';
    colorInput.value = ch.color || '#60a5fa';
    colorInput.addEventListener('input', () => { ch.color = colorInput.value; });
    colorRow.appendChild(colorInput);
    card.appendChild(colorRow);

    // Sound
    const soundRow = document.createElement('div');
    soundRow.className = 'character-row';
    soundRow.innerHTML = '<span class="character-field-label">Sound</span>';
    const soundSelect = document.createElement('select');
    soundSelect.className = 'inspector-select';
    const noSound = document.createElement('option');
    noSound.value = '';
    noSound.textContent = '— default —';
    soundSelect.appendChild(noSound);
    for (const f of AUDIO_FILES) {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      if (f === ch.soundUrl) opt.selected = true;
      soundSelect.appendChild(opt);
    }
    soundSelect.addEventListener('change', () => { ch.soundUrl = soundSelect.value; });
    soundRow.appendChild(soundSelect);
    card.appendChild(soundRow);

    charactersList.appendChild(card);
  }
}

if (charsAddBtn) {
  charsAddBtn.addEventListener('click', () => {
    const name = charsNewName.value.trim();
    if (name) {
      S.characters.push({ name, color: '#60a5fa', soundUrl: '' });
      charsNewName.value = '';
      renderCharactersList();
    }
  });
}

if (charsNewName) {
  charsNewName.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && charsAddBtn) charsAddBtn.click();
  });
}
