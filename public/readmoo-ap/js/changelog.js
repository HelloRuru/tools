/**
 * 修改紀錄模組
 * 合併 Google Sheet E 欄共用紀錄 + localStorage 本機紀錄
 */

function getChangelog() {
  return readStoredJson(CONFIG.STORAGE_KEYS.CHANGELOG, []);
}

function saveChangelog(logs) {
  localStorage.setItem(CONFIG.STORAGE_KEYS.CHANGELOG, JSON.stringify(logs));
}

function addChangelogEntry(type, content) {
  const logs = getChangelog();
  logs.unshift({
    id: 'log_' + Date.now(),
    time: new Date().toISOString(),
    user: AppState.user?.name || 'AP接龍工具系統',
    type, // 'add', 'edit', 'delete'
    content
  });
  saveChangelog(logs);

  if (document.getElementById('tab-changelog').classList.contains('active')) {
    renderChangelog();
  }
}

// 把 Sheet E 欄的 log 轉成統一格式
function getSheetLogs() {
  const raw = AppState.sheetLogs || [];
  const actionMap = { '新增': 'add', '編輯': 'edit', '刪除': 'delete' };
  return raw.map(l => ({
    id: `sheet_${l.memberId}_${l.date}_${l.action}`,
    time: `${l.date.slice(0,4)}-${l.date.slice(4,6)}-${l.date.slice(6,8)}T00:00:00`,
    user: l.editor,
    type: actionMap[l.action] || l.action,
    content: `#${l.memberId} ${l.memberName}`,
    source: 'sheet'
  }));
}

function renderChangelog(dateFilter = '') {
  const listEl = document.getElementById('changelog-list');
  const emptyEl = document.getElementById('changelog-empty');

  // 合併 Sheet 共用紀錄 + 本機紀錄，按時間排序（新的在前）
  const localLogs = getChangelog();
  const sheetLogs = getSheetLogs();
  let logs = [...localLogs, ...sheetLogs];

  // 去重（Sheet log 和本機 log 可能重複）
  const seen = new Set();
  logs = logs.filter(l => {
    const key = `${l.user}_${l.type}_${l.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 按時間排序
  logs.sort((a, b) => new Date(b.time) - new Date(a.time));

  if (dateFilter) {
    logs = logs.filter(l => l.time.startsWith(dateFilter));
  }

  emptyEl.style.display = logs.length === 0 ? 'block' : 'none';
  listEl.style.display = logs.length === 0 ? 'none' : 'flex';

  const typeLabels = {
    add: '新增',
    edit: '編輯',
    delete: '刪除'
  };

  listEl.innerHTML = logs.map(l => {
    const date = new Date(l.time);
    const timeStr = date.toLocaleDateString('zh-TW') + ' ' +
                    date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    const sourceTag = l.source === 'sheet' ? ' <span class="cache-badge">共用</span>' : '';
    return `
      <div class="log-item">
        <span class="log-time">${timeStr}</span>
        <span class="log-user">${escapeHtml(l.user)}${sourceTag}</span>
        <span class="log-content">
          <span class="badge" style="font-size:11px;">${typeLabels[l.type] || l.type}</span>
          ${escapeHtml(l.content)}
        </span>
      </div>
    `;
  }).join('');
}

function initChangelog() {
  const dateFilter = document.getElementById('changelog-date-filter');

  dateFilter.addEventListener('change', () => {
    renderChangelog(dateFilter.value);
  });

  renderChangelog();
}

window.initChangelog = initChangelog;
window.addChangelogEntry = addChangelogEntry;
