import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const selected = process.argv[2] || 'all';
const tests = new Map();

tests.set('nickname', () => {
  const source = read('public/readmoo-ap/js/recommend.js');
  const functionBody = source.match(/function resolveRecommendNickFromDirectory\(nick\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.ok(functionBody, '找不到 resolveRecommendNickFromDirectory');
  assert.doesNotMatch(functionBody, /members\.find|\^\\d\+\$/, '推薦書單不應把純數字暱稱轉成名冊 ID');
  assert.match(functionBody, /return nick \|\| ''/, '暱稱應原樣保留');
});

tests.set('book-events', () => {
  const source = read('public/readmoo-ap/js/recommend.js');
  const functionBody = source.match(/function addToMyBooks\(id\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.ok(functionBody, '找不到 addToMyBooks');
  assert.doesNotMatch(functionBody, /initBooks\(/, '加入推薦書後不應重新初始化整個書單模組');
  assert.match(functionBody, /books-updated/, '加入推薦書後應發送書單更新事件');
});

tests.set('storage', () => {
  const app = read('public/readmoo-ap/js/app.js');
  const books = read('public/readmoo-ap/js/books.js');
  const coupon = read('public/readmoo-ap/js/coupon.js');
  const recommend = read('public/readmoo-ap/js/recommend.js');
  const changelog = read('public/readmoo-ap/js/changelog.js');
  assert.match(app, /function readStoredJson\(/, '主程式需要安全讀取 localStorage 的共用函式');
  assert.match(app, /readStoredJson\(CONFIG\.STORAGE_KEYS\.USER, null\)/, '身分資料應使用安全讀取');
  assert.match(books, /readStoredJson\(CONFIG\.STORAGE_KEYS\.BOOKS, \[\]\)/, '書單資料應使用安全讀取');
  for (const [name, source] of [['優惠', coupon], ['推薦', recommend], ['修改紀錄', changelog]]) {
    assert.doesNotMatch(source, /JSON\.parse\(localStorage\.getItem/, `${name}模組不可直接解析本機資料`);
  }
});

tests.set('user-name', () => {
  const app = read('public/readmoo-ap/js/app.js');
  const functionBody = app.match(/function updateUserBar\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.ok(functionBody, '找不到 updateUserBar');
  assert.doesNotMatch(functionBody, /nameEl\.innerHTML/, '本機暱稱不可直接插入 innerHTML');
  assert.match(functionBody, /createTextNode/, '本機暱稱應以文字節點顯示');
});

tests.set('api-names', () => {
  const coupon = read('public/readmoo-ap/js/coupon.js');
  const recommend = read('public/readmoo-ap/js/recommend.js');
  assert.doesNotMatch(coupon, /function postToGas\(/, '優惠模組不可宣告共用全域 postToGas');
  assert.doesNotMatch(recommend, /function postToGas\(/, '推薦模組不可宣告共用全域 postToGas');
  assert.match(coupon, /function postCouponToGas\(/, '優惠模組應使用獨立 API 函式');
  assert.match(recommend, /function postRecommendToGas\(/, '推薦模組應使用獨立 API 函式');
});

tests.set('tabs-a11y', () => {
  const app = read('public/readmoo-ap/js/app.js');
  assert.match(app, /tab\.addEventListener\('keydown'/, '分頁按鈕應支援鍵盤操作');
  assert.match(app, /ArrowRight|ArrowLeft/, '分頁應支援左右方向鍵');
  assert.match(app, /aria-controls/, '分頁按鈕應連結對應面板');
  assert.match(app, /aria-labelledby/, '面板應連結對應分頁按鈕');
  assert.match(app, /tabIndex = isActive \? 0 : -1/, '只有目前分頁應進入 Tab 順序');
});

tests.set('modal-a11y', () => {
  const app = read('public/readmoo-ap/js/app.js');
  assert.match(app, /aria-modal/, 'Modal 應宣告 aria-modal');
  assert.match(app, /event\.key === 'Escape'/, 'Modal 應支援 Esc 關閉');
  assert.match(app, /event\.key === 'Tab'/, 'Modal 應限制焦點留在視窗內');
  assert.match(app, /_lastFocused/, 'Modal 關閉後應把焦點還給原控制項');
});

tests.set('built-assets', () => {
  const appMin = read('public/readmoo-ap/js/app.min.js');
  const booksMin = read('public/readmoo-ap/js/books.min.js');
  const changelogMin = read('public/readmoo-ap/js/changelog.min.js');
  assert.match(appMin, /readStoredJson/, 'app.min.js 必須包含安全儲存修正');
  assert.match(appMin, /aria-modal/, 'app.min.js 必須包含 Modal 修正');
  assert.match(appMin, /ArrowRight/, 'app.min.js 必須包含鍵盤分頁操作');
  assert.match(booksMin, /readStoredJson/, 'books.min.js 必須包含安全儲存修正');
  assert.match(changelogMin, /readStoredJson/, 'changelog.min.js 必須包含安全儲存修正');
});

const names = selected === 'all' ? [...tests.keys()] : [selected];
let failed = 0;
for (const name of names) {
  const test = tests.get(name);
  if (!test) throw new Error(`未知測試：${name}`);
  try {
    test();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
