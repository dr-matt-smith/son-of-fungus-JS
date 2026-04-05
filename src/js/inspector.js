import { S } from './state.js';
import { fitLabelFontSize } from './nodes/node-element.js';
import { EVENT_TYPES, COMMAND_TYPES, createCommand } from './commands.js';
import { applyFungusStyles, syncAutoConnections, updateDescriptionLabel } from './fungus-mode.js';
import { getRunLog } from './engine.js';
import { AUDIO_FILES } from './audio-manifest.js';
import { IMAGE_FILES } from './image-manifest.js';
import { EXAMPLE_FILES } from './examples-manifest.js';

const inspectorEl    = document.getElementById('inspector');
const emptyMsg       = document.getElementById('inspector-empty');
const propsContainer = document.getElementById('inspector-props');
const inspectorBody  = document.getElementById('inspector-body');
const tbody          = document.querySelector('#inspector-table tbody');
const divider        = document.getElementById('divider');

// ── Resizable divider ────────────────────────────────────────────────────────

let draggingDivider = false;

divider.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  draggingDivider = true;
  divider.classList.add('dragging');
  document.body.style.cursor = 'col-resize';
});

document.addEventListener('mousemove', (e) => {
  if (!draggingDivider) return;
  const mainArea = document.getElementById('main-area');
  const mainRect = mainArea.getBoundingClientRect();
  const inspectorW = Math.max(180, Math.min(mainRect.width * 0.6, mainRect.right - e.clientX));
  inspectorEl.style.width = `${inspectorW}px`;
});

document.addEventListener('mouseup', () => {
  if (!draggingDivider) return;
  draggingDivider = false;
  divider.classList.remove('dragging');
  document.body.style.cursor = '';
});

// ── Selected command tracking (fungus mode) ─────────────────────────────────

let selectedCmdIdx = -1;

function cmdDetail(cmd) {
  switch (cmd.type) {
    case 'say': {
      const t = cmd.text || '';
      return `"${t.substring(0, 24)}${t.length > 24 ? '…' : ''}"`;
    }
    case 'call': {
      const target = S.nodes.find(n => n.id === cmd.targetBlockId);
      return `<${target ? target.label : 'None'}> : ${cmd.mode === 'stop' ? 'Stop' : 'Continue'}`;
    }
    case 'menu':        return `${cmd.options.length} options`;
    case 'wait':        return `${cmd.duration}s`;
    case 'playSound':   return cmd.audioUrl || '(none)';
    case 'playMusic':   return cmd.audioUrl || '(none)';
    case 'sendMessage': return `"${cmd.message || ''}"`;
    case 'setVarValue': return `${cmd.variableName || ''} = ${cmd.value ?? ''}`;
    case 'setVarCopy':  return `${cmd.variableName || ''} ← ${cmd.sourceVariableName || ''}`;
    case 'ifCondition':
    case 'elseIf': {
      let s = `${cmd.variableName || '?'} ${cmd.operator} ${cmd.compareType === 'variable' ? cmd.compareVarName || '?' : cmd.compareValue ?? '?'}`;
      if (cmd.extraConditions?.length > 0) {
        for (const ec of cmd.extraConditions) {
          s += ` ${ec.logic} ${ec.variableName || '?'} ${ec.operator} ${ec.compareType === 'variable' ? ec.compareVarName || '?' : ec.compareValue ?? '?'}`;
        }
      }
      return s;
    }
    case 'elseCmd':     return '';
    case 'endIf':       return '';
    case 'stageBgColor': return cmd.color || '';
    case 'stageBgImage': return cmd.imageUrl || '(none)';
    case 'stopAudio':   return '';
    default:            return '';
  }
}

// ── Fungus mode reactivity ──────────────────────────────────────────────────

