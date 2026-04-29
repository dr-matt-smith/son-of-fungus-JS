import { test, expect } from '@playwright/test';
import { dragNewNode, drag, getNodeBox } from './helpers.js';

// Helper: add a command via the search popup (matches exact label)
async function addCommand(page, cmdLabel) {
  await page.locator('.cmd-action-btn.cmd-action-add').click();
  await page.locator('.cmd-search-input').fill(cmdLabel);
  // Click the item whose label exactly matches
  const items = page.locator('.cmd-search-item');
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const label = await items.nth(i).locator('.cmd-search-label').textContent();
    if (label === cmdLabel) { await items.nth(i).click(); return; }
  }
  // Fallback: click first match
  await items.first().click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Expand all collapsed data sections
  await page.evaluate(() => {
    document.querySelectorAll('.data-section.collapsed').forEach(s => {
      s.classList.remove('collapsed');
      const t = s.querySelector('.data-section-toggle');
      if (t) t.textContent = '−';
    });
  });
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
    await expect(nameInput).toHaveValue(/New Block/);
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

// ─── Version 23: Inspector/Events tabs and Settings cog ──────────────────

test.describe('V23 – Inspector and Settings cog', () => {
  test('inspector tab is visible', async ({ page }) => {
    await expect(page.locator('.inspector-tab[data-tab="inspector"]')).toBeVisible();
  });

  test('settings cog button is visible', async ({ page }) => {
    await expect(page.locator('#btn-settings-cog')).toBeVisible();
  });

  test('inspector tab is active by default', async ({ page }) => {
    await expect(page.locator('.inspector-tab[data-tab="inspector"]')).toHaveClass(/active/);
  });

  test('clicking settings cog shows settings panel and hides tabs', async ({ page }) => {
    await page.locator('#btn-settings-cog').click();
    await expect(page.locator('#settings-panel')).toBeVisible();
    await expect(page.locator('#inspector-panel')).toBeHidden();
    await expect(page.locator('#inspector-tabs')).toBeHidden();
  });

  test('close settings button restores tabs and inspector', async ({ page }) => {
    await page.locator('#btn-settings-cog').click();
    await page.locator('#btn-close-settings').click();
    await expect(page.locator('#inspector-panel')).toBeVisible();
    await expect(page.locator('#settings-panel')).toBeHidden();
    await expect(page.locator('#inspector-tabs')).toBeVisible();
  });
});

// ─── Version 24: Inspector cleanup, Export JSON move ────────────────────────

test.describe('V24 – Inspector clears on deselect/delete', () => {
  test('inspector shows "No object selected" after node is deleted', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.click();
    await expect(page.locator('#inspector-props')).toBeVisible();

    // Delete the node via right-click context menu
    await node.click({ button: 'right' });
    await page.locator('.fungus-ctx-item').filter({ hasText: 'Delete' }).click();
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

// ─── Version 25: Step-by-step execution ─────────────────────────────────

test.describe('V25 – Step-by-step execution', () => {
  test('Step button is visible', async ({ page }) => {
    await expect(page.locator('#btn-play-step')).toBeVisible();
  });

  test('Play button shows "Play"', async ({ page }) => {
    await expect(page.locator('#play-label')).toHaveText('Play');
  });

  test('clicking Step starts execution and shows Next/Stop buttons', async ({ page }) => {
    // Create a block with a Game Started event and a Say command
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.click();

    // Set event to Game Started
    await page.locator('.inspector-event-select').selectOption('gameStarted');

    // Add a Say command
    await addCommand(page, 'Say');

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

// ─── Version 26: JSON copy ──────────────────────────────────────────────

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
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    await addCommand(page, 'Say');

    // Deselect and play
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);
    await page.locator('#btn-play').click();
    await page.waitForTimeout(1500);
    // Click Say next button if visible
    if (await page.locator('.say-dialog-next').count() > 0) await page.locator('.say-dialog-next').click();
    await page.waitForTimeout(500);

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
    await addCommand(page, 'Play Sound');

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
    await addCommand(page, 'Play Music');

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
    // Create block with Game Started + Say
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    await addCommand(page, 'Say');

    // Deselect and play
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);
    await page.locator('#btn-play').click();
    await page.waitForTimeout(1500);
    // Click Say next button if visible
    if (await page.locator('.say-dialog-next').count() > 0) await page.locator('.say-dialog-next').click();
    await page.waitForTimeout(500);

    // Check run log
    await page.locator('#btn-run-log').click();
    const logText = await page.locator('#json-modal-body pre').textContent();
    expect(logText).toContain('*Enter block*:');
  });

  test('run log command entries are prefixed with id and block name', async ({ page }) => {
    // Create block with Game Started + Say
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    await addCommand(page, 'Say');

    // Deselect and play
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);
    await page.locator('#btn-play').click();
    await page.waitForTimeout(1500);
    // Click Say next button if visible
    if (await page.locator('.say-dialog-next').count() > 0) await page.locator('.say-dialog-next').click();
    await page.waitForTimeout(500);
    // Stop to return to editor and check log
    if (await page.locator('#btn-stop').isVisible()) await page.locator('#btn-stop').click();

    // Check run log has id: name: prefix on Say command
    await page.locator('#btn-run-log').click();
    const logText = await page.locator('#json-modal-body pre').textContent();
    expect(logText).toMatch(/Block \d+ ".+": Say:/);
  });

  test('execution started line is NOT prefixed with id', async ({ page }) => {
    // Create block with Game Started (no commands)
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');

    // Deselect and play
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);
    await page.locator('#btn-play').click();
    await page.waitForTimeout(1500);
    // Click Say next button if visible
    if (await page.locator('.say-dialog-next').count() > 0) await page.locator('.say-dialog-next').click();
    await page.waitForTimeout(500);

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
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await expect(node).toHaveClass(/fungus-standard-block/);
  });

  test('new block does NOT have event or branching class initially', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await expect(node).not.toHaveClass(/fungus-event-block/);
    await expect(node).not.toHaveClass(/fungus-branching-block/);
  });
});

