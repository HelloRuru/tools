/**
 * 推薦書單 — 透過 Apps Script 寫入共用 Sheet recommends 分頁
 * 功能：
 *   - PO 推薦（自動抓讀墨書資、同一本書多人推薦合併到一張卡）
 *   - 匿名點愛心（localStorage 防重複）
 *   - 標籤自動合併、點標籤篩選
 *   - 三種排序：愛心 / 推薦人數 / 最新
 *   - 一鍵複製到社團（詳細版 / 簡潔版 / 不含 AP）
 *   - 加到「我的書單」（連動 books.js）
 *   - 離線 fallback（fetch 成功後存 localStorage 快照）
 */

const RECOMMEND_GAS_URL = 'https://script.google.com/macros/s/AKfycbzaIpW_bkjDqspXf_zbv0ok0jsDKIOPcXdfuTcIWQagFoT-7lbsdK2Ges4iNZuFBBXg/exec';
const RECOMMEND_SNAPSHOT_KEY = 'readmoo-recommend-snapshot';
const RECOMMEND_LIKED_KEY = 'readmoo-recommend-liked';
const RECOMMEND_NICK_KEY = 'readmoo-ap-nick';

let recommendList = [];
let recommendCurrentSort = 'likes';
let recommendCurrentTag = '';
let recommendIsOffline = false;

function initRecommend() {
  const root = document.getElementById('tab-recommend');
  if (!root) return;

  bindRecommendNick();
  bindRecommendForm();
  bindRecommendFilter();
  bindRecommendEditModal();

  loadRecommends();
}

function bindRecommendEditModal() {
  const close = document.getElementById('recommend-edit-close-btn');
  const cancel = document.getElementById('recommend-edit-cancel-btn');
  const save = document.getElementById('recommend-edit-save-btn');
  const modal = document.getElementById('recommend-edit-modal');

  if (close) close.addEventListener('click', closeRecommendEditModal);
  if (cancel) cancel.addEventListener('click', closeRecommendEditModal);
  if (save) save.addEventListener('click', submitRecommendEdit);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeRecommendEditModal();
    });
  }
}

function bindRecommendNick() {
  const nickInput = document.getElementById('recommend-nick-input');
  const localUser = (window.AppState && window.AppState.user && window.AppState.user.name) || '';
  const savedNick = localUser || localStorage.getItem(RECOMMEND_NICK_KEY) || '';
  if (nickInput) {
    nickInput.value = savedNick;
    if (savedNick) localStorage.setItem(RECOMMEND_NICK_KEY, savedNick);
  }
}

function getRecommendNick() {
  const nickInput = document.getElementById('recommend-nick-input');
  const v = nickInput ? nickInput.value.trim() : '';
  if (v) {
    localStorage.setItem(RECOMMEND_NICK_KEY, v);
    return v;
  }
  return localStorage.getItem(RECOMMEND_NICK_KEY) || '';
}

function resolveRecommendNickFromDirectory(nick) {
  // 暱稱必須原樣保留，不能把純數字誤當成 AP 名冊 ID。
  // Sheet 公式曾把「+1」寫成「1」，自動對名會把資料掛到別人名下。
  return nick || '';
}

function bindRecommendForm() {
  const form = document.getElementById('recommend-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitRecommend();
  });

  // 讀墨搜尋
  const searchBtn = document.getElementById('recommend-search-btn');
  const urlInput = document.getElementById('recommend-url');
  if (searchBtn) searchBtn.addEventListener('click', () => searchReadmoo());
  if (urlInput) {
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        const v = urlInput.value.trim();
        // 看起來不像 URL 就走搜尋
        if (v && !/^(https?:\/\/|moo\.im\/|\d{12,})/.test(v)) {
          e.preventDefault();
          searchReadmoo();
        }
      }
    });
  }
}