function onNodeDataChanged() {
  applyFungusStyles();
  syncAutoConnections();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setPropsRows(rows) {
  tbody.innerHTML = '';
  for (const [label, value] of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${label}</td><td>${escapeHtml(String(value))}</td>`;
    tbody.appendChild(tr);
  }
}

function showEmpty() {
  selectedCmdIdx = -1;
  emptyMsg.style.display = 'block';
  propsContainer.style.display = 'none';
  // Remove sections from both propsContainer and inspectorBody
  inspectorBody.querySelectorAll('.inspector-section').forEach(s => s.remove());
  tbody.innerHTML = '';
}

// ── Inspector update ─────────────────────────────────────────────────────────

export function updateInspector() {
  if (S.activeNode) {
    renderNodeInspector(S.activeNode);
    return;
  }
  if (S.selectedConn) {
    renderConnInspector(S.selectedConn);
    return;
  }
  showEmpty();
}

// ── Node inspector ───────────────────────────────────────────────────────────

function renderNodeInspector(n) {
  emptyMsg.style.display = 'none';
  propsContainer.style.display = '';
  // Clean up previous sections
  propsContainer.querySelectorAll('.inspector-section').forEach(s => s.remove());

  // Name and Description at the top
  if (n.type === 'state' || n.type === 'choice') {
    const nameSection = document.createElement('div');
    nameSection.className = 'inspector-section inspector-name-section';

    const nameHeader = document.createElement('div');
    nameHeader.className = 'inspector-section-title inspector-name-header';
    const nameLabel = document.createElement('span');
    nameLabel.textContent = 'Name';
    nameHeader.appendChild(nameLabel);
    const idLabel = document.createElement('span');
    idLabel.className = 'inspector-id-label';
    idLabel.textContent = `id: ${n.id}`;
    nameHeader.appendChild(idLabel);
    nameSection.appendChild(nameHeader);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'inspector-input inspector-name-input';
    nameInput.value = n.label;
    nameInput.addEventListener('input', () => {
      const val = nameInput.value.trim();
      if (val) {
        n.label = val;
        const labelEl = n.el.querySelector('.node-label');
        if (labelEl) labelEl.textContent = val;
        fitLabelFontSize(n);
      }
    });
    nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    nameSection.appendChild(nameInput);

    const descLabel = document.createElement('div');
    descLabel.className = 'inspector-section-title';
    descLabel.textContent = 'Description';
    nameSection.appendChild(descLabel);

    const descArea = document.createElement('textarea');
    descArea.className = 'inspector-input inspector-desc-input';
    descArea.rows = 3;
    descArea.value = n.description || '';
    descArea.placeholder = 'Block description…';
    descArea.addEventListener('input', () => { n.description = descArea.value; updateDescriptionLabel(n); });
    descArea.addEventListener('keydown', (e) => e.stopPropagation());
    nameSection.appendChild(descArea);

    propsContainer.insertBefore(nameSection, propsContainer.firstChild);
  }

  // Hide the props table — id is shown in the name header
  tbody.innerHTML = '';

  // Event section
  const eventSection = document.createElement('div');
  eventSection.className = 'inspector-section';

  {
    // Inline layout: label + dropdown on same row
    const eventRow = document.createElement('div');
    eventRow.className = 'inspector-event-row';
    const eventLabel = document.createElement('span');
    eventLabel.className = 'inspector-section-title';
    eventLabel.textContent = 'Execute on Event';
    eventRow.appendChild(eventLabel);

    const eventSelect = document.createElement('select');
    eventSelect.className = 'inspector-select inspector-event-select';
    for (const [key, ev] of Object.entries(EVENT_TYPES)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = ev.label;
      if (n.event?.type === key) opt.selected = true;
      eventSelect.appendChild(opt);
    }
    eventSelect.addEventListener('change', () => {
      n.event = { type: eventSelect.value };
      if (eventSelect.value === 'messageReceived') n.event.message = '';
      if (eventSelect.value === 'keyPressed') n.event.key = '';
      onNodeDataChanged();
      updateInspector();
    });
    eventRow.appendChild(eventSelect);
    eventSection.appendChild(eventRow);
  }

  // Extra fields for message/key events
  if (n.event?.type === 'messageReceived') {
    const msgOptions = [['', '— select message —'], ...S.messages.map(m => [m, m])];
    eventSection.appendChild(labeledSelect('Message', n.event.message || '', msgOptions, v => {
      n.event.message = v;
      onNodeDataChanged();
    }));
  }
  if (n.event?.type === 'keyPressed') {
    const input = createInput(n.event.key || '', v => { n.event.key = v; });
    input.placeholder = 'Key (e.g. Space, a)';
    eventSection.appendChild(input);
  }

  // Commands section
  const cmdsSection = document.createElement('div');
  cmdsSection.className = 'inspector-section';
  cmdsSection.innerHTML = `<div class="inspector-section-title">Commands (${n.commands.length})</div>`;

  const cmdList = document.createElement('div');
  cmdList.className = 'inspector-cmd-list';

  // Clamp selected index; auto-select executing command in debug mode
  if (S.executingNode === n && S.executingCommandIdx >= 0) {
    selectedCmdIdx = S.executingCommandIdx;
  }
  if (selectedCmdIdx >= n.commands.length) selectedCmdIdx = n.commands.length - 1;

  {
    // ── Compute indentation levels ──────────────────────────────────────
    const indentLevels = [];
    let depth = 0;
    for (const cmd of n.commands) {
      if (cmd.type === 'endIf') depth = Math.max(0, depth - 1);
      if (cmd.type === 'elseIf' || cmd.type === 'elseCmd') {
        // Same level as IF (one less than inner commands)
        indentLevels.push(Math.max(0, depth - 1));
      } else {
        indentLevels.push(depth);
      }
      if (cmd.type === 'ifCondition') depth++;
    }

    // ── Command summary list + editor ───────────────────────────────────
    n.commands.forEach((cmd, idx) => {
      const row = document.createElement('div');
      row.className = `fungus-cmd-summary fungus-cmd-${cmd.type}`;
      if (indentLevels[idx] > 0) row.style.paddingLeft = `${6 + indentLevels[idx] * 18}px`;
      if (idx === selectedCmdIdx) row.classList.add('fungus-cmd-selected');
      if (S.executingCommandIdx === idx && S.executingNode === n) {
        row.classList.add('cmd-executing');
      }

      // Drag handle for reordering
      const dragHandle = document.createElement('span');
      dragHandle.className = 'fungus-cmd-drag-handle';
      dragHandle.textContent = '⠿';
      dragHandle.title = 'Drag to reorder';
      row.appendChild(dragHandle);

      // HTML5 drag and drop
      row.draggable = true;
      row.dataset.cmdIdx = String(idx);
      row.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(idx));
        row.classList.add('cmd-dragging');
      });
      row.addEventListener('dragend', () => { row.classList.remove('cmd-dragging'); });
      row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('cmd-drag-over'); });
      row.addEventListener('dragleave', () => { row.classList.remove('cmd-drag-over'); });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('cmd-drag-over');
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const toIdx = idx;
        if (fromIdx !== toIdx) {
          const [moved] = n.commands.splice(fromIdx, 1);
          n.commands.splice(toIdx, 0, moved);
          if (selectedCmdIdx === fromIdx) selectedCmdIdx = toIdx;
          else if (fromIdx < selectedCmdIdx && toIdx >= selectedCmdIdx) selectedCmdIdx--;
          else if (fromIdx > selectedCmdIdx && toIdx <= selectedCmdIdx) selectedCmdIdx++;
          onNodeDataChanged();
          updateInspector();
        }
      });

      // Verb
      const verb = document.createElement('span');
      verb.className = 'fungus-cmd-verb';
      verb.textContent = COMMAND_TYPES[cmd.type]?.label || cmd.type;
      row.appendChild(verb);

      // Detail
      const detail = document.createElement('span');
      detail.className = 'fungus-cmd-detail';
      detail.textContent = cmdDetail(cmd);
      row.appendChild(detail);

      row.addEventListener('click', () => { selectedCmdIdx = idx; updateInspector(); });
      cmdList.appendChild(row);
    });
    cmdsSection.appendChild(cmdList);

    // Add command dropdown
    const addRow = document.createElement('div');
    addRow.className = 'inspector-add-cmd';
    const addSelect = document.createElement('select');
    addSelect.className = 'inspector-select';
    addSelect.innerHTML = '<option value="">+ Add command...</option>';
    for (const [key, ct] of Object.entries(COMMAND_TYPES)) {
      if (key === 'endIf' || key === 'elseIf' || key === 'elseCmd') continue; // structural commands
      addSelect.innerHTML += `<option value="${key}">${ct.label} (${ct.category})</option>`;
    }
    addSelect.addEventListener('change', () => {
      if (!addSelect.value) return;
      if (addSelect.value === 'endIf') return; // END-IF is auto-inserted with IF
      n.commands.push(createCommand(addSelect.value));
      if (addSelect.value === 'ifCondition') {
        n.commands.push(createCommand('endIf'));
      }
      selectedCmdIdx = n.commands.length - (addSelect.value === 'ifCondition' ? 2 : 1);
      onNodeDataChanged();
      updateInspector();
    });
    addRow.appendChild(addSelect);
    cmdsSection.appendChild(addRow);

    // ── Command editor (for selected command) ───────────────────────────
    if (selectedCmdIdx >= 0 && selectedCmdIdx < n.commands.length) {
      const cmd = n.commands[selectedCmdIdx];
      const editor = document.createElement('div');
      editor.className = 'inspector-section fungus-cmd-editor';

      const editorTitle = document.createElement('div');
      editorTitle.className = 'inspector-section-title';
      editorTitle.textContent = COMMAND_TYPES[cmd.type]?.label || cmd.type;
      editor.appendChild(editorTitle);

      // Command-specific fields
      const fields = document.createElement('div');
      fields.className = 'inspector-cmd-fields';
      renderCommandFields(fields, cmd, n);
      editor.appendChild(fields);

      // Delete button
      const btnRow = document.createElement('div');
      btnRow.className = 'fungus-cmd-btn-row';
      const delBtn = document.createElement('button');
      delBtn.className = 'cmd-btn cmd-btn-del';
      delBtn.textContent = '× Delete';
      delBtn.title = 'Remove command';
      delBtn.addEventListener('click', () => {
        const cmd = n.commands[selectedCmdIdx];
        if (cmd.type === 'ifCondition') {
          // Find matching END-IF and remove both + contents between
          let depth = 0;
          let endIdx = -1;
          for (let i = selectedCmdIdx; i < n.commands.length; i++) {
            if (n.commands[i].type === 'ifCondition') depth++;
            if (n.commands[i].type === 'endIf') { depth--; if (depth === 0) { endIdx = i; break; } }
          }
          if (endIdx >= 0) n.commands.splice(selectedCmdIdx, endIdx - selectedCmdIdx + 1);
          else n.commands.splice(selectedCmdIdx, 1);
        } else if (cmd.type === 'endIf') {
          // Find matching IF and remove both + contents between
          let depth = 0;
          let ifIdx = -1;
          for (let i = selectedCmdIdx; i >= 0; i--) {
            if (n.commands[i].type === 'endIf') depth++;
            if (n.commands[i].type === 'ifCondition') { depth--; if (depth === 0) { ifIdx = i; break; } }
          }
          if (ifIdx >= 0) n.commands.splice(ifIdx, selectedCmdIdx - ifIdx + 1);
          else n.commands.splice(selectedCmdIdx, 1);
        } else {
          n.commands.splice(selectedCmdIdx, 1);
        }
        selectedCmdIdx = -1; onNodeDataChanged(); updateInspector();
      });
      btnRow.appendChild(delBtn);

      // Add Else-If / Else buttons for IF and Else-If commands
      if (cmd.type === 'ifCondition' || cmd.type === 'elseIf') {
        // Find the matching END-IF to insert before it
        let depth = 0;
        let endIdx = -1;
        for (let i = selectedCmdIdx; i < n.commands.length; i++) {
          if (n.commands[i].type === 'ifCondition') depth++;
          if (n.commands[i].type === 'endIf') { depth--; if (depth === 0) { endIdx = i; break; } }
        }
        // Only search within the current IF block for existing else/elseIf
        if (endIdx >= 0) {
          const addElseIfBtn = document.createElement('button');
          addElseIfBtn.className = 'cmd-btn';
          addElseIfBtn.textContent = '+ Else-If';
          addElseIfBtn.addEventListener('click', () => {
            n.commands.splice(endIdx, 0, createCommand('elseIf'));
            selectedCmdIdx = endIdx;
            onNodeDataChanged(); updateInspector();
          });
          btnRow.appendChild(addElseIfBtn);

          // Only show Add Else if there isn't already an Else in this IF block
          let hasElse = false;
          let d2 = 1;
          for (let i = selectedCmdIdx + 1; i < endIdx; i++) {
            if (n.commands[i].type === 'ifCondition') d2++;
            if (n.commands[i].type === 'endIf') d2--;
            if (d2 === 1 && n.commands[i].type === 'elseCmd') { hasElse = true; break; }
          }
          if (!hasElse) {
            const addElseBtn = document.createElement('button');
            addElseBtn.className = 'cmd-btn';
            addElseBtn.textContent = '+ Else';
            addElseBtn.addEventListener('click', () => {
              n.commands.splice(endIdx, 0, createCommand('elseCmd'));
              selectedCmdIdx = endIdx;
              onNodeDataChanged(); updateInspector();
            });
            btnRow.appendChild(addElseBtn);
          }
        }
      }

      editor.appendChild(btnRow);

      cmdsSection.appendChild(editor);
    }
  }

  // Append sections after the table
  propsContainer.appendChild(eventSection);
  propsContainer.appendChild(cmdsSection);
}

// ── Command field renderers ──────────────────────────────────────────────────

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
  container.appendChild(labeledSelect('Compare to', cond.compareType || 'literal', compareTypes, v => { cond.compareType = v; updateInspector(); }));
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
    delBtn.textContent = '× Remove condition';
    delBtn.addEventListener('click', () => { cmd.extraConditions.splice(i, 1); updateInspector(); });
    container.appendChild(delBtn);
  }

  // Add AND/OR button
  const addCondBtn = document.createElement('button');
  addCondBtn.className = 'cmd-btn';
  addCondBtn.textContent = '+ AND/OR condition';
  addCondBtn.addEventListener('click', () => {
    if (!cmd.extraConditions) cmd.extraConditions = [];
    cmd.extraConditions.push({ logic: 'AND', variableName: '', operator: '==', compareType: 'literal', compareValue: '', compareVarName: '' });
    updateInspector();
  });
  container.appendChild(addCondBtn);
}

function renderCommandFields(container, cmd, node) {
  switch (cmd.type) {
    case 'say':
      container.appendChild(labeledInput('Character', cmd.character, v => { cmd.character = v; }));
      container.appendChild(labeledTextarea('Text', cmd.text, v => { cmd.text = v; }));
      break;
    case 'call':
      container.appendChild(labeledBlockSelect('Target Block', cmd.targetBlockId, v => { cmd.targetBlockId = v; onNodeDataChanged(); }, node));
      container.appendChild(labeledSelect('Mode', cmd.mode, [['stop', 'Stop'], ['continue', 'Continue']], v => { cmd.mode = v; }));
      break;
    case 'menu':
      cmd.options.forEach((opt, i) => {
        const row = document.createElement('div');
        row.className = 'cmd-menu-option';
        row.appendChild(labeledInput(`Option ${i + 1}`, opt.text, v => { opt.text = v; }));
        row.appendChild(labeledBlockSelect('→ Block', opt.targetBlockId, v => { opt.targetBlockId = v; onNodeDataChanged(); }, node));
        if (cmd.options.length > 2) {
          const del = document.createElement('button');
          del.className = 'cmd-btn cmd-btn-del';
          del.textContent = '×';
          del.addEventListener('click', () => { cmd.options.splice(i, 1); onNodeDataChanged(); updateInspector(); });
          row.appendChild(del);
        }
        container.appendChild(row);
      });
      const addOpt = document.createElement('button');
      addOpt.className = 'cmd-btn';
      addOpt.textContent = '+ Option';
      addOpt.addEventListener('click', () => { cmd.options.push({ text: `Option ${cmd.options.length + 1}`, targetBlockId: null }); onNodeDataChanged(); updateInspector(); });
      container.appendChild(addOpt);
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
      container.appendChild(labeledSelect('Variable', cmd.variableName || '', varOpts, v => { cmd.variableName = v; updateInspector(); }));
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

// ── Field builders ───────────────────────────────────────────────────────────

function createInput(value, onChange) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inspector-input';
  input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  input.addEventListener('keydown', (e) => e.stopPropagation());
  return input;
}

function labeledInput(label, value, onChange) {
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
  ta.addEventListener('change', () => onChange(ta.value));
  ta.addEventListener('keydown', (e) => e.stopPropagation());
  row.appendChild(ta);
  return row;
}

function labeledSelect(label, value, options, onChange) {
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

function labeledCheckbox(label, checked, onChange) {
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

// ── Connection inspector ─────────────────────────────────────────────────────

function renderConnInspector(c) {
  emptyMsg.style.display = 'none';
  propsContainer.style.display = '';
  propsContainer.querySelectorAll('.inspector-section').forEach(s => s.remove());

  const fromNode = c.fromId != null ? S.nodes.find(n => n.id === c.fromId) : null;
  const toNode   = c.toId   != null ? S.nodes.find(n => n.id === c.toId)   : null;
  setPropsRows([
    ['Type', 'transition'],
    ['ID', c.id],
    ['Label', c.label],
    ['From', fromNode ? `${fromNode.type} (${fromNode.id})` : 'disconnected'],
    ['To',   toNode   ? `${toNode.type} (${toNode.id})`     : 'disconnected'],
  ]);
}

// ── JSON serialisation ───────────────────────────────────────────────────────

export function serialiseDiagram() {
  return {
    variables: S.variables.map(v => ({ name: v.name, type: v.type, value: v.value, ...(v.enumName ? { enumName: v.enumName } : {}) })),
    messages: [...S.messages],
    enums: S.enums.map(e => ({ name: e.name, values: e.values.map(v => ({ key: v.key, label: v.label })) })),
    nodes: S.nodes.map(n => ({
      id: n.id,
      type: n.type,
      x: Math.round(n.x),
      y: Math.round(n.y),
      w: n.w,
      h: n.h,
      label: n.label || undefined,
      event: n.event,
      commands: n.commands,
    })),
    connections: S.connections.map(c => ({
      id: c.id,
      fromId: c.fromId,
      toId: c.toId,
      label: c.label,
      ...(c.danglingFrom ? { danglingFrom: c.danglingFrom } : {}),
      ...(c.danglingTo   ? { danglingTo:   c.danglingTo }   : {}),
    })),
  };
}

export function showJsonExport() {
  const json = JSON.stringify(serialiseDiagram(), null, 2);
  const overlay = document.createElement('div');
  overlay.id = 'json-modal-overlay';
  overlay.innerHTML = `
    <div id="json-modal">
      <div id="json-modal-header">
        <span>Diagram JSON</span>
        <div id="json-modal-actions">
          <button id="json-modal-copy" class="json-modal-btn" title="Copy to clipboard">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button id="json-modal-close" class="json-modal-btn" title="Close">&times;</button>
        </div>
      </div>
      <div id="json-modal-body"><pre></pre></div>
    </div>
  `;
  document.body.appendChild(overlay);
  const pre = overlay.querySelector('pre');
  pre.textContent = json;
  const close = () => overlay.remove();
  overlay.querySelector('#json-modal-close').addEventListener('click', close);
  overlay.querySelector('#json-modal-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(json).then(() => {
      const btn = overlay.querySelector('#json-modal-copy');
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 1500);
    });
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
  });
}

export function showRunLog() {
  const log = getRunLog();
  const text = log.length === 0
    ? '(No execution log yet — click Play All first)'
    : log.map(e => `[${e.ts}] ${e.message}`).join('\n');

  const overlay = document.createElement('div');
  overlay.id = 'json-modal-overlay';
  overlay.innerHTML = `
    <div id="json-modal">
      <div id="json-modal-header">
        <span>Run Log</span>
        <div id="json-modal-actions">
          <button id="json-modal-copy" class="json-modal-btn" title="Copy to clipboard">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
          <button id="json-modal-close" class="json-modal-btn" title="Close">&times;</button>
        </div>
      </div>
      <div id="json-modal-body"><pre></pre></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('pre').textContent = text;
  const close = () => overlay.remove();
  overlay.querySelector('#json-modal-close').addEventListener('click', close);
  overlay.querySelector('#json-modal-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(text).then(() => {
      const btn = overlay.querySelector('#json-modal-copy');
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 1500);
    });
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
  });
}

