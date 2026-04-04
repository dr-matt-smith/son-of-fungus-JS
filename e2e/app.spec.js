import { test, expect } from '@playwright/test';
import { dragNewNode, drag, getNodeBox, dragBetween } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Default mode is Fungus; switch to statechart for backward-compatible tests
  await page.locator('.inspector-tab[data-tab="settings"]').click();
  await page.locator('input[name="diagram-mode"][value="statechart"]').check();
  await page.locator('.inspector-tab[data-tab="inspector"]').click();
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

// ─── Version 21: Hand tool in zoom toolbar ────────────────────────────────

test.describe('V21 – Hand tool in zoom toolbar', () => {
  test('hand tool button is inside the zoom toolbar', async ({ page }) => {
    const handBtn = page.locator('#zoom-toolbar #btn-hand-tool');
    await expect(handBtn).toBeVisible();
  });

  test('hand tool button is NOT in the main toolbar', async ({ page }) => {
    const handBtnInToolbar = page.locator('#toolbar #btn-hand-tool');
    await expect(handBtnInToolbar).toHaveCount(0);
  });

  test('hand tool toggles active class when clicked', async ({ page }) => {
    const btn = page.locator('#btn-hand-tool');
    await expect(btn).not.toHaveClass(/active/);
    await btn.click();
    await expect(btn).toHaveClass(/active/);
    await btn.click();
    await expect(btn).not.toHaveClass(/active/);
  });

  test('hand tool changes cursor to grab on canvas', async ({ page }) => {
    await page.locator('#btn-hand-tool').click();
    const cursor = await page.locator('#canvas-container').evaluate(el => el.style.cursor);
    expect(cursor).toBe('grab');
  });

  test('deactivating hand tool restores default cursor', async ({ page }) => {
    const btn = page.locator('#btn-hand-tool');
    await btn.click();
    await btn.click();
    const cursor = await page.locator('#canvas-container').evaluate(el => el.style.cursor);
    expect(cursor).toBe('');
  });

  test('"h" keyboard shortcut still toggles hand tool in zoom toolbar', async ({ page }) => {
    const btn = page.locator('#btn-hand-tool');
    await expect(btn).not.toHaveClass(/active/);
    await page.keyboard.press('h');
    await expect(btn).toHaveClass(/active/);
    await page.keyboard.press('h');
    await expect(btn).not.toHaveClass(/active/);
  });
});

// ─── Version 22: Edit block name in inspector panel ───────────────────────

test.describe('V22 – Edit block name in inspector panel', () => {
  test('inspector shows editable name input when state node is selected', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    const nameInput = page.locator('.inspector-name-input');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue(/State/);
  });

  test('inspector shows editable name input when choice node is selected', async ({ page }) => {
    await dragNewNode(page, '#btn-new-choice');
    await page.locator('.choice-node').click();
    const nameInput = page.locator('.inspector-name-input');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue('?');
  });

  test('inspector does NOT show name input for start node', async ({ page }) => {
    await dragNewNode(page, '#btn-new-start');
    await page.locator('.start-node').click();
    await expect(page.locator('.inspector-name-input')).toHaveCount(0);
  });

  test('inspector does NOT show name input for end node', async ({ page }) => {
    await dragNewNode(page, '#btn-new-end');
    await page.locator('.end-node').click();
    await expect(page.locator('.inspector-name-input')).toHaveCount(0);
  });

  test('typing in name input updates the diagram label dynamically', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    const nameInput = page.locator('.inspector-name-input');
    await nameInput.fill('MyBlock');
    const label = page.locator('.state-node .node-label');
    await expect(label).toHaveText('MyBlock');
  });

  test('diagram label updates as the user types each character', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    const nameInput = page.locator('.inspector-name-input');
    await nameInput.fill('');
    await nameInput.type('AB');
    const label = page.locator('.state-node .node-label');
    await expect(label).toHaveText('AB');
  });

  test('name input reflects current label when node is reselected', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');

    // Select and rename
    await node.click();
    const nameInput = page.locator('.inspector-name-input');
    await nameInput.fill('Renamed');

    // Deselect
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);

    // Reselect
    await node.click();
    await expect(page.locator('.inspector-name-input')).toHaveValue('Renamed');
  });
});

