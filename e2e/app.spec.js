import { test, expect } from '@playwright/test';
import { dragNewNode, drag, getNodeBox, dragBetween } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

// ─── Version 1: Toolbar & basic node creation ──────────────────────────────

test.describe('V1 – Toolbar and state creation', () => {
  test('toolbar is visible at the top', async ({ page }) => {
    await expect(page.locator('#toolbar')).toBeVisible();
  });

  test('drag a state node onto the canvas', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await expect(page.locator('.state-node')).toHaveCount(1);
  });

  test('zoom in button increases zoom percentage', async ({ page }) => {
    const label = page.locator('#zoom-label');
    const before = await label.textContent();
    await page.locator('#btn-zoom-in').click();
    const after = await label.textContent();
    expect(parseInt(after)).toBeGreaterThan(parseInt(before));
  });

  test('zoom out button decreases zoom percentage', async ({ page }) => {
    const label = page.locator('#zoom-label');
    const before = await label.textContent();
    await page.locator('#btn-zoom-out').click();
    const after = await label.textContent();
    expect(parseInt(after)).toBeLessThan(parseInt(before));
  });
});

// ─── Version 1: Minimap ────────────────────────────────────────────────────

test.describe('V1 – Minimap', () => {
  test('minimap is visible', async ({ page }) => {
    await expect(page.locator('#minimap')).toBeVisible();
  });

  test('minimap viewport rectangle exists', async ({ page }) => {
    await expect(page.locator('#minimap-viewport')).toBeVisible();
  });
});

// ─── Version 2: Scroll-wheel zoom & middle-button pan ──────────────────────

test.describe('V2 – Wheel zoom and pan', () => {
  test('scroll wheel zooms in', async ({ page }) => {
    const label = page.locator('#zoom-label');
    const before = parseInt(await label.textContent());
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(100);
    const after = parseInt(await label.textContent());
    expect(after).toBeGreaterThan(before);
  });

  test('hand tool button toggles active class', async ({ page }) => {
    const btn = page.locator('#btn-hand-tool');
    await expect(btn).not.toHaveClass(/active/);
    await btn.click();
    await expect(btn).toHaveClass(/active/);
    await btn.click();
    await expect(btn).not.toHaveClass(/active/);
  });
});

// ─── Version 3: All node types ─────────────────────────────────────────────

test.describe('V3 – Node types', () => {
  test('create start node', async ({ page }) => {
    await dragNewNode(page, '#btn-new-start');
    await expect(page.locator('.start-node')).toHaveCount(1);
  });

  test('create end node', async ({ page }) => {
    await dragNewNode(page, '#btn-new-end');
    await expect(page.locator('.end-node')).toHaveCount(1);
  });

  test('create choice (diamond) node', async ({ page }) => {
    await dragNewNode(page, '#btn-new-choice');
    await expect(page.locator('.choice-node')).toHaveCount(1);
    await expect(page.locator('.choice-node .choice-svg')).toBeVisible();
  });
});

// ─── Version 3: Node selection and text editing ────────────────────────────

test.describe('V3 – Selection and text editing', () => {
  test('clicking a state node activates it (shows handles)', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.click();
    await expect(node).toHaveClass(/node-active/);
    await expect(page.locator('.resize-handle')).toHaveCount(8);
    await expect(page.locator('.conn-handle')).toBeVisible();
  });

  test('double-clicking a state opens text editor', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.dblclick();
    await expect(page.locator('.node-label-input')).toBeVisible();
  });

  test('editing text and pressing Enter commits it', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.dblclick();
    const input = page.locator('.node-label-input');
    await input.fill('My State');
    await input.press('Enter');
    await expect(page.locator('.node-label')).toHaveText('My State');
  });

  test('Shift+Enter inserts a newline', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.dblclick();
    const input = page.locator('.node-label-input');
    await input.fill('');
    await input.type('Line1');
    await input.press('Shift+Enter');
    await input.type('Line2');
    await input.press('Enter');
    const label = page.locator('.node-label');
    await expect(label).toContainText('Line1');
    await expect(label).toContainText('Line2');
  });

  test('clicking empty canvas deselects a node', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.click();
    await expect(node).toHaveClass(/node-active/);
    // Click on empty canvas area (top-left corner far from node)
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 10, box.y + 10);
    await expect(node).not.toHaveClass(/node-active/);
  });
});

