import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/readmoo-ap/js/bug-report.js', import.meta.url), 'utf8');
const listeners = {};
const storageKeys = new Set([
  'readmoo-ap-user',
  'readmoo-ap-books',
  'readmoo-ap-log',
  'readmoo-ap-chain-state',
]);
const localStorage = {
  get length() { return storageKeys.size; },
  key: index => [...storageKeys][index] ?? null,
  getItem: () => { throw new Error('BUG 報告不得讀取 localStorage 值'); },
  setItem: key => storageKeys.add(key),
  removeItem: key => storageKeys.delete(key),
};
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
    innerWidth: 1280,
    innerHeight: 720,
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
  localStorage,
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
  storage: {
    available: true,
    totalEntries: 4,
    booksConfigured: true,
    apLogConfigured: true,
    identityConfigured: true,
    chainStateConfigured: true,
  },
  errors: [
    {
      time: '秘密書名時間',
      type: '秘密類別',
      message: '秘密書名與暱稱 user@example.com',
      source: 'https://tools.helloruru.com/readmoo-ap/js/app.min.js',
      line: '10) 秘密行號',
      column: '20) 秘密欄號',
    },
    {
      time: '12:34:56',
      type: 'JavaScript',
      message: 'TypeError: 私密內容',
      source: 'private1234.js',
      line: 123456,
    },
    {
      time: '12:34:56',
      type: 'JavaScript',
      message: 'TypeError: 超大行號',
      source: 'app.min.js',
      line: 10001,
    },
  ],
}, '搜尋會卡住，聯絡 user@example.com，網址 https://secret.example/?token=abc，訂單編號 123456789012、訂單末碼：5678、AP＊901234567890、*246812345678、＊9012、＃3456、＊＃789012345678');

assert.match(markdown, /^# Readmoo AP BUG 報告/m);
assert.match(markdown, /## 使用者描述/);
assert.match(markdown, /## 版本與環境/);
assert.match(markdown, /## 服務檢查/);
assert.match(markdown, /## 本機資料摘要/);
assert.match(markdown, /## 最近錯誤/);
assert.match(markdown, /app\.min\.js\?v=1/);
assert.match(markdown, /本機儲存項目數：4/);
assert.match(markdown, /有書單資料：是/);
assert.match(markdown, /有 AP 紀錄：是/);
assert.doesNotMatch(markdown, /user@example\.com/);
assert.doesNotMatch(markdown, /token=abc/);
assert.doesNotMatch(markdown, /secret\.example/);
assert.match(markdown, /\[電子郵件已隱藏\]/);
assert.match(markdown, /\[網址已隱藏\]/);
assert.doesNotMatch(markdown, /秘密書名|秘密類別|秘密行號|秘密欄號|private1234|123456|5678|2468|9012|3456|7890|AP＊90/);
assert.doesNotMatch(markdown, /app\.min\.js:10001|\[末碼已隱藏\]\d/);
assert.match(markdown, /--:--:-- \[JavaScript\] 錯誤內容已隱藏/);
assert.match(markdown, /訂單編號 \[末碼已隱藏\]/);
assert.match(markdown, /訂單末碼：\[末碼已隱藏\]/);
assert.match(markdown, /AP\[末碼已隱藏\]/);
assert.match(markdown, /\*\[末碼已隱藏\]/);
assert.match(markdown, /＊\[末碼已隱藏\]/);
assert.match(markdown, /＃\[末碼已隱藏\]/);
assert.match(markdown, /＊＃\[末碼已隱藏\]/);

assert.equal(typeof listeners.error, 'function', '應從載入開始捕捉 JavaScript 錯誤');
assert.equal(typeof listeners.unhandledrejection, 'function', '應捕捉未處理的 Promise 錯誤');
listeners.error({
  message: '載入秘密書名失敗，訂單末碼 2468',
  filename: 'https://tools.helloruru.com/readmoo-ap/js/app.min.js?v=secret',
  lineno: 10,
  colno: 20,
});
listeners.error({
  message: '負數行號秘密',
  filename: 'https://tools.helloruru.com/readmoo-ap/js/app.min.js',
  lineno: -1,
  colno: '秘密欄號',
});
listeners.error({
  message: '小數行號秘密',
  filename: 'https://tools.helloruru.com/readmoo-ap/js/app.min.js',
  lineno: 1.5,
});
listeners.unhandledrejection({ reason: new Error('Promise 秘密書名') });
const diagnostics = await api.collectDiagnostics();
assert.equal(diagnostics.storage.totalEntries, 4);
assert.equal(diagnostics.storage.booksConfigured, true);
assert.equal(diagnostics.storage.apLogConfigured, true);
assert.doesNotMatch(JSON.stringify(diagnostics), /秘密書名|秘密欄號|2468|secret/);
assert.match(JSON.stringify(diagnostics), /錯誤內容已隱藏/);
assert.equal(diagnostics.errors[0].line, 10);
assert.equal(diagnostics.errors[1].line, null);
assert.equal(diagnostics.errors[2].line, null);
assert.ok(diagnostics.errors.every(error => !('column' in error)), '診斷資料不得保留欄號');
assert.doesNotMatch(source, /localStorage\.getItem/, 'BUG 報告不得讀取任何 localStorage 值');

const html = fs.readFileSync(new URL('../public/readmoo-ap/index.html', import.meta.url), 'utf8');
const minified = fs.readFileSync(new URL('../public/readmoo-ap/js/bug-report.min.js', import.meta.url), 'utf8');
assert.match(html, /id="btn-download-bug-report"/, '頁尾應有常駐 BUG 報告按鈕');
assert.match(
  html,
  /bug-report\.min\.js\?v=20260715b[\s\S]*app\.min\.js/,
  'BUG 報告模組必須在 app.js 前載入，才能捕捉初始化錯誤'
);
assert.match(minified, /buildMarkdown/, '正式頁載入的壓縮檔必須包含 Markdown 產生器');

console.log('PASS Readmoo AP Markdown bug report');
