/**
 * 優惠交換 — 透過 Google Apps Script 寫入共用 Sheet
 * - 讀取：fetch GAS Web App with type=coupons
 * - 寫入：POST action=coupon_create / coupon_mark_used
 * - 離線 fallback：成功 fetch 後存 localStorage 快照，離線時讀快照
 */

const COUPON_GAS_URL = 'https://script.google.com/macros/s/AKfycbzaIpW_bkjDqspXf_zbv0ok0jsDKIOPcXdfuTcIWQagFoT-7lbsdK2Ges4iNZuFBBXg/exec';
const READMOO_LINE_URL = 'https://line.me/ti/g2/SH66tYNkpY-PdFk94oKtnwRoe-Ve6QjxVUlOHg';
const COUPON_NICK_KEY = 'readmoo-ap-nick';
const COUPON_SNAPSHOT_KEY = 'readmoo-coupon-snapshot';
const COUPON_MINE_KEY = 'readmoo-coupon-mine';

let couponList = [];
let isOffline = false;
let myRecordsTab = 'active';

function initCoupon() {
  const root = document.getElementById('tab-coupon');
  if (!root) return;

  bindCouponForm();
  bindCouponFilter();
  bindCouponNick();
  bindCouponEditModal();
  bindMyRecordsTabs();

  loadCoupons();
}

function bindMyRecordsTabs() {
  document.querySelectorAll('.coupon-my-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      myRecordsTab = btn.getAttribute('data-mytab');
      document.querySelectorAll('.coupon-my-tab-btn').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-mytab') === myRecordsTab);
      });
      renderMyRecords();
    });
  });
}

function bindCouponEditModal() {
  const closeBtn = document.getElementById('coupon-edit-close-btn');
  const saveBtn = document.getElementById('coupon-edit-save-btn');
  const cancelBtn = document.getElementById('coupon-edit-cancel-btn');
  const modal = document.getElementById('coupon-edit-modal');

  if (closeBtn) closeBtn.addEventListener('click', closeEditCouponDialog);
  if (cancelBtn) cancelBtn.addEventListener('click', closeEditCouponDialog);
  if (saveBtn) saveBtn.addEventListener('click', submitCouponEdit);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeEditCouponDialog();
    });
  }
}

function bindCouponNick() {
  const nickInput = document.getElementById('coupon-nick-input');
  // 優先抓本機身份（使用指南設的暱稱），其次抓 readmoo-ap-nick
  const localUser = (window.AppState && window.AppState.user && window.AppState.user.name) || '';
  const savedNick = localUser || localStorage.getItem(COUPON_NICK_KEY) || '';
  if (nickInput) {
    nickInput.value = savedNick;
    if (savedNick) localStorage.setItem(COUPON_NICK_KEY, savedNick);
  }

  const useMyApBtn = document.getElementById('coupon-use-my-ap');
  if (useMyApBtn) {
    useMyApBtn.addEventListener('click', fillMyApLink);
  }

  const useReadmooLineBtn = document.getElementById('coupon-use-readmoo-line');
  if (useReadmooLineBtn) {
    useReadmooLineBtn.addEventListener('click', () => {
      const contactInput = document.getElementById('coupon-contact');
      if (contactInput) {
        contactInput.value = '讀墨 1500 日挑戰 LINE 社群：' + READMOO_LINE_URL;
        contactInput.focus();
      }
    });
  }
}