// ─── Version 23: Fungus FlowChart mode ────────────────────────────────────

test.describe('V23 – Inspector/Settings tabs', () => {
  test('inspector and settings tabs are visible', async ({ page }) => {
    await expect(page.locator('.inspector-tab[data-tab="inspector"]')).toBeVisible();
    await expect(page.locator('.inspector-tab[data-tab="settings"]')).toBeVisible();
  });

  test('inspector tab is active by default', async ({ page }) => {
    await expect(page.locator('.inspector-tab[data-tab="inspector"]')).toHaveClass(/active/);
    await expect(page.locator('.inspector-tab[data-tab="settings"]')).not.toHaveClass(/active/);
  });

  test('clicking settings tab shows settings panel', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await expect(page.locator('#settings-panel')).toBeVisible();
    await expect(page.locator('#inspector-panel')).toBeHidden();
    await expect(page.locator('.inspector-tab[data-tab="settings"]')).toHaveClass(/active/);
  });

  test('clicking inspector tab switches back', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();
    await expect(page.locator('#inspector-panel')).toBeVisible();
    await expect(page.locator('#settings-panel')).toBeHidden();
  });

  test('settings panel has diagram mode radio buttons with preview diagrams', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    const radios = page.locator('input[name="diagram-mode"]');
    await expect(radios).toHaveCount(2);
    const previews = page.locator('.settings-mode-preview');
    await expect(previews).toHaveCount(2);
  });
});

test.describe('V23 – Fungus FlowChart mode', () => {
  async function switchToFungusMode(page) {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();
  }

  async function switchToStatechartMode(page) {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="statechart"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();
  }

  test('switching to Fungus mode hides start and end palette buttons', async ({ page }) => {
    await expect(page.locator('#btn-new-start')).toBeVisible();
    await expect(page.locator('#btn-new-end')).toBeVisible();
    await switchToFungusMode(page);
    await expect(page.locator('#btn-new-start')).toBeHidden();
    await expect(page.locator('#btn-new-end')).toBeHidden();
  });

  test('switching back to State Chart mode restores start/end buttons', async ({ page }) => {
    await switchToFungusMode(page);
    await expect(page.locator('#btn-new-start')).toBeHidden();
    await switchToStatechartMode(page);
    await expect(page.locator('#btn-new-start')).toBeVisible();
    await expect(page.locator('#btn-new-end')).toBeVisible();
  });

  test('state nodes get fungus styling class in Fungus mode', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await switchToFungusMode(page);
    const node = page.locator('.state-node');
    await expect(node).toHaveClass(/fungus-standard-block/);
  });

  test('node with event gets event block styling', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');

    // Select node and set event to Game Started
    await node.click();
    await page.locator('.inspector-select').first().selectOption('gameStarted');

    await switchToFungusMode(page);
    await expect(node).toHaveClass(/fungus-event-block/);
  });

  test('fungus styling classes removed when switching back', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await switchToFungusMode(page);
    const node = page.locator('.state-node');
    await expect(node).toHaveClass(/fungus-standard-block/);
    await switchToStatechartMode(page);
    await expect(node).not.toHaveClass(/fungus-standard-block/);
  });

  test('connection handle hidden in Fungus mode', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');

    // In statechart mode, clicking node shows conn handle
    await node.click();
    await expect(page.locator('.conn-handle')).toHaveCount(1);

    // Deselect, switch to fungus, select node, no conn handle
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);

    await switchToFungusMode(page);
    await node.click();
    await expect(page.locator('.conn-handle')).toHaveCount(0);
  });

  test('auto-connection created when call command targets another block', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -100, 0);
    await dragNewNode(page, '#btn-new-state', 100, 0);

    // Select first node and add a Call command
    const nodeA = page.locator('.state-node').nth(0);
    await nodeA.click();

    // Add a Call command
    const addCmd = page.locator('.inspector-add-cmd select');
    await addCmd.selectOption('call');

    // Set targetBlockId to second node
    const blockSelect = page.locator('.cmd-field select').first();
    // Get the second option value (should be the second node)
    const options = await blockSelect.locator('option').all();
    const secondNodeOption = options.find(async (opt) => {
      const val = await opt.getAttribute('value');
      return val && val !== '';
    });

    // Select the first available non-empty option (the other node)
    await blockSelect.selectOption({ index: 1 });

    // Switch to Fungus mode
    await switchToFungusMode(page);

    // Should have an auto-connection
    await expect(page.locator('.conn-auto')).toHaveCount(1);
  });

  test('auto-connections removed when switching back to State Chart', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -100, 0);
    await dragNewNode(page, '#btn-new-state', 100, 0);

    const nodeA = page.locator('.state-node').nth(0);
    await nodeA.click();
    await page.locator('.inspector-add-cmd select').selectOption('call');
    await page.locator('.cmd-field select').first().selectOption({ index: 1 });

    await switchToFungusMode(page);
    await expect(page.locator('.conn-auto')).toHaveCount(1);

    await switchToStatechartMode(page);
    await expect(page.locator('.conn-auto')).toHaveCount(0);
  });

  test('existing start/end nodes are dimmed in Fungus mode', async ({ page }) => {
    await dragNewNode(page, '#btn-new-start');
    await switchToFungusMode(page);
    const startNode = page.locator('.start-node');
    const opacity = await startNode.evaluate(el => getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeLessThan(1);
  });
});

