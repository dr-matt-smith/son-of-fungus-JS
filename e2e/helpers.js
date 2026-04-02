/**
 * Shared helpers for Playwright e2e tests.
 * All drag operations use the canvas-container as the coordinate reference.
 */

/**
 * Drags a palette button onto the canvas centre (or a given offset from centre).
 * Returns the locator for the newly created node.
 */
export async function dragNewNode(page, btnId, offsetX = 0, offsetY = 0) {
  const btn = page.locator(btnId);
  const canvas = page.locator('#canvas-container');
  const canvasBox = await canvas.boundingBox();
  const cx = canvasBox.x + canvasBox.width / 2 + offsetX;
  const cy = canvasBox.y + canvasBox.height / 2 + offsetY;

  await btn.hover();
  await page.mouse.down();
  await page.mouse.move(cx, cy, { steps: 5 });
  await page.mouse.up();
}

/**
 * Returns the bounding box of a node element.
 */
export async function getNodeBox(page, nodeLocator) {
  return await nodeLocator.boundingBox();
}

/**
 * Drags from one point to another on the page.
 */
export async function drag(page, fromX, fromY, toX, toY, steps = 10) {
  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps });
  await page.mouse.up();
}

/**
 * Drags from the centre of one element to the centre of another.
 */
export async function dragBetween(page, fromLocator, toLocator, steps = 10) {
  const fromBox = await fromLocator.boundingBox();
  const toBox = await toLocator.boundingBox();
  const fx = fromBox.x + fromBox.width / 2;
  const fy = fromBox.y + fromBox.height / 2;
  const tx = toBox.x + toBox.width / 2;
  const ty = toBox.y + toBox.height / 2;
  await drag(page, fx, fy, tx, ty, steps);
}