test.describe('V29 – Fungus event annotation', () => {
  test('block with Game Started event shows annotation on diagram', async ({ page }) => {
    // Create block and set Game Started event
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');

    // Check annotation exists on the block
    const annotation = page.locator('.fungus-event-label');
    await expect(annotation).toBeVisible();
    await expect(annotation).toHaveText('<Game Started>');
  });

  test('block with no event has no annotation', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    // Event defaults to None, so no annotation
    const annotation = page.locator('.fungus-event-label');
    await expect(annotation).toHaveCount(0);
  });

  test('annotation is removed when event is set back to None', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    await expect(page.locator('.fungus-event-label')).toBeVisible();

    // Set back to None
    await page.locator('.inspector-event-select').selectOption('none');
    await expect(page.locator('.fungus-event-label')).toHaveCount(0);
  });

  test('block changes to event style when event is set', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await expect(node).toHaveClass(/fungus-standard-block/);

    await node.click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    await expect(node).toHaveClass(/fungus-event-block/);
    await expect(node).not.toHaveClass(/fungus-standard-block/);
  });
});

// ─── Version 30: Play Sound wait checkbox ─────────────────────────────────

test.describe('V30 – Play Sound wait checkbox', () => {
  test('playSound command shows wait checkbox in inspector', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Play Sound');

    const checkbox = page.locator('.cmd-checkbox-label input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test('playMusic command does NOT show wait checkbox', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Play Music');

    const checkbox = page.locator('.cmd-checkbox-label input[type="checkbox"]');
    await expect(checkbox).toHaveCount(0);
  });

  test('wait checkbox can be toggled', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Play Sound');

    const checkbox = page.locator('.cmd-checkbox-label input[type="checkbox"]');
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('wait checkbox label text is correct', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Play Sound');

    const label = page.locator('.cmd-checkbox-label');
    await expect(label).toContainText('Wait for sound to finish playing');
  });
});

// ─── Version 31: Improved fungus block features ──────────────────────────

test.describe('V31 – Auto-select on drop in fungus mode', () => {
  test('new block is selected after drag-drop in fungus mode', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await expect(node).toHaveClass(/node-active/);
  });

  test('inspector shows properties after drag-drop in fungus mode', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    // Inspector should show the name section
    await expect(page.locator('.inspector-name-section')).toBeVisible();
  });
});

test.describe('V31 – Fungus inspector layout', () => {
  test('Name and Description appear at top of inspector in fungus mode', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    await expect(page.locator('.inspector-name-input')).toBeVisible();
    await expect(page.locator('.inspector-desc-input')).toBeVisible();
  });

  test('Size, Position, Connections are hidden in fungus mode', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    const tableText = await page.locator('#inspector-table').textContent();
    expect(tableText).not.toContain('Size');
    expect(tableText).not.toContain('Position');
    expect(tableText).not.toContain('Connections');
  });
});

test.describe('V31 – Fungus context menu', () => {
  test('right-click on block shows context menu with Delete and Duplicate', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const node = page.locator('.state-node');
    await node.click({ button: 'right' });

    const menu = page.locator('.fungus-ctx-menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('.fungus-ctx-item').nth(0)).toHaveText('Delete');
    await expect(menu.locator('.fungus-ctx-item').nth(1)).toHaveText('Duplicate');
  });

  test('context menu Delete removes the block', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await expect(page.locator('.state-node')).toHaveCount(1);

    await page.locator('.state-node').click({ button: 'right' });
    await page.locator('.fungus-ctx-item').filter({ hasText: 'Delete' }).click();

    await expect(page.locator('.state-node')).toHaveCount(0);
  });

  test('context menu Duplicate creates a copy of the block', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await expect(page.locator('.state-node')).toHaveCount(1);

    await page.locator('.state-node').click({ button: 'right' });
    await page.locator('.fungus-ctx-item').filter({ hasText: 'Duplicate' }).click();

    await expect(page.locator('.state-node')).toHaveCount(2);
  });

  test('delete "x" handle is hidden in fungus mode', async ({ page }) => {
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
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    const idLabel = page.locator('.inspector-id-label');
    await expect(idLabel).toBeVisible();
    await expect(idLabel).toHaveText(/id: \d+/);
  });

  test('props table is empty in fungus mode (no Type/ID rows)', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    const tableText = await page.locator('#inspector-table').textContent();
    expect(tableText.trim()).toBe('');
  });
});