function fillMyApLink() {
  const nickInput = document.getElementById('coupon-nick-input');
  const apInput = document.getElementById('coupon-ap-link');
  const hintEl = document.getElementById('coupon-ap-hint');
  const nick = nickInput ? nickInput.value.trim() : '';

  if (!nick) {
    showCouponToast('請先填上你的暱稱');
    if (nickInput) nickInput.focus();
    return;
  }

  const members = (window.AppState && Array.isArray(window.AppState.members))
    ? window.AppState.members : [];

  if (members.length === 0) {
    showCouponToast('AP 名冊還沒載入，請稍等一下再試');
    return;
  }

  const exact = members.find((m) => m.name === nick);
  const fuzzy = !exact ? members.find((m) =>
    m.name && (m.name.includes(nick) || nick.includes(m.name))
  ) : null;
  const matched = exact || fuzzy;

  if (!matched) {
    showCouponToast('AP 名冊裡找不到「' + nick + '」');
    if (hintEl) {
      hintEl.style.display = 'block';
      hintEl.innerHTML = '找不到，請<a href="#directory">先到 AP 名冊登記</a>，或直接貼連結到上面';
    }
    return;
  }

  if (!matched.link) {
    showCouponToast('「' + matched.name + '」在名冊裡沒有 AP 連結');
    return;
  }

  if (apInput) {
    apInput.value = matched.link;
    apInput.focus();
  }
  if (hintEl) {
    hintEl.style.display = 'block';
    hintEl.textContent = '已帶入「' + matched.name + '」的 AP 連結';
    hintEl.style.color = '#7E9277';
  }
}

function getNick() {
  const nickInput = document.getElementById('coupon-nick-input');
  const v = nickInput ? nickInput.value.trim() : '';
  if (v) {
    localStorage.setItem(COUPON_NICK_KEY, v);
    return v;
  }
  return localStorage.getItem(COUPON_NICK_KEY) || '';
}

function bindCouponForm() {
  const form = document.getElementById('coupon-form');
  if (!form) return;

  const expireInput = document.getElementById('coupon-expire');
  if (expireInput && !expireInput.value) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    expireInput.valueAsDate = d;
  }

  const picks = document.querySelectorAll('.coupon-pick-btn');
  const discountInput = document.getElementById('coupon-discount');
  picks.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-pick');
      if (discountInput) {
        discountInput.value = val;
        discountInput.focus();
      }
      picks.forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
  if (discountInput) {
    discountInput.addEventListener('input', () => {
      const v = discountInput.value.trim();
      picks.forEach((b) => b.classList.toggle('active', b.getAttribute('data-pick') === v));
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitCoupon();
  });
}

async function submitCoupon() {
  const rawNick = getNick();
  if (!rawNick) {
    showCouponToast('請先填上你的暱稱');
    return;
  }

  // 若使用者填了純數字（成員 ID），自動換成 AP 名冊的真名存進 Sheet
  const nick = resolveNickFromDirectory(rawNick);

  const payload = {
    action: 'coupon_create',
    nick: nick,
    code: document.getElementById('coupon-code').value.trim(),
    discount: document.getElementById('coupon-discount').value,
    scope: document.getElementById('coupon-scope').value,
    expire_date: document.getElementById('coupon-expire').value,
    ap_link: document.getElementById('coupon-ap-link').value.trim(),
    note: document.getElementById('coupon-note').value.trim(),
    contact: document.getElementById('coupon-contact').value.trim()
  };

  if (!payload.code || !payload.discount || !payload.scope || !payload.expire_date || !payload.ap_link) {
    showCouponToast('請填完所有必填欄位');
    return;
  }

  const submitBtn = document.getElementById('coupon-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '送出中…';
  }

  try {
    const res = await postCouponToGas(payload);
    if (res.success) {
      showCouponToast('PO 成功，謝謝你分享！');
      document.getElementById('coupon-form').reset();
      const exp = document.getElementById('coupon-expire');
      if (exp) {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        exp.valueAsDate = d;
      }
      rememberMineId(res.id);
      await loadCoupons();
    } else {
      showCouponToast('PO 失敗：' + (res.message || '未知錯誤'));
    }
  } catch (err) {
    showCouponToast('網路異常，PO 沒成功：' + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="send"></i> PO 出去';
      if (window.lucide) lucide.createIcons();
    }
  }
}

function rememberMineId(id) {
  if (!id) return;
  const list = readStoredJson(COUPON_MINE_KEY, []);
  if (!list.includes(id)) {
    list.push(id);
    localStorage.setItem(COUPON_MINE_KEY, JSON.stringify(list));
  }
}

function getMineIds() {
  return readStoredJson(COUPON_MINE_KEY, []);
}

