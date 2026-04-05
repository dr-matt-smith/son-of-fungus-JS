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
    el.innerHTML = `<span class="node-label">New Block ${id}</span>`;
  } else if (type === 'start') {
    el.innerHTML = '<span class="node-label-fixed">start</span>';
  } else if (type === 'end') {
    el.innerHTML = '<span class="node-label-fixed">end</span>';
  }

  // ID label at top-right inside the node
  const idSpan = document.createElement('span');
  idSpan.className = 'node-id-label';
  idSpan.textContent = `id: ${id}`;
  el.appendChild(idSpan);

  return el;
}

export function fitLabelFontSize(node) {
  if (node.type !== 'state' && node.type !== 'choice') return;
  const labelEl = node.el.querySelector('.node-label');
  if (!labelEl) return;
  // Use CSS font size (no auto-fit shrinking)
  labelEl.style.fontSize = '';
}