async function searchReadmoo() {
  const urlInput = document.getElementById('recommend-url');
  const resultsEl = document.getElementById('recommend-search-results');
  const searchBtn = document.getElementById('recommend-search-btn');
  if (!urlInput || !resultsEl) return;

  const q = urlInput.value.trim();
  if (!q) {
    showRecommendToast('請先輸入書名');
    return;
  }
  if (q.length < 2) {
    showRecommendToast('關鍵字至少兩個字');
    return;
  }

  resultsEl.style.display = 'block';
  resultsEl.innerHTML = '<div class="recommend-search-loading">搜尋讀墨中…</div>';
  if (searchBtn) {
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<i data-lucide="loader"></i> 搜尋中';
    if (window.lucide) lucide.createIcons();
  }

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(`/api/readmoo-search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || ('HTTP ' + res.status));
    }
    const data = await res.json();
    const books = (data && data.books) || [];

    if (books.length === 0) {
      const qe = encodeURIComponent(q);
      resultsEl.innerHTML = `
        <div class="recommend-search-zero">
          <p>沒找到 <strong>${escRec(q)}</strong></p>
          <div class="recommend-search-actions">
            <a href="https://readmoo.com/search/keyword?q=${qe}" target="_blank" rel="noopener" class="btn-secondary btn-sm">
              <i data-lucide="external-link"></i> 到讀墨找
            </a>
            <a href="https://www.google.com/search?q=site%3Areadmoo.com+${qe}" target="_blank" rel="noopener" class="btn-secondary btn-sm">
              <i data-lucide="external-link"></i> Google 搜
            </a>
          </div>
          <p class="hint-text">找到後把網址貼回上面欄位</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    resultsEl.innerHTML = `
      <div class="recommend-search-head">找到 ${books.length} 本：點選一本帶入</div>
      <div class="recommend-search-list">
        ${books.slice(0, 10).map((b) => `
          <button type="button" class="recommend-search-item" data-url="${escRec(b.url || '')}" data-title="${escRec(b.title || '')}" data-author="${escRec(b.author || '')}">
            ${b.cover ? `<img src="${escRec(b.cover)}" alt="" loading="lazy">` : '<div class="recommend-search-noimg"><i data-lucide="book"></i></div>'}
            <div class="recommend-search-info">
              <strong>${escRec(b.title || '')}</strong>
              <span>${escRec(b.author || '')}${b.publisher ? '・' + escRec(b.publisher) : ''}</span>
            </div>
          </button>
        `).join('')}
      </div>
    `;

    resultsEl.querySelectorAll('.recommend-search-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        const title = btn.getAttribute('data-title');
        const author = btn.getAttribute('data-author');
        if (urlInput) urlInput.value = url;
        const titleFb = document.getElementById('recommend-title-fallback');
        const authorFb = document.getElementById('recommend-author-fallback');
        if (titleFb && !titleFb.value) titleFb.value = title || '';
        if (authorFb && !authorFb.value) authorFb.value = author || '';
        resultsEl.style.display = 'none';
        resultsEl.innerHTML = '';
        showRecommendToast('已帶入「' + (title || '') + '」');
      });
    });

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    resultsEl.innerHTML = `<div class="recommend-search-error">搜尋失敗：${escRec(err.message || '未知錯誤')}</div>`;
  } finally {
    if (searchBtn) {
      searchBtn.disabled = false;
      searchBtn.innerHTML = '<i data-lucide="search"></i> 搜尋';
      if (window.lucide) lucide.createIcons();
    }
  }
}