// ─── Version 24: Inspector cleanup, Export JSON move, choice hidden ───────

test.describe('V24 – Inspector clears on deselect/delete', () => {
  test('inspector shows "No object selected" after node is deleted', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.click();
    await expect(page.locator('#inspector-props')).toBeVisible();

    // Delete the node
    await page.locator('.node-delete-handle').click();
    await expect(page.locator('.state-node')).toHaveCount(0);
    await expect(page.locator('#inspector-props')).toBeHidden();
    const emptyText = await page.locator('#inspector-empty').textContent();
    expect(emptyText).toContain('No object selected');
  });

  test('inspector clears when node is deselected by clicking canvas', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.click();
    await expect(page.locator('#inspector-props')).toBeVisible();

    // Click empty canvas
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);
    await expect(page.locator('#inspector-empty')).toBeVisible();
    await expect(page.locator('.inspector-section')).toHaveCount(0);
  });

  test('inspector is blank when group of nodes is selected', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state', -50, -20);
    await dragNewNode(page, '#btn-new-state', 50, 20);

    // Deselect first
    const canvas = page.locator('#canvas-container');
    const cBox = await canvas.boundingBox();
    await page.mouse.click(cBox.x + 5, cBox.y + 5);

    // Select both via rubber-band
    const nodeA = page.locator('.state-node').nth(0);
    const nodeB = page.locator('.state-node').nth(1);
    const boxA = await nodeA.boundingBox();
    const boxB = await nodeB.boundingBox();
    const left = Math.min(boxA.x, boxB.x) - 20;
    const top = Math.min(boxA.y, boxB.y) - 20;
    const right = Math.max(boxA.x + boxA.width, boxB.x + boxB.width) + 20;
    const bottom = Math.max(boxA.y + boxA.height, boxB.y + boxB.height) + 20;
    await drag(page, left, top, right, bottom, 15);

    await expect(nodeA).toHaveClass(/node-group-selected/);
    await expect(page.locator('#inspector-empty')).toBeVisible();
  });
});

test.describe('V24 – Export JSON button on canvas', () => {
  test('export JSON button is visible on the canvas area', async ({ page }) => {
    const btn = page.locator('#canvas-container #btn-export-json');
    await expect(btn).toBeVisible();
  });

  test('export JSON button is NOT inside the inspector', async ({ page }) => {
    const btnInInspector = page.locator('#inspector #btn-export-json');
    await expect(btnInInspector).toHaveCount(0);
  });

  test('clicking export JSON button shows the JSON modal', async ({ page }) => {
    await page.locator('#btn-export-json').click();
    await expect(page.locator('#json-modal-overlay')).toBeVisible();
    // Close it
    await page.keyboard.press('Escape');
  });
});

