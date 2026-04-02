/**
 * Pure geometry functions for connections — no DOM dependency.
 */

/** Point on `node`'s visible border facing toward (targetX, targetY). */
export function getBorderPoint(node, targetX, targetY) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy };
  const len = Math.sqrt(dx * dx + dy * dy);
  const ndx = dx / len;
  const ndy = dy / len;
  const hw  = node.w / 2;
  const hh  = node.h / 2;
  if (node.type === 'start' || node.type === 'end') {
    return { x: cx + ndx * hw, y: cy + ndy * hh };
  }
  if (node.type === 'choice') {
    const t = (hw * hh) / (Math.abs(ndy) * hw + Math.abs(ndx) * hh);
    return { x: cx + ndx * t, y: cy + ndy * t };
  }
  const tx = Math.abs(ndx) > 0.001 ? hw / Math.abs(ndx) : Infinity;
  const ty = Math.abs(ndy) > 0.001 ? hh / Math.abs(ndy) : Infinity;
  return { x: cx + ndx * Math.min(tx, ty), y: cy + ndy * Math.min(tx, ty) };
}

/** Filled arrowhead polygon whose TIP is at (px,py) pointing in direction `angle`. */
export function makeArrowPoints(px, py, angle) {
  const LEN = 11, HALF = 5;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const bx = px - LEN * cos, by = py - LEN * sin;
  return `${px},${py} ${bx + HALF * sin},${by - HALF * cos} ${bx - HALF * sin},${by + HALF * cos}`;
}

/**
 * Returns the perpendicular unit vector for an unordered node pair.
 * Always defined relative to lower-id → higher-id so it is the same for
 * both A→B and B→A connections in the same pair.
 */
export function getPairPerpendicular(from, to) {
  const ref = from.id < to.id ? { from, to } : { from: to, to: from };
  const dx  = (ref.to.x + ref.to.w / 2) - (ref.from.x + ref.from.w / 2);
  const dy  = (ref.to.y + ref.to.h / 2) - (ref.from.y + ref.from.h / 2);
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { px: -dy / len, py: dx / len };
}
