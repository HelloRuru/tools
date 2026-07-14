import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parsePublishDate } from '../functions/api/readmoo-search.js';

const html = `
  <meta itemprop="datePublished" content="2019/06/01">
  <section class="recommendations">
    <span>出版日期：2026-07-02</span>
  </section>
`;

assert.equal(
  parsePublishDate(html),
  '2019-06-01',
  '應讀取主書籍的 datePublished，不可誤抓推薦書日期'
);

assert.equal(
  parsePublishDate('<span>出版日期：2026-07-02</span>'),
  '',
  '沒有主書籍結構化日期時，不可用推薦區日期冒充'
);

const source = fs.readFileSync(new URL('../functions/api/readmoo-search.js', import.meta.url), 'utf8');
assert.match(source, /_ck', 'v4-'/, '修改爬蟲解析後必須升級 Cloudflare 快取鍵');

console.log('PASS readmoo publish date parser');
