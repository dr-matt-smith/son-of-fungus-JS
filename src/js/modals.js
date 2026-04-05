import { serialiseDiagram } from './serialisation.js';
import { getRunLog } from './engine.js';
import { EXAMPLE_FILES } from './examples-manifest.js';

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
    ? '(No execution log yet \u2014 click Play All first)'
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
          <textarea id="json-load-input" class="inspector-textarea" rows="8" placeholder="Paste JSON here\u2026" style="width:100%;resize:vertical;"></textarea>
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
