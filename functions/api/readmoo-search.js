// Cloudflare Pages Function: /api/readmoo-search?q=KEYWORD
// 搜尋讀墨書庫，回傳 JSON

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const CACHE_TTL = 1800;

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(context.request.url);
  const rawQuery = url.searchParams.get('q')?.trim();

  if (!rawQuery || rawQuery.length < 1 || rawQuery.length > 100) {
    return resp({ error: '請輸入 1~100 字的搜尋關鍵字' }, 400);
  }

  // 健康檢查
  if (rawQuery === '__ping__') {
    return resp({ ok: true, ts: Date.now() });
  }

  // 讀墨搜尋不接受全形/半形標點（哈利波特：神秘的魔法石 → 0 筆）
  // 把標點換成空格，再壓掉多餘空白
  const query = stripPunctuation(rawQuery);
  if (!query) {
    return resp({ query: rawQuery, count: 0, books: [] });
  }

  // ?nocache=1 → 強制繞過快取
  const noCache = url.searchParams.get('nocache') === '1';

  try {
    // Cache（安全包裝，失敗就跳過）
    let cache = null;
    let cacheKey = null;
    try {
      cache = caches.default;
      const cacheUrl = new URL(context.request.url);
      // _ck 加版本碼，改演算法時 bump 版本能清掉舊快取
      cacheUrl.searchParams.set('_ck', 'v4-' + query.toLowerCase());
      cacheKey = new Request(cacheUrl.toString());
      if (!noCache) {
        const cached = await cache.match(cacheKey);
        if (cached) {
          return new Response(cached.body, {
            headers: { ...CORS_HEADERS, 'X-Cache': 'HIT' },
          });
        }
      }
    } catch (e) {
      // cache 不可用就跳過
    }

    const searchUrl = `https://readmoo.com/search/keyword?q=${encodeURIComponent(query)}`;
    const rmRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-TW,zh;q=0.9',
        'Accept': 'text/html',
      },
    });

    if (!rmRes.ok) {
      return resp({ error: `Readmoo ${rmRes.status}` }, 502);
    }

    const html = await rmRes.text();
    const allBooks = parseSearchResults(html);
    // 最多回傳 20 本（減少回應大小 + 出版日期抓取時間）
    const books = allBooks.slice(0, 20);

    // 平行抓每本書的出版日期（從詳情頁）
    await fetchPublishDates(books);

    const body = JSON.stringify({ query: rawQuery, count: books.length, books });

    // 寫入 cache（失敗不影響回應）
    if (cache && cacheKey) {
      try {
        const cacheResponse = new Response(body, {
          headers: { ...CORS_HEADERS, 'Cache-Control': `public, max-age=${CACHE_TTL}` },
        });
        context.waitUntil(cache.put(cacheKey, cacheResponse.clone()));
      } catch (e) { /* 跳過 */ }
    }

    return new Response(body, {
      headers: { ...CORS_HEADERS, 'X-Cache': 'MISS' },
    });
  } catch (err) {
    return resp({ error: err.name === 'AbortError' ? '連線逾時' : err.message }, 500);
  }
}

function resp(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS_HEADERS });
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9',
  'Accept': 'text/html',
};

function stripPunctuation(s) {
  return s
    .replace(/[：，。、？！「」『』（）〈〉《》【】〔〕——…・·~～\-—‧'"'']/g, ' ')
    .replace(/[:,.?!"'`()\[\]{}<>~\-—|/\\;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSearchResults(html) {
  const books = [];

  // Strategy 1: 從嵌入的 JS 變數抓書籍資料
  const itemsMatch = html.match(/const\s+items\s*=\s*(\[[\s\S]*?\]);/);
  let itemsMap = {};
  if (itemsMatch) {
    try {
      const items = JSON.parse(itemsMatch[1]);
      items.forEach(item => {
        itemsMap[item.item_id] = {
          id: item.item_id,
          title: item.item_name,
          price: item.price,
          publisher: item.item_brand,
        };
      });
    } catch (e) { /* 跳過 */ }
  }

  // Strategy 2: 從 HTML 抓封面 + 作者
  const coverPattern = /<a\s+href="https?:\/\/readmoo\.com\/book\/(\d+)"[^>]*class="book-cover product-link"[^>]*aria-label="([^"]*)"[^>]*>[\s\S]*?data-lazy-original="([^"]*)"[^>]*>/g;
  let match;
  const coverMap = {};
  while ((match = coverPattern.exec(html)) !== null) {
    coverMap[match[1]] = { title: match[2], cover: match[3] };
  }

  const authorPattern = /<a\s+href="https?:\/\/readmoo\.com\/contributor\/\d+"[^>]*aria-label="作者\s+([^"]*)"[^>]*>/g;
  const authors = [];
  while ((match = authorPattern.exec(html)) !== null) {
    authors.push(match[1]);
  }

  // 合併
  const ids = Object.keys(itemsMap);
  if (ids.length > 0) {
    ids.forEach((id, index) => {
      const item = itemsMap[id];
      const cover = coverMap[id];
      books.push({
        id: item.id, title: item.title, price: item.price,
        publisher: item.publisher, author: authors[index] || '',
        cover: cover?.cover || '',
        url: `https://readmoo.com/book/${item.id}`,
      });
    });
  } else {
    Object.entries(coverMap).forEach(([id, data], index) => {
      books.push({
        id, title: data.title, price: 0, publisher: '',
        author: authors[index] || '', cover: data.cover,
        url: `https://readmoo.com/book/${id}`,
      });
    });
  }

  return books;
}

export function parsePublishDate(html) {
  const tag = html.match(/<meta\b[^>]*itemprop=["']datePublished["'][^>]*>/i)?.[0];
  if (!tag) return '';

  const rawDate = tag.match(/content=["'](\d{4})[\/-](\d{2})[\/-](\d{2})["']/i);
  return rawDate ? `${rawDate[1]}-${rawDate[2]}-${rawDate[3]}` : '';
}

// 平行抓出版日期（每本書打一次詳情頁，最多 10 本）
async function fetchPublishDates(books) {
  // 最多抓前 10 本，避免打太多 request
  const targets = books.slice(0, 10);

  const results = await Promise.allSettled(
    targets.map(async (book) => {
      try {
        const res = await fetch(book.url, { headers: FETCH_HEADERS });
        if (!res.ok) return;
        const html = await res.text();
        const pubdate = parsePublishDate(html);
        if (pubdate) book.pubdate = pubdate;
      } catch (e) {
        // 單本抓不到就跳過，不影響其他
      }
    })
  );
}