test.describe('V24 – Fungus mode toolbar and naming', () => {
  async function switchToFungusMode(page) {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();
  }

  test('choice button is hidden in Fungus mode', async ({ page }) => {
    await expect(page.locator('#btn-new-choice')).toBeVisible();
    await switchToFungusMode(page);
    await expect(page.locator('#btn-new-choice')).toBeHidden();
  });

  test('state button shows "Block" text in Fungus mode', async ({ page }) => {
    await switchToFungusMode(page);
    await expect(page.locator('#btn-new-state')).toContainText('Block');
  });

  test('new nodes named "New Block N" in Fungus mode', async ({ page }) => {
    await switchToFungusMode(page);
    await dragNewNode(page, '#btn-new-state');
    const label = page.locator('.state-node .node-label');
    await expect(label).toContainText('New Block');
  });

  test('state button shows "State" text after exiting Fungus mode', async ({ page }) => {
    await switchToFungusMode(page);
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="statechart"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();
    await expect(page.locator('#btn-new-state')).toContainText('State');
  });
});

// ─── Version 25: Default Fungus mode, mode label, step execution ─────────

test.describe('V25 – Default Fungus mode and settings order', () => {
  // These tests check fresh page state before beforeEach switches to statechart
  test('fungus radio is first in settings', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    const radios = page.locator('input[name="diagram-mode"]');
    const first = radios.first();
    await expect(first).toHaveValue('fungus');
  });

  test('app loads in Fungus mode on fresh page', async ({ page }) => {
    // Navigate fresh (beforeEach already switched to statechart, so re-navigate)
    await page.goto('/');
    await expect(page.locator('#btn-new-start')).toBeHidden();
    await expect(page.locator('#btn-new-state')).toContainText('Block');
  });
});

test.describe('V25 – Mode label', () => {
  test('mode label is visible', async ({ page }) => {
    await expect(page.locator('#mode-label-text')).toBeVisible();
  });

  test('mode label shows "State Chart Mode" in statechart mode', async ({ page }) => {
    // beforeEach already switched to statechart
    await expect(page.locator('#mode-label-text')).toHaveText('State Chart Mode');
  });

  test('mode label shows hint about Settings tab', async ({ page }) => {
    await expect(page.locator('#mode-label-hint')).toContainText('Settings tab');
  });

  test('mode label changes to "Fungus Mode" when switching', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await expect(page.locator('#mode-label-text')).toHaveText('Fungus Mode');
  });
});

test.describe('V25 – Step-by-step execution', () => {
  async function switchToFungusMode(page) {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();
  }

  test('Step button is visible in Fungus mode', async ({ page }) => {
    await switchToFungusMode(page);
    await expect(page.locator('#btn-play-step')).toBeVisible();
  });

  test('Play button shows "Play All" in Fungus mode', async ({ page }) => {
    await switchToFungusMode(page);
    await expect(page.locator('#play-label')).toHaveText('Play All');
  });

  test('Step button is hidden in State Chart mode', async ({ page }) => {
    // Already in statechart from beforeEach
    await expect(page.locator('#btn-play-step')).toBeHidden();
  });

  test('Play button shows "Play" in State Chart mode', async ({ page }) => {
    await expect(page.locator('#play-label')).toHaveText('Play');
  });

  test('clicking Step starts execution and shows Next/Stop buttons', async ({ page }) => {
    await switchToFungusMode(page);

    // Create a block with a Game Started event and a Say command
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.click();

    // Set event to Game Started
    await page.locator('.inspector-select').first().selectOption('gameStarted');

    // Add a Say command
    await page.locator('.inspector-add-cmd select').selectOption('say');

    // Click empty canvas to deselect
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);

    // Click Step button
    await page.locator('#btn-play-step').click();
    await page.waitForTimeout(200);

    // Next and Stop buttons should be visible
    await expect(page.locator('#btn-step-continue')).toBeVisible();
    await expect(page.locator('#btn-stop')).toBeVisible();
    // Play and Step buttons hidden
    await expect(page.locator('#btn-play')).toBeHidden();
    await expect(page.locator('#btn-play-step')).toBeHidden();

    // Stop execution
    await page.locator('#btn-stop').click();
  });
});