// ── Load Project ────────────────────────────────────────────────────────────

export function showJsonLoad(onLoad) {
  const overlay = document.createElement('div');
  overlay.id = 'json-modal-overlay';

  let exampleOptions = EXAMPLE_FILES.map(e => `<option value="${e.file}">${e.name}</option>`).join('');

  overlay.innerHTML = `
    <div id="json-modal">
      <div id="json-modal-header">
        <span>Load Project</span>
        <button id="json-modal-close" class="json-modal-btn" title="Close">&times;</button>
      </div>
      <div id="json-modal-body" style="display:flex;flex-direction:column;gap:14px;">
        <div class="load-section">
          <div class="load-section-title">Load from Examples</div>
          <div style="display:flex;gap:6px;">
            <select id="load-example-select" class="inspector-select" style="flex:1;margin-top:0;">
              <option value="">— select example —</option>
              ${exampleOptions}
            </select>
            <button id="load-example-btn" class="toolbar-btn">Load</button>
          </div>
        </div>
        <div class="load-section">
          <div class="load-section-title">Open File</div>
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="file" id="load-file-input" accept=".json,.JSON" style="flex:1;font-size:11px;">
            <button id="load-file-btn" class="toolbar-btn">Load</button>
          </div>
        </div>
        <div class="load-section">
          <div class="load-section-title">Paste JSON</div>
          <textarea id="json-load-input" class="inspector-textarea" rows="8" placeholder="Paste JSON here…" style="width:100%;resize:vertical;"></textarea>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
            <span id="json-load-error" style="color:#ef4444;font-size:11px;"></span>
            <button id="load-paste-btn" class="toolbar-btn">Load</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#json-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
  });

  const errorEl = overlay.querySelector('#json-load-error');

  function tryLoad(text) {
    if (!text) { errorEl.textContent = 'No data.'; return; }
    let data;
    try { data = JSON.parse(text); } catch (err) { errorEl.textContent = 'Invalid JSON: ' + err.message; return; }
    if (!data.nodes || !Array.isArray(data.nodes)) { errorEl.textContent = 'JSON must contain a "nodes" array.'; return; }
    if (!confirm('This will replace your current flowchart. Are you sure?')) return;
    close();
    onLoad(data);
  }

  // Example load
  overlay.querySelector('#load-example-btn').addEventListener('click', async () => {
    const file = overlay.querySelector('#load-example-select').value;
    if (!file) { errorEl.textContent = 'Please select an example.'; return; }
    errorEl.textContent = '';
    try {
      const resp = await fetch(file);
      if (!resp.ok) { errorEl.textContent = 'Failed to load example.'; return; }
      tryLoad(await resp.text());
    } catch (err) { errorEl.textContent = 'Error: ' + err.message; }
  });

  // File open
  overlay.querySelector('#load-file-btn').addEventListener('click', () => {
    const fileInput = overlay.querySelector('#load-file-input');
    const file = fileInput.files[0];
    if (!file) { errorEl.textContent = 'Please choose a file.'; return; }
    errorEl.textContent = '';
    const reader = new FileReader();
    reader.onload = () => tryLoad(reader.result);
    reader.onerror = () => { errorEl.textContent = 'Failed to read file.'; };
    reader.readAsText(file);
  });

  // Paste JSON
  const textarea = overlay.querySelector('#json-load-input');
  textarea.addEventListener('keydown', (e) => e.stopPropagation());
  overlay.querySelector('#load-paste-btn').addEventListener('click', () => {
    errorEl.textContent = '';
    tryLoad(textarea.value.trim());
  });
}
