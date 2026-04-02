import { WORLD_W, WORLD_H, MM_W, MM_H } from './config.js';
import { S } from './state.js';
import { canvasContainer, minimapEl, mmStatesEl, mmVP } from './dom-refs.js';

export function getMinimapBounds() {
  const PADDING = 200;
  let minX = 0, minY = 0, maxX = WORLD_W, maxY = WORLD_H;
  for (const node of S.nodes) {
    minX = Math.min(minX, node.x - PADDING);
    minY = Math.min(minY, node.y - PADDING);
    maxX = Math.max(maxX, node.x + node.w + PADDING);
    maxY = Math.max(maxY, node.y + node.h + PADDING);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function getMinimapScales() {
  const b = getMinimapBounds();
  return { b, sx: MM_W / b.w, sy: MM_H / b.h };
}

export function positionMinimapNode(node, mmScales) {
  const { b, sx, sy } = mmScales || getMinimapScales();
  const el = node.mmEl;
  const vis = node.type === 'choice' ? 0.7 : 1;
  const mw = node.w * sx * vis;
  const mh = node.h * sy * vis;
  const mx = (node.x - b.x + node.w * (1 - vis) / 2) * sx;
  const my = (node.y - b.y + node.h * (1 - vis) / 2) * sy;
  el.style.left   = `${mx}px`;
  el.style.top    = `${my}px`;
  el.style.width  = `${mw}px`;
  el.style.height = `${mh}px`;
}

export function updateMinimapViewport(mmScales) {
  const { b, sx, sy } = mmScales || getMinimapScales();
  const cw = canvasContainer.clientWidth;
  const ch = canvasContainer.clientHeight;
  const viewX = -S.panX / S.zoom;
  const viewY = -S.panY / S.zoom;
  const viewW =  cw / S.zoom;
  const viewH =  ch / S.zoom;
  mmVP.style.left   = `${(viewX - b.x) * sx}px`;
  mmVP.style.top    = `${(viewY - b.y) * sy}px`;
  mmVP.style.width  = `${viewW * sx}px`;
  mmVP.style.height = `${viewH * sy}px`;
}

export function refreshMinimap() {
  const mmScales = getMinimapScales();
  for (const node of S.nodes) {
    positionMinimapNode(node, mmScales);
  }
  updateMinimapViewport(mmScales);
}