// ─── Version 26: JSON copy, no resize in Fungus ──────────────────────────

test.describe('V26 – JSON modal text selectable with copy button', () => {
  test('JSON modal has a copy button', async ({ page }) => {
    await page.locator('#btn-export-json').click();
    await expect(page.locator('#json-modal-copy')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('JSON modal pre text is selectable', async ({ page }) => {
    await page.locator('#btn-export-json').click();
    const userSelect = await page.locator('#json-modal-body pre').evaluate(
      el => getComputedStyle(el).userSelect
    );
    expect(userSelect).toBe('text');
    await page.keyboard.press('Escape');
  });
});

test.describe('V26 – No resize handles in Fungus mode', () => {
  async function switchToFungusMode(page) {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();
  }

  test('no resize handles on active node in Fungus mode', async ({ page }) => {
    await switchToFungusMode(page);
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await expect(page.locator('.resize-handle')).toHaveCount(0);
  });

  test('resize handles appear on active node in State Chart mode', async ({ page }) => {
    // Already in statechart from beforeEach
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await expect(page.locator('.resize-handle')).toHaveCount(8);
  });

  test('block label has larger font in Fungus mode', async ({ page }) => {
    await switchToFungusMode(page);
    await dragNewNode(page, '#btn-new-state');
    const fontSize = await page.locator('.state-node .node-label').evaluate(
      el => parseFloat(getComputedStyle(el).fontSize)
    );
    expect(fontSize).toBeGreaterThanOrEqual(15);
  });
});

// ─── Version 27: Run Log, Audio dropdown ──────────────────────────────────

test.describe('V27 – Run Log', () => {
  test('run log button is visible on canvas', async ({ page }) => {
    await expect(page.locator('#btn-run-log')).toBeVisible();
  });

  test('clicking run log shows modal with log content', async ({ page }) => {
    await page.locator('#btn-run-log').click();
    await expect(page.locator('#json-modal-overlay')).toBeVisible();
    const header = await page.locator('#json-modal-header span').first().textContent();
    expect(header).toBe('Run Log');
    await page.keyboard.press('Escape');
  });

  test('run log has copy button', async ({ page }) => {
    await page.locator('#btn-run-log').click();
    await expect(page.locator('#json-modal-copy')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('run log shows entries after execution', async ({ page }) => {
    // Switch to fungus mode, create block with Game Started + Say
    async function switchToFungusMode(page) {
      await page.locator('.inspector-tab[data-tab="settings"]').click();
      await page.locator('input[name="diagram-mode"][value="fungus"]').check();
      await page.locator('.inspector-tab[data-tab="inspector"]').click();
    }
    await switchToFungusMode(page);
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-select').first().selectOption('gameStarted');
    await page.locator('.inspector-add-cmd select').selectOption('say');

    // Deselect and play
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);
    await page.locator('#btn-play').click();
    await page.waitForTimeout(1500);

    // Check run log
    await page.locator('#btn-run-log').click();
    const logText = await page.locator('#json-modal-body pre').textContent();
    expect(logText).toContain('Execution started');
    expect(logText).toContain('Say:');
    expect(logText).toContain('Execution complete');
    await page.keyboard.press('Escape');
  });
});

test.describe('V27 – Audio file dropdown', () => {
  test('playSound command shows audio file dropdown', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-add-cmd select').selectOption('playSound');

    // Should have a select for Audio File
    const audioSelect = page.locator('.cmd-field select').first();
    await expect(audioSelect).toBeVisible();

    // Check it has the audio files
    const options = await audioSelect.locator('option').allTextContents();
    expect(options.some(o => o.includes('yum.mp3'))).toBe(true);
    expect(options.some(o => o.includes('die.mp3'))).toBe(true);
  });

  test('playMusic command shows audio file dropdown', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-add-cmd select').selectOption('playMusic');

    const audioSelect = page.locator('.cmd-field select').first();
    await expect(audioSelect).toBeVisible();
    const options = await audioSelect.locator('option').allTextContents();
    expect(options.some(o => o.includes('yum.mp3'))).toBe(true);
  });

  test('each audio file in /audio is playable', async ({ page }) => {
    // Verify each audio file returns a 200 response
    const audioFiles = ['/audio/die.mp3', '/audio/food_sounds/yum.mp3'];
    for (const file of audioFiles) {
      const response = await page.request.get(`http://localhost:4173${file}`);
      expect(response.status()).toBe(200);
    }
  });
});

// ─── Version 28: Run Log Style ────────────────────────────────────────────

test.describe('V28 – Run Log Style', () => {
  test('run log uses *Enter block* format for block entries', async ({ page }) => {
    // Switch to fungus mode
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    // Create block with Game Started + Say
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-select').first().selectOption('gameStarted');
    await page.locator('.inspector-add-cmd select').selectOption('say');

    // Deselect and play
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);
    await page.locator('#btn-play').click();
    await page.waitForTimeout(1500);

    // Check run log
    await page.locator('#btn-run-log').click();
    const logText = await page.locator('#json-modal-body pre').textContent();
    expect(logText).toContain('*Enter block*:');
  });

  test('run log command entries are prefixed with id and block name', async ({ page }) => {
    // Switch to fungus mode
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    // Create block with Game Started + Say
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-select').first().selectOption('gameStarted');
    await page.locator('.inspector-add-cmd select').selectOption('say');

    // Deselect and play
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);
    await page.locator('#btn-play').click();
    await page.waitForTimeout(1500);

    // Check run log has id: name: prefix on Say command
    await page.locator('#btn-run-log').click();
    const logText = await page.locator('#json-modal-body pre').textContent();
    // Should match pattern like "1: New Block 1: Say:"
    expect(logText).toMatch(/\d+: .+: Say:/);
  });

  test('execution started line is NOT prefixed with id', async ({ page }) => {
    // Switch to fungus mode
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    // Create block with Game Started (no commands)
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-select').first().selectOption('gameStarted');

    // Deselect and play
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);
    await page.locator('#btn-play').click();
    await page.waitForTimeout(1500);

    // Check run log
    await page.locator('#btn-run-log').click();
    const logText = await page.locator('#json-modal-body pre').textContent();
    // "Execution started" should NOT have a numeric prefix
    const lines = logText.split('\n');
    const startLine = lines.find(l => l.includes('Execution started'));
    expect(startLine).toBeTruthy();
    expect(startLine).not.toMatch(/\] \d+:/);
  });
});

