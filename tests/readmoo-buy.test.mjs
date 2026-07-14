import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const pageDir = path.join(root, 'public', 'readmoo-buy');
const html = fs.readFileSync(path.join(pageDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(pageDir, 'css', 'style.css'), 'utf8');
const minCss = fs.readFileSync(path.join(pageDir, 'css', 'style.min.css'), 'utf8');
const appSource = fs.readFileSync(path.join(pageDir, 'js', 'app.js'), 'utf8');
const minAppSource = fs.readFileSync(path.join(pageDir, 'js', 'app.min.js'), 'utf8');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name) {
    if (this.values.has(name)) { this.values.delete(name); return false; }
    this.values.add(name); return true;
  }
}

class FakeElement {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.classList = new ClassList();
    this.listeners = {};
    this.attributes = {};
    this.textContent = '';
    this.innerHTML = '';
    this.value = '';
  }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  dispatch(type) { this.listeners[type]?.call(this, { target: this }); }
  focus() { this.ownerDocument.activeElement = this; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
}

function createHarness(source = appSource) {
  const ids = Object.fromEntries([
    'price-display', 'screen-hint', 'hidden-input', 'calc-screen',
    'calc-results', 'calc-advice', 'theme-toggle', 'footer-year'
  ].map((id) => [id, new FakeElement()]));
  const buttons = [
    ...'0123456789'.split('').map((digit) => new FakeElement({ digit })),
    new FakeElement({ digit: '00' }),
    new FakeElement({ action: 'backspace' }),
    new FakeElement({ action: 'clear' }),
    new FakeElement({ action: 'calc' })
  ];
  const documentListeners = {};
  const document = {
    activeElement: null,
    documentElement: new FakeElement(),
    getElementById: (id) => ids[id] ?? null,
    querySelectorAll: (selector) => selector === '.calc-key' ? buttons : [],
    addEventListener: (type, callback) => { documentListeners[type] = callback; }
  };
  [...Object.values(ids), ...buttons].forEach((element) => { element.ownerDocument = document; });
  const storage = new Map();
  const context = {
    document,
    window: { matchMedia: () => ({ matches: false }) },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    },
    IntersectionObserver: class {
      observe() {}
      unobserve() {}
    },
    setTimeout: (callback) => callback(),
    console
  };
  vm.runInNewContext(source, context, { filename: 'app.js' });
  return {
    ids,
    pressDigit(digit) {
      const button = buttons.find((item) => item.dataset.digit === digit);
      assert.ok(button, `找不到數字鍵 ${digit}`);
      button.dispatch('click');
    },
    clickAction(action) {
      const button = buttons.find((item) => item.dataset.action === action);
      assert.ok(button, `找不到操作鍵 ${action}`);
      button.dispatch('click');
    }
  };
}

test('00 不會把已達四位數上限的價格重設成錯誤數字', () => {
  const app = createHarness();
  app.pressDigit('9');
  app.pressDigit('9');
  app.pressDigit('9');
  app.pressDigit('00');
  assert.equal(app.ids['price-display'].textContent, '999');
});

test('輸入前導零時畫面只保留正常整數格式', () => {
  const app = createHarness();
  app.pressDigit('00');
  app.pressDigit('5');
  app.pressDigit('0');
  assert.equal(app.ids['price-display'].textContent, '50');
});

test('價格刪到最低門檻以下時不保留舊結果', () => {
  const app = createHarness();
  app.pressDigit('2');
  app.pressDigit('5');
  app.pressDigit('0');
  assert.match(app.ids['calc-results'].innerHTML, /calc-result-cards/);
  app.clickAction('backspace');
  assert.match(app.ids['calc-results'].innerHTML, /calc-result-placeholder/);
});

test('速查表涵蓋折扣交界且沒有 251 到 254 的缺口', () => {
  for (const text of ['$50 ~ $202', '$203 ~ $222', '$223 ~ $250', '$251 ~ $444', '$445 ~ $500']) {
    assert.ok(html.includes(text), `缺少速查區間 ${text}`);
  }
  assert.match(html, /\$444 與領書額度同價/);
});

test('頁面具備唯一 H1 與完整計算機控制名稱', () => {
  assert.equal((html.match(/<h1\b/gi) ?? []).length, 1);
  assert.match(html, /data-action="backspace"[^>]+aria-label="刪除上一位"/);
  assert.match(html, /data-action="clear"[^>]+aria-label="清除價格"/);
  assert.match(html, /id="hidden-input"[\s\S]*?min="50"[\s\S]*?max="9999"[\s\S]*?aria-describedby="screen-hint"/);
  assert.doesNotMatch(html, /type="number"[^>]*\bpattern=/);
});

test('窄手機維持四欄鍵盤且輸入螢幕有可見焦點', () => {
  assert.doesNotMatch(css, /@media\s*\(max-width:\s*380px\)[\s\S]*?grid-template-columns:\s*repeat\(3,\s*1fr\)/);
  assert.match(css, /\.calc-screen:focus-within/);
});

test('Readmoo 頁面遵守品牌字體與合法字重', () => {
  assert.match(css, /GenSenRounded-Regular\.woff2/);
  assert.match(css, /GenSenRounded-Medium\.woff2/);
  assert.match(css, /GenSenRounded-Bold\.woff2/);
  assert.doesNotMatch(css, /font-weight:\s*600\b/);
  assert.doesNotMatch(html, /GenWanMin|NotoSerifTC/);
  assert.match(css, /h1\s*\{[\s\S]*?font-weight:\s*700/);
  assert.match(css, /h2,\s*h3\s*\{[\s\S]*?font-weight:\s*500/);
  assert.match(css, /html\.dark\s*\{[\s\S]*?--text-muted:\s*#928C86/);
});

test('線上載入的壓縮資源與修正版行為同步', () => {
  const app = createHarness(minAppSource);
  app.pressDigit('9');
  app.pressDigit('9');
  app.pressDigit('9');
  app.pressDigit('00');
  assert.equal(app.ids['price-display'].textContent, '999');
  assert.match(minCss, /\.calc-screen:focus-within/);
  assert.doesNotMatch(minCss, /max-width:380px/);
});