async function postCouponToGas(payload) {
  const res = await fetch(COUPON_GAS_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return await res.json();
}

async function loadCoupons() {
  const listEl = document.getElementById('coupon-list');
  const emptyEl = document.getElementById('coupon-empty');
  const offlineBanner = document.getElementById('coupon-offline-banner');
  const countEl = document.getElementById('coupon-count');
  if (!listEl) return;

  listEl.innerHTML = '<div class="coupon-loading">讀取中…</div>';

  try {
    const url = COUPON_GAS_URL + '?type=coupons&_t=' + Date.now();
    const res = await fetch(url);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      couponList = json.data;
      localStorage.setItem(COUPON_SNAPSHOT_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        data: couponList
      }));
      isOffline = false;
      if (offlineBanner) offlineBanner.style.display = 'none';
    } else {
      throw new Error(json.message || '回傳格式異常');
    }
  } catch (err) {
    const snapshot = readStoredJson(COUPON_SNAPSHOT_KEY, null);
    if (snapshot && snapshot.data) {
      couponList = snapshot.data;
      isOffline = true;
      if (offlineBanner) {
        offlineBanner.style.display = 'block';
        offlineBanner.textContent = '離線模式：顯示 ' + formatRelativeTime(snapshot.savedAt) + ' 的快照';
      }
    } else {
      listEl.innerHTML = '<div class="coupon-error">讀不到資料，也沒有快取。請檢查網路後重試。</div>';
      return;
    }
  }

  renderMyRecords();
  renderCouponList();
}

