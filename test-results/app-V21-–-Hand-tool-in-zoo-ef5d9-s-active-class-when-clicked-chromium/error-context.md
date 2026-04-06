# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.js >> V21 – Hand tool in zoom toolbar >> hand tool toggles active class when clicked
- Location: e2e/app.spec.js:246:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.data-section.collapsed .data-section-toggle').nth(2)

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - button "Block" [ref=e4]: Block
    - generic [ref=e7]:
      - button "Play" [ref=e8] [cursor=pointer]:
        - img [ref=e9]
        - generic [ref=e11]: Play
      - button "Debug" [ref=e12] [cursor=pointer]:
        - img [ref=e13]
        - text: Debug
  - generic [ref=e16]:
    - generic [ref=e17]:
      - generic [ref=e18]:
        - generic [ref=e19]:
          - button "◀" [ref=e20] [cursor=pointer]
          - generic [ref=e21]: Data
        - button "Collapse all sections" [ref=e22] [cursor=pointer]:
          - img [ref=e23]
      - generic [ref=e25]:
        - generic [ref=e26]:
          - generic [ref=e27]:
            - generic [ref=e28]: Variables
            - button "−" [ref=e29] [cursor=pointer]
          - generic [ref=e31]:
            - combobox [ref=e32]:
              - option "Boolean"
              - option "Integer"
              - option "Float"
              - option "String" [selected]
              - option "Enum"
            - textbox "Variable name…" [ref=e33]
            - button "Add" [ref=e34] [cursor=pointer]
        - generic [ref=e37]:
          - generic [ref=e38]: Enums
          - button "+" [ref=e39] [cursor=pointer]
        - generic [ref=e41]:
          - generic [ref=e42]:
            - generic [ref=e43]: Events
            - button "−" [active] [ref=e44] [cursor=pointer]
          - generic [ref=e46]:
            - textbox "New message name…" [ref=e47]
            - button "Add" [ref=e48] [cursor=pointer]
        - generic [ref=e51]:
          - generic [ref=e52]: Characters
          - button "+" [ref=e53] [cursor=pointer]
    - generic [ref=e55]:
      - generic [ref=e56]:
        - img
      - generic [ref=e57]:
        - button "Export JSON" [ref=e58] [cursor=pointer]
        - button "Load Project" [ref=e59] [cursor=pointer]
        - button "Run Log" [ref=e60] [cursor=pointer]
        - button "Build" [ref=e61] [cursor=pointer]
      - generic "Minimap – drag the red rectangle to scroll the canvas" [ref=e62]:
        - generic: MAP
        - button "_" [ref=e64] [cursor=pointer]
      - generic [ref=e65]:
        - button "Fit All (F)" [ref=e66] [cursor=pointer]:
          - img [ref=e67]
        - button "Zoom Out (-)" [ref=e73] [cursor=pointer]:
          - img [ref=e74]
        - slider "Zoom slider" [ref=e75] [cursor=pointer]: "100"
        - button "Zoom In (= or +)" [ref=e76] [cursor=pointer]:
          - img [ref=e77]
        - generic [ref=e78]: 100%
        - button "Hand Tool (H)" [ref=e80] [cursor=pointer]:
          - img [ref=e81]
    - generic [ref=e85]:
      - generic [ref=e86]:
        - button "Inspector" [ref=e87] [cursor=pointer]
        - button "⚙" [ref=e88] [cursor=pointer]
      - paragraph [ref=e91]: No object selected
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { dragNewNode, drag, getNodeBox } from './helpers.js';
  3   | 
  4   | // Helper: add a command via the search popup (matches exact label)
  5   | async function addCommand(page, cmdLabel) {
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
  22  |   const toggles = page.locator('.data-section.collapsed .data-section-toggle');
  23  |   const count = await toggles.count();
> 24  |   for (let i = 0; i < count; i++) await toggles.nth(i).click();
      |                                                        ^ Error: locator.click: Test timeout of 30000ms exceeded.
  25  | });
  26  | 
  27  | // ─── Version 1: Toolbar & basic node creation ──────────────────────────────
  28  | 
  29  | test.describe('V1 – Toolbar and state creation', () => {
  30  |   test('toolbar is visible at the top', async ({ page }) => {
  31  |     await expect(page.locator('#toolbar')).toBeVisible();
  32  |   });
  33  | 
  34  |   test('drag a state node onto the canvas', async ({ page }) => {
  35  |     await dragNewNode(page, '#btn-new-state');
  36  |     await expect(page.locator('.state-node')).toHaveCount(1);
  37  |   });
  38  | 
  39  |   test('zoom in button increases zoom percentage', async ({ page }) => {
  40  |     const label = page.locator('#zoom-label');
  41  |     const before = await label.textContent();
  42  |     await page.locator('#btn-zoom-in').click();
  43  |     const after = await label.textContent();
  44  |     expect(parseInt(after)).toBeGreaterThan(parseInt(before));
  45  |   });
  46  | 
  47  |   test('zoom out button decreases zoom percentage', async ({ page }) => {
  48  |     const label = page.locator('#zoom-label');
  49  |     const before = await label.textContent();
  50  |     await page.locator('#btn-zoom-out').click();
  51  |     const after = await label.textContent();
  52  |     expect(parseInt(after)).toBeLessThan(parseInt(before));
  53  |   });
  54  | });
  55  | 
  56  | // ─── Version 1: Minimap ────────────────────────────────────────────────────
  57  | 
  58  | test.describe('V1 – Minimap', () => {
  59  |   test('minimap is visible', async ({ page }) => {
  60  |     await expect(page.locator('#minimap')).toBeVisible();
  61  |   });
  62  | 
  63  |   test('minimap viewport rectangle exists', async ({ page }) => {
  64  |     await expect(page.locator('#minimap-viewport')).toBeVisible();
  65  |   });
  66  | });
  67  | 
  68  | // ─── Version 2: Scroll-wheel zoom & middle-button pan ──────────────────────
  69  | 
  70  | test.describe('V2 – Wheel zoom and pan', () => {
  71  |   test('scroll wheel zooms in', async ({ page }) => {
  72  |     const label = page.locator('#zoom-label');
  73  |     const before = parseInt(await label.textContent());
  74  |     const canvas = page.locator('#canvas-container');
  75  |     const box = await canvas.boundingBox();
  76  |     await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  77  |     await page.mouse.wheel(0, -100);
  78  |     await page.waitForTimeout(100);
  79  |     const after = parseInt(await label.textContent());
  80  |     expect(after).toBeGreaterThan(before);
  81  |   });
  82  | 
  83  |   test('hand tool button toggles active class', async ({ page }) => {
  84  |     const btn = page.locator('#btn-hand-tool');
  85  |     await expect(btn).not.toHaveClass(/active/);
  86  |     await btn.click();
  87  |     await expect(btn).toHaveClass(/active/);
  88  |     await btn.click();
  89  |     await expect(btn).not.toHaveClass(/active/);
  90  |   });
  91  | });
  92  | 
  93  | // ─── Version 3: Node dragging ──────────────────────────────────────────────
  94  | 
  95  | test.describe('V3 – Node dragging', () => {
  96  |   test('dragging a node moves it on the canvas', async ({ page }) => {
  97  |     await dragNewNode(page, '#btn-new-state');
  98  |     const node = page.locator('.state-node');
  99  |     const boxBefore = await getNodeBox(page, node);
  100 | 
  101 |     await drag(page,
  102 |       boxBefore.x + boxBefore.width / 2,
  103 |       boxBefore.y + boxBefore.height / 2,
  104 |       boxBefore.x + boxBefore.width / 2 + 100,
  105 |       boxBefore.y + boxBefore.height / 2 + 50);
  106 | 
  107 |     const boxAfter = await getNodeBox(page, node);
  108 |     expect(boxAfter.x).toBeGreaterThan(boxBefore.x);
  109 |     expect(boxAfter.y).toBeGreaterThan(boxBefore.y);
  110 |   });
  111 | });
  112 | 
  113 | // ─── Version 4: Fit All ────────────────────────────────────────────────────
  114 | 
  115 | test.describe('V4 – Fit All', () => {
  116 |   test('fit all adjusts zoom to show all nodes', async ({ page }) => {
  117 |     // Create two nodes far apart
  118 |     await dragNewNode(page, '#btn-new-state', -200, -150);
  119 |     await dragNewNode(page, '#btn-new-state', 200, 150);
  120 | 
  121 |     const label = page.locator('#zoom-label');
  122 |     await page.locator('#btn-fit-all').click();
  123 |     const zoomText = await label.textContent();
  124 |     // Should have adjusted zoom (exact value depends on viewport)
```