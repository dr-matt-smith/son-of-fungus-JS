/**
 * DOM setup for tests. Must be called before importing main.js,
 * because modules grab DOM references at load time.
 */
export function setupDOM() {
  document.body.innerHTML = `
    <div id="toolbar">
      <button id="btn-new-state" class="toolbar-btn palette-btn" draggable="false">State</button>
      <button id="btn-new-start" class="toolbar-btn palette-btn" draggable="false"></button>
      <button id="btn-new-end" class="toolbar-btn palette-btn" draggable="false"></button>
      <button id="btn-new-choice" class="toolbar-btn palette-btn" draggable="false"></button>
      <button id="btn-play" class="toolbar-btn"><span id="play-label">Play All</span></button>
      <button id="btn-play-step" class="toolbar-btn" style="display:none;">Step</button>
      <button id="btn-step-continue" class="toolbar-btn" style="display:none;">Next</button>
      <button id="btn-stop" class="toolbar-btn" style="display:none;">Stop</button>
    </div>
    <div id="mode-label">
      <span id="mode-label-text">Fungus Mode</span>
      <span id="mode-label-hint">(change in Settings ⚙)</span>
    </div>
    <div id="zoom-toolbar">
      <button id="btn-fit-all" class="toolbar-btn"></button>
      <button id="btn-zoom-out" class="toolbar-btn"></button>
      <input id="zoom-slider" type="range" min="8" max="500" value="100">
      <button id="btn-zoom-in" class="toolbar-btn"></button>
      <span id="zoom-label" class="zoom-label">100%</span>
      <button id="btn-hand-tool" class="toolbar-btn tool-btn"></button>
    </div>
    <div id="main-area">
      <div id="canvas-container" style="width:800px;height:600px;">
        <div id="canvas" style="width:4000px;height:3000px;">
          <svg id="connections-svg" xmlns="http://www.w3.org/2000/svg"></svg>
        </div>
        <div id="canvas-overlay-buttons">
          <button id="btn-export-json" class="toolbar-btn">Export JSON</button>
          <button id="btn-run-log" class="toolbar-btn">Run Log</button>
        </div>
        <div id="minimap" style="width:200px;height:150px;">
          <div id="minimap-states"></div>
          <div id="minimap-viewport"></div>
          <span id="minimap-label">MAP</span>
          <button id="minimap-minimize">_</button>
        </div>
        <button id="minimap-restore" style="display:none;">Minimap</button>
      </div>
      <div id="divider"></div>
      <div id="inspector">
        <div id="inspector-tabs">
          <button class="inspector-tab active" data-tab="inspector">Inspector</button>
          <button class="inspector-tab" data-tab="messages">Events</button>
          <button class="inspector-tab" data-tab="variables">Variables</button>
          <button id="btn-settings-cog" class="settings-cog-btn" title="Settings">⚙</button>
        </div>
        <div id="inspector-panel" class="tab-panel">
          <div id="inspector-body">
            <p id="inspector-empty">No object selected</p>
            <div id="inspector-props" style="display:none;">
              <table id="inspector-table"><tbody></tbody></table>
            </div>
          </div>
        </div>
        <div id="settings-panel" class="tab-panel" style="display:none;">
          <div class="settings-header">
            <span class="settings-header-title">Settings</span>
            <button id="btn-close-settings" class="toolbar-btn">Close Settings</button>
          </div>
          <div class="settings-section">
            <div class="settings-section-title">Diagram Mode</div>
            <label class="settings-mode-option">
              <input type="radio" name="diagram-mode" value="fungus" checked>
              <span class="settings-mode-name">Fungus FlowChart</span>
            </label>
            <label class="settings-mode-option">
              <input type="radio" name="diagram-mode" value="statechart">
              <span class="settings-mode-name">State Chart Diagram</span>
            </label>
          </div>
        </div>
        <div id="messages-panel" class="tab-panel" style="display:none;">
          <div class="settings-section">
            <div class="settings-section-title">Event Messages</div>
            <div id="messages-list"></div>
            <div class="messages-add-row">
              <input id="messages-new-input" type="text" class="inspector-input" placeholder="New message name…">
              <button id="messages-add-btn" class="toolbar-btn">Add</button>
            </div>
          </div>
        </div>
        <div id="variables-panel" class="tab-panel" style="display:none;">
          <div class="settings-section">
            <div class="settings-section-title">Global Variables</div>
            <div id="variables-list"></div>
            <div class="variable-add-row">
              <select id="variables-new-type" class="inspector-select variable-type-select">
                <option value="Boolean">Boolean</option>
                <option value="Integer">Integer</option>
                <option value="Float">Float</option>
                <option value="String" selected>String</option>
              </select>
              <input id="variables-new-name" type="text" class="inspector-input variable-name-input" placeholder="Variable name…">
              <button id="variables-add-btn" class="toolbar-btn">Add</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