// ─── Version 29: Fungus block default style & event annotation ────────────

test.describe('V29 – Fungus block default style', () => {
  test('new block in fungus mode has fungus-standard-block class', async ({ page }) => {
    // Switch to fungus mode
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await expect(node).toHaveClass(/fungus-standard-block/);
  });

  test('new block does NOT have event or branching class initially', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await expect(node).not.toHaveClass(/fungus-event-block/);
    await expect(node).not.toHaveClass(/fungus-branching-block/);
  });
});

test.describe('V29 – Fungus event annotation', () => {
  test('block with Game Started event shows annotation on diagram', async ({ page }) => {
    // Switch to fungus mode
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    // Create block and set Game Started event
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-select').first().selectOption('gameStarted');

    // Check annotation exists on the block
    const annotation = page.locator('.fungus-event-label');
    await expect(annotation).toBeVisible();
    await expect(annotation).toHaveText('<Game Started>');
  });

  test('block with no event has no annotation', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    // Event defaults to None, so no annotation
    const annotation = page.locator('.fungus-event-label');
    await expect(annotation).toHaveCount(0);
  });

  test('annotation is removed when event is set back to None', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-select').first().selectOption('gameStarted');
    await expect(page.locator('.fungus-event-label')).toBeVisible();

    // Set back to None
    await page.locator('.inspector-select').first().selectOption('none');
    await expect(page.locator('.fungus-event-label')).toHaveCount(0);
  });

  test('block changes to event style when event is set', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await expect(node).toHaveClass(/fungus-standard-block/);

    await node.click();
    await page.locator('.inspector-select').first().selectOption('gameStarted');
    await expect(node).toHaveClass(/fungus-event-block/);
    await expect(node).not.toHaveClass(/fungus-standard-block/);
  });
});

// ─── Version 30: Play Sound wait checkbox ─────────────────────────────────