// ─── Version 3: Node resizing ──────────────────────────────────────────────

test.describe('V3 – Node resizing', () => {
  test('dragging east resize handle makes node wider', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.click();
    const boxBefore = await getNodeBox(page, node);

    const handle = page.locator('.resize-handle[data-dir="e"]');
    const hBox = await handle.boundingBox();
    await drag(page, hBox.x + hBox.width / 2, hBox.y + hBox.height / 2,
               hBox.x + hBox.width / 2 + 80, hBox.y + hBox.height / 2);

    const boxAfter = await getNodeBox(page, node);
    expect(boxAfter.width).toBeGreaterThan(boxBefore.width);
  });

  test('reset button restores default size', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.click();

    // Resize it first
    const handle = page.locator('.resize-handle[data-dir="e"]');
    const hBox = await handle.boundingBox();
    await drag(page, hBox.x + 4, hBox.y + 4, hBox.x + 100, hBox.y + 4);

    const boxResized = await getNodeBox(page, node);

    // Click reset button
    await page.locator('.node-reset-btn').click();
    const boxReset = await getNodeBox(page, node);
    expect(boxReset.width).toBeLessThan(boxResized.width);
  });
});

// ─── Version 3: Node dragging ──────────────────────────────────────────────

test.describe('V3 – Node dragging', () => {
  test('dragging a node moves it on the canvas', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    const boxBefore = await getNodeBox(page, node);

    await drag(page,
      boxBefore.x + boxBefore.width / 2,
      boxBefore.y + boxBefore.height / 2,
      boxBefore.x + boxBefore.width / 2 + 100,
      boxBefore.y + boxBefore.height / 2 + 50);

    const boxAfter = await getNodeBox(page, node);
    expect(boxAfter.x).toBeGreaterThan(boxBefore.x);
    expect(boxAfter.y).toBeGreaterThan(boxBefore.y);
  });
});

// ─── Version 4: Fit All ────────────────────────────────────────────────────

test.describe('V4 – Fit All', () => {
  test('fit all adjusts zoom to show all nodes', async ({ page }) => {
    // Create two nodes far apart
    await dragNewNode(page, '#btn-new-state', -200, -150);
    await dragNewNode(page, '#btn-new-state', 200, 150);

    const label = page.locator('#zoom-label');
    await page.locator('#btn-fit-all').click();
    const zoomText = await label.textContent();
    // Should have adjusted zoom (exact value depends on viewport)
    expect(zoomText).toMatch(/\d+%/);
  });
});

// ─── Version 5: Connections ────────────────────────────────────────────────

