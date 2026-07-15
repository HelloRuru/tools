// ─── 圖書館新書探測器 ───

const API_BASE = '/api/hyread-proxy';

// ══════════════════════════════════════════════════
// State
// ══════════════════════════════════════════════════

let currentTab = 'new';
let currentLib = 'tc';
let currentBooks = [];
let sortAsc = true;
let libraries = {};
let isSearchMode = false; // 目前畫面顯示的是不是搜尋結果（影響卡片連結要連書店還是圖書館子站）

// ══════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════

async function fetchAPI(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}?${qs}`);
  if (!res.ok) throw new Error(`API 錯誤 ${res.status}`);
  return await res.json();
}

async function loadLibraries() {
  try {
    const data = await fetchAPI({ action: 'libraries' });
    libraries = data.libraries;
    populateLibrarySelect();
  } catch {
    // 使用內建列表作為備用（臺灣雲端書庫 24 縣市館，北到南）
    libraries = {
      kl: '基隆市', tpe: '臺北市', nt: '新北市', ty: '桃園市',
      hc: '新竹市', hcc: '新竹縣', ml: '苗栗縣', tc: '臺中市',
      chc: '彰化縣', ntc: '南投縣', ylc: '雲林縣', cy: '嘉義市',
      cyc: '嘉義縣', tn: '臺南市', ks: '高雄市', pt: '屏東縣',
      il: '宜蘭縣', hl: '花蓮縣', tt: '臺東縣', ph: '澎湖縣',
      km: '金門縣', ntl2: '國立臺灣圖書館',
    };
    populateLibrarySelect();
  }
}

function populateLibrarySelect() {
  const select = document.getElementById('select-lib');
  select.innerHTML = '';
  for (const [code, name] of Object.entries(libraries)) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    if (code === currentLib) opt.selected = true;
    select.appendChild(opt);
  }
  populateSearchLibSelect();
}

function populateSearchLibSelect() {
  const select = document.getElementById('search-lib');
  if (!select) return;
  select.innerHTML = '';
  const savedLib = localStorage.getItem('searchLib') || 'tpml';
  for (const [code, name] of Object.entries(libraries)) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    if (code === savedLib) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('change', (e) => {
    localStorage.setItem('searchLib', e.target.value);
  });
}

// ══════════════════════════════════════════════════
// Tab 切換
// ══════════════════════════════════════════════════

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

  // 切 tab 時清掉找書助手的搜尋結果，避免兩個結果疊在一起
  const libSearchResult = document.getElementById('lib-search-result');
  if (libSearchResult) {
    libSearchResult.innerHTML = '';
    libSearchResult.classList.add('hidden');
  }

  // 新書 / 熱門都來自雲端書庫、依縣市館，兩個 Tab 都顯示館別選擇器
  const mocHint = document.getElementById('moc-hint');
  if (mocHint) mocHint.style.display = tab === 'new' ? '' : 'none';
  const libSelector = document.getElementById('lib-selector');
  if (libSelector) libSelector.style.display = '';

  loadBooks();
}

// ══════════════════════════════════════════════════
// 載入書籍
// ══════════════════════════════════════════════════

async function loadFreeHits() {
  showLoading(true, `比對${libraries[currentLib] || ''}熱門+新書 vs 書店暢銷榜...`);
  clearResults();

  try {
    const data = await fetchAPI({ action: 'free-hits', lib: currentLib });
    const hits = data.hits || [];
    currentBooks = hits;

    const container = document.getElementById('results');
    const emptyState = document.getElementById('empty-state');
    const sortRow = document.getElementById('sort-row');

    if (hits.length === 0) {
      emptyState.style.display = '';
      emptyState.querySelector('p').textContent =
        `這間圖書館最近上架的 ${data.totalLib} 本新書，都不在書店暢銷榜上。換一間看看？`;
      sortRow.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    sortRow.style.display = '';
    document.getElementById('result-count').textContent =
      `${hits.length} 本熱賣中，圖書館免費借得到`;

    const grid = document.createElement('div');
    grid.className = 'book-grid';

    for (const book of hits) {
      const a = document.createElement('a');
      a.className = 'book-card free-hit';
      a.href = `https://${currentLib}.ebook.hyread.com.tw/bookDetail.jsp?id=${book.id}`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = `
        <span class="free-hit-badge">${book.source || '熱賣'}</span>
        <img class="book-cover" src="${book.thumbnail}" alt="${escapeHtml(book.title)}"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 3 4%22><rect fill=%22%23E5E0DB%22 width=%223%22 height=%224%22/></svg>'">
        <div class="book-title">${escapeHtml(book.title)}</div>
      `;
      grid.appendChild(a);
    }

    container.innerHTML = '';
    container.appendChild(grid);
  } catch (err) {
    showToast('比對失敗：' + err.message);
  } finally {
    showLoading(false);
  }
}

async function loadBooks() {
  const action = currentTab === 'new' ? 'new' : 'top';
  showLoading(true, `正在查詢${libraries[currentLib] || ''}...`);
  clearResults();

  try {
    const data = await fetchAPI({ action, lib: currentLib });
    currentBooks = data.books || [];
    renderBooks();
  } catch (err) {
    showToast('查詢失敗：' + err.message);
    clearResults();
  } finally {
    showLoading(false);
  }
}

async function searchBooks() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) { showToast('請輸入書名'); return; }

  showLoading(true, `查詢「${query}」中（掃全台雲端書庫）...`);
  clearResults();
  document.getElementById('lib-search-result').innerHTML = '';
  document.getElementById('lib-search-result').classList.add('hidden');

  try {
    // 臺灣雲端書庫跨館搜尋：一次查全台，每本書自帶「幾個縣市館可借」
    const res = await fetchAPI({ action: 'cloud-search', q: query });
    renderCloudSearchResult(query, res);
  } catch (err) {
    showToast('搜尋失敗：' + err.message);
  } finally {
    showLoading(false);
  }
}

function renderCloudSearchResult(query, res) {
  const books = res.books || [];
  const found = res.found || 0;
  const titleMatched = res.titleMatched !== false; // 後端沒回就當有命中（相容）

  // 書名沒命中時誠實提示：雲端書庫的搜尋是全文比對，可能沒收這本書
  const notice = (!titleMatched && books.length > 0)
    ? `<p class="cross-notice">雲端書庫裡沒有書名剛好叫「${escapeHtml(query)}」的電子書，以下是內文提到相關字詞的推薦。可試試改打作者、副標，或書名的主要幾個字。</p>`
    : '';

  let html = `
    <div class="lib-search-summary">
      <h2 class="lib-search-title">「${escapeHtml(query)}」全台雲端書庫</h2>
      <p class="cross-desc">共找到 <strong>${found}</strong> 筆相關書籍，以下列出前 ${books.length} 筆。每本書標示「全台幾個縣市館可借」。</p>
      ${notice}
    </div>
  `;

  if (books.length === 0) {
    html += `
      <div class="lib-search-empty">
        <p>找不到「${escapeHtml(query)}」的相關電子書。</p>
        <p>換個關鍵字試試（例如：副標、作者，或只打書名主要幾個字）。</p>
      </div>
    `;
  } else {
    html += '<div class="lib-search-books">';
    for (const book of books) {
      const siteBadge = book.siteCount > 0
        ? `<span class="badge badge-moc">全台 ${book.siteCount} 館可借</span>`
        : '<span class="badge badge-buy">暫無館藏</span>';
      const meta = [book.creators, book.publisher, book.year].filter(Boolean).join('｜');
      html += `
        <a class="lib-book-card" href="${escapeHtml(book.detailUrl)}" target="_blank" rel="noopener">
          <img class="lib-book-cover" src="${escapeHtml(book.thumbnail)}" alt="${escapeHtml(book.title)}" loading="lazy" onerror="this.style.display='none'">
          <div class="lib-book-meta">
            ${siteBadge}
            <div class="lib-book-title">${escapeHtml(book.title)}</div>
            ${meta ? `<div class="lib-book-sub">${escapeHtml(meta)}</div>` : ''}
            <div class="lib-book-link">看借閱頁 →</div>
          </div>
        </a>
      `;
    }
    html += '</div>';
  }

  const container = document.getElementById('lib-search-result');
  container.innerHTML = html;
  container.classList.remove('hidden');

  if (window.lucide) lucide.createIcons();
}

async function crossLibrarySearch(query) {
  const btn = document.getElementById('btn-cross-search');
  if (btn) { btn.disabled = true; btn.textContent = '查詢中（約需 30 秒）...'; }
  showLoading(true, `跨館查詢「${query}」中（並行查 23 間圖書館）...`);

  try {
    // 兩個 scope 並行：計次 + 全部
    const [mocRes, allRes] = await Promise.all([
      fetchAPI({ action: 'lib-search-cross', q: query, scope: 4 }),
      fetchAPI({ action: 'lib-search-cross', q: query, scope: 2 }),
    ]);

    renderCrossResult(query, mocRes, allRes);
  } catch (err) {
    showToast('跨館查詢失敗：' + err.message);
  } finally {
    showLoading(false);
    if (btn) { btn.disabled = false; btn.textContent = '查全台圖書館（會慢一點）'; }
  }
}

function renderCrossResult(query, mocRes, allRes) {
  const mocByLib = {};
  (mocRes.results || []).forEach(r => { mocByLib[r.lib] = r.queryNum || 0; });

  const rows = (allRes.results || []).map(r => ({
    lib: r.lib,
    library: r.library,
    allCount: r.queryNum || 0,
    mocCount: mocByLib[r.lib] || 0,
  }));
  rows.sort((a, b) => b.allCount - a.allCount || b.mocCount - a.mocCount);

  const hitLibs = rows.filter(r => r.allCount > 0);

  let html = `
    <div class="cross-result">
      <h3 class="cross-title">「${escapeHtml(query)}」全台圖書館掃描結果</h3>
      <p class="cross-desc">共 ${rows.length} 間圖書館中，<strong>${hitLibs.length} 間有相關書</strong>。</p>
      <table class="cross-table">
        <thead>
          <tr><th>圖書館</th><th>計次</th><th>買斷</th><th>合計</th></tr>
        </thead>
        <tbody>
  `;
  for (const r of rows) {
    if (r.allCount === 0) continue;
    const buy = r.allCount - r.mocCount;
    const searchUrl = `https://${r.lib}.ebook.hyread.com.tw/searchList.jsp?search_field=FullText&search_input=${encodeURIComponent(query)}&target=lib&scope=2&isRental=0`;
    html += `
      <tr>
        <td><a href="${searchUrl}" target="_blank" rel="noopener">${escapeHtml(r.library)} ↗</a></td>
        <td>${r.mocCount}</td>
        <td>${buy}</td>
        <td><strong>${r.allCount}</strong></td>
      </tr>
    `;
  }
  if (hitLibs.length === 0) {
    html += '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">所有圖書館都沒有，可能要去 HyRead 書店買，或換個關鍵字試試。</td></tr>';
  }
  html += `
        </tbody>
      </table>
      <p class="cross-note">點圖書館名稱可開新分頁前往該館 HyRead 站。注意：計次書全國共用書單、買斷書每館不同。</p>
    </div>
  `;

  const container = document.getElementById('lib-search-result');
  // 接在現有單館結果下方
  container.insertAdjacentHTML('beforeend', html);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

