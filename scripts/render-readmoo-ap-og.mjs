import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanvas, loadImage } from 'canvas';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'scripts', 'readmoo-ap-og.html');
const OUTPUT = path.join(ROOT, 'public', 'readmoo-ap', 'og.png');

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch (error) {
    const fallback = 'file:///C:/Users/kaoru/welly-interview-2026/node_modules/playwright/index.mjs';
    return (await import(fallback)).chromium;
  }
}

const chromium = await loadChromium();
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(SOURCE).href, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => window.OG_READY || window.OG_ERROR, null, { timeout: 30000 });

  const error = await page.evaluate(() => window.OG_ERROR || null);
  if (error) throw new Error(`Canvas 繪製失敗：${error}`);

  const fontReady = await page.evaluate(() => document.fonts.check('700 72px GenSenRounded'));
  if (!fontReady) throw new Error('GenSenRounded 字體沒有載入');

  await page.locator('#og').screenshot({ path: OUTPUT, omitBackground: true });
} finally {
  await browser.close();
}

const image = await loadImage(OUTPUT);
if (image.width !== 1200 || image.height !== 630) {
  throw new Error(`OG 尺寸錯誤：${image.width}x${image.height}`);
}

// 解碼後重畫一次，確認 PNG 可被 Canvas 正常讀取。
const verifyCanvas = createCanvas(1200, 630);
verifyCanvas.getContext('2d').drawImage(image, 0, 0);
const size = fs.statSync(OUTPUT).size;
if (size < 50000) throw new Error(`OG 檔案異常偏小：${size} bytes`);

console.log(JSON.stringify({
  ok: true,
  output: OUTPUT,
  width: image.width,
  height: image.height,
  bytes: size,
  font: 'GenSenRounded',
}, null, 2));