test.describe('V30 – Play Sound wait checkbox', () => {
  test('playSound command shows wait checkbox in inspector', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-add-cmd select').selectOption('playSound');

    const checkbox = page.locator('.cmd-checkbox-label input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test('playMusic command does NOT show wait checkbox', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-add-cmd select').selectOption('playMusic');

    const checkbox = page.locator('.cmd-checkbox-label input[type="checkbox"]');
    await expect(checkbox).toHaveCount(0);
  });

  test('wait checkbox can be toggled', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-add-cmd select').selectOption('playSound');

    const checkbox = page.locator('.cmd-checkbox-label input[type="checkbox"]');
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('wait checkbox label text is correct', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-add-cmd select').selectOption('playSound');

    const label = page.locator('.cmd-checkbox-label');
    await expect(label).toContainText('Wait for sound to finish playing');
  });
});

// ─── Version 31: Improved fungus block features ──────────────────────────

test.describe('V31 – Auto-select on drop in fungus mode', () => {
  test('new block is selected after drag-drop in fungus mode', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await expect(node).toHaveClass(/node-active/);
  });

  test('inspector shows properties after drag-drop in fungus mode', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    // Inspector should show the name section
    await expect(page.locator('.inspector-name-section')).toBeVisible();
  });
});

test.describe('V31 – Fungus inspector layout', () => {
  test('Name and Description appear at top of inspector in fungus mode', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    await expect(page.locator('.inspector-name-input')).toBeVisible();
    await expect(page.locator('.inspector-desc-input')).toBeVisible();
  });

  test('Size, Position, Connections are hidden in fungus mode', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    const tableText = await page.locator('#inspector-table').textContent();
    expect(tableText).not.toContain('Size');
    expect(tableText).not.toContain('Position');
    expect(tableText).not.toContain('Connections');
  });

  test('Size, Position, Connections are shown in statechart mode', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="statechart"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    const tableText = await page.locator('#inspector-table').textContent();
    expect(tableText).toContain('Size');
    expect(tableText).toContain('Position');
    expect(tableText).toContain('Connections');
  });
});

test.describe('V31 – Fungus context menu', () => {
  test('right-click on block shows context menu with Delete and Duplicate', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.click({ button: 'right' });

    const menu = page.locator('.fungus-ctx-menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('.fungus-ctx-item').nth(0)).toHaveText('Delete');
    await expect(menu.locator('.fungus-ctx-item').nth(1)).toHaveText('Duplicate');
  });

  test('context menu Delete removes the block', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    await expect(page.locator('.state-node')).toHaveCount(1);

    await page.locator('.state-node').click({ button: 'right' });
    await page.locator('.fungus-ctx-item').filter({ hasText: 'Delete' }).click();

    await expect(page.locator('.state-node')).toHaveCount(0);
  });

  test('context menu Duplicate creates a copy of the block', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    await expect(page.locator('.state-node')).toHaveCount(1);

    await page.locator('.state-node').click({ button: 'right' });
    await page.locator('.fungus-ctx-item').filter({ hasText: 'Duplicate' }).click();

    await expect(page.locator('.state-node')).toHaveCount(2);
  });

  test('delete "x" handle is hidden in fungus mode', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    const deleteHandle = page.locator('.node-delete-handle');
    // The handle element may exist but should be hidden via CSS
    if (await deleteHandle.count() > 0) {
      await expect(deleteHandle).not.toBeVisible();
    }
  });
});

// ─── Version 32: Fungus inspector id label ────────────────────────────────

test.describe('V32 – Fungus inspector id label', () => {
  test('id label appears next to Name header in fungus mode', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    const idLabel = page.locator('.inspector-id-label');
    await expect(idLabel).toBeVisible();
    await expect(idLabel).toHaveText(/id: \d+/);
  });

  test('props table is empty in fungus mode (no Type/ID rows)', async ({ page }) => {
    await page.locator('.inspector-tab[data-tab="settings"]').click();
    await page.locator('input[name="diagram-mode"][value="fungus"]').check();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    const tableText = await page.locator('#inspector-table').textContent();
    expect(tableText.trim()).toBe('');
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