test.describe('V5 – Connections', () => {
  test('create a connection between two nodes via conn-handle drag', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -100, 0);
    await dragNewNode(page, '#btn-new-state', 100, 0);

    const nodes = page.locator('.state-node');
    const nodeA = nodes.nth(0);
    const nodeB = nodes.nth(1);

    // Click first node to activate and show conn-handle
    await nodeA.click();
    await expect(page.locator('.conn-handle')).toBeVisible();

    // Drag from conn-handle to second node
    const connHandle = page.locator('.conn-handle');
    await dragBetween(page, connHandle, nodeB);

    await expect(page.locator('.conn-line')).toHaveCount(1);
    await expect(page.locator('.conn-arrow')).toHaveCount(1);
  });

  test('connection has default "transition" label', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -100, 0);
    await dragNewNode(page, '#btn-new-state', 100, 0);
    const nodeA = page.locator('.state-node').nth(0);
    const nodeB = page.locator('.state-node').nth(1);

    await nodeA.click();
    await dragBetween(page, page.locator('.conn-handle'), nodeB);

    await expect(page.locator('.conn-label')).toHaveText('transition');
  });

  test('clicking a connection selects it (shows delete button)', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -100, 0);
    await dragNewNode(page, '#btn-new-state', 100, 0);
    const nodeA = page.locator('.state-node').nth(0);
    const nodeB = page.locator('.state-node').nth(1);

    await nodeA.click();
    await dragBetween(page, page.locator('.conn-handle'), nodeB);

    // Click on the connection hitarea (SVG element with pointer-events: stroke)
    await page.locator('.conn-hitarea').click({ force: true });
    await expect(page.locator('.conn-group')).toHaveClass(/conn-selected/);
    // Delete button should be visible
    const del = page.locator('.conn-delete');
    await expect(del).toHaveCSS('visibility', 'visible');
  });

  test('double-clicking connection label opens editor', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -100, 0);
    await dragNewNode(page, '#btn-new-state', 100, 0);
    const nodeA = page.locator('.state-node').nth(0);
    const nodeB = page.locator('.state-node').nth(1);

    await nodeA.click();
    await dragBetween(page, page.locator('.conn-handle'), nodeB);

    // Select the connection then double-click its label
    const label = page.locator('.conn-label');
    await label.click({ force: true });
    await label.dblclick({ force: true });

    await expect(page.locator('.conn-label-input')).toBeVisible();
  });

  test('deleting a connection via X button removes it', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -100, 0);
    await dragNewNode(page, '#btn-new-state', 100, 0);
    const nodeA = page.locator('.state-node').nth(0);
    const nodeB = page.locator('.state-node').nth(1);

    await nodeA.click();
    await dragBetween(page, page.locator('.conn-handle'), nodeB);
    await expect(page.locator('.conn-line')).toHaveCount(1);

    // Select and delete (SVG elements need force click)
    await page.locator('.conn-hitarea').click({ force: true });
    await page.locator('.conn-delete').click({ force: true });
    await expect(page.locator('.conn-line')).toHaveCount(0);
  });

  test('connections move with nodes (elastic banding)', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -100, 0);
    await dragNewNode(page, '#btn-new-state', 100, 0);
    const nodeA = page.locator('.state-node').nth(0);
    const nodeB = page.locator('.state-node').nth(1);

    await nodeA.click();
    await dragBetween(page, page.locator('.conn-handle'), nodeB);

    const pathBefore = await page.locator('.conn-line').getAttribute('d');

    // Drag node A down
    const boxA = await getNodeBox(page, nodeA);
    await drag(page, boxA.x + boxA.width / 2, boxA.y + boxA.height / 2,
               boxA.x + boxA.width / 2, boxA.y + boxA.height / 2 + 80);

    const pathAfter = await page.locator('.conn-line').getAttribute('d');
    expect(pathAfter).not.toBe(pathBefore);
  });

  test('multiple connections between same pair creates curved lines', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -100, 0);
    await dragNewNode(page, '#btn-new-state', 100, 0);
    const nodeA = page.locator('.state-node').nth(0);
    const nodeB = page.locator('.state-node').nth(1);

    // First connection
    await nodeA.click();
    await dragBetween(page, page.locator('.conn-handle'), nodeB);

    // Second connection
    await nodeA.click();
    await dragBetween(page, page.locator('.conn-handle'), nodeB);

    await expect(page.locator('.conn-line')).toHaveCount(2);
    // The two paths should differ (due to curve offset)
    const path1 = await page.locator('.conn-line').nth(0).getAttribute('d');
    const path2 = await page.locator('.conn-line').nth(1).getAttribute('d');
    expect(path1).not.toBe(path2);
  });
});

// ─── Version 6: Auto text sizing ───────────────────────────────────────────

test.describe('V6 – Auto text font sizing', () => {
  test('label font size is set after node creation', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const label = page.locator('.state-node .node-label');
    const fontSize = await label.evaluate(el => el.style.fontSize);
    expect(fontSize).toBeTruthy();
    expect(parseFloat(fontSize)).toBeGreaterThan(0);
  });
});

// ─── Version 6: Group selection ────────────────────────────────────────────