// ─── Version 33: Event label & description on stage ──────────────────────

test.describe('V33 – Execute on Event label', () => {
  test('fungus mode shows "Execute on Event" label with inline dropdown', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    const eventRow = page.locator('.inspector-event-row');
    await expect(eventRow).toBeVisible();
    await expect(eventRow.locator('.inspector-section-title')).toHaveText('Execute on Event');
    await expect(eventRow.locator('.inspector-event-select')).toBeVisible();
  });
});

test.describe('V33 – Description on stage', () => {
  test('description appears below block when typed in inspector', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    const descInput = page.locator('.inspector-desc-input');
    await descInput.fill('My block description');

    const descLabel = page.locator('.fungus-desc-label');
    await expect(descLabel).toBeVisible();
    await expect(descLabel).toHaveText('My block description');
  });

  test('no description label when description is empty', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    await expect(page.locator('.fungus-desc-label')).toHaveCount(0);
  });
});

// ─── Version 34: Minimap inside canvas area ──────────────────────────────

test.describe('V34 – Minimap in canvas area', () => {
  test('minimap is inside canvas-container', async ({ page }) => {
    const minimap = page.locator('#canvas-container #minimap');
    await expect(minimap).toBeVisible();
  });

  test('minimap does not overlap inspector panel', async ({ page }) => {
    const minimapBox = await page.locator('#minimap').boundingBox();
    const inspectorBox = await page.locator('#inspector').boundingBox();
    // Minimap right edge should be to the left of the inspector left edge
    expect(minimapBox.x + minimapBox.width).toBeLessThanOrEqual(inspectorBox.x + 1);
  });

  test('minimap-restore button is inside canvas-container', async ({ page }) => {
    const restoreBtn = page.locator('#canvas-container #minimap-restore');
    // It exists in DOM (hidden by default)
    await expect(restoreBtn).toHaveCount(1);
  });
});

// ─── Version 35: ID labels, Messages tab, message dropdowns ──────────────

test.describe('V35 – Node ID label', () => {
  test('blocks show id label at top right', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    const idLabel = page.locator('.state-node .node-id-label');
    await expect(idLabel).toBeVisible();
    await expect(idLabel).toHaveText(/id: \d+/);
  });
});

test.describe('V35 – Messages (Events) panel', () => {
  test('messages panel is visible in data panel', async ({ page }) => {
    await expect(page.locator('#messages-panel')).toBeVisible();
  });

  test('can add a message via input and button', async ({ page }) => {

    await page.locator('#messages-new-input').fill('testMessage');
    await page.locator('#messages-add-btn').click();

    const items = page.locator('.messages-item');
    await expect(items).toHaveCount(1);
    const input = items.first().locator('input');
    await expect(input).toHaveValue('testMessage');
  });

  test('can delete a message', async ({ page }) => {

    await page.locator('#messages-new-input').fill('msg1');
    await page.locator('#messages-add-btn').click();
    await expect(page.locator('.messages-item')).toHaveCount(1);

    await page.locator('.messages-delete-btn').click();
    await expect(page.locator('.messages-item')).toHaveCount(0);
  });
});

test.describe('V35 – Send Message dropdown', () => {
  test('sendMessage command shows dropdown with defined messages', async ({ page }) => {
    // Add a message first

    await page.locator('#messages-new-input').fill('hello');
    await page.locator('#messages-add-btn').click();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    // Create block with sendMessage command
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Send Message');

    // Check the message dropdown has the defined message
    const msgSelect = page.locator('.cmd-field select');
    const options = await msgSelect.locator('option').allTextContents();
    expect(options).toContain('hello');
  });
});

test.describe('V35 – Message Received annotation', () => {
  test('Message Received block shows message name on diagram', async ({ page }) => {
    // Add message

    await page.locator('#messages-new-input').fill('myEvent');
    await page.locator('#messages-add-btn').click();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    // Create block with Message Received event
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('messageReceived');
    // Select the message from dropdown
    await page.locator('.cmd-field select').first().selectOption('myEvent');

    // Check annotation on diagram
    const annotation = page.locator('.fungus-event-label');
    await expect(annotation).toContainText('<Message Received>');
    await expect(annotation).toContainText('"myEvent"');
  });
});

// ─── Version 36: Command summary list & editor ──────────────────────────

test.describe('V36 – Fungus command summary list', () => {
  test('commands appear as summary rows in fungus mode', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Say');

    const summaries = page.locator('.fungus-cmd-summary');
    await expect(summaries).toHaveCount(1);
    await expect(summaries.first()).toContainText('Say');
  });

  test('clicking summary row highlights it green and shows editor', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Say');

    // The newly added command should auto-select
    await expect(page.locator('.fungus-cmd-selected')).toHaveCount(1);
    await expect(page.locator('.fungus-cmd-editor')).toBeVisible();
  });

  test('editor shows fields for the selected command', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Say');

    // Editor should show character, text, checkboxes, and audio fields
    const fields = page.locator('.fungus-cmd-editor .cmd-field');
    await expect(fields).toHaveCount(6); // character, text, wait-for-next, typing-anim, typing-audio, typing-sound
  });
});

// ─── Version 37: Command summary row refinement ─────────────────────────

