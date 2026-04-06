# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.js >> V24 – Inspector clears on deselect/delete >> inspector shows "No object selected" after node is deleted
- Location: e2e/app.spec.js:855:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4173/
Call log:
  - navigating to "http://localhost:4173/", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "This site can’t be reached" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: localhost
      - text: refused to connect.
    - generic [ref=e10]:
      - paragraph [ref=e11]: "Try:"
      - list [ref=e12]:
        - listitem [ref=e13]: Checking the connection
        - listitem [ref=e14]:
          - link "Checking the proxy and the firewall" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "Reload" [ref=e19] [cursor=pointer]
    - button "Details" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { dragNewNode, drag, getNodeBox } from './helpers.js';
  3   | 
  4   | // Helper: add a command via the search popup (matches exact label)
> 5   | async function addCommand(page, cmdLabel) {
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4173/
  6   |   await page.locator('.cmd-action-btn.cmd-action-add').click();
  7   |   await page.locator('.cmd-search-input').fill(cmdLabel);
  8   |   // Click the item whose label exactly matches
  9   |   const items = page.locator('.cmd-search-item');
  10  |   const count = await items.count();
  11  |   for (let i = 0; i < count; i++) {
  12  |     const label = await items.nth(i).locator('.cmd-search-label').textContent();
  13  |     if (label === cmdLabel) { await items.nth(i).click(); return; }
  14  |   }
  15  |   // Fallback: click first match
  16  |   await items.first().click();
  17  | }
  18  | 
  19  | test.beforeEach(async ({ page }) => {
  20  |   await page.goto('/');
  21  |   // Expand all collapsed data sections
  22  |   await page.evaluate(() => {
  23  |     document.querySelectorAll('.data-section.collapsed').forEach(s => {
  24  |       s.classList.remove('collapsed');
  25  |       const t = s.querySelector('.data-section-toggle');
  26  |       if (t) t.textContent = '−';
  27  |     });
  28  |   });
  29  | });
  30  | 
  31  | // ─── Version 1: Toolbar & basic node creation ──────────────────────────────
  32  | 
  33  | test.describe('V1 – Toolbar and state creation', () => {
  34  |   test('toolbar is visible at the top', async ({ page }) => {
  35  |     await expect(page.locator('#toolbar')).toBeVisible();
  36  |   });
  37  | 
  38  |   test('drag a state node onto the canvas', async ({ page }) => {
  39  |     await dragNewNode(page, '#btn-new-state');
  40  |     await expect(page.locator('.state-node')).toHaveCount(1);
  41  |   });
  42  | 
  43  |   test('zoom in button increases zoom percentage', async ({ page }) => {
  44  |     const label = page.locator('#zoom-label');
  45  |     const before = await label.textContent();
  46  |     await page.locator('#btn-zoom-in').click();
  47  |     const after = await label.textContent();
  48  |     expect(parseInt(after)).toBeGreaterThan(parseInt(before));
  49  |   });
  50  | 
  51  |   test('zoom out button decreases zoom percentage', async ({ page }) => {
  52  |     const label = page.locator('#zoom-label');
  53  |     const before = await label.textContent();
  54  |     await page.locator('#btn-zoom-out').click();
  55  |     const after = await label.textContent();
  56  |     expect(parseInt(after)).toBeLessThan(parseInt(before));
  57  |   });
  58  | });
  59  | 
  60  | // ─── Version 1: Minimap ────────────────────────────────────────────────────
  61  | 
  62  | test.describe('V1 – Minimap', () => {
  63  |   test('minimap is visible', async ({ page }) => {
  64  |     await expect(page.locator('#minimap')).toBeVisible();
  65  |   });
  66  | 
  67  |   test('minimap viewport rectangle exists', async ({ page }) => {
  68  |     await expect(page.locator('#minimap-viewport')).toBeVisible();
  69  |   });
  70  | });
  71  | 
  72  | // ─── Version 2: Scroll-wheel zoom & middle-button pan ──────────────────────
  73  | 
  74  | test.describe('V2 – Wheel zoom and pan', () => {
  75  |   test('scroll wheel zooms in', async ({ page }) => {
  76  |     const label = page.locator('#zoom-label');
  77  |     const before = parseInt(await label.textContent());
  78  |     const canvas = page.locator('#canvas-container');
  79  |     const box = await canvas.boundingBox();
  80  |     await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  81  |     await page.mouse.wheel(0, -100);
  82  |     await page.waitForTimeout(100);
  83  |     const after = parseInt(await label.textContent());
  84  |     expect(after).toBeGreaterThan(before);
  85  |   });
  86  | 
  87  |   test('hand tool button toggles active class', async ({ page }) => {
  88  |     const btn = page.locator('#btn-hand-tool');
  89  |     await expect(btn).not.toHaveClass(/active/);
  90  |     await btn.click();
  91  |     await expect(btn).toHaveClass(/active/);
  92  |     await btn.click();
  93  |     await expect(btn).not.toHaveClass(/active/);
  94  |   });
  95  | });
  96  | 
  97  | // ─── Version 3: Node dragging ──────────────────────────────────────────────
  98  | 
  99  | test.describe('V3 – Node dragging', () => {
  100 |   test('dragging a node moves it on the canvas', async ({ page }) => {
  101 |     await dragNewNode(page, '#btn-new-state');
  102 |     const node = page.locator('.state-node');
  103 |     const boxBefore = await getNodeBox(page, node);
  104 | 
  105 |     await drag(page,
```