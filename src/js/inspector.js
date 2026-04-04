import { S } from './state.js';
import { fitLabelFontSize } from './nodes/node-element.js';
import { EVENT_TYPES, COMMAND_TYPES, createCommand } from './commands.js';
import { applyFungusStyles, syncAutoConnections, updateDescriptionLabel } from './fungus-mode.js';
import { getRunLog } from './engine.js';
import { AUDIO_FILES } from './audio-manifest.js';

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

// ── Fungus mode reactivity ──────────────────────────────────────────────────

function onNodeDataChanged() {
  if (S.diagramMode === 'fungus') {
    applyFungusStyles();
    syncAutoConnections();
  }
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

  const isFungus = S.diagramMode === 'fungus';

  // In fungus mode, show Name and Description at the top (before the table)
  if (isFungus && (n.type === 'state' || n.type === 'choice')) {
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

  if (isFungus) {
    // In fungus mode, hide the props table — id is shown in the name header
    tbody.innerHTML = '';
  } else {
    const rows = [['Type', n.type], ['ID', n.id]];
    if (n.type === 'state' || n.type === 'choice') {
      rows.push(['Size', `${n.w} × ${n.h}`]);
    }
    rows.push(['Position', `${Math.round(n.x)}, ${Math.round(n.y)}`]);
    const outgoing = S.connections.filter(c => c.fromId === n.id).length;
    const incoming = S.connections.filter(c => c.toId === n.id).length;
    rows.push(['Connections', `${outgoing} out / ${incoming} in`]);
    setPropsRows(rows);
  }

  // Editable name field for state/choice nodes (statechart mode only — fungus has it above)
  if (!isFungus && (n.type === 'state' || n.type === 'choice')) {
    const nameRow = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.textContent = 'Name';
    const valueTd = document.createElement('td');
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
    valueTd.appendChild(nameInput);
    nameRow.appendChild(nameTd);
    nameRow.appendChild(valueTd);
    // Insert after the ID row (index 1)
    const idRow = tbody.rows[1];
    if (idRow && idRow.nextSibling) {
      tbody.insertBefore(nameRow, idRow.nextSibling);
    } else {
      tbody.appendChild(nameRow);
    }
  }

  // Event section
  const eventSection = document.createElement('div');
  eventSection.className = 'inspector-section';

  if (isFungus) {
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
  } else {
    eventSection.innerHTML = `<div class="inspector-section-title">Event Trigger</div>`;

    const eventSelect = document.createElement('select');
    eventSelect.className = 'inspector-select';
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
    eventSection.appendChild(eventSelect);
  }

  // Extra fields for message/key events
  if (n.event?.type === 'messageReceived') {
    const input = createInput(n.event.message || '', v => { n.event.message = v; });
    input.placeholder = 'Message name';
    eventSection.appendChild(input);
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

  n.commands.forEach((cmd, idx) => {
    const item = document.createElement('div');
    item.className = 'inspector-cmd-item';
    if (S.executingCommandIdx === idx && S.executingNode === n) {
      item.classList.add('cmd-executing');
    }

    const header = document.createElement('div');
    header.className = 'inspector-cmd-header';

    const label = COMMAND_TYPES[cmd.type]?.label || cmd.type;
    const catLabel = COMMAND_TYPES[cmd.type]?.category || '';
    header.innerHTML = `<span class="cmd-label">${label}</span><span class="cmd-cat">${catLabel}</span>`;

    const btnGroup = document.createElement('span');
    btnGroup.className = 'cmd-btn-group';

    if (idx > 0) {
      const upBtn = document.createElement('button');
      upBtn.className = 'cmd-btn';
      upBtn.textContent = '↑';
      upBtn.title = 'Move up';
      upBtn.addEventListener('click', (e) => { e.stopPropagation(); n.commands.splice(idx - 1, 0, n.commands.splice(idx, 1)[0]); onNodeDataChanged(); updateInspector(); });
      btnGroup.appendChild(upBtn);
    }
    if (idx < n.commands.length - 1) {
      const downBtn = document.createElement('button');
      downBtn.className = 'cmd-btn';
      downBtn.textContent = '↓';
      downBtn.title = 'Move down';
      downBtn.addEventListener('click', (e) => { e.stopPropagation(); n.commands.splice(idx + 1, 0, n.commands.splice(idx, 1)[0]); onNodeDataChanged(); updateInspector(); });
      btnGroup.appendChild(downBtn);
    }
    const delBtn = document.createElement('button');
    delBtn.className = 'cmd-btn cmd-btn-del';
    delBtn.textContent = '×';
    delBtn.title = 'Remove command';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); n.commands.splice(idx, 1); onNodeDataChanged(); updateInspector(); });
    btnGroup.appendChild(delBtn);

    header.appendChild(btnGroup);
    item.appendChild(header);

    // Command-specific fields
    const fields = document.createElement('div');
    fields.className = 'inspector-cmd-fields';
    renderCommandFields(fields, cmd, n);
    item.appendChild(fields);

    cmdList.appendChild(item);
  });

  cmdsSection.appendChild(cmdList);

  // Add command dropdown
  const addRow = document.createElement('div');
  addRow.className = 'inspector-add-cmd';
  const addSelect = document.createElement('select');
  addSelect.className = 'inspector-select';
  addSelect.innerHTML = '<option value="">+ Add command...</option>';
  for (const [key, ct] of Object.entries(COMMAND_TYPES)) {
    addSelect.innerHTML += `<option value="${key}">${ct.label} (${ct.category})</option>`;
  }
  addSelect.addEventListener('change', () => {
    if (!addSelect.value) return;
    n.commands.push(createCommand(addSelect.value));
    onNodeDataChanged();
    updateInspector();
  });
  addRow.appendChild(addSelect);
  cmdsSection.appendChild(addRow);

  // Append sections after the table
  propsContainer.appendChild(eventSection);
  propsContainer.appendChild(cmdsSection);
}

// ── Command field renderers ──────────────────────────────────────────────────

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
    case 'setVariable':
      container.appendChild(labeledInput('Variable', cmd.variableName, v => { cmd.variableName = v; }));
      container.appendChild(labeledInput('Value', cmd.value, v => { cmd.value = v; }));
      break;
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
    case 'wait':
      container.appendChild(labeledInput('Duration (s)', cmd.duration, v => { cmd.duration = parseFloat(v) || 0; }));
      break;
    case 'sendMessage':
      container.appendChild(labeledInput('Message', cmd.message, v => { cmd.message = v; }));
      break;
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
    variables: S.variables.map(v => ({ name: v.name, type: v.type, value: v.value })),
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