test.describe('V37 – Command summary row layout', () => {
  test('summary rows have verb and detail columns', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Say');

    const verb = page.locator('.fungus-cmd-verb');
    await expect(verb).toHaveText('Say');
    const detail = page.locator('.fungus-cmd-detail');
    await expect(detail).toBeVisible();
  });

  test('summary rows have drag handles', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Say');
    await addCommand(page, 'Wait');

    const handles = page.locator('.fungus-cmd-drag-handle');
    await expect(handles.first()).toBeVisible();
  });

  test('command action bar has action buttons', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    // Use action bar + button to add a command via search
    await page.locator('.cmd-action-btn.cmd-action-add').click();
    await page.locator('.cmd-search-input').fill('say');
    await page.locator('.cmd-search-item').first().click();

    const actionBtns = page.locator('.cmd-action-bar .cmd-action-btn');
    await expect(actionBtns).toHaveCount(5); // up, down, +, dup, delete
  });
});

// ─── Version 39: Variables tab ────────────────────────────────────────────

test.describe('V39 – Variables panel', () => {
  test('variables panel is visible in data panel', async ({ page }) => {
    await expect(page.locator('#variables-panel')).toBeVisible();
  });

  test('can add a variable', async ({ page }) => {

    await page.locator('#variables-new-name').fill('score');
    await page.locator('#variables-add-btn').click();

    const items = page.locator('.variable-wrapper');
    await expect(items).toHaveCount(1);
    const nameInput = items.first().locator('.variable-name-input');
    await expect(nameInput).toHaveValue('score');
  });

  test('can change variable type', async ({ page }) => {

    await page.locator('#variables-new-name').fill('count');
    await page.locator('#variables-add-btn').click();

    const typeSelect = page.locator('.variable-wrapper .variable-type-select');
    await typeSelect.selectOption('Integer');
    await expect(typeSelect).toHaveValue('Integer');
  });

  test('Boolean variable shows checkbox', async ({ page }) => {

    await page.locator('#variables-new-name').fill('flag');
    await page.locator('#variables-add-btn').click();

    await page.locator('.variable-wrapper .variable-type-select').selectOption('Boolean');
    const cb = page.locator('.variable-value-checkbox');
    await expect(cb).toBeVisible();
  });

  test('can delete a variable', async ({ page }) => {

    await page.locator('#variables-new-name').fill('temp');
    await page.locator('#variables-add-btn').click();
    await expect(page.locator('.variable-wrapper')).toHaveCount(1);

    await page.locator('.variable-item .messages-delete-btn').click();
    await expect(page.locator('.variable-wrapper')).toHaveCount(0);
  });
});

// ─── Version 40: Enums ───────────────────────────────────────────────────

test.describe('V40 – Enums panel', () => {
  test('enums panel is visible in data panel', async ({ page }) => {
    await expect(page.locator('#enums-panel')).toBeVisible();
  });

  test('can add an enum set', async ({ page }) => {

    await page.locator('#enums-new-name').fill('Colors');
    await page.locator('#enums-add-btn').click();

    await expect(page.locator('.enum-card')).toHaveCount(1);
    await expect(page.locator('.enum-name-input')).toHaveValue('Colors');
  });

  test('can add enum values with key and label', async ({ page }) => {

    await page.locator('#enums-new-name').fill('Sizes');
    await page.locator('#enums-add-btn').click();

    // Add a value
    await page.locator('.enum-card .cmd-btn').click();
    await expect(page.locator('.enum-value-row').filter({ has: page.locator('.enum-key-input') })).toHaveCount(1);
  });

  test('can delete an enum set', async ({ page }) => {

    await page.locator('#enums-new-name').fill('Temp');
    await page.locator('#enums-add-btn').click();
    await expect(page.locator('.enum-card')).toHaveCount(1);

    await page.locator('.enum-card-header .messages-delete-btn').click();
    await expect(page.locator('.enum-card')).toHaveCount(0);
  });
});

// ─── Version 41: Set Variable commands ───────────────────────────────────

test.describe('V41 – Set Variable (value) command', () => {
  test('setVarValue command can be added to a block', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Set Variable');

    const verb = page.locator('.fungus-cmd-verb');
    await expect(verb).toHaveText('Set Variable');
  });

  test('setVarValue editor shows variable dropdown when variables exist', async ({ page }) => {
    // Add a variable first

    await page.locator('#variables-new-name').fill('score');
    await page.locator('#variables-add-btn').click();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Set Variable');

    // Editor should show variable select
    const editor = page.locator('.fungus-cmd-editor');
    const selects = editor.locator('select');
    await expect(selects.first()).toBeVisible();
  });
});

test.describe('V41 – Set Variable (copy) command', () => {
  test('setVarCopy command can be added to a block', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Copy Variable');

    const verb = page.locator('.fungus-cmd-verb');
    await expect(verb).toHaveText('Copy Variable');
  });

  test('setVarCopy editor shows two variable dropdowns', async ({ page }) => {
    // Add variables

    await page.locator('#variables-new-name').fill('a');
    await page.locator('#variables-add-btn').click();
    await page.locator('#variables-new-name').fill('b');
    await page.locator('#variables-add-btn').click();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Copy Variable');

    const editor = page.locator('.fungus-cmd-editor');
    const selects = editor.locator('.cmd-field select');
    await expect(selects).toHaveCount(2);
  });
});