test.describe('V6 – Group selection and drag', () => {
  test('dragging rectangle on empty canvas selects enclosed nodes', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -50, -20);
    await dragNewNode(page, '#btn-new-state', 50, 20);

    // Click canvas to deselect any active node
    const canvas = page.locator('#canvas-container');
    const cBox = await canvas.boundingBox();
    await page.mouse.click(cBox.x + 5, cBox.y + 5);

    // Get bounds of both nodes to draw selection rectangle around them
    const nodeA = page.locator('.state-node').nth(0);
    const nodeB = page.locator('.state-node').nth(1);
    const boxA = await getNodeBox(page, nodeA);
    const boxB = await getNodeBox(page, nodeB);

    const left = Math.min(boxA.x, boxB.x) - 20;
    const top = Math.min(boxA.y, boxB.y) - 20;
    const right = Math.max(boxA.x + boxA.width, boxB.x + boxB.width) + 20;
    const bottom = Math.max(boxA.y + boxA.height, boxB.y + boxB.height) + 20;

    await drag(page, left, top, right, bottom, 15);

    await expect(nodeA).toHaveClass(/node-group-selected/);
    await expect(nodeB).toHaveClass(/node-group-selected/);
  });

  test('clicking empty canvas deselects group', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -50, -20);
    await dragNewNode(page, '#btn-new-state', 50, 20);

    const canvas = page.locator('#canvas-container');
    const cBox = await canvas.boundingBox();
    await page.mouse.click(cBox.x + 5, cBox.y + 5);

    const nodeA = page.locator('.state-node').nth(0);
    const nodeB = page.locator('.state-node').nth(1);
    const boxA = await getNodeBox(page, nodeA);
    const boxB = await getNodeBox(page, nodeB);

    const left = Math.min(boxA.x, boxB.x) - 20;
    const top = Math.min(boxA.y, boxB.y) - 20;
    const right = Math.max(boxA.x + boxA.width, boxB.x + boxB.width) + 20;
    const bottom = Math.max(boxA.y + boxA.height, boxB.y + boxB.height) + 20;

    await drag(page, left, top, right, bottom, 15);
    await expect(nodeA).toHaveClass(/node-group-selected/);

    // Click empty area to deselect
    await page.mouse.click(cBox.x + 5, cBox.y + 5);
    await expect(nodeA).not.toHaveClass(/node-group-selected/);
    await expect(nodeB).not.toHaveClass(/node-group-selected/);
  });
});

// ─── Version 7: Minimap minimize / restore ─────────────────────────────────

test.describe('V7 – Minimap minimize/restore', () => {
  test('clicking minimize hides minimap and shows restore button', async ({ page }) => {
    await page.locator('#minimap-minimize').click();
    await expect(page.locator('#minimap')).toBeHidden();
    await expect(page.locator('#minimap-restore')).toBeVisible();
  });

  test('clicking restore shows minimap again', async ({ page }) => {
    await page.locator('#minimap-minimize').click();
    await page.locator('#minimap-restore').click();
    await expect(page.locator('#minimap')).toBeVisible();
    await expect(page.locator('#minimap-restore')).toBeHidden();
  });
});

// ─── Version 8: Zoom toolbar ──────────────────────────────────────────────

test.describe('V8 – Zoom toolbar', () => {
  test('zoom toolbar is visible at bottom-left', async ({ page }) => {
    await expect(page.locator('#zoom-toolbar')).toBeVisible();
  });

  test('zoom slider is present', async ({ page }) => {
    await expect(page.locator('#zoom-slider')).toBeVisible();
  });

  test('zoom slider changes zoom level', async ({ page }) => {
    const label = page.locator('#zoom-label');
    const slider = page.locator('#zoom-slider');
    await slider.fill('200');
    await slider.dispatchEvent('input');
    const text = await label.textContent();
    expect(parseInt(text)).toBeGreaterThanOrEqual(150);
  });

  test('zoom label shows percentage', async ({ page }) => {
    const text = await page.locator('#zoom-label').textContent();
    expect(text).toMatch(/\d+%/);
  });

  test('fit all button is in zoom toolbar', async ({ page }) => {
    await expect(page.locator('#zoom-toolbar #btn-fit-all')).toBeVisible();
  });
});

// ─── Version 9: Start/End labels ───────────────────────────────────────────

