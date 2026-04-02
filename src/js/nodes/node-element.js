/**
 * DOM element construction and font sizing for nodes.
 */

export function buildNodeElement(type, id) {
  const el = document.createElement('div');
  el.className = `diagram-node ${type}-node`;
  el.dataset.id   = String(id);
  el.dataset.type = type;
  el.dataset.testid = `node-${type}-${id}`;

  if (type === 'choice') {
    el.innerHTML =
      '<svg class="choice-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
        '<polygon points="50,2 98,50 50,98 2,50"/>' +
      '</svg>' +
      '<span class="node-label">?</span>';
  } else if (type === 'state') {
    el.innerHTML = `<span class="node-label">State ${id}</span>`;
  } else if (type === 'start') {
    el.innerHTML = '<span class="node-label-fixed">start</span>';
  } else if (type === 'end') {
    el.innerHTML = '<span class="node-label-fixed">end</span>';
  }

  if (type === 'state' || type === 'choice') {
    const btn = document.createElement('button');
    btn.className = 'node-reset-btn';
    btn.title     = 'Reset to default size';
    btn.textContent = '↺';
    btn.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
    el.appendChild(btn);
  }

  return el;
}

export function fitLabelFontSize(node) {
  if (node.type !== 'state' && node.type !== 'choice') return;
  const labelEl = node.el.querySelector('.node-label');
  if (!labelEl) return;

  const MAX_FONT = 200;
  const MIN_FONT = 6;

  let availH, availW;
  if (node.type === 'choice') {
    availH = node.h * 0.48 - 4;
    availW = node.w * 0.48 - 4;
  } else {
    availH = node.h - 14;
    availW = node.w - 18;
  }

  let lo = MIN_FONT, hi = MAX_FONT, best = MIN_FONT;
  while (lo <= hi) {
    const mid = (lo + hi) / 2;
    labelEl.style.fontSize = `${mid}px`;
    if (labelEl.scrollHeight <= availH && labelEl.scrollWidth <= availW) {
      best = mid;
      lo = mid + 0.5;
    } else {
      hi = mid - 0.5;
    }
  }
  labelEl.style.fontSize = `${best}px`;
}
