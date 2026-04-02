/**
 * DOM setup for tests. Must be called before importing app.js,
 * because app.js grabs DOM references at module load time.
 */
export function setupDOM() {
  document.body.innerHTML = `
    <div id="toolbar">
      <button id="btn-fit-all" class="toolbar-btn"></button>
      <button id="btn-zoom-in" class="toolbar-btn"></button>
      <span id="zoom-label" class="zoom-label">100%</span>
      <button id="btn-zoom-out" class="toolbar-btn"></button>
      <input id="zoom-slider" type="range" min="8" max="500" value="100">
      <button id="btn-hand-tool" class="toolbar-btn"></button>
      <button id="btn-new-state" class="toolbar-btn palette-btn" draggable="false"></button>
      <button id="btn-new-start" class="toolbar-btn palette-btn" draggable="false"></button>
      <button id="btn-new-end" class="toolbar-btn palette-btn" draggable="false"></button>
      <button id="btn-new-choice" class="toolbar-btn palette-btn" draggable="false"></button>
    </div>
    <div id="zoom-toolbar"></div>
    <div id="canvas-container" style="width:800px;height:600px;">
      <div id="canvas" style="width:4000px;height:3000px;">
        <svg id="connections-svg" xmlns="http://www.w3.org/2000/svg"></svg>
      </div>
    </div>
    <div id="minimap" style="width:200px;height:150px;">
      <div id="minimap-states"></div>
      <div id="minimap-viewport"></div>
      <span id="minimap-label">MAP</span>
      <button id="minimap-minimize">_</button>
    </div>
    <button id="minimap-restore" style="display:none;">Minimap</button>
  `;
}
