import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/readmoo-ap/js/bug-report.js', import.meta.url), 'utf8');
const listeners = {};
const sandbox = {
  console,
  Blob,
  File,
  URL,
  AbortController,
  setTimeout,
  clearTimeout,
  window: {
    addEventListener: (name, handler) => { listeners[name] = handler; },
    location: { origin: 'https://tools.helloruru.com', pathname: '/readmoo-ap/' },
  },
  document: {
    readyState: 'loading',
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
  },
  navigator: {
    userAgent: 'Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36',
    platform: 'Win32',
    language: 'zh-TW',
    onLine: true,
  },
  performance: { now: () => 100, getEntriesByType: () => [] },
  screen: { width: 1440, height: 900 },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  fetch: async () => new Response('{}', { status: 200 }),
  Response,
};
vm.runInNewContext(source, sandbox);

const api = sandbox.window.ReadmooBugReport;
assert.ok(api, '應提供 BUG 報告模組');

const markdown = api.buildMarkdown({
  generatedAt: '2026-07-15T01:00:00.000Z',
  page: 'https://tools.helloruru.com/readmoo-ap/',
  currentTab: 'books',
  browser: 'Chrome',
  platform: 'Win32',
  language: 'zh-TW',
  screen: '1440x900',
  viewport: '1280x720',
  online: true,
  versions: ['app.min.js?v=1', 'bug-report.min.js?v=1'],
  api: { search: 'OK 120ms', daily: 'HTTP 404 30ms' },
  storage: { available: true, books: 3, apLog: 2, identityConfigured: true },
  errors: [{ time: '01:00:01', type: 'error', message: 'Failed at https://secret.example/?token=abc user@example.com' }],
}, '搜尋會卡住，聯絡 user@example.com，網址 https://secret.example/?token=abc');

assert.match(markdown, /^# Readmoo AP BUG 報告/m);
assert.match(markdown, /## 使用者描述/);
assert.match(markdown, /## 版本與環境/);
assert.match(markdown, /## 服務檢查/);
assert.match(markdown, /## 本機資料摘要/);
assert.match(markdown, /## 最近錯誤/);
assert.match(markdown, /app\.min\.js\?v=1/);
assert.match(markdown, /書單筆數：3/);
assert.doesNotMatch(markdown, /user@example\.com/);
assert.doesNotMatch(markdown, /token=abc/);
assert.doesNotMatch(markdown, /secret\.example/);
assert.match(markdown, /\[電子郵件已隱藏\]/);
assert.match(markdown, /\[網址已隱藏\]/);

assert.equal(typeof listeners.error, 'function', '應從載入開始捕捉 JavaScript 錯誤');
assert.equal(typeof listeners.unhandledrejection, 'function', '應捕捉未處理的 Promise 錯誤');

const html = fs.readFileSync(new URL('../public/readmoo-ap/index.html', import.meta.url), 'utf8');
const minified = fs.readFileSync(new URL('../public/readmoo-ap/js/bug-report.min.js', import.meta.url), 'utf8');
assert.match(html, /id="btn-download-bug-report"/, '頁尾應有常駐 BUG 報告按鈕');
assert.match(
  html,
  /bug-report\.min\.js\?v=20260715a[\s\S]*app\.min\.js/,
  'BUG 報告模組必須在 app.js 前載入，才能捕捉初始化錯誤'
);
assert.match(minified, /buildMarkdown/, '正式頁載入的壓縮檔必須包含 Markdown 產生器');

console.log('PASS Readmoo AP Markdown bug report');
