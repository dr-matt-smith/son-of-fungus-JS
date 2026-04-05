import { S } from './state.js';
import { COMMAND_TYPES, createCommand } from './commands.js';
import { renderCommandFields } from './command-fields.js';
import { COMMAND_REGISTRY } from './command-registry.js';

// ── Shared state ────────────────────────────────────────────────────────────

let selectedCmdIdx = -1;
let cmdSearchContainer = null;

export function getSelectedCmdIdx() { return selectedCmdIdx; }
export function setSelectedCmdIdx(v) { selectedCmdIdx = v; }
export function getCmdSearchContainer() { return cmdSearchContainer; }
export function setCmdSearchContainer(v) { cmdSearchContainer = v; }

// ── Helpers ─────────────────────────────────────────────────────────────────

function cmdDetail(cmd) {
  return COMMAND_REGISTRY[cmd.type]?.detail(cmd, S.nodes) || '';
}

function showCommandSearch(node, parentEl, callbacks) {
  const { onNodeDataChanged, updateInspector } = callbacks;

  // Toggle: if already showing, remove it
  if (cmdSearchContainer) {
    cmdSearchContainer.remove();
    cmdSearchContainer = null;
    return;
  }

  cmdSearchContainer = document.createElement('div');
  cmdSearchContainer.className = 'cmd-search-inline';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cmd-search-input inspector-input';
  input.placeholder = 'Search commands…';
  cmdSearchContainer.appendChild(input);

  const results = document.createElement('div');
  results.className = 'cmd-search-results';
  cmdSearchContainer.appendChild(results);

  let highlightedIdx = 0;

  function selectItem(item) {
    const key = item.dataset.cmdKey;
    node.commands.push(createCommand(key));
    selectedCmdIdx = node.commands.length - 1;
    cmdSearchContainer = null;
    onNodeDataChanged();
    updateInspector();
  }

  function updateHighlight() {
    const items = results.querySelectorAll('.cmd-search-item');
    items.forEach((el, i) => el.classList.toggle('cmd-search-highlighted', i === highlightedIdx));
    if (items[highlightedIdx]) items[highlightedIdx].scrollIntoView({ block: 'nearest' });
  }

  function renderResults(filter) {
    results.innerHTML = '';
    for (const [key, ct] of Object.entries(COMMAND_TYPES)) {
      const text = `${ct.label} (${ct.category})`;
      if (filter && !text.toLowerCase().includes(filter.toLowerCase())) continue;
      const item = document.createElement('div');
      item.className = 'cmd-search-item';
      item.dataset.cmdKey = key;
      item.innerHTML = `<span class="cmd-search-label">${ct.label}</span><span class="cmd-search-cat">${ct.category}</span>`;
      item.addEventListener('click', () => selectItem(item));
      results.appendChild(item);
    }
    highlightedIdx = 0;
    updateHighlight();
  }

  renderResults('');
  input.addEventListener('input', () => renderResults(input.value));
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    const items = results.querySelectorAll('.cmd-search-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIdx = Math.min(highlightedIdx + 1, items.length - 1);
      updateHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIdx = Math.max(highlightedIdx - 1, 0);
      updateHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[highlightedIdx]) selectItem(items[highlightedIdx]);
    } else if (e.key === 'Escape') {
      cmdSearchContainer.remove(); cmdSearchContainer = null;
    }
  });

  parentEl.appendChild(cmdSearchContainer);
  setTimeout(() => input.focus(), 0);
}

export function updateCmdSummaryRow() {
  if (selectedCmdIdx < 0) return;
  const row = document.querySelectorAll('.fungus-cmd-summary')[selectedCmdIdx];
  if (!row) return;
  const n = S.activeNode;
  if (!n || selectedCmdIdx >= n.commands.length) return;
  const detail = row.querySelector('.fungus-cmd-detail');
  if (detail) detail.textContent = cmdDetail(n.commands[selectedCmdIdx]);
}

// ── Main render function ────────────────────────────────────────────────────

