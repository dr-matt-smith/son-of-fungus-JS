import { S } from './state.js';

const inspectorEl    = document.getElementById('inspector');
const emptyMsg       = document.getElementById('inspector-empty');
const propsContainer = document.getElementById('inspector-props');
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
  const totalW = mainRect.width;
  const inspectorW = Math.max(180, Math.min(totalW * 0.6, mainRect.right - e.clientX));
  inspectorEl.style.width = `${inspectorW}px`;
});

document.addEventListener('mouseup', () => {
  if (!draggingDivider) return;
  draggingDivider = false;
  divider.classList.remove('dragging');
  document.body.style.cursor = '';
});

// ── Inspector content ────────────────────────────────────────────────────────

function setRows(rows) {
  tbody.innerHTML = '';
  for (const [label, value] of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${label}</td><td>${escapeHtml(String(value))}</td>`;
    tbody.appendChild(tr);
  }
  emptyMsg.style.display = 'none';
  propsContainer.style.display = '';
}

function showEmpty() {
  emptyMsg.style.display = '';
  propsContainer.style.display = 'none';
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function updateInspector() {
  if (S.activeNode) {
    const n = S.activeNode;
    const rows = [
      ['Type', n.type],
      ['ID', n.id],
    ];
    if (n.type === 'state' || n.type === 'choice') {
      rows.push(['Name', n.label]);
      rows.push(['Width', n.w]);
      rows.push(['Height', n.h]);
    }
    rows.push(['X', Math.round(n.x)]);
    rows.push(['Y', Math.round(n.y)]);

    // Count connections
    const outgoing = S.connections.filter(c => c.fromId === n.id).length;
    const incoming = S.connections.filter(c => c.toId === n.id).length;
    rows.push(['Outgoing', outgoing]);
    rows.push(['Incoming', incoming]);

    setRows(rows);
    return;
  }

  if (S.selectedConn) {
    const c = S.selectedConn;
    const fromNode = c.fromId != null ? S.nodes.find(n => n.id === c.fromId) : null;
    const toNode   = c.toId   != null ? S.nodes.find(n => n.id === c.toId)   : null;
    const rows = [
      ['Type', 'transition'],
      ['ID', c.id],
      ['Label', c.label],
      ['From', fromNode ? `${fromNode.type} (${fromNode.id})` : 'disconnected'],
      ['To',   toNode   ? `${toNode.type} (${toNode.id})`     : 'disconnected'],
    ];
    setRows(rows);
    return;
  }

  showEmpty();
}

// ── JSON serialisation ───────────────────────────────────────────────────────

export function serialiseDiagram() {
  return {
    nodes: S.nodes.map(n => ({
      id: n.id,
      type: n.type,
      x: Math.round(n.x),
      y: Math.round(n.y),
      w: n.w,
      h: n.h,
      label: n.label || undefined,
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
        <button id="json-modal-close" title="Close">&times;</button>
      </div>
      <div id="json-modal-body"><pre></pre></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('pre').textContent = json;

  const close = () => overlay.remove();
  overlay.querySelector('#json-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
  });
}