// ══════════════════════════════════════════════════
// 渲染
// ══════════════════════════════════════════════════

function renderBooks() {
  const container = document.getElementById('results');
  const emptyState = document.getElementById('empty-state');
  const countEl = document.getElementById('result-count');
  const sortRow = document.getElementById('sort-row');

  if (currentBooks.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = '';
    emptyState.querySelector('p').textContent = currentTab === 'new'
      ? '此圖書館未啟用計次服務，沒有計次新書。'
      : '沒有找到書籍。';
    sortRow.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  sortRow.style.display = '';
  countEl.textContent = `共 ${currentBooks.length} 本`;

  // 排序
  const sorted = [...currentBooks].sort((a, b) => {
    const cmp = (a.title || '').localeCompare(b.title || '', 'zh-TW');
    return sortAsc ? cmp : -cmp;
  });

  const isTop = currentTab === 'top';
  // 如果是熱門排行，預設按排名排（不按書名）
  const display = isTop && sortAsc ? currentBooks : sorted;

  const grid = document.createElement('div');
  grid.className = 'book-grid';

  for (const book of display) {
    const a = document.createElement('a');
    a.className = 'book-card';
    // 新書 / 熱門都來自臺灣雲端書庫，後端已回傳 detailUrl
    a.href = book.detailUrl || `https://www.ebookservice.tw/#/book/tcl/${book.id}`;
    a.target = '_blank';
    a.rel = 'noopener';

    let rankHtml = '';
    if (isTop && book.rank) {
      const top3 = book.rank <= 3 ? ' top3' : '';
      rankHtml = `<span class="book-rank${top3}">${book.rank}</span>`;
    }

    let dateHtml = '';
    if (book.firstSeen && currentTab === 'new') {
      dateHtml = `<div class="book-date">${book.firstSeen} 上架</div>`;
    }

    a.innerHTML = `
      ${rankHtml}
      <img class="book-cover" src="${book.thumbnail}" alt="${escapeHtml(book.title)}"
           onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 3 4%22><rect fill=%22%23E5E0DB%22 width=%223%22 height=%224%22/></svg>'">
      <div class="book-title">${escapeHtml(book.title)}</div>
      ${dateHtml}
    `;
    grid.appendChild(a);
  }

  container.innerHTML = '';
  container.appendChild(grid);
  lucide.createIcons();
}

function renderSearchResults(results) {
  const container = document.getElementById('results');
  const emptyState = document.getElementById('empty-state');
  const sortRow = document.getElementById('sort-row');

  const entries = Object.entries(results);

  if (entries.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = '';
    emptyState.querySelector('p').textContent = '沒有找到。試試其他關鍵字，或到 HyRead One 搜尋完整館藏。';
    sortRow.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  sortRow.style.display = '';

  let totalBooks = 0;
  entries.forEach(([, v]) => { totalBooks += v.books.length; });
  document.getElementById('result-count').textContent =
    `${entries.length} 間圖書館有結果，共 ${totalBooks} 本`;

  container.innerHTML = '';

  for (const [code, data] of entries) {
    const group = document.createElement('div');
    group.className = 'lib-group';

    group.innerHTML = `
      <div class="lib-group-header">
        <span class="lib-dot"></span>
        <span class="lib-group-name">${escapeHtml(data.name)}</span>
        <span class="lib-group-count">${data.books.length} 本</span>
      </div>
    `;

    const list = document.createElement('div');
    for (const book of data.books) {
      const a = document.createElement('a');
      a.className = 'book-list-item';
      a.href = `https://${code}.ebook.hyread.com.tw/bookDetail.jsp?id=${book.id}`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = `
        <img class="book-cover-sm" src="${book.thumbnail}" alt=""
             onerror="this.style.display='none'">
        <span class="book-title">${escapeHtml(book.title)}</span>
      `;
      list.appendChild(a);
    }

    group.appendChild(list);
    container.appendChild(group);
  }
}

// ══════════════════════════════════════════════════
// Dark Mode
// ══════════════════════════════════════════════════

function initDarkMode() {
  const btn = document.getElementById('btn-dark-mode');
  const saved = localStorage.getItem('helloruru-theme');

  const applyDark = (isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
    const icon = btn?.querySelector('[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
      lucide.createIcons();
    }
  };

  if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches)) {
    applyDark(true);
  }

  btn?.addEventListener('click', () => {
    const isDark = !document.documentElement.classList.contains('dark');
    localStorage.setItem('helloruru-theme', isDark ? 'dark' : 'light');
    applyDark(isDark);
  });
}