// ─── Version 42: Light/Dark theme ────────────────────────────────────────

test.describe('V42 – Theme toggle', () => {
  test('theme radio buttons exist in settings', async ({ page }) => {
    await page.locator('#btn-settings-cog').click();
    const radios = page.locator('input[name="theme"]');
    await expect(radios).toHaveCount(2);
  });

  test('light is the default theme', async ({ page }) => {
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('light');
  });

  test('selecting dark theme removes data-theme', async ({ page }) => {
    await page.locator('#btn-settings-cog').click();
    await page.locator('input[name="theme"][value="dark"]').check();
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBeNull();
  });

  test('light theme body has lighter background by default', async ({ page }) => {
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe('rgb(17, 24, 39)');
  });
});

// ─── Version 43: Command color coding ────────────────────────────────────

test.describe('V43 – Command color coding', () => {
  test('say command row has fungus-cmd-say class', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Say');

    await expect(page.locator('.fungus-cmd-say')).toHaveCount(1);
  });

  test('different commands get different color classes', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Say');
    await addCommand(page, 'Wait');

    await expect(page.locator('.fungus-cmd-say')).toHaveCount(1);
    await expect(page.locator('.fungus-cmd-wait')).toHaveCount(1);
  });
});

// ─── Version 45: IF / END-IF commands ────────────────────────────────────

test.describe('V45 – IF / END-IF', () => {
  test('adding IF does NOT auto-insert End', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'If');

    const summaries = page.locator('.fungus-cmd-summary');
    await expect(summaries).toHaveCount(1);
    await expect(summaries.nth(0).locator('.fungus-cmd-verb')).toHaveText('If');
  });

  test('End, Else-If, Else are available in command search', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    await page.locator('.cmd-action-btn.cmd-action-add').click();
    await page.locator('.cmd-search-input').fill('');
    const items = await page.locator('.cmd-search-item .cmd-search-label').allTextContents();
    expect(items).toContain('End');
    expect(items).toContain('Else-If');
    expect(items).toContain('Else');
    await page.keyboard.press('Escape');
  });

  test('IF and End can be added separately', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();

    await addCommand(page, 'If');
    await addCommand(page, 'End');
    await expect(page.locator('.fungus-cmd-ifCondition')).toHaveCount(1);
    await expect(page.locator('.fungus-cmd-endIf')).toHaveCount(1);
  });

  test('IF editor shows variable, operator and value fields', async ({ page }) => {
    // Add a variable first

    await page.locator('#variables-new-name').fill('score');
    await page.locator('#variables-add-btn').click();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'If');

    // IF should auto-select, editor should be visible
    const editor = page.locator('.fungus-cmd-editor');
    await expect(editor).toBeVisible();
    // Should have selects for variable, operator, compare type
    const selects = editor.locator('.cmd-field select');
    await expect(selects).toHaveCount(3); // variable, operator, compare-to
  });
});

// ─── Version 46: ELSE-IF, ELSE, AND/OR ───────────────────────────────────

test.describe('V46/V61 – ELSE-IF and ELSE via search', () => {
  test('Else-If can be added via command search', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'If');
    await addCommand(page, 'Else-If');

    await expect(page.locator('.fungus-cmd-elseIf')).toHaveCount(1);
  });

  test('Else can be added via command search', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'If');
    await addCommand(page, 'Else');

    await expect(page.locator('.fungus-cmd-elseCmd')).toHaveCount(1);
  });

  test('End can be added via command search', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'If');
    await addCommand(page, 'End');

    await expect(page.locator('.fungus-cmd-endIf')).toHaveCount(1);
  });

  test('IF editor has + AND/OR condition button', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'If');

    const editor = page.locator('.fungus-cmd-editor');
    await expect(editor.locator('.cmd-btn').filter({ hasText: '+ AND/OR' })).toBeVisible();
  });
});

// ─── Version 47: Variable initialisation in Run Log ──────────────────────

test.describe('V47 – Variable init in Run Log', () => {
  test('run log shows variable values before execution started', async ({ page }) => {
    // Add a variable

    await page.locator('#variables-new-name').fill('health');
    await page.locator('#variables-add-btn').click();
    await page.locator('.inspector-tab[data-tab="inspector"]').click();

    // Create block with Game Started
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');

    // Deselect and play
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);
    await page.locator('#btn-play').click();
    await page.waitForTimeout(1500);
    // Click Say next button if visible
    if (await page.locator('.say-dialog-next').count() > 0) await page.locator('.say-dialog-next').click();
    await page.waitForTimeout(500);

    // Check run log
    await page.locator('#btn-run-log').click();
    const logText = await page.locator('#json-modal-body pre').textContent();
    expect(logText).toContain('initialisation');
    expect(logText).toContain('health');
    // Initialisation should come before Execution started
    const initPos = logText.indexOf('initialisation');
    const startPos = logText.indexOf('Execution started');
    expect(initPos).toBeLessThan(startPos);
  });
});

// ─── Keyboard shortcuts ────────────────────────────────────────────────────

// ─── Version 49: Zoom toolbar in canvas ──────────────────────────────────

