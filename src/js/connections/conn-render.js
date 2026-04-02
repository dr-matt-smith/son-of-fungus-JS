import { S } from '../state.js';
import { connSvg } from '../dom-refs.js';
import { getBorderPoint, makeArrowPoints, getPairPerpendicular } from './geometry.js';
import { updateReconnHandles } from './conn-selection.js';

export function makeConnGroup() {
  const NS = 'http://www.w3.org/2000/svg';
  const g  = document.createElementNS(NS, 'g');
  g.classList.add('conn-group');

  const hit = document.createElementNS(NS, 'path');
  hit.classList.add('conn-hitarea');
  g.appendChild(hit);

  const line = document.createElementNS(NS, 'path');
  line.classList.add('conn-line');
  g.appendChild(line);

  const arrow = document.createElementNS(NS, 'polygon');
  arrow.classList.add('conn-arrow');
  g.appendChild(arrow);

  const lbl = document.createElementNS(NS, 'text');
  lbl.classList.add('conn-label');
  g.appendChild(lbl);

  const del = document.createElementNS(NS, 'g');
  del.classList.add('conn-delete');
  del.style.visibility = 'hidden';
  const delCirc = document.createElementNS(NS, 'circle');
  delCirc.setAttribute('r', '8');
  delCirc.classList.add('conn-delete-bg');
  const delTxt = document.createElementNS(NS, 'text');
  delTxt.classList.add('conn-delete-x');
  delTxt.textContent = '×';
  del.appendChild(delCirc);
  del.appendChild(delTxt);
  g.appendChild(del);

  connSvg.appendChild(g);
  return g;
}

export function renderConnGroup(group, p1, p2, ctrlX, ctrlY, label, isSelected) {
  const d = `M ${p1.x} ${p1.y} Q ${ctrlX} ${ctrlY} ${p2.x} ${p2.y}`;
  group.querySelector('.conn-hitarea').setAttribute('d', d);
  group.querySelector('.conn-line').setAttribute('d', d);

  const t = 2 / 3, mt = 1 - t;
  const ax = mt*mt*p1.x + 2*mt*t*ctrlX + t*t*p2.x;
  const ay = mt*mt*p1.y + 2*mt*t*ctrlY + t*t*p2.y;
  const tx = 2*mt*(ctrlX - p1.x) + 2*t*(p2.x - ctrlX);
  const ty = 2*mt*(ctrlY - p1.y) + 2*t*(p2.y - ctrlY);
  group.querySelector('.conn-arrow').setAttribute('points', makeArrowPoints(ax, ay, Math.atan2(ty, tx)));

  const lx = 0.25*p1.x + 0.5*ctrlX + 0.25*p2.x;
  const ly = 0.25*p1.y + 0.5*ctrlY + 0.25*p2.y;
  const labelEl = group.querySelector('.conn-label');
  labelEl.setAttribute('x', lx);
  labelEl.setAttribute('y', ly - 10);
  if (label !== undefined) labelEl.textContent = label;

  const td = 0.88, mtd = 1 - td;
  const dx  = mtd*mtd*p1.x + 2*mtd*td*ctrlX + td*td*p2.x;
  const dy  = mtd*mtd*p1.y + 2*mtd*td*ctrlY + td*td*p2.y;
  const ttx = 2*mtd*(ctrlX - p1.x) + 2*td*(p2.x - ctrlX);
  const tty = 2*mtd*(ctrlY - p1.y) + 2*td*(p2.y - ctrlY);
  const tlen = Math.sqrt(ttx*ttx + tty*tty) || 1;
  const DEL_OFFSET = 16;
  const delX = dx + (-tty / tlen) * DEL_OFFSET;
  const delY = dy + ( ttx / tlen) * DEL_OFFSET;
  const delGroup = group.querySelector('.conn-delete');
  delGroup.setAttribute('transform', `translate(${delX}, ${delY})`);
  delGroup.style.visibility = isSelected ? 'visible' : 'hidden';
}

export function updateConnectionsForNode(node) {
  for (const conn of S.connections) {
    if (conn.fromId === node.id || conn.toId === node.id) updateConnection(conn);
  }
}

export function updateConnection(conn) {
  const from = conn.fromId != null ? S.nodes.find(n => n.id === conn.fromId) : null;
  const to   = conn.toId   != null ? S.nodes.find(n => n.id === conn.toId)   : null;

  if (!from && !to) {
    const p1 = conn.danglingFrom || { x: 0, y: 0 };
    const p2 = conn.danglingTo   || { x: 0, y: 0 };
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    renderConnGroup(conn.group, p1, p2, mx, my, conn.label, conn === S.selectedConn);
    updateReconnHandles(conn);
    return;
  }

  let p1, p2;
  if (from && to) {
    const toC   = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    const fromC = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    p1 = getBorderPoint(from, toC.x, toC.y);
    p2 = getBorderPoint(to, fromC.x, fromC.y);
  } else if (from && !to) {
    const dp = conn.danglingTo || { x: from.x + from.w / 2 + 80, y: from.y + from.h / 2 };
    p1 = getBorderPoint(from, dp.x, dp.y);
    p2 = dp;
  } else {
    const dp = conn.danglingFrom || { x: to.x + to.w / 2 - 80, y: to.y + to.h / 2 };
    p1 = dp;
    p2 = getBorderPoint(to, dp.x, dp.y);
  }

  let mx, my;
  if (from && to) {
    const { px, py } = getPairPerpendicular(from, to);
    const off = conn.curveOffset || 0;
    mx = (p1.x + p2.x) / 2 + px * off;
    my = (p1.y + p2.y) / 2 + py * off;
  } else {
    mx = (p1.x + p2.x) / 2;
    my = (p1.y + p2.y) / 2;
  }

  renderConnGroup(conn.group, p1, p2, mx, my, conn.label, conn === S.selectedConn);
  updateReconnHandles(conn);
}