// ══════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════

function showLoading(show, text) {
  const el = document.getElementById('loading');
  el.style.display = show ? '' : 'none';
  if (text) document.getElementById('loading-text').textContent = text;
}

function clearResults() {
  document.getElementById('results').innerHTML = '';
  document.getElementById('sort-row').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';
  isSearchMode = false;
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = '';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ══════════════════════════════════════════════════
// Init
// ══════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  loadLibraries();

  // Tab
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // 圖書館切換
  document.getElementById('select-lib').addEventListener('change', (e) => {
    currentLib = e.target.value;
    if (currentTab === 'free-hits') loadFreeHits();
    else if (currentTab !== 'search') loadBooks();
  });

  // 搜尋
  document.getElementById('btn-search').addEventListener('click', searchBooks);
  document.getElementById('search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchBooks();
  });

  // 排序
  document.getElementById('btn-sort').addEventListener('click', () => {
    sortAsc = !sortAsc;
    document.getElementById('btn-sort').innerHTML =
      `<i data-lucide="arrow-up-down" width="14" height="14"></i> ${sortAsc ? '按書名' : '按書名 Z-A'}`;
    lucide.createIcons();
    if (currentTab !== 'search') renderBooks();
  });

  // 回頂層按鈕
  const btnTop = document.getElementById('btn-back-top');
  window.addEventListener('scroll', () => {
    btnTop.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
  btnTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // 初始載入（預設 Tab 是最新上架，顯示提示 + 圖書館選擇器）
  const mocHint = document.getElementById('moc-hint');
  if (mocHint) mocHint.style.display = '';
  const libSelector = document.getElementById('lib-selector');
  if (libSelector) libSelector.style.display = '';
  lucide.createIcons();
  loadBooks();
});