test.describe('V49 – Zoom toolbar in canvas', () => {
  test('zoom toolbar is inside canvas-container', async ({ page }) => {
    const toolbar = page.locator('#canvas-container #zoom-toolbar');
    await expect(toolbar).toBeVisible();
  });

  test('data expand button shows "Data" text', async ({ page }) => {
    // Collapse data panel
    await page.locator('#btn-collapse-data').click();
    const expandBtn = page.locator('#btn-expand-data');
    await expect(expandBtn).toBeVisible();
    await expect(expandBtn).toContainText('Data');
  });
});

// ─── Version 50/57: Load Project ────────────────────────────────────────────

test.describe('V57 – Load Project', () => {
  test('Load Project button is visible', async ({ page }) => {
    await expect(page.locator('#btn-load-json')).toBeVisible();
    await expect(page.locator('#btn-load-json')).toContainText('Load Project');
  });

  test('clicking Load Project shows modal with three sections', async ({ page }) => {
    await page.locator('#btn-load-json').click();
    await expect(page.locator('#json-modal-overlay')).toBeVisible();
    // Three sections: examples, file, paste
    await expect(page.locator('.load-section')).toHaveCount(3);
    await expect(page.locator('#load-example-select')).toBeVisible();
    await expect(page.locator('#load-file-input')).toBeVisible();
    await expect(page.locator('#json-load-input')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('examples dropdown has options', async ({ page }) => {
    await page.locator('#btn-load-json').click();
    const options = await page.locator('#load-example-select option').allTextContents();
    expect(options.length).toBeGreaterThan(1); // at least "— select —" + one example
    await page.keyboard.press('Escape');
  });

  test('invalid pasted JSON shows error', async ({ page }) => {
    await page.locator('#btn-load-json').click();
    await page.locator('#json-load-input').fill('not json');
    await page.locator('#load-paste-btn').click();
    await expect(page.locator('#json-load-error')).toContainText('Invalid JSON');
    await page.keyboard.press('Escape');
  });
});

// ─── Version 51: Debug mode ──────────────────────────────────────────────

test.describe('V51 – Debug mode', () => {
  test('Play button shows "Play"', async ({ page }) => {
    await expect(page.locator('#play-label')).toHaveText('Play');
  });

  test('Debug button is visible and labeled', async ({ page }) => {
    await expect(page.locator('#btn-play-step')).toBeVisible();
    await expect(page.locator('#btn-play-step')).toContainText('Debug');
  });

  test('debug status bar appears when Debug is clicked', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    await addCommand(page, 'Say');

    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);

    await page.locator('#btn-play-step').click();
    await page.waitForTimeout(500);

    await expect(page.locator('#debug-status-bar')).toBeVisible();

    await page.locator('#btn-stop').click();
    await expect(page.locator('#debug-status-bar')).toBeHidden();
  });

  test('Enums and Events hidden, Variables visible in debug mode', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    await addCommand(page, 'Say');

    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);

    await page.locator('#btn-play-step').click();
    await page.waitForTimeout(500);

    await expect(page.locator('#data-enums')).toBeHidden();
    await expect(page.locator('#data-events')).toBeHidden();
    await expect(page.locator('#data-variables')).toBeVisible();

    await page.locator('#btn-stop').click();
  });
});

// ─── Version 53: Enhanced debug stepping ────────────────────────────────

test.describe('V53 – Debug pauses at every step', () => {
  test('debug pauses on variable initialisation', async ({ page }) => {
    // Add a variable
    await page.locator('#variables-new-name').fill('score');
    await page.locator('#variables-add-btn').click();

    // Create block with Game Started
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');

    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);

    // Start debug
    await page.locator('#btn-play-step').click();
    await page.waitForTimeout(500);

    // Should be paused on variable init
    const statusText = await page.locator('#debug-status-text').textContent();
    expect(statusText).toContain('DEBUG run:');
    expect(statusText).toContain('initialisation');

    await page.locator('#btn-stop').click();
  });

  test('debug pauses on block entry', async ({ page }) => {
    // Create block with Game Started + Say (no variables)
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    await addCommand(page, 'Say');

    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);

    // Start debug
    await page.locator('#btn-play-step').click();
    await page.waitForTimeout(500);

    // First pause should be on "Execution started"
    let statusText = await page.locator('#debug-status-text').textContent();
    expect(statusText).toContain('Execution started');

    // Step to block entry
    await page.locator('#btn-step-continue').click();
    await page.waitForTimeout(300);

    statusText = await page.locator('#debug-status-text').textContent();
    expect(statusText).toContain('Enter block');

    await page.locator('#btn-stop').click();
  });
});

// ─── Version 55: Run stage ───────────────────────────────────────────────

