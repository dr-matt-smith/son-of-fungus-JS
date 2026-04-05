/**
 * Capture screenshots of the app for documentation.
 * Run with: node docs/capture-screenshots.mjs
 * Requires the dev server to be running on http://localhost:5173
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const OUT = 'docs/images';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(BASE);
  await page.waitForTimeout(500);

  // Helper: drag a new block onto the canvas
  async function dragNewNode(selector, offsetX = 0, offsetY = 0) {
    const btn = page.locator(selector);
    const box = await btn.boundingBox();
    const canvas = page.locator('#canvas-container');
    const cBox = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(cBox.x + cBox.width / 2 + offsetX, cBox.y + cBox.height / 2 + offsetY, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  }

  // Helper: add command via search
  async function addCommand(label) {
    await page.locator('.cmd-action-btn.cmd-action-add').click();
    await page.locator('.cmd-search-input').fill(label);
    const items = page.locator('.cmd-search-item');
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const text = await items.nth(i).locator('.cmd-search-label').textContent();
      if (text === label) { await items.nth(i).click(); return; }
    }
    await items.first().click();
  }

  // 1. Full app overview (light mode - already default)
  await page.screenshot({ path: `${OUT}/app-overview.png` });

  // 2. Create a flowchart with multiple blocks
  // Block 1: Start
  await dragNewNode('#btn-new-state', -150, -50);
  await page.locator('.state-node').first().click();
  await page.locator('.inspector-event-select').selectOption('gameStarted');
  // Rename it
  const nameInput = page.locator('.inspector-name-input');
  await nameInput.fill('Start');
  await addCommand('Say');
  await addCommand('Call');

  // Click away to deselect
  const canvas = page.locator('#canvas-container');
  const cBox = await canvas.boundingBox();
  await page.mouse.click(cBox.x + 50, cBox.y + 50);
  await page.waitForTimeout(200);

  // Block 2
  await dragNewNode('#btn-new-state', 150, -50);
  const nodes = page.locator('.state-node');
  await nodes.nth(1).click();
  const nameInput2 = page.locator('.inspector-name-input');
  await nameInput2.fill('Scene 2');
  await addCommand('Say');
  await addCommand('Wait');

  // Deselect
  await page.mouse.click(cBox.x + 50, cBox.y + 50);
  await page.waitForTimeout(300);

  // 3. Screenshot: flowchart with blocks
  const canvasEl = page.locator('#canvas-container');
  await canvasEl.screenshot({ path: `${OUT}/flowchart-blocks.png` });

  // 4. Select first block - screenshot inspector
  await nodes.first().click();
  await page.waitForTimeout(200);
  const inspector = page.locator('#inspector');
  await inspector.screenshot({ path: `${OUT}/inspector-block.png` });

  // 5. Screenshot: command list with selected command
  await page.locator('.fungus-cmd-summary').first().click();
  await page.waitForTimeout(100);
  await inspector.screenshot({ path: `${OUT}/inspector-command-selected.png` });

  // 6. Screenshot: command search
  await page.locator('.cmd-action-btn.cmd-action-add').click();
  await page.waitForTimeout(200);
  await inspector.screenshot({ path: `${OUT}/command-search.png` });
  await page.keyboard.press('Escape');

  // 7. Screenshot: data panel (Variables/Enums/Events)
  // Add a variable
  await page.locator('#variables-new-name').fill('score');
  await page.locator('#variables-add-btn').click();
  await page.locator('#variables-new-name').fill('playerName');
  await page.locator('#variables-add-btn').click();
  await page.waitForTimeout(200);
  const dataPanel = page.locator('#data-panel');
  await dataPanel.screenshot({ path: `${OUT}/data-panel.png` });

  // 8. Add an enum
  await page.locator('#enums-new-name').fill('Difficulty');
  await page.locator('#enums-add-btn').click();
  // Add values
  await page.locator('.enum-card .cmd-btn').click();
  await page.waitForTimeout(100);
  await dataPanel.screenshot({ path: `${OUT}/data-panel-enum.png` });

  // 9. Add a message
  await page.locator('#messages-new-input').fill('startBattle');
  await page.locator('#messages-add-btn').click();
  await page.waitForTimeout(100);

  // 10. Screenshot: full app with data
  await page.screenshot({ path: `${OUT}/app-with-data.png` });

  // 11. Dark mode
  await page.locator('#btn-settings-cog').click();
  await page.locator('input[name="theme"][value="dark"]').check();
  await page.locator('#btn-close-settings').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/app-dark-mode.png` });

  // Switch back to light
  await page.locator('#btn-settings-cog').click();
  await page.locator('input[name="theme"][value="light"]').check();
  await page.locator('#btn-close-settings').click();

  // 12. Screenshot: zoom toolbar
  const zoomToolbar = page.locator('#zoom-toolbar');
  await zoomToolbar.screenshot({ path: `${OUT}/zoom-toolbar.png` });

  // 13. Screenshot: right-click context menu
  await nodes.first().click({ button: 'right' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/context-menu.png`, clip: { x: 0, y: 0, width: 800, height: 500 } });
  await page.mouse.click(10, 10); // dismiss

  // 14. Block types - screenshot showing event block (blue) and standard block (yellow)
  await page.mouse.click(cBox.x + 50, cBox.y + 50);
  await page.waitForTimeout(200);
  await canvasEl.screenshot({ path: `${OUT}/block-types.png` });

  console.log('Screenshots captured successfully!');
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
