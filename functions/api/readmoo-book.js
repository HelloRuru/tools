// Cloudflare Pages Function: /api/readmoo-book?url=READMOO_URL_OR_ID
// 從讀墨書本網址（或 ID）抓詳情頁，回傳書名/作者/封面/價格/出版日

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9',
  'Accept': 'text/html',
};

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(context.request.url);
  const input = url.searchParams.get('url')?.trim();

  if (!input) {
    return resp({ error: '請提供讀墨書本網址或 ID' }, 400);
  }

  // 從輸入抓 13/15 位數 book ID
  // 支援格式：
  //   https://readmoo.com/book/210327058000101
  //   https://share.readmoo.com/book/994525
  //   210327058000101
  //   994525
  const idMatch = input.match(/\b(\d{6,15})\b/);
  if (!idMatch) {
    return resp({ error: '看不出書本 ID。請貼像 https://readmoo.com/book/XXX 的網址' }, 400);
  }
  let bookId = idMatch[1];

  try {
    let bookHtml = '';
    let realId = bookId;

    // 短 ID（6-12 位）= share.readmoo.com 的舊 ID，先去 share 頁拿正規 ID
    if (bookId.length < 13) {
      const shareRes = await fetch(`https://share.readmoo.com/book/${bookId}`, { headers: FETCH_HEADERS });
      if (!shareRes.ok) return resp({ error: `share 頁回 ${shareRes.status}（這個 ID 可能已失效）` }, 502);
      const shareHtml = await shareRes.text();
      const m = shareHtml.match(/(?:^|[^\d])(2\d{14})(?:[^\d]|$)/);
      if (!m) return resp({ error: '無法從 share 頁找到正規 book ID' }, 502);
      realId = m[1];
    }

    const bookRes = await fetch(`https://readmoo.com/book/${realId}`, { headers: FETCH_HEADERS });
    if (!bookRes.ok) return resp({ error: `讀墨回 ${bookRes.status}（這本書可能已下架）` }, 502);
    bookHtml = await bookRes.text();

    const title = (bookHtml.match(/<h1[^>]*class="book-detail-title"[^>]*>([^<]+)<\/h1>/) || [])[1]?.trim() || '';
    if (!title) return resp({ error: '抓不到書名，這個網址不像是讀墨書本頁' }, 502);

    let author = '';
    const authorMatch = bookHtml.match(/<a[^>]*itemprop="author"[^>]*>([^<]+)<\/a>/);
    if (authorMatch) {
      author = authorMatch[1].trim();
    } else {
      const ogTitle = (bookHtml.match(/property="og:title"\s+content="([^"]+)"/) || [])[1] || '';
      const dashIdx = ogTitle.lastIndexOf(' - ');
      const pipeIdx = ogTitle.indexOf(' | ');
      if (dashIdx > 0 && pipeIdx > dashIdx) {
        author = ogTitle.substring(dashIdx + 3, pipeIdx).trim();
      }
    }

    const cover = (bookHtml.match(/property="og:image"\s+content="([^"]+)"/) || [])[1] || '';
    const publisher = (bookHtml.match(/<a[^>]*itemprop="publisher"[^>]*>([^<]+)<\/a>/) || [])[1]?.trim() || '';
    const priceStr = (bookHtml.match(/itemprop="price"[^>]*content="([0-9.]+)"/) || [])[1]
                  || (bookHtml.match(/"price":\s*"?([0-9.]+)"?/) || [])[1] || '';
    const price = priceStr ? parseFloat(priceStr) : 0;
    const pubdate = (bookHtml.match(/出版日期：(\d{4}-\d{2}-\d{2})/) || [])[1] || '';

    // 標籤：讀墨書頁底部的 <a href="/tag/xxx">標籤名</a>
    const tags = [];
    const tagRegex = /<a[^>]+href="(?:https?:\/\/readmoo\.com)?\/tag\/[^"]+"[^>]*>([^<]+)<\/a>/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(bookHtml)) !== null) {
      const t = tagMatch[1].trim();
      if (t && !tags.includes(t)) tags.push(t);
    }

    return resp({
      book: {
        id: realId,
        title,
        author,
        publisher,
        price,
        cover,
        pubdate,
        tags,
        url: `https://readmoo.com/book/${realId}`,
      },
    });
  } catch (err) {
    return resp({ error: err.message }, 500);
  }
}

function resp(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS_HEADERS });
}
