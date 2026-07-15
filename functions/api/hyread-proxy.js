// HyRead 圖書館 API Proxy
// 參考：Taiwan-Ebook-Lover (MIT)、Library-Hyread-Ebook-Searching (MIT)

const LIBRARIES = {
  klccab:      '基隆市文化局',
  ncl:         '國家圖書館',
  tpml:        '臺北市立圖書館',
  tphcc:       '新北市立圖書館',
  ntledu:      '國立臺灣圖書館',
  tycccgov:    '桃園市立圖書館',
  hcmlgov:     '新竹市圖書館',
  hchcc:       '新竹縣公共圖書館',
  miaolilib:   '苗栗縣立圖書館',
  taichunggov: '臺中市立圖書館',
  cabcygov:    '嘉義市政府文化局',
  tnml:        '臺南市立圖書館',
  ksml:        '高雄市立圖書館',
  ilccb:       '宜蘭縣政府文化局',
  hccc:        '花蓮縣文化局',
  cclttct:     '臺東縣政府文化處',
  bocach:      '南投縣公共圖書館',
  ylccb:       '雲林縣公共圖書館',
  chcedu:      '彰化雲端電子書庫',
  pthggov:     '屏東縣公共圖書館',
  kinmen:      '金門縣文化局',
  phhcc:       '澎湖縣圖書館',
  matsucc:     '連江縣公共圖書館',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// 抓 HyRead 頁面 HTML
// 注意（2026-07-15 更新）：HyRead 全站掛上了 Cloudflare 挑戰（Cf-Mitigated: challenge）。
// 規則跟以前完全相反 —— 現在「不帶 User-Agent 會被擋 403」，帶正常的瀏覽器 UA 反而放行。
// 所以這裡改成偽裝成一般 Chrome 請求（UA + Accept-Language），才能通過 Cloudflare。
async function fetchHyRead(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

// 通用解析：從 HTML 找 bookDetail 連結 + 書名 + 封面
// HyRead 的封面和書名常在不同的 <a> 裡，所以要分兩步
function parseBooks(html) {
  const books = [];
  const seen = new Set();
  const coverMap = {};  // id -> 封面 URL
  const titleMap = {};  // id -> 書名
  const idOrder = [];   // 保留原始順序
  let m;

  // 掃描所有 <a href="bookDetail?id=XXX"> 區塊
  const blockRe = /<a[^>]*href="[^"]*bookDetail\.jsp\?id=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = blockRe.exec(html)) !== null) {
    const id = m[1];
    const block = m[2];

    // 記錄順序
    if (!idOrder.includes(id)) idOrder.push(id);

    // 抓封面圖（從 img src）
    if (!coverMap[id]) {
      const imgMatch = block.match(/<img[^>]*src="(https?:\/\/[^"]*bookcover[^"]*)"/i);
      if (imgMatch) coverMap[id] = imgMatch[1];
    }

    // 抓書名（h6 > contTxt > 純文字 > img title/alt）
    if (!titleMap[id]) {
      const h6Match = block.match(/<h6[^>]*>([\s\S]*?)<\/h6>/i);
      const contMatch = block.match(/<div[^>]*class="[^"]*contTxt[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const plainText = block.replace(/<[^>]*>/g, '').trim();
      const titleMatch = block.match(/<img[^>]*title="([^"#]+)"/i);
      const altMatch = block.match(/<img[^>]*alt="([^"]+)"/i);

      const t = (h6Match ? h6Match[1].replace(/<[^>]*>/g, '').trim() : '')
        || (contMatch ? contMatch[1].replace(/<[^>]*>/g, '').trim() : '')
        || (plainText && plainText.length < 200 ? plainText : '')
        || (titleMatch ? titleMatch[1].trim() : '')
        || (altMatch ? altMatch[1].trim() : '');

      if (t) titleMap[id] = decodeEntities(t);
    }
  }

  // 補充：從 book-title > span 抓書名（HyRead One 暢銷榜用）
  const btSpanRe = /<a[^>]*href="[^"]*bookDetail\.jsp\?id=(\d+)[^"]*"[^>]*>[\s\S]*?<div class="book-title">\s*<span>([^<]+)<\/span>/gi;
  while ((m = btSpanRe.exec(html)) !== null) {
    const id = m[1];
    if (!idOrder.includes(id)) idOrder.push(id);
    if (!titleMap[id]) {
      titleMap[id] = decodeEntities(m[2].trim());
    }
  }

  // 補充：從 book-title-01 裡抓書名（書店搜尋結果用）
  const btRe = /<div[^>]*class="[^"]*book-title-01[^"]*"[^>]*>\s*<a[^>]*href="[^"]*bookDetail\.jsp\?id=(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = btRe.exec(html)) !== null) {
    const id = m[1];
    if (!idOrder.includes(id)) idOrder.push(id);
    if (!titleMap[id]) {
      titleMap[id] = decodeEntities(m[2].replace(/<[^>]*>/g, '').trim());
    }
  }

  // 補充：從 bookPic img src 抓封面（書店搜尋結果用）
  const bpRe = /<img[^>]*src="(https?:\/\/[^"]*bookcover\/(\d+)[^"]*)"[^>]*class="[^"]*bookPic[^"]*"/gi;
  const bpRe2 = /<img[^>]*class="[^"]*bookPic[^"]*"[^>]*src="(https?:\/\/[^"]*bookcover\/(\d+)[^"]*)"[^>]*/gi;
  for (const re of [bpRe, bpRe2]) {
    while ((m = re.exec(html)) !== null) {
      // 從封面 URL 裡提取 id（bookcover/485700978...jpg → 485700 是前 N 位）
      // 用 idOrder 裡的 id 去匹配
      for (const knownId of idOrder) {
        if (m[1].includes(`bookcover/${knownId}`)) {
          if (!coverMap[knownId]) coverMap[knownId] = m[1];
          break;
        }
      }
    }
  }

  // 組合結果
  for (const id of idOrder) {
    if (seen.has(id) || !titleMap[id]) continue;
    seen.add(id);
    books.push({
      id,
      title: titleMap[id],
      thumbnail: coverMap[id] || '',
    });
  }

  return books;
}