function renderMyRecords() {
  const sectionEl = document.getElementById('coupon-my-records-section');
  const listEl = document.getElementById('coupon-my-list');
  const emptyEl = document.getElementById('coupon-my-empty');
  const countEl = document.getElementById('coupon-my-count');
  const statsEl = document.getElementById('coupon-my-stats');
  if (!sectionEl || !listEl) return;

  const mineIds = getMineIds();
  if (mineIds.length === 0) {
    sectionEl.style.display = 'none';
    return;
  }

  const myCoupons = couponList.filter((c) => mineIds.includes(c.id));
  if (myCoupons.length === 0) {
    sectionEl.style.display = 'none';
    return;
  }

  sectionEl.style.display = 'block';

  const today = new Date().toISOString().slice(0, 10);
  const active = [];
  const used = [];
  const expired = [];

  myCoupons.forEach((c) => {
    if (c.status === 'removed') return;
    if (c.status === 'used') used.push(c);
    else if (c.expire_date && String(c.expire_date).slice(0, 10) < today) expired.push(c);
    else active.push(c);
  });

  document.getElementById('coupon-my-active-count').textContent = active.length;
  document.getElementById('coupon-my-used-count').textContent = used.length;
  document.getElementById('coupon-my-expired-count').textContent = expired.length;

  if (countEl) countEl.textContent = myCoupons.length;

  const totalActive = myCoupons.filter((c) => c.status !== 'removed').length;
  const usedRate = totalActive > 0 ? Math.round((used.length / totalActive) * 100) : 0;
  if (statsEl) {
    statsEl.innerHTML = `共 PO 出 <strong>${totalActive}</strong> 張、有 <strong>${used.length}</strong> 張被使用、配對率 <strong>${usedRate}%</strong>`;
  }

  let display;
  if (myRecordsTab === 'active') display = active;
  else if (myRecordsTab === 'used') display = used;
  else display = expired;

  display.sort((a, b) => {
    if (myRecordsTab === 'used') {
      return String(b.matched_at || '').localeCompare(String(a.matched_at || ''));
    }
    return String(a.expire_date || '').localeCompare(String(b.expire_date || ''));
  });

  if (display.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  listEl.innerHTML = display.map((c) => renderMyRecordItem(c)).join('');
  if (window.lucide) lucide.createIcons();
}

function renderMyRecordItem(c) {
  const expireDate = String(c.expire_date || '').slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const daysLeft = calcDaysLeft(expireDate);

  let statusBadge = '';
  let usedInfo = '';

  if (c.status === 'used') {
    const usedBy = resolveNickFromDirectory(c.matched_by) || c.matched_by || '某人';
    const matchedAt = formatDateTime(c.matched_at);
    statusBadge = '<span class="my-record-badge my-record-badge-used"><i data-lucide="check-circle"></i> 已被使用</span>';
    usedInfo = `
      <div class="my-record-used-info">
        <i data-lucide="user-check"></i>
        <strong>${escapeHtml(usedBy)}</strong> 使用了這張券
        ${c.matched_tail ? `<span class="my-record-tail">末兩碼 ${escapeHtml(c.matched_tail)}</span>` : ''}
        ${matchedAt ? `<span class="my-record-time">${escapeHtml(matchedAt)}</span>` : ''}
      </div>
    `;
  } else if (expireDate && expireDate < today) {
    statusBadge = '<span class="my-record-badge my-record-badge-expired"><i data-lucide="clock"></i> 已過期</span>';
  } else if (daysLeft >= 0 && daysLeft <= 3) {
    statusBadge = `<span class="my-record-badge my-record-badge-urgent"><i data-lucide="alert-circle"></i> 剩 ${daysLeft} 天</span>`;
  } else {
    statusBadge = '<span class="my-record-badge my-record-badge-active"><i data-lucide="circle"></i> 進行中</span>';
  }

  return `
    <div class="my-record-item">
      <div class="my-record-head">
        <span class="my-record-discount">${escapeHtml(c.discount)}</span>
        <span class="my-record-scope">${escapeHtml(c.scope)}</span>
        ${statusBadge}
        <span class="my-record-expire">到 ${expireDate}</span>
      </div>
      <div class="my-record-code">
        <span class="coupon-label">券碼</span>
        <code class="coupon-code">${escapeHtml(c.code)}</code>
      </div>
      ${usedInfo}
    </div>
  `;
}

function renderCouponList() {
  const listEl = document.getElementById('coupon-list');
  const emptyEl = document.getElementById('coupon-empty');
  const countEl = document.getElementById('coupon-count');
  const filterEl = document.getElementById('coupon-filter');
  if (!listEl) return;

  const filter = filterEl ? filterEl.value : 'available';
  const mineIds = getMineIds();
  const today = new Date().toISOString().slice(0, 10);

  let filtered = couponList.filter((c) => {
    if (c.status === 'used' || c.status === 'removed') return false;
    if (c.expire_date && String(c.expire_date).slice(0, 10) < today) return false;

    if (filter === 'mine') return mineIds.includes(c.id);
    return true;
  });

  filtered.sort((a, b) => String(a.expire_date).localeCompare(String(b.expire_date)));

  if (countEl) countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  listEl.innerHTML = filtered.map((c) => renderCouponCard(c, mineIds)).join('');

  listEl.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-copy');
      navigator.clipboard.writeText(text).then(() => {
        showCouponToast('已複製：' + text);
      });
    });
  });

  listEl.querySelectorAll('[data-mark-used]').forEach((btn) => {
    btn.addEventListener('click', () => openMarkUsedDialog(btn.getAttribute('data-mark-used')));
  });

  listEl.querySelectorAll('[data-edit-coupon]').forEach((btn) => {
    btn.addEventListener('click', () => openEditCouponDialog(btn.getAttribute('data-edit-coupon')));
  });

  listEl.querySelectorAll('[data-delete-coupon]').forEach((btn) => {
    btn.addEventListener('click', () => deleteCoupon(btn.getAttribute('data-delete-coupon')));
  });

  if (window.lucide) lucide.createIcons();
}

function openEditCouponDialog(id) {
  const c = couponList.find((x) => x.id === id);
  if (!c) return;

  const modal = document.getElementById('coupon-edit-modal');
  if (!modal) return;

  document.getElementById('edit-coupon-id').value = c.id;
  document.getElementById('edit-coupon-code').value = c.code || '';
  document.getElementById('edit-coupon-discount').value = c.discount || '';
  document.getElementById('edit-coupon-scope').value = c.scope || '';
  document.getElementById('edit-coupon-expire').value = String(c.expire_date || '').slice(0, 10);
  document.getElementById('edit-coupon-ap-link').value = c.ap_link || '';
  document.getElementById('edit-coupon-note').value = c.note || '';
  document.getElementById('edit-coupon-contact').value = c.contact || '';

  openModal('coupon-edit-modal');
}