export function renderCommandList(n, cmdsSection, callbacks) {
  const { onNodeDataChanged, updateInspector } = callbacks;

  const cmdList = document.createElement('div');
  cmdList.className = 'inspector-cmd-list';

  // Clamp selected index; auto-select executing command in debug mode
  if (S.executingNode === n && S.executingCommandIdx >= 0) {
    selectedCmdIdx = S.executingCommandIdx;
  }
  if (selectedCmdIdx >= n.commands.length) selectedCmdIdx = n.commands.length - 1;

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

    // Drag handle for reordering (pointer-based)
    const dragHandle = document.createElement('span');
    dragHandle.className = 'fungus-cmd-drag-handle';
    dragHandle.textContent = '⠿';
    dragHandle.title = 'Drag to reorder';
    row.appendChild(dragHandle);

    row.dataset.cmdIdx = String(idx);
    dragHandle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectedCmdIdx = idx;
      cmdList.querySelectorAll('.fungus-cmd-selected').forEach(r => r.classList.remove('fungus-cmd-selected'));
      row.classList.add('fungus-cmd-selected');

      let dragIdx = idx;
      const onMove = (me) => {
        const rows = Array.from(cmdList.querySelectorAll('.fungus-cmd-summary'));
        // Find which row the pointer is over
        for (let i = 0; i < rows.length; i++) {
          const rect = rows[i].getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (me.clientY < midY && i < dragIdx) {
            // Move up
            cmdList.insertBefore(rows[dragIdx], rows[i]);
            const [moved] = n.commands.splice(dragIdx, 1);
            n.commands.splice(i, 0, moved);
            dragIdx = i;
            selectedCmdIdx = i;
            // Re-index
            rows.forEach((r, ri) => r.dataset.cmdIdx = String(ri));
            break;
          } else if (me.clientY > midY && i > dragIdx) {
            // Move down
            if (i < rows.length - 1) cmdList.insertBefore(rows[dragIdx], rows[i + 1]);
            else cmdList.appendChild(rows[dragIdx]);
            const [moved] = n.commands.splice(dragIdx, 1);
            n.commands.splice(i, 0, moved);
            dragIdx = i;
            selectedCmdIdx = i;
            rows.forEach((r, ri) => r.dataset.cmdIdx = String(ri));
            break;
          }
        }
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        onNodeDataChanged();
        updateInspector();
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
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

  // Command action bar
  const actionBar = document.createElement('div');
  actionBar.className = 'cmd-action-bar';

  // Left: up/down arrows
  const leftGroup = document.createElement('span');
  leftGroup.className = 'cmd-action-group';
  const upBtn = document.createElement('button');
  upBtn.className = 'cmd-action-btn';
  upBtn.textContent = '▲';
  upBtn.title = 'Select previous command';
  upBtn.addEventListener('click', () => { if (selectedCmdIdx > 0) { selectedCmdIdx--; updateInspector(); } });
  leftGroup.appendChild(upBtn);
  const downBtn = document.createElement('button');
  downBtn.className = 'cmd-action-btn';
  downBtn.textContent = '▼';
  downBtn.title = 'Select next command';
  downBtn.addEventListener('click', () => { if (selectedCmdIdx < n.commands.length - 1) { selectedCmdIdx++; updateInspector(); } });
  leftGroup.appendChild(downBtn);
  actionBar.appendChild(leftGroup);

  // Right: + new, duplicate, delete
  const rightGroup = document.createElement('span');
  rightGroup.className = 'cmd-action-group';
  const addBtn = document.createElement('button');
  addBtn.className = 'cmd-action-btn cmd-action-add';
  addBtn.textContent = '+';
  addBtn.title = 'Add new command';
  addBtn.addEventListener('click', () => showCommandSearch(n, cmdsSection, callbacks));
  rightGroup.appendChild(addBtn);

  if (selectedCmdIdx >= 0 && selectedCmdIdx < n.commands.length) {
    const dupBtn = document.createElement('button');
    dupBtn.className = 'cmd-action-btn';
    dupBtn.textContent = '⧉';
    dupBtn.title = 'Duplicate command';
    dupBtn.addEventListener('click', () => {
      const copy = JSON.parse(JSON.stringify(n.commands[selectedCmdIdx]));
      copy.id = crypto.randomUUID?.() || String(Date.now() + Math.random());
      n.commands.splice(selectedCmdIdx + 1, 0, copy);
      selectedCmdIdx++;
      onNodeDataChanged();
      updateInspector();
    });
    rightGroup.appendChild(dupBtn);
  }

  const delBtn2 = document.createElement('button');
  delBtn2.className = 'cmd-action-btn cmd-action-del';
  delBtn2.textContent = '🗑';
  delBtn2.title = 'Delete selected command';
  delBtn2.addEventListener('click', () => {
    if (selectedCmdIdx < 0 || selectedCmdIdx >= n.commands.length) return;
    n.commands.splice(selectedCmdIdx, 1);
    selectedCmdIdx = -1;
    onNodeDataChanged();
    updateInspector();
  });
  rightGroup.appendChild(delBtn2);
  actionBar.appendChild(rightGroup);
  cmdsSection.appendChild(actionBar);

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

    cmdsSection.appendChild(editor);
  }
}