test.describe('V55 – Run stage', () => {
  test('Play hides main area and shows run stage', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    // Add a wait command so execution doesn't finish instantly
    await addCommand(page, 'Wait');

    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);

    await page.locator('#btn-play').click();
    // run-stage should be visible while running
    await expect(page.locator('#run-stage')).toBeVisible();
    await expect(page.locator('#main-area')).toBeHidden();

    // Stop before wait finishes
    await page.locator('#btn-stop').click();
    await expect(page.locator('#run-stage')).toBeHidden();
    await expect(page.locator('#main-area')).toBeVisible();
  });

  test('stageBgColor command can be added', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Stage BG Color');

    const verb = page.locator('.fungus-cmd-verb');
    await expect(verb).toHaveText('Stage BG Color');
  });

  test('stageBgImage command shows image dropdown', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Stage BG Image');

    // Select the command to show editor
    const editor = page.locator('.fungus-cmd-editor');
    await expect(editor).toBeVisible();
    const imgSelect = editor.locator('.cmd-field select');
    await expect(imgSelect).toBeVisible();
    const options = await imgSelect.locator('option').allTextContents();
    expect(options.some(o => o.includes('FungusTown'))).toBe(true);
  });
});

// ─── Version 56: Build runtime ──────────────────────────────────────────

test.describe('V56 – Build runtime', () => {
  test('Build button is visible', async ({ page }) => {
    await expect(page.locator('#btn-build')).toBeVisible();
  });

  test('clicking Build triggers a download', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');

    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-build').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('flowchart-runtime.zip');
  });
});

// ─── Version 72: Data panel row height bars ───────────────────────────────

test.describe('V72 – Data panel row resize bars', () => {
  test('divider between collapsed sections has no row-resize cursor effect', async ({ page }) => {
    // Collapse all sections
    await page.evaluate(() => {
      document.querySelectorAll('.data-section').forEach(s => {
        s.classList.add('collapsed');
        const t = s.querySelector('.data-section-toggle');
        if (t) t.textContent = '+';
      });
    });
    // Try to mousedown on a divider between collapsed sections
    const divider = page.locator('#data-panel-body > .data-section-divider').first();
    await expect(divider).toBeVisible();
    // After mousedown on divider between collapsed sections, body cursor should NOT be row-resize
    const box = await divider.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const cursor = await page.evaluate(() => document.body.style.cursor);
    expect(cursor).not.toBe('row-resize');
    await page.mouse.up();
  });

  test('static dividers are hidden in debug mode', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    await addCommand(page, 'Say');

    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);

    await page.locator('#btn-play-step').click();
    await page.waitForTimeout(500);

    // All static dividers should be hidden
    const staticDividers = page.locator('#data-panel-body > .data-section-divider:not(#debug-stage-divider)');
    const count = await staticDividers.count();
    for (let i = 0; i < count; i++) {
      await expect(staticDividers.nth(i)).toBeHidden();
    }

    await page.locator('#btn-stop').click();
  });

  test('debug stage divider is visible and resizable in debug mode', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    await addCommand(page, 'Say');

    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);

    await page.locator('#btn-play-step').click();
    await page.waitForTimeout(500);

    // Debug stage divider and preview should be visible
    await expect(page.locator('#debug-stage-divider')).toBeVisible();
    await expect(page.locator('#debug-stage-preview')).toBeVisible();

    // Drag the debug stage divider to resize
    const divider = page.locator('#debug-stage-divider');
    const divBox = await divider.boundingBox();
    const previewBefore = await page.locator('#debug-stage-preview').boundingBox();

    await page.mouse.move(divBox.x + divBox.width / 2, divBox.y + divBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(divBox.x + divBox.width / 2, divBox.y - 50, { steps: 5 });
    await page.mouse.up();

    const previewAfter = await page.locator('#debug-stage-preview').boundingBox();
    // Preview should have grown (divider moved up)
    expect(previewAfter.height).toBeGreaterThan(previewBefore.height);

    await page.locator('#btn-stop').click();
  });

  test('static dividers are restored after exiting debug mode', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    await addCommand(page, 'Say');

    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);

    await page.locator('#btn-play-step').click();
    await page.waitForTimeout(500);
    await page.locator('#btn-stop').click();
    await page.waitForTimeout(300);

    // Static dividers should be visible again
    const staticDividers = page.locator('#data-panel-body > .data-section-divider');
    const count = await staticDividers.count();
    for (let i = 0; i < count; i++) {
      await expect(staticDividers.nth(i)).toBeVisible();
    }

    // Debug stage divider should be gone
    await expect(page.locator('#debug-stage-divider')).toHaveCount(0);
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

// ─── Version 73: Comment command ──────────────────────────────────────────

test.describe('V73 – Comment command', () => {
  test('Comment appears in command search popup', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.cmd-action-btn.cmd-action-add').click();
    await page.locator('.cmd-search-input').fill('Comment');
    const items = page.locator('.cmd-search-item');
    const labels = await items.locator('.cmd-search-label').allTextContents();
    expect(labels).toContain('Comment');
  });

  test('adding a Comment command shows it in the summary list', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Comment');

    const summaries = page.locator('.fungus-cmd-summary');
    await expect(summaries).toHaveCount(1);
    await expect(summaries.first().locator('.fungus-cmd-verb')).toHaveText('Comment');
  });

  test('Comment editor has Name and Description fields', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Comment');

    // The command should be auto-selected after adding; check for editor fields
    const editor = page.locator('.fungus-cmd-editor');
    await expect(editor).toBeVisible();
    await expect(editor.locator('.cmd-field-label', { hasText: 'Name' })).toBeVisible();
    await expect(editor.locator('.cmd-field-label', { hasText: 'Description' })).toBeVisible();
  });

  test('Comment command does not affect execution', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    await addCommand(page, 'Comment');

    // Deselect and run
    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);
    await page.locator('#btn-play').click();
    await page.waitForTimeout(500);

    // Execution should complete without error
    await page.locator('#btn-run-log').click();
    const logText = await page.locator('#json-modal-body pre').textContent();
    expect(logText).toContain('Execution complete');
    await page.keyboard.press('Escape');
  });
});