// 解析熱門書 HTML（topLendBook.jsp）
function parseTopBooks(html) {
  const books = parseBooks(html);
  return books.map((b, i) => ({
    rank: i + 1,
    title: b.title,
    id: b.id,
    thumbnail: b.thumbnail || '',
  }));
}

// 解析新書上架 HTML（moccount-page.jsp）
function parseNewBooks(html) {
  return parseBooks(html).map(b => ({
    title: b.title,
    id: b.id,
    thumbnail: b.thumbnail || '',
  }));
}

// 解析搜尋結果 HTML（searchList.jsp）
function parseSearchResults(html) {
  return parseBooks(html).map(b => ({
    title: b.title,
    id: b.id,
    thumbnail: b.thumbnail || '',
  }));
}

// 兩步走：在指定圖書館分站搜尋（破解 AJAX info 參數）
// scope: 2 = 全部館藏 / 4 = 計次館藏 / 1 = 本館 / 3 = 試用
async function librarySearch(lib, query, scope = 4) {
  const encoded = encodeURIComponent(query);
  const searchUrl = `https://${lib}.ebook.hyread.com.tw/searchList.jsp?search_field=FullText&search_input=${encoded}&target=lib&scope=${scope}&isRental=0`;

  // Step 1: 拿 HTML 撈 info 字串（伺服器把加密後的參數寫死在 inline script）
  const html = await fetchHyRead(searchUrl);
  const infoMatch = html.match(/url:\s*aaa\+'slp_searchResultHtmlAjax\.jsp'[\s\S]*?info\s*:\s*'([^']+)'/);
  if (!infoMatch) {
    return { lib, query, scope, queryNum: 0, totalpage: 0, books: [], error: 'info-not-found' };
  }
  const info = infoMatch[1];

  // Step 2: POST AJAX 端點拿結果片段
  const ajaxRes = await fetch(`https://${lib}.ebook.hyread.com.tw/mservice/slp_searchResultHtmlAjax.jsp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': '*/*',
      'Referer': searchUrl,
    },
    body: 'info=' + encodeURIComponent(info),
  });
  const resultHtml = await ajaxRes.text();

  // 解析總筆數（HTML 註解裡的 debug info：totalpage / queryNum）
  const debugMatch = resultHtml.match(/totalpage\s*:\s*(\d+)[\s\S]*?queryNum\s*:\s*(\d+)/);
  const totalpage = debugMatch ? parseInt(debugMatch[1], 10) : 0;
  const queryNum = debugMatch ? parseInt(debugMatch[2], 10) : 0;

  // 解析書本：從 section.book__list 之類的 wrapper 撈 bookDetail 連結 + 書名 + 書封
  const books = parseLibrarySearchBooks(resultHtml);

  return { lib, query, scope, queryNum, totalpage, books };
}

// 解析圖書館搜尋的 AJAX HTML 片段
// 結構（每本書）：
//   <a href="/bookDetail.jsp?id=NNN"><img src="https://webcdn2.../bookcover/XXX.jpg"></a>
//   ... <h6><a href="/bookDetail.jsp?id=NNN">書名</a></h6>
//
// 同一個 id 會出現兩次（一次包圖、一次包標題），用第一次出現的位置為書本起點，
// 在後續 2000 字元內撈書名（h6）和書封（bookcover img）。
function parseLibrarySearchBooks(html) {
  const books = [];
  const seen = new Set();

  const idRegex = /href="\/bookDetail\.jsp\?id=(\d+)"/g;
  let m;
  while ((m = idRegex.exec(html)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);

    // 從這個位置往後 2000 字元內找書名和書封
    const nearby = html.slice(m.index, m.index + 2000);
    const titleMatch = nearby.match(/<h6[^>]*>\s*<a[^>]*>([^<]+)<\/a>/);
    const imgMatch = nearby.match(/<img[^>]+src="(https?:\/\/[^"]*bookcover[^"]+)"/);

    books.push({
      id,
      title: titleMatch ? decodeEntities(titleMatch[1].trim()) : '',
      thumbnail: imgMatch ? imgMatch[1] : '',
    });
  }

  return books;
}

function decodeEntities(str) {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// KV 記錄新書首次出現的日期
async function recordFirstSeen(kv, lib, books) {
  if (!kv) return books;
  const key = `firstseen:${lib}`;
  let record = {};
  try {
    const raw = await kv.get(key);
    if (raw) record = JSON.parse(raw);
  } catch { /* ignore */ }

  const today = new Date().toISOString().slice(0, 10);
  let changed = false;

  for (const book of books) {
    if (!record[book.id]) {
      record[book.id] = today;
      changed = true;
    }
    book.firstSeen = record[book.id];
  }

  if (changed) {
    await kv.put(key, JSON.stringify(record), { expirationTtl: 86400 * 90 }); // 保留 90 天
  }

  return books;
}

// ─── 臺灣雲端書庫搜尋（HyRead 搜尋頁 2026-07 起被 Cloudflare 全託管挑戰擋死，改用這個）───
// 臺灣雲端書庫（ebookservice.tw）是另一套全台 24 縣市館的公共電子書借閱系統，
// 提供乾淨的 JSON API、不擋爬蟲，且搜尋結果自帶 sites 陣列（哪些縣市館有此書），
// 天然支援「跨館搜尋」——一次查就知道全台幾個館可借。
// 逆向出的端點：GET /api/1.00/search/web/{館別}/0/{取幾筆}/{起始offset}?q={關鍵字}
//   第三格 = 這次取幾筆、第四格 = 從第幾筆開始（1-based）。tcl 為預設彙整館，搜得到全台書。
const CLOUD_API = 'https://www.ebookservice.tw/api/1.00';

async function cloudSearch(query, size = 30, offset = 1) {
  const url = `${CLOUD_API}/search/web/tcl/0/${size}/${offset}?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'zh-TW,zh;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`雲端書庫 HTTP ${res.status}`);
  const data = await res.json();

  const found = data?.payload?.hits?.found || 0;
  const hits = data?.payload?.hits?.hit || [];

  const books = hits.map(h => {
    const f = h.fields || {};
    // sites 陣列 = 有此書的縣市館（含重複與 "0"，去重去零後即館數）
    const siteSet = new Set((f.sites || []).filter(s => s && s !== '0'));
    return {
      id: f.id || h.id,
      title: f.title || '',
      creators: Array.isArray(f.creators) ? f.creators.join('、') : (f.creators || ''),
      publisher: f.publisher || '',
      year: f.year || '',
      thumbnail: h.coverImageUrl?.medium || h.coverImageUrl?.small || '',
      siteCount: siteSet.size,
      // 詳情頁：導到臺灣雲端書庫該書
      detailUrl: `https://www.ebookservice.tw/#/book/tcl/${f.id || h.id}`,
    };
  });

  return { query, found, books };
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const kv = context.env.LIBRARY_CACHE || null;

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const action = url.searchParams.get('action');
  const lib = url.searchParams.get('lib');
  const query = url.searchParams.get('q');

  // 回傳圖書館列表
  if (action === 'libraries') {
    return jsonResponse({ libraries: LIBRARIES });
  }

  // 驗證圖書館代碼
  if (lib && !LIBRARIES[lib]) {
    return jsonResponse({ error: '不支援的圖書館代碼' }, 400);
  }

  try {
    if (action === 'top' && lib) {
      // 熱門排行
      const html = await fetchHyRead(
        `https://${lib}.ebook.hyread.com.tw/Template/RWD3.0/topLendBook.jsp`
      );
      const books = parseTopBooks(html);
      return jsonResponse({ library: LIBRARIES[lib], books });

    } else if (action === 'new' && lib) {
      // 計次新書上架（先抓第 1 頁取總頁數，再平行抓剩餘頁）
      const baseUrl = `https://${lib}.ebook.hyread.com.tw/Template/RWD3.0/moccount-page.jsp`;
      const firstHtml = await fetchHyRead(baseUrl);

      // 從 HTML 取得總頁數（「共 N 頁」）
      const totalMatch = firstHtml.match(/共\s*(\d+)\s*頁/);
      const totalPages = totalMatch ? Math.min(parseInt(totalMatch[1], 10), 30) : 1;

      const seenIds = new Set();
      const books = [];
      for (const b of parseNewBooks(firstHtml)) {
        if (!seenIds.has(b.id)) { seenIds.add(b.id); books.push(b); }
      }

      if (totalPages > 1) {
        const restUrls = [];
        for (let p = 2; p <= totalPages; p++) {
          restUrls.push(fetchHyRead(`${baseUrl}?nowpage=${p}`));
        }
        const restPages = await Promise.all(restUrls);
        for (const pageHtml of restPages) {
          for (const b of parseNewBooks(pageHtml)) {
            if (!seenIds.has(b.id)) { seenIds.add(b.id); books.push(b); }
          }
        }
      }

      await recordFirstSeen(kv, lib, books);
      return jsonResponse({ library: LIBRARIES[lib], books });

    } else if (action === 'bestseller') {
      // HyRead 書店暢銷榜（要花錢買的書）
      const html = await fetchHyRead(
        'https://one.ebook.hyread.com.tw/Template/GO/bestSelling.jsp'
      );
      const books = parseBooks(html);
      return jsonResponse({ books: books.map((b, i) => ({ rank: i + 1, ...b })) });

    } else if (action === 'free-hits' && lib) {
      // 圖書館（熱門 + 新書多頁）vs HyRead 暢銷榜 + Readmoo 暢銷榜 交叉比對
      const MAX_NEW_PAGES = 3;
      const newPageUrls = [];
      for (let p = 1; p <= MAX_NEW_PAGES; p++) {
        newPageUrls.push(
          fetchHyRead(`https://${lib}.ebook.hyread.com.tw/Template/RWD3.0/moccount-page.jsp?nowpage=${p}`)
        );
      }

      const [topHtml, hyreadBestHtml, readmooHtml, ...newPages] = await Promise.all([
        fetchHyRead(`https://${lib}.ebook.hyread.com.tw/Template/RWD3.0/topLendBook.jsp`),
        fetchHyRead('https://one.ebook.hyread.com.tw/Template/GO/bestSelling.jsp'),
        fetchHyRead('https://readmoo.com/search/popular'),
        ...newPageUrls,
      ]);

      // 合併圖書館書籍：熱門排行 + 多頁新書（去重）
      const topBooks = parseTopBooks(topHtml);
      const allLibBooks = [...topBooks];
      const seenIds = new Set(topBooks.map(b => b.id));
      for (const pageHtml of newPages) {
        const pageBooks = parseNewBooks(pageHtml);
        for (const b of pageBooks) {
          if (!seenIds.has(b.id)) {
            seenIds.add(b.id);
            allLibBooks.push(b);
          }
        }
      }

      const hyreadBest = parseBooks(hyreadBestHtml);

      // Readmoo 暢銷榜：從 img alt 抓書名
      const readmooBest = [];
      const rmRe = /<img[^>]*alt="([^"]{2,100})"[^>]*>/gi;
      let rmm;
      const rmSkip = /logo|app|readmoo|mobile|排行|裝飾|下載/i;
      const rmSeen = new Set();
      while ((rmm = rmRe.exec(readmooHtml)) !== null) {
        const t = rmm[1].trim();
        if (t && !rmSkip.test(t) && !rmSeen.has(t)) {
          rmSeen.add(t);
          readmooBest.push({ title: t });
        }
      }

      // 合併兩個暢銷榜（用主書名比對，冒號前的部分）
      const normalize = (t) => (t || '').toLowerCase().replace(/\s+/g, '')
        .replace(/[（(）)【】\[\]：:，,。.、！!？?～~「」『』""''《》〈〉\-—─·・]/g, '');
      const mainTitle = (t) => normalize((t || '').split(/[:：]/)[0]);

      const bestSet = new Set();
      const bestSource = {}; // mainTitle -> 來源
      hyreadBest.forEach(b => {
        const k = mainTitle(b.title);
        if (k.length < 3) return;
        bestSet.add(k);
        bestSource[k] = 'HyRead 熱賣';
      });
      readmooBest.forEach(b => {
        const k = mainTitle(b.title);
        if (k.length < 3) return;
        if (bestSet.has(k)) {
          bestSource[k] = '雙榜熱賣';
        } else {
          bestSet.add(k);
          bestSource[k] = 'Readmoo 熱賣';
        }
      });

      const hits = allLibBooks.filter(b => bestSet.has(mainTitle(b.title)))
        .map(b => ({
          ...b,
          source: bestSource[mainTitle(b.title)] || '',
        }));

      return jsonResponse({
        library: LIBRARIES[lib],
        hits,
        totalLib: allLibBooks.length,
        totalBestseller: bestSet.size,
      });

    } else if (action === 'lib-search' && lib && query) {
      // 圖書館分站搜尋（兩步走破解 AJAX）
      // scope=4 計次 / scope=2 全部館藏（包含計次+買斷）
      const scope = parseInt(url.searchParams.get('scope') || '4', 10);
      const result = await librarySearch(lib, query, scope);
      return jsonResponse({
        library: LIBRARIES[lib],
        ...result,
      });

    } else if (action === 'lib-search-cross' && query) {
      // 跨館搜尋：並行查所有圖書館的「計次」或「全部」館藏
      const scope = parseInt(url.searchParams.get('scope') || '4', 10);
      const libs = Object.keys(LIBRARIES);

      const results = await Promise.allSettled(
        libs.map(libCode => librarySearch(libCode, query, scope))
      );

      const summary = results.map((r, i) => {
        if (r.status === 'fulfilled') {
          return {
            lib: libs[i],
            library: LIBRARIES[libs[i]],
            queryNum: r.value.queryNum,
            books: r.value.books.slice(0, 5), // 每館只回前 5 本，控制 payload
          };
        }
        return { lib: libs[i], library: LIBRARIES[libs[i]], queryNum: 0, error: r.reason?.message };
      });

      // 按筆數降冪排序
      summary.sort((a, b) => (b.queryNum || 0) - (a.queryNum || 0));
      const totalHits = summary.reduce((sum, s) => sum + (s.queryNum || 0), 0);
      const libsWithBook = summary.filter(s => s.queryNum > 0).length;

      return jsonResponse({
        query,
        scope,
        totalHits,
        libsWithBook,
        libCount: libs.length,
        results: summary,
      });

    } else if (action === 'cloud-search' && query) {
      // 臺灣雲端書庫跨館搜尋（HyRead 搜尋頁被 Cloudflare 擋後的替代源）
      // 回傳每本書 + siteCount（全台幾個縣市館有此書）
      const result = await cloudSearch(query, 30, 1);
      return jsonResponse({ source: '臺灣雲端書庫', ...result });

    } else if (action === 'search' && query) {
      // 搜尋 HyRead 書店（靜態 HTML，能抓到結果）— 舊版相容
      const encoded = encodeURIComponent(query);
      const html = await fetchHyRead(
        `https://ebook.hyread.com.tw/searchList.jsp?search_field=FullText&MZAD=0&search_input=${encoded}`
      );
      const books = parseSearchResults(html);
      return jsonResponse({ query, books, source: 'HyRead 書店' });

    } else if (action === 'search-all' && query) {
      // 搜尋 HyRead 書店（同 search，保留 search-all 相容）
      const encoded = encodeURIComponent(query);
      const html = await fetchHyRead(
        `https://ebook.hyread.com.tw/searchList.jsp?search_field=FullText&MZAD=0&search_input=${encoded}`
      );
      const books = parseSearchResults(html);
      return jsonResponse({ query, books, source: 'HyRead 書店' });

    } else {
      return jsonResponse({
        error: '缺少參數',
        usage: {
          libraries: '?action=libraries',
          top: '?action=top&lib=tpml',
          new: '?action=new&lib=tpml',
          libSearch: '?action=lib-search&lib=tpml&q=原子習慣&scope=4 (4=計次 / 2=全部)',
          libSearchCross: '?action=lib-search-cross&q=原子習慣&scope=4',
          search: '?action=search&q=原子習慣 (HyRead 書店搜尋)',
        }
      }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