async function submitRecommend() {
  const rawNick = getRecommendNick();
  if (!rawNick) {
    showRecommendToast('請先填上你的暱稱');
    return;
  }
  const nick = resolveRecommendNickFromDirectory(rawNick);

  const inputUrl = document.getElementById('recommend-url').value.trim();
  const text = document.getElementById('recommend-text').value.trim();
  const userTagsRaw = document.getElementById('recommend-tags').value.trim();
  const title = document.getElementById('recommend-title-fallback').value.trim();
  const author = document.getElementById('recommend-author-fallback').value.trim();

  if (!inputUrl) {
    showRecommendToast('請貼上讀墨連結');
    return;
  }
  if (!text) {
    showRecommendToast('請寫一下推薦理由');
    return;
  }

  const user_tags = userTagsRaw
    ? userTagsRaw.split(/[,，、\s]+/).filter(Boolean).join('|')
    : '';

  const submitBtn = document.getElementById('recommend-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '送出中…';
  }

  try {
    const res = await postRecommendToGas({
      action: 'recommend_create',
      nick: nick,
      input_url: inputUrl,
      text: text,
      user_tags: user_tags,
      title: title,
      author: author
    });
    if (res.success) {
      showRecommendToast(res.existing ? '已加入你對這本書的推薦' : 'PO 推薦成功！');
      document.getElementById('recommend-form').reset();
      await loadRecommends();
    } else {
      showRecommendToast('PO 失敗：' + (res.message || '未知錯誤'));
    }
  } catch (err) {
    showRecommendToast('網路異常：' + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="send"></i> PO 推薦';
      if (window.lucide) lucide.createIcons();
    }
  }
}

async function postRecommendToGas(payload) {
  const res = await fetch(RECOMMEND_GAS_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return await res.json();
}

async function loadRecommends() {
  const listEl = document.getElementById('recommend-list');
  const offlineBanner = document.getElementById('recommend-offline-banner');
  if (!listEl) return;

  listEl.innerHTML = '<div class="recommend-loading">讀取中…</div>';

  try {
    const url = RECOMMEND_GAS_URL + '?type=recommends&_t=' + Date.now();
    const res = await fetch(url);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      recommendList = json.data;
      localStorage.setItem(RECOMMEND_SNAPSHOT_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        data: recommendList
      }));
      recommendIsOffline = false;
      if (offlineBanner) offlineBanner.style.display = 'none';
    } else {
      throw new Error(json.message || '回傳格式異常');
    }
  } catch (err) {
    const snapshot = readStoredJson(RECOMMEND_SNAPSHOT_KEY, null);
    if (snapshot && snapshot.data) {
      recommendList = snapshot.data;
      recommendIsOffline = true;
      if (offlineBanner) {
        offlineBanner.style.display = 'block';
        offlineBanner.textContent = '離線模式：顯示 ' + formatRelTime(snapshot.savedAt) + ' 的快照';
      }
    } else {
      listEl.innerHTML = '<div class="recommend-error">讀不到資料、也沒快取。請檢查網路後重試。</div>';
      return;
    }
  }

  renderTagCloud();
  renderRecommendList();
}

function renderTagCloud() {
  const cloudEl = document.getElementById('recommend-tag-cloud');
  if (!cloudEl) return;

  const tagCounts = new Map();
  recommendList.forEach((r) => {
    [].concat(r.official_tags || [], r.user_tags || []).forEach((t) => {
      const key = String(t).trim();
      if (!key) return;
      tagCounts.set(key, (tagCounts.get(key) || 0) + 1);
    });
  });

  if (tagCounts.size === 0) {
    cloudEl.innerHTML = '<span class="recommend-tag-empty">還沒有標籤</span>';
    return;
  }

  const sorted = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  cloudEl.innerHTML =
    `<button class="recommend-tag-chip${recommendCurrentTag === '' ? ' active' : ''}" data-tag="">全部</button>` +
    sorted.map(([tag, count]) =>
      `<button class="recommend-tag-chip${recommendCurrentTag === tag ? ' active' : ''}" data-tag="${escRec(tag)}">${escRec(tag)} <span class="recommend-tag-count">×${count}</span></button>`
    ).join('');

  cloudEl.querySelectorAll('.recommend-tag-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      recommendCurrentTag = btn.getAttribute('data-tag') || '';
      renderTagCloud();
      renderRecommendList();
    });
  });
}