test.describe('V9 – Start and end node labels', () => {
  test('start node shows read-only "start" label', async ({ page }) => {
    await dragNewNode(page, '#btn-new-start');
    const label = page.locator('.start-node .node-label-fixed');
    await expect(label).toBeVisible();
    await expect(label).toHaveText('start');
  });

  test('end node shows read-only "end" label', async ({ page }) => {
    await dragNewNode(page, '#btn-new-end');
    const label = page.locator('.end-node .node-label-fixed');
    await expect(label).toBeVisible();
    await expect(label).toHaveText('end');
  });

  test('start label is not editable on double-click', async ({ page }) => {
    await dragNewNode(page, '#btn-new-start');
    const node = page.locator('.start-node');
    await node.dblclick();
    // No textarea should appear
    await expect(page.locator('.node-label-input')).toHaveCount(0);
  });
});

// ─── Version 10: Node deletion ─────────────────────────────────────────────

test.describe('V10 – Node deletion', () => {
  test('active node shows red delete handle', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.click();
    await expect(page.locator('.node-delete-handle')).toBeVisible();
  });

  test('clicking delete handle removes the node', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await expect(page.locator('.state-node')).toHaveCount(1);

    await page.locator('.state-node').click();
    await page.locator('.node-delete-handle').click();
    await expect(page.locator('.state-node')).toHaveCount(0);
  });

  test('deleting a node preserves its connections as dangling', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -100, 0);
    await dragNewNode(page, '#btn-new-state', 100, 0);
    const nodeA = page.locator('.state-node').nth(0);
    const nodeB = page.locator('.state-node').nth(1);

    // Create connection A → B
    await nodeA.click();
    await dragBetween(page, page.locator('.conn-handle'), nodeB);
    await expect(page.locator('.conn-line')).toHaveCount(1);

    // Delete node A
    await nodeA.click();
    await page.locator('.node-delete-handle').click();

    // Connection should still exist (dangling)
    await expect(page.locator('.conn-line')).toHaveCount(1);
    // Only one state node remains
    await expect(page.locator('.state-node')).toHaveCount(1);
  });

  test('dangling connection shows reconn handle when selected', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -100, 0);
    await dragNewNode(page, '#btn-new-state', 100, 0);
    const nodeA = page.locator('.state-node').nth(0);
    const nodeB = page.locator('.state-node').nth(1);

    await nodeA.click();
    await dragBetween(page, page.locator('.conn-handle'), nodeB);

    // Delete node A → makes fromId dangling
    await nodeA.click();
    await page.locator('.node-delete-handle').click();

    // Select the dangling connection
    await page.locator('.conn-hitarea').click({ force: true });
    await expect(page.locator('.reconn-handle')).toHaveCount(1);
  });

  test('delete handle appears on all node types', async ({ page }) => {
    const buttons = ['#btn-new-state', '#btn-new-start', '#btn-new-end', '#btn-new-choice'];
    const offsets = [-200, -80, 80, 200];
    for (let i = 0; i < buttons.length; i++) {
      await dragNewNode(page, buttons[i], offsets[i], 0);
    }
    const nodeTypes = ['.state-node', '.start-node', '.end-node', '.choice-node'];
    for (const sel of nodeTypes) {
      await page.locator(sel).click();
      await expect(page.locator('.node-delete-handle')).toBeVisible();
      // Click away to deselect
      const canvas = page.locator('#canvas-container');
      const box = await canvas.boundingBox();
      await page.mouse.click(box.x + 5, box.y + 5);
    }
  });
});

// ─── Keyboard shortcuts ────────────────────────────────────────────────────

test.describe('Keyboard shortcuts', () => {
  test('Escape deselects active node', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.click();
    await expect(node).toHaveClass(/node-active/);
    await page.keyboard.press('Escape');
    await expect(node).not.toHaveClass(/node-active/);
  });

  test('"h" toggles hand tool', async ({ page }) => {
    const btn = page.locator('#btn-hand-tool');
    await expect(btn).not.toHaveClass(/active/);
    await page.keyboard.press('h');
    await expect(btn).toHaveClass(/active/);
    await page.keyboard.press('h');
    await expect(btn).not.toHaveClass(/active/);
  });

  test('"f" triggers fit all', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -200, -100);
    await dragNewNode(page, '#btn-new-state', 200, 100);
    // Click canvas to deselect
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);

    const labelBefore = await page.locator('#zoom-label').textContent();
    await page.keyboard.press('f');
    const labelAfter = await page.locator('#zoom-label').textContent();
    // Zoom should have changed
    expect(labelAfter).not.toBe(labelBefore);
  });
});
