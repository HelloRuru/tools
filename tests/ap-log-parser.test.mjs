import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/readmoo-ap/js/ap-log.js', import.meta.url), 'utf8');
const sandbox = {
  console,
  localStorage: { getItem: () => null, setItem: () => {} },
  document: { addEventListener: () => {} },
  window: {},
};
vm.runInNewContext(source, sandbox);

const parse = (body, nick = '嚕嚕在看書！', from = '小魚') =>
  JSON.parse(JSON.stringify(sandbox.parseConversation(body, nick, from)));

assert.deepEqual(parse('AP*68\n@Nancy Tsai\n@嚕嚕在看書！'), [
  { from: '小魚', code: '68' },
]);

assert.deepEqual(parse('AP*68\n\n@嚕嚕在看書！'), [
  { from: '小魚', code: '68' },
], '空白行不可把訂單碼與收禮人拆散');

assert.deepEqual(parse('下午 8:12 小魚：AP＊17＋68 ＠嚕嚕在看書！'), [
  { from: '小魚', code: '17' },
  { from: '小魚', code: '68' },
], '應支援 LINE 時間、全形符號與組合訂單碼');

assert.deepEqual(parse('AP68 @嚕嚕在看書！\nAP：12345 @嚕嚕在看書！'), [
  { from: '小魚', code: '68' },
  { from: '小魚', code: '12345' },
], '應支援沒有星號與冒號格式');

assert.deepEqual(parse('訂單末碼 2468\n@嚕嚕在看書！'), [
  { from: '小魚', code: '2468' },
], '應支援白話的訂單末碼格式');

assert.deepEqual(parse('AP*17\n@別人\n\nAP#68\n@嚕嚕在看書！'), [
  { from: '小魚', code: '68' },
], '同段對話有多筆 AP 時，只能登記有提到自己的區塊');

const minified = fs.readFileSync(new URL('../public/readmoo-ap/js/ap-log.min.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../public/readmoo-ap/index.html', import.meta.url), 'utf8');
assert.match(minified, /extractOrderCodes/, '正式頁載入的 ap-log.min.js 必須包含彈性解析器');
assert.match(html, /ap-log\.min\.js\?v=20260502m/, '正式頁必須更新 LINE 解析器快取版本');

console.log('PASS flexible LINE conversation parser');
