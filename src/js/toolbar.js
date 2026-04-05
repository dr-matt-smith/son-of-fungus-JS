'use strict';

import { NODE_DEFAULTS, ZOOM_STEP } from './config.js';
import { S } from './state.js';
import { canvasContainer, zoomSlider, btnHandTool } from './dom-refs.js';
import { applyTransform, zoomAround, fitAll, updateCursor } from './transform.js';
import { refreshMinimap, updateMinimapViewport } from './minimap.js';

// ── Toolbar: Fit All ─────────────────────────────────────────────────────────

document.getElementById('btn-fit-all').addEventListener('click', fitAll);

// ── Toolbar: zoom buttons ────────────────────────────────────────────────────

document.getElementById('btn-zoom-in').addEventListener('click', () => {
  const { clientWidth: cw, clientHeight: ch } = canvasContainer;
  zoomAround(S.zoom + ZOOM_STEP, cw / 2, ch / 2);
});

document.getElementById('btn-zoom-out').addEventListener('click', () => {
  const { clientWidth: cw, clientHeight: ch } = canvasContainer;
  zoomAround(S.zoom - ZOOM_STEP, cw / 2, ch / 2);
});

// ── Zoom slider ──────────────────────────────────────────────────────────────

zoomSlider.addEventListener('input', () => {
  const newZoom = parseInt(zoomSlider.value, 10) / 100;
  const { clientWidth: cw, clientHeight: ch } = canvasContainer;
  zoomAround(newZoom, cw / 2, ch / 2);
});

// ── Toolbar: hand tool ───────────────────────────────────────────────────────

btnHandTool.addEventListener('click', () => {
  S.activeTool = S.activeTool === 'hand' ? 'select' : 'hand';
  btnHandTool.classList.toggle('active', S.activeTool === 'hand');
  updateCursor();
});

// ── Toolbar: palette buttons (drag-to-create) ───────────────────────────────

export function setupPaletteBtn(btnId, type) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    S.creatingNode     = true;
    S.creatingNodeType = type;
    const def = NODE_DEFAULTS[type];
    S.ghostEl = document.createElement('div');
    S.ghostEl.className = `diagram-node ${type}-node node-ghost`;
    S.ghostEl.style.width  = `${def.w}px`;
    S.ghostEl.style.height = `${def.h}px`;
    if (type === 'choice') {
      S.ghostEl.innerHTML =
        '<svg class="choice-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
          '<polygon points="50,2 98,50 50,98 2,50"/>' +
        '</svg>' +
        '<span class="node-label">?</span>';
    } else if (type === 'state') {
      const name = `New Block ${S.nextId}`;
      S.ghostEl.innerHTML = `<span class="node-label">${name}</span>`;
    }
    positionGhost(e.clientX, e.clientY);
    document.body.appendChild(S.ghostEl);
  });
  btn.addEventListener('dragstart', (e) => e.preventDefault());
}

setupPaletteBtn('btn-new-state',  'state');
setupPaletteBtn('btn-new-start',  'start');
setupPaletteBtn('btn-new-end',    'end');
setupPaletteBtn('btn-new-choice', 'choice');

export function positionGhost(clientX, clientY) {
  const def = NODE_DEFAULTS[S.creatingNodeType];
  S.ghostEl.style.left = `${clientX - def.w / 2}px`;
  S.ghostEl.style.top  = `${clientY - def.h / 2}px`;
}
