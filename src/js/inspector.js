import { S } from './state.js';
import { fitLabelFontSize } from './nodes/node-element.js';
import { EVENT_TYPES, COMMAND_TYPES, createCommand } from './commands.js';
import { applyFungusStyles, syncAutoConnections, updateDescriptionLabel } from './fungus-mode.js';
import { renderCommandFields, labeledSelect, labeledInput, labeledCheckbox, createInput, initCommandFieldCallbacks } from './command-fields.js';
import { renderCommandList, getSelectedCmdIdx, setSelectedCmdIdx, setCmdSearchContainer, updateCmdSummaryRow } from './command-list.js';

// Re-export split-out modules so existing imports from './inspector.js' keep working
export { serialiseDiagram } from './serialisation.js';
export { showJsonExport, showRunLog, showJsonLoad } from './modals.js';

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
  applyFungusStyles();
  syncAutoConnections();
}

// Wire up callbacks for command-fields module
initCommandFieldCallbacks({ onNodeDataChanged, updateInspector, updateCmdSummaryRow });

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
  setSelectedCmdIdx(-1);
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
  setCmdSearchContainer(null); // clear inline search on re-render
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

  renderCommandList(n, cmdsSection, { onNodeDataChanged, updateInspector });

  // Append sections after the table
  propsContainer.appendChild(eventSection);
  propsContainer.appendChild(cmdsSection);
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
