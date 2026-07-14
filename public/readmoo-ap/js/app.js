/**
 * 讀墨 AP 接龍工具 — 主程式
 * Tab 路由 + 深色模式 + 全域初始化
 */

// ============ Config ============
const CONFIG = {
  // Google Sheets ID
  SHEET_ID: '1xjGSZquaGyLPRWsBEKtM2_1t_CRS1LLKSF76NhYzaeA',
  // Google Apps Script Web App URL
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzaIpW_bkjDqspXf_zbv0ok0jsDKIOPcXdfuTcIWQagFoT-7lbsdK2Ges4iNZuFBBXg/exec',
  // localStorage keys
  STORAGE_KEYS: {
    BOOKS: 'readmoo-ap-books',
    USER: 'readmoo-ap-user',
    CHANGELOG: 'readmoo-ap-changelog',
    AP_CACHE: 'readmoo-ap-cache',
    THEME: 'helloruru-theme',
    CHAIN_STATE: 'readmoo-ap-chain-state'
  }
};

// ============ Global State ============
const AppState = {
  members: [],
  user: null,
  isVerified: false
};
window.AppState = AppState;

// ============ Safe Local Storage ============
function readStoredJson(key, fallback) {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  try {
    return JSON.parse(saved);
  } catch (error) {
    console.warn(`已忽略損壞的本機資料：${key}`, error);
    localStorage.removeItem(key);
    return fallback;
  }
}
window.readStoredJson = readStoredJson;

// ============ Tab Router ============
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  const AUTH_TABS = new Set(['books', 'chain']);

  function doSwitchTab(tabId) {
    tabs.forEach(t => {
      const isActive = t.dataset.tab === tabId;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive);
      t.tabIndex = isActive ? 0 : -1;
    });
    panels.forEach(p => {
      const isActive = p.id === `tab-${tabId}`;
      p.classList.toggle('active', isActive);
      p.setAttribute('aria-hidden', String(!isActive));
    });
    window.location.hash = tabId;
    document.dispatchEvent(new CustomEvent('tab-changed', { detail: { tab: tabId } }));
  }

  function switchTab(tabId) {
    if (AUTH_TABS.has(tabId) && !AppState.user) {
      requireIdentity(() => doSwitchTab(tabId));
      return;
    }
    doSwitchTab(tabId);
  }

  tabs.forEach((tab, index) => {
    const tabId = tab.dataset.tab;
    const panel = document.getElementById(`tab-${tabId}`);
    tab.id = `tab-button-${tabId}`;
    tab.setAttribute('aria-controls', `tab-${tabId}`);
    tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
    if (panel) {
      panel.setAttribute('aria-labelledby', tab.id);
      panel.setAttribute('aria-hidden', String(!panel.classList.contains('active')));
    }

    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      let targetIndex = null;
      if (event.key === 'ArrowRight') targetIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') targetIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') targetIndex = 0;
      if (event.key === 'End') targetIndex = tabs.length - 1;
      if (targetIndex === null) return;
      event.preventDefault();
      tabs[targetIndex].focus();
      switchTab(tabs[targetIndex].dataset.tab);
    });
  });

  // Hash routing（延後到 applyInitialHash 呼叫，等成員載入完成）
  window.addEventListener('hashchange', () => {
    const h = window.location.hash.slice(1);
    if (h && document.getElementById(`tab-${h}`)) {
      switchTab(h);
    }
  });

  // 初始 hash 路由：等成員載入後才觸發，避免空下拉選單
  window._applyInitialHash = function() {
    const hash = window.location.hash.slice(1);
    if (hash && document.getElementById(`tab-${hash}`)) {
      switchTab(hash);
    }
  };
}

// ============ Dark Mode ============
function initDarkMode() {
  const STORAGE_KEY = CONFIG.STORAGE_KEYS.THEME;
  const toggle = document.querySelector('.theme-toggle');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark') applyTheme(true);
    else if (saved === 'light') applyTheme(false);
    else applyTheme(prefersDark.matches);
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    const next = !isDark;
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
  }

  prefersDark.addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) applyTheme(e.matches);
  });

  if (toggle) toggle.addEventListener('click', toggleTheme);
  initTheme();
}

// ============ Toast ============
function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