function closeEditCouponDialog() {
  closeModal('coupon-edit-modal');
}

async function submitCouponEdit() {
  const id = document.getElementById('edit-coupon-id').value;
  const payload = {
    action: 'coupon_update',
    id: id,
    code: document.getElementById('edit-coupon-code').value.trim(),
    discount: document.getElementById('edit-coupon-discount').value.trim(),
    scope: document.getElementById('edit-coupon-scope').value.trim(),
    expire_date: document.getElementById('edit-coupon-expire').value,
    ap_link: document.getElementById('edit-coupon-ap-link').value.trim(),
    note: document.getElementById('edit-coupon-note').value.trim(),
    contact: document.getElementById('edit-coupon-contact').value.trim()
  };

  if (!payload.code || !payload.discount || !payload.scope || !payload.expire_date || !payload.ap_link) {
    showCouponToast('請填完所有必填欄位');
    return;
  }

  const saveBtn = document.getElementById('coupon-edit-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '儲存中…'; }

  try {
    const res = await postCouponToGas(payload);
    if (res.success) {
      showCouponToast('修改成功！');
      closeEditCouponDialog();
      await loadCoupons();
    } else {
      showCouponToast('修改失敗：' + (res.message || ''));
    }
  } catch (err) {
    showCouponToast('網路異常：' + err.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i data-lucide="save"></i> 儲存';
      if (window.lucide) lucide.createIcons();
    }
  }
}

async function deleteCoupon(id) {
  const c = couponList.find((x) => x.id === id);
  if (!c) return;
  if (!confirm(`要下架「${c.discount} - ${c.scope}」這張券嗎？\n\n下架後其他人就看不到了。`)) return;

  try {
    const res = await postCouponToGas({ action: 'coupon_delete', id: id });
    if (res.success) {
      showCouponToast('已下架');
      await loadCoupons();
    } else {
      showCouponToast('下架失敗：' + (res.message || ''));
    }
  } catch (err) {
    showCouponToast('網路異常：' + err.message);
  }
}

function resolveNickFromDirectory(nick) {
  // 直接原樣顯示，不做「對名冊」的自動轉換
  // 早期版本曾把純數字 nick 對到 AP 名冊 id，但這會造成「Sheet 公式 bug 把 +1 變 1」→「對到 id=1 的別人」的災難
  return nick || '';
}

function renderCouponCard(c, mineIds) {
  const isMine = mineIds.includes(c.id);
  const expireDate = String(c.expire_date || '').slice(0, 10);
  const daysLeft = calcDaysLeft(expireDate);
  const urgent = daysLeft >= 0 && daysLeft <= 3;
  const displayNick = resolveNickFromDirectory(c.nick);

  return `
    <div class="coupon-card${urgent ? ' urgent' : ''}${isMine ? ' mine' : ''}">
      <div class="coupon-card-head">
        <span class="coupon-discount">${escapeHtml(c.discount)}</span>
        <span class="coupon-scope">${escapeHtml(c.scope)}</span>
        ${isMine ? '<span class="coupon-mine-tag">我的</span>' : ''}
        <span class="coupon-expire ${urgent ? 'urgent' : ''}">
          ${urgent ? '剩 ' + daysLeft + ' 天' : '到 ' + expireDate}
        </span>
      </div>
      <div class="coupon-card-body">
        <div class="coupon-row">
          <span class="coupon-label">券碼</span>
          <code class="coupon-code">${escapeHtml(c.code)}</code>
          <button class="coupon-copy-btn" data-copy="${escapeHtml(c.code)}" title="複製">
            <i data-lucide="copy"></i>
          </button>
        </div>
        <div class="coupon-row">
          <span class="coupon-label">AP</span>
          <a href="${escapeHtml(c.ap_link)}" target="_blank" rel="noopener" class="coupon-ap-link">
            ${escapeHtml(c.ap_link)} <i data-lucide="external-link"></i>
          </a>
        </div>
        ${c.note ? `<div class="coupon-row"><span class="coupon-label">備註</span><span class="coupon-note">${escapeHtml(c.note)}</span></div>` : ''}
        <div class="coupon-row coupon-meta">
          <span class="coupon-nick"><i data-lucide="user"></i> ${escapeHtml(displayNick)}</span>
          ${c.contact ? `<span class="coupon-contact">${escapeHtml(c.contact)}</span>` : ''}
        </div>
      </div>
      <div class="coupon-card-foot">
        ${isMine ? `
          <button class="btn-text btn-sm" data-edit-coupon="${escapeHtml(c.id)}">
            <i data-lucide="pencil"></i> 修改
          </button>
          <button class="btn-text btn-sm coupon-delete-btn" data-delete-coupon="${escapeHtml(c.id)}">
            <i data-lucide="trash-2"></i> 下架
          </button>
        ` : ''}
        <button class="btn-primary btn-sm" data-mark-used="${escapeHtml(c.id)}">
          <i data-lucide="check-circle"></i> 我用了，回報末兩碼
        </button>
      </div>
    </div>
  `;
}

function calcDaysLeft(dateStr) {
  if (!dateStr) return 999;
  const today = new Date();
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return 999;
  return Math.ceil((target - today) / 86400000);
}

function bindCouponFilter() {
  const filter = document.getElementById('coupon-filter');
  if (filter) filter.addEventListener('change', renderCouponList);

  const refreshBtn = document.getElementById('coupon-refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', loadCoupons);
}

function openMarkUsedDialog(couponId) {
  const coupon = couponList.find((c) => c.id === couponId);
  if (!coupon) return;

  const nick = getNick();
  if (!nick) {
    showCouponToast('請先填上你的暱稱再回報');
    return;
  }

  const tail = prompt('請輸入訂單末兩碼（例：*59）\n\n你正在使用：' + coupon.discount + ' / ' + coupon.scope);
  if (!tail) return;

  const cleaned = tail.trim();
  if (!/^[\*＊#＃]\d{2}$/.test(cleaned)) {
    if (!confirm('「' + cleaned + '」格式不像末兩碼（應為 *XX）。確定要送嗎？')) return;
  }

  markUsed(couponId, nick, cleaned);
}

async function markUsed(couponId, nick, tail) {
  try {
    const res = await postCouponToGas({
      action: 'coupon_mark_used',
      id: couponId,
      matched_by: nick,
      matched_tail: tail
    });
    if (res.success) {
      showCouponToast('回報成功，謝謝！');
      await loadCoupons();
    } else {
      showCouponToast('回報失敗：' + (res.message || '未知錯誤'));
    }
  } catch (err) {
    showCouponToast('網路異常：' + err.message);
  }
}

function formatDateTime(input) {
  if (!input) return '';
  const str = String(input);
  // Sheet 回的可能格式：
  // 1. ISO: 2026-06-04T10:02:00.000Z
  // 2. v4 格式: 2026-06-04 10:02
  // 3. 純日期: 2026-06-04
  // 統一輸出: 2026-06-04 10:02 / 2026-06-04
  if (str.includes('T')) {
    // 有 T → ISO，需轉時區到台灣（+8）
    const d = new Date(str);
    if (isNaN(d.getTime())) return str.slice(0, 16).replace('T', ' ');
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  }
  // 已是友善格式
  return str.length > 16 ? str.slice(0, 16) : str;
}

function formatRelativeTime(iso) {
  if (!iso) return '剛剛';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return '剛剛';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分鐘前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小時前';
  return Math.floor(diff / 86400000) + ' 天前';
}

function showCouponToast(msg) {
  if (typeof showToast === 'function') {
    showToast(msg);
    return;
  }
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg;
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 2400);
  } else {
    alert(msg);
  }
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('tab-coupon')) {
    initCoupon();
  }
});

window.initCoupon = initCoupon;