function renderRecommendList() {
  const listEl = document.getElementById('recommend-list');
  const countEl = document.getElementById('recommend-count');
  const emptyEl = document.getElementById('recommend-empty');
  if (!listEl) return;

  let filtered = recommendList.slice();

  if (recommendCurrentTag) {
    filtered = filtered.filter((r) => {
      const allTags = [].concat(r.official_tags || [], r.user_tags || []);
      return allTags.some((t) => String(t).trim() === recommendCurrentTag);
    });
  }

  if (recommendCurrentSort === 'likes') {
    filtered.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
  } else if (recommendCurrentSort === 'recommenders') {
    filtered.sort((a, b) => (b.recommenders?.length || 0) - (a.recommenders?.length || 0));
  } else if (recommendCurrentSort === 'newest') {
    filtered.sort((a, b) => String(b.last_recommend_at || '').localeCompare(String(a.last_recommend_at || '')));
  }

  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  const likedIds = new Set(readStoredJson(RECOMMEND_LIKED_KEY, []));

  listEl.innerHTML = filtered.map((r) => renderRecommendCard(r, likedIds)).join('');

  bindRecommendCardEvents();
  if (window.lucide) lucide.createIcons();

  // 補抓缺封面 / 標題 / 作者的書資（透過 Cloudflare Function /api/readmoo-book）
  enrichMissingBookInfo(filtered);
}

const _enrichmentCache = new Map();

async function enrichMissingBookInfo(items) {
  for (const r of items) {
    const needsBasic = !r.cover_url || !r.title || !r.author;
    const needsTags = !r.official_tags || r.official_tags.length === 0;
    if (!needsBasic && !needsTags) continue;
    if (_enrichmentCache.has(r.id)) continue;
    if (!r.readmoo_url) continue;
    _enrichmentCache.set(r.id, true);

    try {
      const res = await fetch(`/api/readmoo-book?url=${encodeURIComponent(r.readmoo_url)}`);
      if (!res.ok) continue;
      const j = await res.json();
      if (!j || !j.book) continue;
      const b = j.book;
      const card = document.querySelector(`.recommend-card[data-id="${r.id}"]`);
      if (!card) continue;

      if (b.cover && !r.cover_url) {
        const coverEl = card.querySelector('.recommend-cover');
        if (coverEl) {
          coverEl.innerHTML = `<img src="${escRec(b.cover)}" alt="${escRec(b.title || '')}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="recommend-cover-fallback" style="display:none"><i data-lucide="book"></i></div>`;
        }
        r.cover_url = b.cover;
      }
      if (b.title && !r.title) {
        const titleEl = card.querySelector('.recommend-title');
        if (titleEl) titleEl.textContent = b.title;
        r.title = b.title;
      }
      if ((b.author || b.publisher) && !r.author) {
        const metaEl = card.querySelector('.recommend-meta');
        if (metaEl) {
          let html = '';
          if (b.author) html += `<span>${escRec(b.author)}</span>`;
          if (b.publisher) html += `<span class="recommend-pub">／ ${escRec(b.publisher)}</span>`;
          metaEl.innerHTML = html;
        }
        r.author = b.author || '';
        r.publisher = b.publisher || '';
      }
      if (Array.isArray(b.tags) && b.tags.length > 0 && (!r.official_tags || r.official_tags.length === 0)) {
        r.official_tags = b.tags;
        const tagsEl = card.querySelector('.recommend-tags');
        if (tagsEl) {
          const officialHtml = b.tags.map((t) =>
            `<span class="recommend-tag recommend-tag-official">${escRec(t)}</span>`
          ).join('');
          // 把 official tags 插在最前面（既有的 user tags + 加標籤按鈕保留）
          const existingChildren = Array.from(tagsEl.children);
          tagsEl.innerHTML = officialHtml;
          existingChildren.forEach((c) => tagsEl.appendChild(c));
        }
      }
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      // 抓不到就算了
    }
  }
}