// ============ Modal Helpers ============
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal._lastFocused = document.activeElement;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    const firstFocusable = modal.querySelector(
      'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href]'
    );
    if (firstFocusable) firstFocusable.focus();
  });
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  if (modal._lastFocused && document.contains(modal._lastFocused)) {
    modal._lastFocused.focus();
  }
}

function initModalCloses() {
  const overlays = document.querySelectorAll('.modal-overlay');

  overlays.forEach((overlay, index) => {
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', String(overlay.style.display === 'none'));
    const heading = overlay.querySelector('h2, h3');
    if (heading) {
      if (!heading.id) heading.id = `modal-title-${index + 1}`;
      overlay.setAttribute('aria-labelledby', heading.id);
    }
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.closest('.modal-overlay').id);
    });
  });

  overlays.forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  document.addEventListener('keydown', (event) => {
    const visibleOverlays = Array.from(overlays).filter(
      overlay => window.getComputedStyle(overlay).display !== 'none'
    );
    const activeModal = visibleOverlays.at(-1);
    if (!activeModal) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal(activeModal.id);
      return;
    }

    if (event.key === 'Tab') {
      const focusable = Array.from(activeModal.querySelectorAll(
        'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href]'
      )).filter(element => window.getComputedStyle(element).display !== 'none');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}

// ============ User Session ============
function loadUser() {
  const saved = readStoredJson(CONFIG.STORAGE_KEYS.USER, null);
  if (saved) {
    AppState.user = saved;
    AppState.isVerified = true;
  }
  updateUserBar();
}

function saveUser(name, date) {
  AppState.user = { name, date };
  AppState.isVerified = true;
  localStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(AppState.user));
  updateUserBar();
}

function updateUserBar() {
  const bar = document.getElementById('user-bar');
  const nameEl = document.getElementById('user-bar-name');
  const booksTitle = document.getElementById('books-title');
  if (!bar) return;
  if (AppState.user && AppState.user.name) {
    const books = typeof getBooks === 'function' ? getBooks() : [];
    const countText = books.length > 0 ? ` · ${books.length} 本書` : '';
    nameEl.textContent = '';
    nameEl.appendChild(document.createTextNode(`${AppState.user.name} `));
    const localHint = document.createElement('span');
    localHint.className = 'local-hint';
    localHint.textContent = `本機紀錄${countText}`;
    nameEl.appendChild(localHint);
    bar.style.display = 'flex';
    if (booksTitle) booksTitle.textContent = `${AppState.user.name} 的書單`;
  } else {
    bar.style.display = 'none';
    if (booksTitle) booksTitle.textContent = '我的書單';
  }
}

function requireAuth(callback) {
  if (AppState.isVerified) {
    callback();
  } else {
    AppState._identityOnly = false;
    openModal('quiz-modal');
    AppState._authCallback = callback;
  }
}

// 輕量身分選擇（書單/接龍用，不需答題）
function requireIdentity(callback) {
  if (AppState.user) {
    callback();
  } else {
    AppState._identityOnly = true;
    openModal('quiz-modal');
    AppState._authCallback = callback;
  }
}

