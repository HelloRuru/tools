/**
 * AP 紀錄（私人筆記）— 批次模式
 * 從 LINE 對話解析「誰送了 AP 給我」，存 localStorage（本機，別人看不到）
 *
 * 規則：
 * - 一段對話 = 一個送禮人（嚕寶手動填名字，因 LINE 複製不帶名）
 * - 一段對話可有多個 AP 區塊，每區塊自己看有沒有 @ 我
 * - 訂單末碼支援 *#＊＃ + AP*17+*68 多筆組合
 * - 同「送禮人 + 訂單末碼」自動去重
 */

const AP_LOG_KEY = 'readmoo-ap-log';
const AP_LOG_NICK_KEY = 'readmoo-ap-nick';

let batchEntries = []; // 批次清單 [{from, body}]

function initApLog() {
  const nickInput = document.getElementById('ap-log-nick-input');
  const nickSaveBtn = document.getElementById('ap-log-nick-save');
  const nickStatus = document.getElementById('ap-log-nick-status');
  const pasteSection = document.getElementById('ap-log-paste-section');
  const listSection = document.getElementById('ap-log-list-section');
  const dateInput = document.getElementById('ap-log-date');
  const batchListEl = document.getElementById('ap-log-batch-list');
  const addBtn = document.getElementById('ap-log-add-btn');
  const parseBtn = document.getElementById('ap-log-parse-btn');
  const parseResult = document.getElementById('ap-log-parse-result');
  const filterSelect = document.getElementById('ap-log-filter');
  const exportBtn = document.getElementById('ap-log-export-btn');
  const listEl = document.getElementById('ap-log-list');
  const emptyEl = document.getElementById('ap-log-empty');
  const countEl = document.getElementById('ap-log-count');

  if (!nickInput) return;

  // 暱稱
  const savedNick = localStorage.getItem(AP_LOG_NICK_KEY) || '';
  nickInput.value = savedNick;
  if (savedNick) {
    pasteSection.style.display = 'block';
    listSection.style.display = 'block';
    nickStatus.innerHTML = `<i data-lucide="check"></i> 已設定：「${escapeHtml(savedNick)}」`;
    if (window.lucide) lucide.createIcons();
    initBatchList();
    renderList();
  }

  if (dateInput && !dateInput.value) {
    dateInput.valueAsDate = new Date();
  }

  nickSaveBtn.addEventListener('click', () => {
    const v = nickInput.value.trim();
    if (!v) { showToast && showToast('請輸入暱稱'); return; }
    localStorage.setItem(AP_LOG_NICK_KEY, v);
    nickStatus.innerHTML = `<i data-lucide="check"></i> 已儲存：「${escapeHtml(v)}」`;
    pasteSection.style.display = 'block';
    listSection.style.display = 'block';
    if (window.lucide) lucide.createIcons();
    initBatchList();
    renderList();
  });

  addBtn.addEventListener('click', () => {
    batchEntries.push({ from: '', body: '' });
    renderBatchList();
  });

  parseBtn.addEventListener('click', () => {
    const nick = localStorage.getItem(AP_LOG_NICK_KEY);
    if (!nick) { showToast && showToast('請先設定暱稱'); return; }

    // 蒐集表單值（從 DOM 讀，避免 input 事件沒同步）
    syncBatchFromDom();

    const date = dateInput.value || new Date().toISOString().slice(0, 10);
    const allParsed = [];
    const issues = [];

    batchEntries.forEach((entry, idx) => {
      if (!entry.body.trim()) return;
      if (!entry.from.trim()) {
        issues.push(`第 ${idx + 1} 塊沒填送禮人，已跳過`);
        return;
      }
      const parsed = parseConversation(entry.body, nick, entry.from.trim());
      allParsed.push(...parsed);
    });

    renderParseResult(allParsed, date, issues);
  });

  filterSelect.addEventListener('change', renderList);
  exportBtn.addEventListener('click', exportCsv);

  function initBatchList() {
    if (batchEntries.length === 0) {
      batchEntries = [{ from: '', body: '' }];
    }
    renderBatchList();
  }

  function renderBatchList() {
    batchListEl.innerHTML = batchEntries.map((entry, idx) => `
      <div class="ap-log-batch-card" data-idx="${idx}">
        <div class="ap-log-batch-header">
          <span class="ap-log-batch-num">${idx + 1}</span>
          <input type="text" class="input-field ap-log-batch-from" data-idx="${idx}" placeholder="送禮人名字（例：小魚）" value="${escapeHtml(entry.from)}">
          ${batchEntries.length > 1 ? `<button class="btn-icon ap-log-batch-remove" data-idx="${idx}" title="刪除這塊"><i data-lucide="x"></i></button>` : ''}
        </div>
        <textarea class="input-field ap-log-batch-body" data-idx="${idx}" rows="6" placeholder="直接貼這個人的 LINE 對話，不用整理格式&#10;支援：AP*68、AP68、AP*17+68、訂單末碼 68&#10;有時間和名字也可以原樣貼上">${escapeHtml(entry.body)}</textarea>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();

    // 綁事件
    batchListEl.querySelectorAll('.ap-log-batch-from').forEach(inp => {
      inp.addEventListener('input', e => {
        const i = parseInt(e.target.dataset.idx, 10);
        batchEntries[i].from = e.target.value;
      });
    });
    batchListEl.querySelectorAll('.ap-log-batch-body').forEach(ta => {
      ta.addEventListener('input', e => {
        const i = parseInt(e.target.dataset.idx, 10);
        batchEntries[i].body = e.target.value;
      });
    });
    batchListEl.querySelectorAll('.ap-log-batch-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.idx, 10);
        batchEntries.splice(i, 1);
        if (batchEntries.length === 0) batchEntries = [{ from: '', body: '' }];
        renderBatchList();
      });
    });
  }

  function syncBatchFromDom() {
    batchListEl.querySelectorAll('.ap-log-batch-from').forEach(inp => {
      const i = parseInt(inp.dataset.idx, 10);
      if (batchEntries[i]) batchEntries[i].from = inp.value;
    });
    batchListEl.querySelectorAll('.ap-log-batch-body').forEach(ta => {
      const i = parseInt(ta.dataset.idx, 10);
      if (batchEntries[i]) batchEntries[i].body = ta.value;
    });
  }

  function renderParseResult(parsed, date, issues) {
    if (parsed.length === 0 && issues.length === 0) {
      parseResult.innerHTML = '<div class="ap-log-warn"><i data-lucide="alert-circle"></i> 沒有解析到任何送你 AP 的紀錄。檢查暱稱有沒有打對，或對話格式是否正確。</div>';
      if (window.lucide) lucide.createIcons();
      return;
    }
    const existing = getLog();
    const existingKeys = new Set(existing.map(r => `${r.from}|${r.code}`));
    const newRecords = [];
    const dupRecords = [];
    parsed.forEach(p => {
      const key = `${p.from}|${p.code}`;
      if (existingKeys.has(key)) dupRecords.push(p);
      else newRecords.push(p);
    });

    let html = '';
    if (issues.length > 0) {
      html += '<div class="ap-log-warn"><i data-lucide="alert-circle"></i><div>';
      issues.forEach(s => html += `<div>${escapeHtml(s)}</div>`);
      html += '</div></div>';
    }
    if (newRecords.length > 0) {
      html += '<div class="ap-log-result-block"><strong>新紀錄（' + newRecords.length + ' 筆）：</strong><ul>';
      newRecords.forEach(r => {
        html += `<li><i data-lucide="plus-circle"></i> ${escapeHtml(r.from)} 訂單 *${escapeHtml(r.code)}</li>`;
      });
      html += '</ul>';
      html += `<button id="ap-log-confirm-btn" class="btn-primary btn-sm"><i data-lucide="check"></i> 全部登記（${newRecords.length} 筆）</button>`;
      html += '</div>';
    }
    if (dupRecords.length > 0) {
      html += '<div class="ap-log-result-block ap-log-result-dup"><strong>已存在（自動跳過 ' + dupRecords.length + ' 筆）：</strong><ul>';
      dupRecords.forEach(r => {
        html += `<li><i data-lucide="skip-forward"></i> ${escapeHtml(r.from)} 訂單 *${escapeHtml(r.code)}</li>`;
      });
      html += '</ul></div>';
    }
    if (newRecords.length === 0 && dupRecords.length > 0 && issues.length === 0) {
      html += '<div class="ap-log-warn-soft">這批對話都已經登記過了。</div>';
    }
    parseResult.innerHTML = html;
    if (window.lucide) lucide.createIcons();

    const confirmBtn = document.getElementById('ap-log-confirm-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const log = getLog();
        newRecords.forEach(r => {
          log.push({
            id: 'ap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            from: r.from,
            code: r.code,
            date: date,
            apPoints: '',
            note: '',
            returned: false,
            createdAt: new Date().toISOString(),
          });
        });
        saveLog(log);
        showToast && showToast(`已登記 ${newRecords.length} 筆`);
        // 清空批次表單
        batchEntries = [{ from: '', body: '' }];
        renderBatchList();
        parseResult.innerHTML = '';
        renderList();
        // 同步 AP 接龍頁的橋接區
        if (window.refreshChainApLogBridge) window.refreshChainApLogBridge();
      });
    }
  }

  function renderList() {
    const log = getLog();
    const filter = filterSelect.value;
    let filtered = log;
    if (filter === 'pending') filtered = log.filter(r => !r.returned);
    else if (filter === 'returned') filtered = log.filter(r => r.returned);

    filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    countEl.textContent = filtered.length > 0 ? `共 ${filtered.length} 筆` : '';
    emptyEl.style.display = filtered.length === 0 ? 'flex' : 'none';
    listEl.style.display = filtered.length === 0 ? 'none' : 'flex';

    listEl.innerHTML = filtered.map(r => `
      <div class="ap-log-card ${r.returned ? 'returned' : ''}" data-id="${r.id}">
        <div class="ap-log-card-main">
          <div class="ap-log-card-from">${escapeHtml(r.from)}</div>
          <div class="ap-log-card-meta">
            <span class="ap-log-code">訂單 *${escapeHtml(r.code)}</span>
            <span class="ap-log-date">${escapeHtml(r.date || '')}</span>
          </div>
          <div class="ap-log-card-extra">
            <label>AP 點數：<input type="text" class="ap-log-points-input" data-id="${r.id}" value="${escapeHtml(r.apPoints || '')}" placeholder="自己填"></label>
            <label>備註：<input type="text" class="ap-log-note-input" data-id="${r.id}" value="${escapeHtml(r.note || '')}" placeholder="（選填）"></label>
          </div>
        </div>
        <div class="ap-log-card-actions">
          <label class="ap-log-returned-toggle">
            <input type="checkbox" class="ap-log-returned-check" data-id="${r.id}" ${r.returned ? 'checked' : ''}>
            <span>${r.returned ? '已回禮' : '已回禮?'}</span>
          </label>
          <button class="btn-icon ap-log-delete-btn" data-id="${r.id}" title="刪除">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
    bindListEvents();
  }

  function bindListEvents() {
    listEl.querySelectorAll('.ap-log-returned-check').forEach(cb => {
      cb.addEventListener('change', e => {
        const id = e.target.dataset.id;
        const log = getLog();
        const r = log.find(x => x.id === id);
        if (r) {
          r.returned = e.target.checked;
          saveLog(log);
          renderList();
          if (window.refreshChainApLogBridge) window.refreshChainApLogBridge();
        }
      });
    });
    listEl.querySelectorAll('.ap-log-points-input').forEach(inp => {
      inp.addEventListener('change', e => {
        const id = e.target.dataset.id;
        const log = getLog();
        const r = log.find(x => x.id === id);
        if (r) { r.apPoints = e.target.value.trim(); saveLog(log); }
      });
    });
    listEl.querySelectorAll('.ap-log-note-input').forEach(inp => {
      inp.addEventListener('change', e => {
        const id = e.target.dataset.id;
        const log = getLog();
        const r = log.find(x => x.id === id);
        if (r) { r.note = e.target.value.trim(); saveLog(log); }
      });
    });
    listEl.querySelectorAll('.ap-log-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (!confirm('確定要刪除這筆紀錄？')) return;
        const log = getLog().filter(r => r.id !== id);
        saveLog(log);
        renderList();
        if (window.refreshChainApLogBridge) window.refreshChainApLogBridge();
      });
    });
  }

  function exportCsv() {
    const log = getLog();
    if (log.length === 0) { showToast && showToast('還沒有紀錄可以匯出'); return; }
    const header = ['日期', '送禮人', '訂單末碼', 'AP 點數', '備註', '已回禮'];
    const rows = log.map(r => [
      r.date || '',
      r.from,
      '*' + r.code,
      r.apPoints || '',
      r.note || '',
      r.returned ? '是' : '否',
    ]);
    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ap-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ============ Parser（單人對話）============
// 一段對話 = 一個送禮人，可能有多個 AP 區塊
// 區塊內有 @我的暱稱 → 把區塊內所有訂單末碼登記給該送禮人
function parseConversation(body, myNick, fromName) {
  const records = [];
  const blocks = splitIntoBlocks(body);
  const normalizedNick = normalizeMentionName(myNick);

  for (const block of blocks) {
    // 抓區塊內所有訂單末碼
    const codes = extractOrderCodes(block);
    if (codes.length === 0) continue;

    // 抓區塊內 @ 名單
    const mentions = extractMentions(block);
    const meMentioned = normalizedNick && mentions.some(mention => {
      const normalizedMention = normalizeMentionName(mention);
      return normalizedMention === normalizedNick
        || normalizedMention.includes(normalizedNick)
        || normalizedNick.includes(normalizedMention);
    });
    if (!meMentioned) continue;

    for (const code of codes) {
      records.push({ from: fromName, code });
    }
  }

  // 去重（同一塊內可能有重複）
  const seen = new Set();
  return records.filter(r => {
    const k = `${r.from}|${r.code}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function splitIntoBlocks(body) {
  const lines = normalizeConversationText(body)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const blocks = [];
  let current = [];
  let currentHasCode = false;
  let currentHasMention = false;

  lines.forEach(line => {
    const lineHasCode = extractOrderCodes(line).length > 0;
    // 前一筆已有訂單碼與收禮人時，下一個訂單碼才算新區塊。
    // 這樣空白行、連續訂單碼與 LINE 時間戳都不會拆錯。
    if (lineHasCode && currentHasCode && currentHasMention) {
      blocks.push(current.join('\n'));
      current = [];
      currentHasCode = false;
      currentHasMention = false;
    }
    current.push(line);
    currentHasCode = currentHasCode || lineHasCode;
    currentHasMention = currentHasMention || /[@＠]/.test(line);
  });

  if (current.length > 0) blocks.push(current.join('\n'));
  return blocks;
}

function normalizeConversationText(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\t ]+/g, ' ');
}

function extractOrderCodes(text) {
  const normalized = normalizeConversationText(text);
  const codes = [];
  const seen = new Set();
  const addCode = code => {
    if (!seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  };

  // *68、#68
  for (const match of normalized.matchAll(/[*#]\s*(\d{1,6})/g)) {
    addCode(match[1]);
  }

  // AP68、AP：68、AP*17+68、AP#17、68
  const apPattern = /\bAP\s*[:：]?\s*((?:[*#]\s*)?\d{1,6}(?:\s*(?:\+|,|、|\/|&|及|和)\s*(?:AP\s*)?(?:[*#]\s*)?\d{1,6})*)/gi;
  for (const match of normalized.matchAll(apPattern)) {
    for (const number of match[1].matchAll(/\d{1,6}/g)) addCode(number[0]);
  }

  // 訂單末碼 2468、末五碼：2468
  const tailPattern = /(?:訂單\s*)?末(?:[一二三四五六七八九十\d]\s*)?碼\s*[:：#*]?\s*(\d{1,6})/g;
  for (const match of normalized.matchAll(tailPattern)) {
    addCode(match[1]);
  }

  return codes;
}

function extractMentions(text) {
  const mentions = [];
  const normalized = normalizeConversationText(text);
  // @ 後抓到下一個 @ 或換行，容許名字後面帶回覆文字。
  const re = /@([^@\n]+)/g;
  let m;
  while ((m = re.exec(normalized)) !== null) {
    let raw = m[1].trim();
    raw = raw.replace(/\s+AP\s*[:*#]?\s*\d.*$/i, '').trim();
    // 跳過 +1, +2, +N 這種
    if (/^\+\d+$/.test(raw)) continue;
    if (raw.length === 0) continue;
    mentions.push(raw);
  }
  return mentions;
}

function normalizeMentionName(name) {
  return normalizeConversationText(name)
    .toLocaleLowerCase('zh-TW')
    .replace(/^[\s@]+|[\s!！?？。．,，、:：;；]+$/g, '')
    .trim();
}

function getLog() {
  try { return JSON.parse(localStorage.getItem(AP_LOG_KEY) || '[]'); }
  catch (e) { return []; }
}

function saveLog(log) {
  localStorage.setItem(AP_LOG_KEY, JSON.stringify(log));
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('ap-log-nick-input')) {
    initApLog();
  }
});

window.initApLog = initApLog;