function renderRecommendCard(r, likedIds) {
  const isLiked = likedIds.has(r.id);
  const allTags = [].concat(r.official_tags || [], r.user_tags || []);
  const tagCountsLocal = new Map();
  (r.user_tags || []).forEach((t) => {
    const k = String(t).trim();
    if (!k) return;
    tagCountsLocal.set(k, (tagCountsLocal.get(k) || 0) + 1);
  });

  const officialTagsHtml = (r.official_tags || []).map((t) =>
    `<span class="recommend-tag recommend-tag-official">${escRec(t)}</span>`
  ).join('');

  const userTagsHtml = Array.from(tagCountsLocal.entries()).map(([tag, count]) =>
    `<span class="recommend-tag recommend-tag-user">${escRec(tag)}${count > 1 ? `<span class="recommend-tag-mini-count">×${count}</span>` : ''}</span>`
  ).join('');

  const myNick = getRecommendNick();
  const myResolvedNick = resolveRecommendNickFromDirectory(myNick);
  const recommendersHtml = (r.recommenders || []).map((rec, idx) => {
    const rawText = String(rec.text || '');
    const needsClamp = rawText.length > 180 || (rawText.match(/\n/g) || []).length >= 3;
    const textHtml = escRecMultiline(rawText);
    const textId = `rec-text-${r.id}-${idx}`;
    const recNick = resolveRecommendNickFromDirectory(rec.nick);
    const isMyText = myNick && (recNick === myResolvedNick || rec.nick === myNick);
    return `<div class="recommend-person">
       <span class="recommend-person-nick">@${escRec(recNick)}${isMyText ? `<button type="button" class="recommend-edit-text-btn" data-edit-text="${escRec(r.id)}" title="修改我的推薦"><i data-lucide="pencil"></i> 修改</button>` : ''}</span>
       <p class="recommend-person-text${needsClamp ? ' is-clamped' : ''}" id="${textId}">${textHtml}</p>
       ${needsClamp ? `<button type="button" class="recommend-toggle-btn" data-toggle="${textId}">讀更多</button>` : ''}
     </div>`;
  }).join('');

  return `
    <div class="recommend-card" data-id="${escRec(r.id)}">
      <a href="${escRec(r.readmoo_url)}" target="_blank" rel="noopener" class="recommend-cover" title="到讀墨看《${escRec(r.title || '這本書')}》">
        ${r.cover_url
          ? `<img src="${escRec(r.cover_url)}" alt="${escRec(r.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div class="recommend-cover-fallback" style="display:none"><i data-lucide="book"></i></div>`
          : `<div class="recommend-cover-fallback"><i data-lucide="book"></i></div>`}
      </a>
      <div class="recommend-main">
        <div class="recommend-head">
          <a href="${escRec(r.readmoo_url)}" target="_blank" rel="noopener" class="recommend-title">
            ${escRec(r.title || '（未填書名）')}
          </a>
          <button class="recommend-like-btn${isLiked ? ' liked' : ''}" data-like="${escRec(r.id)}" title="${isLiked ? '已點過' : '點個愛心'}">
            <i data-lucide="heart"></i>
            <span class="recommend-like-count">${r.like_count || 0}</span>
          </button>
        </div>
        <div class="recommend-meta">
          ${r.author ? `<span>${escRec(r.author)}</span>` : ''}
          ${r.publisher ? `<span class="recommend-pub">／ ${escRec(r.publisher)}</span>` : ''}
        </div>

        <div class="recommend-people">
          <div class="recommend-people-head">
            <i data-lucide="users"></i> ${(r.recommenders || []).length} 人推薦
          </div>
          ${recommendersHtml}
        </div>

        ${officialTagsHtml || userTagsHtml ? `
          <div class="recommend-tags">
            ${officialTagsHtml}
            ${userTagsHtml}
            <button class="recommend-add-tag-btn" data-add-tag="${escRec(r.id)}" title="加標籤">
              <i data-lucide="plus"></i> 加標籤
            </button>
          </div>
        ` : `
          <div class="recommend-tags">
            <button class="recommend-add-tag-btn" data-add-tag="${escRec(r.id)}">
              <i data-lucide="plus"></i> 加標籤
            </button>
          </div>
        `}

        <div class="recommend-actions">
          <button class="btn-secondary btn-sm" data-add-to-books="${escRec(r.id)}">
            <i data-lucide="library"></i> 加到我的書單
          </button>
          <button class="btn-secondary btn-sm" data-copy-share="${escRec(r.id)}" data-format="detail">
            <i data-lucide="copy"></i> 複製到社團（詳細）
          </button>
          <button class="btn-text btn-sm" data-copy-share="${escRec(r.id)}" data-format="simple">
            <i data-lucide="copy"></i> 簡潔版
          </button>
        </div>
      </div>
    </div>
  `;
}

function bindRecommendCardEvents() {
  const listEl = document.getElementById('recommend-list');
  if (!listEl) return;

  listEl.querySelectorAll('[data-like]').forEach((btn) => {
    btn.addEventListener('click', () => likeRecommend(btn.getAttribute('data-like')));
  });

  listEl.querySelectorAll('[data-add-tag]').forEach((btn) => {
    btn.addEventListener('click', () => addTagToRecommend(btn.getAttribute('data-add-tag')));
  });

  listEl.querySelectorAll('[data-add-to-books]').forEach((btn) => {
    btn.addEventListener('click', () => addToMyBooks(btn.getAttribute('data-add-to-books')));
  });

  listEl.querySelectorAll('[data-copy-share]').forEach((btn) => {
    btn.addEventListener('click', () => copyShare(
      btn.getAttribute('data-copy-share'),
      btn.getAttribute('data-format')
    ));
  });

  listEl.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle');
      const p = document.getElementById(id);
      if (!p) return;
      const isClamped = p.classList.toggle('is-clamped');
      btn.textContent = isClamped ? '讀更多' : '收起';
    });
  });

  listEl.querySelectorAll('[data-edit-text]').forEach((btn) => {
    btn.addEventListener('click', () => editMyRecommendText(btn.getAttribute('data-edit-text')));
  });
}

function editMyRecommendText(recommendId) {
  const r = recommendList.find((x) => x.id === recommendId);
  if (!r) return;

  const myNick = getRecommendNick();
  const myResolved = resolveRecommendNickFromDirectory(myNick);
  const myRec = (r.recommenders || []).find((rec) => {
    const recNick = resolveRecommendNickFromDirectory(rec.nick);
    return recNick === myResolved || rec.nick === myNick;
  });
  if (!myRec) {
    showRecommendToast('找不到你對這本書的推薦');
    return;
  }

  const modal = document.getElementById('recommend-edit-modal');
  const idInput = document.getElementById('recommend-edit-id');
  const textArea = document.getElementById('recommend-edit-text');
  const titleHint = document.getElementById('recommend-edit-book-title');
  if (!modal || !textArea) return;

  idInput.value = recommendId;
  textArea.value = myRec.text || '';
  if (titleHint) titleHint.textContent = `修改「${r.title || '這本書'}」的推薦理由`;
  openModal('recommend-edit-modal');
  setTimeout(() => textArea.focus(), 100);
}

function closeRecommendEditModal() {
  closeModal('recommend-edit-modal');
}

async function submitRecommendEdit() {
  const recommendId = document.getElementById('recommend-edit-id').value;
  const newText = document.getElementById('recommend-edit-text').value.trim();
  if (!newText) {
    showRecommendToast('推薦理由不能空白');
    return;
  }

  const r = recommendList.find((x) => x.id === recommendId);
  if (!r) return;

  const myNick = getRecommendNick();
  const saveBtn = document.getElementById('recommend-edit-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '儲存中…'; }

  try {
    const res = await postRecommendToGas({
      action: 'recommend_create',
      nick: myNick,
      input_url: r.readmoo_url,
      text: newText,
      user_tags: ''
    });
    if (res.success) {
      showRecommendToast('已更新你的推薦');
      closeRecommendEditModal();
      await loadRecommends();
    } else {
      showRecommendToast('修改失敗：' + (res.message || ''));
    }
  } catch (err) {
    showRecommendToast('網路異常：' + err.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i data-lucide="save"></i> 儲存';
      if (window.lucide) lucide.createIcons();
    }
  }
}

async function likeRecommend(id) {
  const liked = new Set(readStoredJson(RECOMMEND_LIKED_KEY, []));
  const isCurrentlyLiked = liked.has(id);
  const action = isCurrentlyLiked ? 'recommend_unlike' : 'recommend_like';
  const delta = isCurrentlyLiked ? -1 : 1;

  const item = recommendList.find((r) => r.id === id);
  if (!item) return;
  const oldCount = item.like_count || 0;
  const newCount = Math.max(0, oldCount + delta);
  item.like_count = newCount;

  if (isCurrentlyLiked) liked.delete(id);
  else liked.add(id);
  localStorage.setItem(RECOMMEND_LIKED_KEY, JSON.stringify(Array.from(liked)));

  // 直接更新該卡片的 DOM
  const card = document.querySelector(`.recommend-card[data-id="${id}"]`);
  if (card) {
    const likeBtn = card.querySelector('.recommend-like-btn');
    const countEl = card.querySelector('.recommend-like-count');
    if (likeBtn) {
      if (isCurrentlyLiked) likeBtn.classList.remove('liked');
      else likeBtn.classList.add('liked');
    }
    if (countEl) countEl.textContent = newCount;
  }

  // 背景送 GAS、不等回應
  try {
    const res = await postRecommendToGas({ action: action, id: id });
    if (!res.success) {
      // GAS 失敗 → 復原
      item.like_count = oldCount;
      if (isCurrentlyLiked) liked.add(id);
      else liked.delete(id);
      localStorage.setItem(RECOMMEND_LIKED_KEY, JSON.stringify(Array.from(liked)));
      if (card) {
        const likeBtn = card.querySelector('.recommend-like-btn');
        const countEl = card.querySelector('.recommend-like-count');
        if (likeBtn) {
          if (isCurrentlyLiked) likeBtn.classList.add('liked');
          else likeBtn.classList.remove('liked');
        }
        if (countEl) countEl.textContent = oldCount;
      }
      showRecommendToast((isCurrentlyLiked ? '取消愛心' : '點愛心') + '失敗：' + (res.message || ''));
    }
  } catch (err) {
    item.like_count = oldCount;
    if (isCurrentlyLiked) liked.add(id);
    else liked.delete(id);
    localStorage.setItem(RECOMMEND_LIKED_KEY, JSON.stringify(Array.from(liked)));
    if (card) {
      const likeBtn = card.querySelector('.recommend-like-btn');
      const countEl = card.querySelector('.recommend-like-count');
      if (likeBtn) {
        if (isCurrentlyLiked) likeBtn.classList.add('liked');
        else likeBtn.classList.remove('liked');
      }
      if (countEl) countEl.textContent = oldCount;
    }
    showRecommendToast('網路異常、復原中');
  }
}

async function addTagToRecommend(id) {
  const tag = prompt('輸入要加的標籤：\n（如「燒腦」「金句多」「治癒」）');
  if (!tag || !tag.trim()) return;

  try {
    const res = await postRecommendToGas({ action: 'recommend_add_tag', id: id, tag: tag.trim() });
    if (res.success) {
      showRecommendToast('已加標籤：' + tag.trim());
      await loadRecommends();
    } else {
      showRecommendToast('加標籤失敗：' + (res.message || ''));
    }
  } catch (err) {
    showRecommendToast('網路異常：' + err.message);
  }
}

function addToMyBooks(id) {
  const r = recommendList.find((x) => x.id === id);
  if (!r) return;

  if (typeof window.getBooks !== 'function' || typeof window.saveBooks !== 'function') {
    showRecommendToast('「我的書單」模組沒載入');
    return;
  }

  const books = window.getBooks();
  const existingIdx = books.findIndex((b) =>
    b.readmooId === r.readmoo_id ||
    (b.title && r.title && b.title === r.title)
  );

  if (existingIdx >= 0) {
    showRecommendToast('這本書已在你的書單裡');
    return;
  }

  books.unshift({
    id: 'b-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    title: r.title || '',
    author: r.author || '',
    publisher: r.publisher || '',
    cover: r.cover_url || '',
    readmooId: r.readmoo_id || '',
    readmooUrl: r.readmoo_url || '',
    status: 'want',
    pubdate: '',
    orderNumber: '',
    notes: '從推薦書單加入',
    createdAt: new Date().toISOString()
  });

  window.saveBooks(books);
  showRecommendToast('已加入「我的書單」 想買清單');
  document.dispatchEvent(new Event('books-updated'));
}

function copyShare(id, format) {
  const r = recommendList.find((x) => x.id === id);
  if (!r) return;

  const myNick = getRecommendNick();
  const myApLink = findMyApLink(myNick);
  const useAp = myApLink && confirmIncludeAp();
  const link = useAp ? myApLink : r.readmoo_url;

  let text = '';
  const lastRec = (r.recommenders || []).slice(-1)[0] || {};
  const recText = lastRec.text || '';
  const allTags = [].concat(r.official_tags || [], r.user_tags || []);
  const uniqueTags = Array.from(new Set(allTags)).slice(0, 5);

  if (format === 'detail') {
    text = `📖 ${r.title || '（未填書名）'}\n`;
    if (r.author) text += `作者：${r.author}`;
    if (r.publisher) text += `  /  ${r.publisher}`;
    text += `\n推薦人：${resolveRecommendNickFromDirectory(lastRec.nick) || myNick}\n\n`;
    if (recText) text += `【推薦理由】\n${recText}\n\n`;
    text += `【連結】${useAp ? '（走我的 AP，謝謝你的支持）' : ''}\n${link}\n`;
    if (uniqueTags.length > 0) {
      text += `\n${uniqueTags.map((t) => '#' + t).join(' ')}`;
    }
  } else {
    text = `${r.title || '（未填書名）'}`;
    if (r.author) text += ` / ${r.author}`;
    text += `\n`;
    if (recText) text += `── ${recText}\n`;
    text += link;
  }

  navigator.clipboard.writeText(text).then(() => {
    showRecommendToast('已複製到剪貼簿，可以貼到 LINE / FB 了');
  }).catch(() => {
    prompt('幫你準備好了，Ctrl+C 複製：', text);
  });
}

function findMyApLink(nick) {
  if (!nick) return '';
  const members = (window.AppState && Array.isArray(window.AppState.members))
    ? window.AppState.members : [];
  const resolved = resolveRecommendNickFromDirectory(nick);
  const found = members.find((m) => m.name === resolved || m.name === nick);
  return found ? found.link : '';
}

function confirmIncludeAp() {
  return confirm('要在分享文裡加入你的 AP 連結嗎？\n\n點「確定」= 包含 AP（朋友走你連結結帳）\n點「取消」= 只用讀墨原始書頁連結');
}

function bindRecommendFilter() {
  const sortEl = document.getElementById('recommend-sort');
  if (sortEl) sortEl.addEventListener('change', () => {
    recommendCurrentSort = sortEl.value;
    renderRecommendList();
  });

  const refreshBtn = document.getElementById('recommend-refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadRecommends);
}

function formatRelTime(iso) {
  if (!iso) return '剛剛';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return '剛剛';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分鐘前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小時前';
  return Math.floor(diff / 86400000) + ' 天前';
}

function showRecommendToast(msg) {
  if (typeof showToast === 'function') { showToast(msg); return; }
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg;
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 2400);
  } else {
    alert(msg);
  }
}

function escRec(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function escRecMultiline(s) {
  return escRec(s).replace(/\r?\n/g, '<br>');
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('tab-recommend')) {
    initRecommend();
  }
});

window.initRecommend = initRecommend;