// ─── Version 75: Make BG White command ───────────────────────────────────

test.describe('V75 – Make BG White command', () => {
  test('Make BG White appears in command search popup', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.cmd-action-btn.cmd-action-add').click();
    await page.locator('.cmd-search-input').fill('Make BG White');
    const items = page.locator('.cmd-search-item');
    const labels = await items.locator('.cmd-search-label').allTextContents();
    expect(labels).toContain('Make BG White');
  });

  test('adding a Make BG White command shows it in the summary list', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Make BG White');

    const summaries = page.locator('.fungus-cmd-summary');
    await expect(summaries).toHaveCount(1);
    await expect(summaries.first().locator('.fungus-cmd-verb')).toHaveText('Make BG White');
    await expect(summaries.first().locator('.fungus-cmd-detail')).toHaveText('#ffffff');
  });

  test('Make BG White appears in run log when executed', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await page.locator('.inspector-event-select').selectOption('gameStarted');
    await addCommand(page, 'Make BG White');

    const canvas = page.locator('#canvas-container');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);
    await page.locator('#btn-play').click();
    await page.waitForTimeout(500);

    await page.locator('#btn-run-log').click();
    const logText = await page.locator('#json-modal-body pre').textContent();
    expect(logText).toContain('Make BG White');
    expect(logText).toContain('Execution complete');
    await page.keyboard.press('Escape');
  });
});

// ─── Version 74: UI improvements ──────────────────────────────────────────

test.describe('V74 – UI improvements', () => {
  test('page title is "Son of Fungus"', async ({ page }) => {
    await expect(page).toHaveTitle('Son of Fungus');
  });

  test('command detail text is readable (not #9ca3af)', async ({ page }) => {
    await dragNewNode(page, '#btn-new-state');
    await page.locator('.state-node').click();
    await addCommand(page, 'Say');

    const detail = page.locator('.fungus-cmd-detail').first();
    const color = await detail.evaluate(el => getComputedStyle(el).color);
    // #9ca3af = rgb(156, 163, 175) was the old hard-to-read color; #d1d5db was still too dim
    expect(color).not.toBe('rgb(156, 163, 175)');
    expect(color).not.toBe('rgb(209, 213, 219)');
  });
});

// ─── Version 76: Relative asset paths (sub-folder publish) ────────────────

test.describe('V76 – Relative asset paths', () => {
  test('built index.html references CSS via a relative path', async ({ request }) => {
    const resp = await request.get('/index.html');
    expect(resp.ok()).toBe(true);
    const html = await resp.text();
    // Vite's base: './' should emit ./assets/... not /assets/...
    expect(html).toMatch(/href="\.\/assets\/[^"]+\.css"/);
    expect(html).not.toMatch(/href="\/assets\//);
  });

  test('legacy /audio/ and /images/ paths in pasted JSON are normalised on load', async ({ page }) => {
    // Pre-accept the "are you sure?" confirm dialog the loader pops up
    page.on('dialog', d => d.accept());

    const legacyJson = JSON.stringify({
      variables: [], messages: [], enums: [],
      characters: [
        { name: 'Sherlock', color: '#60a5fa', soundUrl: '/audio/defaults/LowVoice.wav', portraits: [
          { description: 'happy', imageUrl: '/images/potraits/Sherlock/happy.png' },
        ] },
      ],
      nodes: [
        { id: 1, type: 'state', x: 100, y: 100, w: 200, h: 100, label: 'Block 1',
          event: { type: 'gameStarted' },
          commands: [
            { type: 'say', text: 'hi', typingAudioUrl: '/audio/defaults/HighVoice.wav' },
            { type: 'playSound', audioUrl: '/audio/die.mp3' },
            { type: 'stageBgImage', imageUrl: '/images/FungusTown_1.png' },
          ] },
      ],
      connections: [],
    });

    await page.locator('#btn-load-json').click();
    await page.locator('#json-load-input').fill(legacyJson);
    await page.locator('#load-paste-btn').click();

    // Round-trip through Export JSON to read the in-memory state
    await page.locator('#btn-export-json').click();
    const exported = await page.locator('#json-modal-body pre').textContent();
    const parsed = JSON.parse(exported);

    expect(parsed.characters[0].soundUrl).toBe('audio/defaults/LowVoice.wav');
    expect(parsed.characters[0].portraits[0].imageUrl).toBe('images/potraits/Sherlock/happy.png');
    const cmds = parsed.nodes[0].commands;
    expect(cmds.find(c => c.type === 'say').typingAudioUrl).toBe('audio/defaults/HighVoice.wav');
    expect(cmds.find(c => c.type === 'playSound').audioUrl).toBe('audio/die.mp3');
    expect(cmds.find(c => c.type === 'stageBgImage').imageUrl).toBe('images/FungusTown_1.png');
  });
});