// ============ Google Sheets Reader ============
async function fetchMembersFromSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&headers=0`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    // gviz returns JSONP-like: google.visualization.Query.setResponse({...})
    const jsonStr = text.match(/google\.visualization\.Query\.setResponse\((.+)\)/);
    if (!jsonStr) throw new Error('Parse error');
    const json = JSON.parse(jsonStr[1]);

    const rows = json.table.rows;
    const members = [];
    const sheetLogs = [];
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i].c;
      const id = cells[0]?.v;
      const name = cells[1]?.v;
      const link = cells[2]?.v;
      const notes = cells[4]?.v; // E 欄：操作紀錄
      if (id && name) {
        members.push({
          id: String(id),
          name: String(name),
          link: link ? String(link) : ''
        });
        // 解析 E 欄的 log（格式：ver.20260303 由 XXX 新增）
        if (notes) {
          String(notes).split('\n').forEach(line => {
            const m = line.match(/ver\.(\d{8})\s+由\s+(.+?)\s+(新增|編輯|刪除)/);
            if (m) {
              sheetLogs.push({
                date: m[1],
                editor: m[2],
                action: m[3],
                memberId: String(id),
                memberName: String(name),
                raw: line.trim()
              });
            }
          });
        }
      }
    }

    AppState.members = members;
    AppState.sheetLogs = sheetLogs;
    // Cache
    localStorage.setItem(CONFIG.STORAGE_KEYS.AP_CACHE, JSON.stringify({
      data: members,
      time: Date.now()
    }));
    return members;
  } catch (err) {
    console.error('Failed to fetch from Google Sheets:', err);
    // Try cache
    const cached = readStoredJson(CONFIG.STORAGE_KEYS.AP_CACHE, null);
    if (cached) {
      AppState.members = cached.data;
      return cached.data;
    }
    return [];
  }
}

// ============ Apps Script Writer ============
async function writeToSheet(action, data) {
  if (!AppState.user?.name) {
    showToast('請先選擇你的身分');
    return { success: false };
  }
  if (!CONFIG.APPS_SCRIPT_URL) {
    showToast('Apps Script 尚未設定，請聯繫管理員');
    return { success: false };
  }
  try {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action,
        editor: AppState.user.name,
        ...data
      })
    });
    const result = await res.json();
    if (result.success) {
      // Refresh data
      await fetchMembersFromSheet();
    }
    return result;
  } catch (err) {
    console.error('Write failed:', err);
    showToast('寫入失敗，請稍後再試');
    return { success: false };
  }
}

// ============ Footer Year ============
function initFooter() {
  const startYear = 2026;
  const currentYear = new Date().getFullYear();
  const el = document.getElementById('footer-year');
  if (el) {
    el.textContent = currentYear > startYear
      ? `${startYear}\u2013${currentYear}`
      : `${startYear}`;
  }
}

// ============ Init ============
document.addEventListener('DOMContentLoaded', async () => {
  initDarkMode();
  loadUser();
  initTabs();
  initModalCloses();
  initFooter();

  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();

  // Fetch AP members
  const members = await fetchMembersFromSheet();

  // Initialize all modules
  if (window.initQuiz) initQuiz();
  if (window.initDirectory) initDirectory(members);
  if (window.initChain) initChain();
  if (window.initBooks) initBooks();
  if (window.initChangelog) initChangelog();

  // 成員載入完成，觸發初始 hash 路由
  if (window._applyInitialHash) window._applyInitialHash();

  // Quick action: "修改 AP 連結" → switch to directory tab + open edit mode
  const qaEditLink = document.getElementById('qa-edit-link');
  if (qaEditLink) {
    qaEditLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = 'directory';
      setTimeout(() => {
        const btnEdit = document.getElementById('btn-edit-directory');
        if (btnEdit) btnEdit.click();
      }, 300);
    });
  }

  // 新人加入 AP — 開 modal
  const qaNewcomer = document.getElementById('qa-add-newcomer');
  const newcomerModal = document.getElementById('newcomer-modal');
  const newcomerClose = document.getElementById('newcomer-close-btn');
  const newcomerCancel = document.getElementById('newcomer-cancel-btn');
  const newcomerSave = document.getElementById('newcomer-save-btn');
  const newcomerName = document.getElementById('newcomer-name');
  const newcomerLink = document.getElementById('newcomer-link');

  function closeNewcomerModal() {
    closeModal('newcomer-modal');
  }

  if (qaNewcomer && newcomerModal) {
    qaNewcomer.addEventListener('click', (e) => {
      e.preventDefault();
      // 預填本機身份
      if (AppState.user && AppState.user.name && newcomerName) {
        newcomerName.value = AppState.user.name;
      }
      openModal('newcomer-modal');
      setTimeout(() => {
        if (newcomerName && !newcomerName.value) newcomerName.focus();
        else if (newcomerLink) newcomerLink.focus();
      }, 100);
    });
  }

  if (newcomerClose) newcomerClose.addEventListener('click', closeNewcomerModal);
  if (newcomerCancel) newcomerCancel.addEventListener('click', closeNewcomerModal);
  if (newcomerModal) {
    newcomerModal.addEventListener('click', (e) => {
      if (e.target === newcomerModal) closeNewcomerModal();
    });
  }

  if (newcomerSave) {
    newcomerSave.addEventListener('click', async () => {
      const name = (newcomerName?.value || '').trim();
      const link = (newcomerLink?.value || '').trim();

      if (!name) { showToast('請填暱稱'); newcomerName?.focus(); return; }
      if (!link) { showToast('請填 AP 連結'); newcomerLink?.focus(); return; }
      if (!/^https?:\/\//.test(link)) { showToast('AP 連結要 https:// 開頭'); newcomerLink?.focus(); return; }

      // 檢查是否已有同名成員
      const existing = AppState.members.find(m => m.name === name);
      if (existing) {
        if (!confirm(`名冊已經有「${name}」這個成員了。\n要繼續新增嗎？`)) return;
      }

      newcomerSave.disabled = true;
      newcomerSave.textContent = '加入中…';

      try {
        // 用最大 ID + 1
        const maxId = Math.max(0, ...AppState.members.map(m => parseInt(m.id) || 0));
        const nextId = String(maxId + 1);

        const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'add',
            id: nextId,
            name: name,
            link: link,
            editor: name
          })
        });
        const result = await res.json();

        if (result.success) {
          showToast('歡迎加入！已寫入 AP 名冊');
          // 把自己存成本機身份（如果還沒設）
          if (!AppState.user) {
            saveUser(name, new Date().toISOString().slice(0, 10));
            updateUserBar();
          }
          // 重新拉最新名冊
          await fetchMembersFromSheet();
          if (window.initDirectory) initDirectory(AppState.members);
          closeNewcomerModal();
        } else {
          showToast('加入失敗：' + (result.message || '未知錯誤'));
        }
      } catch (err) {
        showToast('網路異常：' + err.message);
      } finally {
        newcomerSave.disabled = false;
        newcomerSave.innerHTML = '<i data-lucide="user-plus"></i> 加入名冊';
        if (window.lucide) lucide.createIcons();
      }
    });
  }

  // Logout / switch identity
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
      AppState.user = null;
      AppState.isVerified = false;
      updateUserBar();
      openModal('quiz-modal');
    });
  }

  // 每日 $99 特惠書
  loadDaily99();
});

// ============ Daily 99 ============
async function loadDaily99() {
  try {
    const res = await fetch('/api/daily-99');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.today) return;

    const book = data.today;
    const card = document.getElementById('daily-99');
    if (!card) return;

    document.getElementById('daily-99-title').textContent = book.title;
    document.getElementById('daily-99-meta').textContent =
      [book.author, book.publisher].filter(Boolean).join(' · ');
    document.getElementById('daily-99-original').textContent =
      book.originalPrice ? `NT$ ${book.originalPrice}` : '';
    const promoEl = document.getElementById('daily-99-promo');
    if (promoEl) promoEl.textContent = `NT$ ${book.promoPrice}`;
    document.getElementById('daily-99-link').href = book.url;

    const coverImg = document.getElementById('daily-99-cover');
    if (book.cover) {
      coverImg.src = book.cover;
      coverImg.alt = book.title;
    }

    // 加入書單
    const btnAdd = document.getElementById('daily-99-add');
    const existingBooks = getBooks();
    const alreadyHas = existingBooks.some(b =>
      b.title.toLowerCase() === book.title.toLowerCase()
    );

    if (alreadyHas) {
      btnAdd.innerHTML = '<i data-lucide="check"></i> 已在書單';
      btnAdd.disabled = true;
      btnAdd.classList.remove('btn-primary');
      btnAdd.classList.add('btn-secondary');
    }

    btnAdd.addEventListener('click', () => {
      const books = getBooks();
      books.push({
        id: 'book_' + Date.now(),
        title: book.title,
        author: book.author,
        version: '電子書',
        pubdate: '',
        publisher: book.publisher,
        price: String(book.promoPrice),
        cover: book.cover,
        readmooUrl: book.url,
        status: 'want',
        createdAt: new Date().toISOString(),
      });
      saveBooks(books);
      btnAdd.innerHTML = '<i data-lucide="check"></i> 已加入';
      btnAdd.disabled = true;
      btnAdd.classList.remove('btn-primary');
      btnAdd.classList.add('btn-secondary');
      if (window.lucide) lucide.createIcons();
      showToast(`已加入書單：${book.title}`);
      document.dispatchEvent(new Event('books-updated'));
    });

    card.style.display = 'block';
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    console.error('Daily 99 load failed:', e);
  }
}
