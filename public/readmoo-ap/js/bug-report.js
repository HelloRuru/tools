// Readmoo AP BUG 報告：錯誤捕捉、隱私過濾與 Markdown 匯出
(function () {
  'use strict';

  if (window.ReadmooBugReport) return;

  const MAX_ERRORS = 20;
  const recentErrors = [];

  function sanitizeText(value, maxLength = 600) {
    return String(value || '')
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[電子郵件已隱藏]')
      .replace(/https?:\/\/[^\s)\]}>'"]+/gi, '[網址已隱藏]')
      .replace(/([*#])\s*\d{2,6}/g, '$1[末碼已隱藏]')
      .replace(/`/g, "'")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
      .slice(0, maxLength);
  }

  function recordError(type, message, source, line, column) {
    recentErrors.push({
      time: new Date().toLocaleTimeString('zh-TW', { hour12: false }),
      type,
      message: sanitizeText(message || '未知錯誤'),
      source: source ? sanitizeText(String(source).split('/').pop(), 100) : '',
      line: Number.isFinite(line) ? line : null,
      column: Number.isFinite(column) ? column : null,
    });
    if (recentErrors.length > MAX_ERRORS) recentErrors.shift();
  }

  window.addEventListener('error', event => {
    recordError('JavaScript', event.message, event.filename, event.lineno, event.colno);
  });

  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    recordError('Promise', reason?.message || reason || '未處理的 Promise 錯誤');
  });

  function detectBrowser() {
    const ua = navigator.userAgent || '';
    if (ua.includes('Line/')) return 'LINE 內建瀏覽器';
    if (ua.includes('FBAN') || ua.includes('FBAV')) return 'Facebook 內建瀏覽器';
    if (ua.includes('Edg/')) return 'Microsoft Edge';
    if (ua.includes('Chrome/')) return 'Chrome';
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('Safari/')) return 'Safari';
    return '其他瀏覽器';
  }

  function readArrayCount(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value.length : 0;
    } catch (error) {
      return '資料損壞';
    }
  }

  function collectStorageSummary() {
    try {
      const probeKey = '__readmoo_bug_report_probe__';
      localStorage.setItem(probeKey, '1');
      localStorage.removeItem(probeKey);
      return {
        available: true,
        books: readArrayCount('readmoo-ap-books'),
        apLog: readArrayCount('readmoo-ap-log'),
        identityConfigured: Boolean(localStorage.getItem('readmoo-ap-user')),
        chainStateConfigured: Boolean(localStorage.getItem('readmoo-ap-chain-state')),
      };
    } catch (error) {
      return {
        available: false,
        books: '無法讀取',
        apLog: '無法讀取',
        identityConfigured: false,
        chainStateConfigured: false,
      };
    }
  }

  function collectVersions() {
    return Array.from(document.querySelectorAll('script[src]'))
      .map(script => {
        try {
          const url = new URL(script.src, window.location.origin);
          if (!url.pathname.includes('/readmoo-ap/js/')) return null;
          return `${url.pathname.split('/').pop()}${url.search || ''}`;
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);
  }

  async function probe(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const startedAt = performance.now();
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      return `HTTP ${response.status} ${Math.round(performance.now() - startedAt)}ms`;
    } catch (error) {
      const name = error.name === 'AbortError' ? 'TIMEOUT' : sanitizeText(error.message, 80);
      return `FAIL ${name} ${Math.round(performance.now() - startedAt)}ms`;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function collectDiagnostics() {
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'unknown';
    const [search, daily] = await Promise.all([
      probe('/api/readmoo-search?q=__ping__'),
      probe('/api/daily-99'),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      page: `${window.location.origin}${window.location.pathname}`,
      currentTab: activeTab,
      browser: detectBrowser(),
      platform: navigator.userAgentData?.platform || navigator.platform || 'unknown',
      language: navigator.language || 'unknown',
      screen: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      online: navigator.onLine,
      versions: collectVersions(),
      api: { search, daily },
      storage: collectStorageSummary(),
      errors: recentErrors.slice(),
    };
  }

  function buildMarkdown(diag, description = '') {
    const safeDescription = sanitizeText(description, 1000) || '未填寫';
    const errors = Array.isArray(diag.errors) && diag.errors.length > 0
      ? diag.errors.map(error => {
          const location = error.source
            ? ` (${sanitizeText(error.source, 100)}${error.line ? `:${error.line}` : ''}${error.column ? `:${error.column}` : ''})`
            : '';
          return `- ${sanitizeText(error.time, 30)} [${sanitizeText(error.type, 30)}] ${sanitizeText(error.message)}${location}`;
        }).join('\n')
      : '- 未捕捉到 JavaScript 錯誤';
    const versions = Array.isArray(diag.versions) && diag.versions.length > 0
      ? diag.versions.map(version => `- ${sanitizeText(version, 150)}`).join('\n')
      : '- 無法取得版本';

    return `# Readmoo AP BUG 報告

> 由工具自動產生。系統不會從本機資料讀取暱稱、書名、LINE 對話或 localStorage 原文。

## 使用者描述

> ${safeDescription.replace(/\n/g, '\n> ')}

## 版本與環境

- 產生時間：${sanitizeText(diag.generatedAt, 50)}
- 頁面：${sanitizeText(diag.page, 200)}
- 目前分頁：${sanitizeText(diag.currentTab, 50)}
- 瀏覽器：${sanitizeText(diag.browser, 80)}
- 平台：${sanitizeText(diag.platform, 80)}
- 語言：${sanitizeText(diag.language, 30)}
- 螢幕：${sanitizeText(diag.screen, 30)}
- 視窗：${sanitizeText(diag.viewport, 30)}
- 網路：${diag.online ? '連線中' : '離線'}

### JavaScript 版本

${versions}

## 服務檢查

- Readmoo 搜尋 API：${sanitizeText(diag.api?.search, 100)}
- 每日好書 API：${sanitizeText(diag.api?.daily, 100)}

## 本機資料摘要

- LocalStorage：${diag.storage?.available ? '可用' : '無法使用'}
- 書單筆數：${sanitizeText(diag.storage?.books, 30)}
- AP 紀錄筆數：${sanitizeText(diag.storage?.apLog, 30)}
- 已設定身分：${diag.storage?.identityConfigured ? '是' : '否'}
- 有接龍暫存：${diag.storage?.chainStateConfigured ? '是' : '否'}

## 最近錯誤

${errors}

## 隱私說明

- 系統不會從本機資料附上暱稱、書名、LINE 對話與儲存原文。
- 電子郵件、網址與訂單末碼會自動遮蔽。
- 請先快速檢查內容，再把這份 Markdown 檔傳給 HelloRuru。
`;
  }

  function makeFilename() {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `readmoo-ap-bug-report-${stamp}.md`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function generateReport() {
    const description = window.prompt(
      '請簡短描述發生了什麼（可以留白，請勿填入姓名、書名或 LINE 對話）',
      ''
    );
    if (description === null) return;

    const button = document.getElementById('btn-download-bug-report');
    const originalHtml = button?.innerHTML || '';
    if (button) {
      button.disabled = true;
      button.textContent = '整理報告中...';
    }

    try {
      const diagnostics = await collectDiagnostics();
      const markdown = buildMarkdown(diagnostics, description);
      const filename = makeFilename();
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });

      if (typeof File === 'function' && navigator.share && navigator.canShare) {
        const file = new File([blob], filename, { type: 'text/markdown' });
        try {
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Readmoo AP BUG 報告',
              text: '請把這份 BUG 報告傳給 HelloRuru。',
            });
            if (typeof showToast === 'function') showToast('BUG 報告已開啟分享');
            return;
          }
        } catch (error) {
          if (error.name === 'AbortError') return;
        }
      }

      downloadBlob(blob, filename);
      if (typeof showToast === 'function') showToast('BUG 報告已下載');
    } catch (error) {
      recordError('BUG 報告', error.message);
      if (typeof showToast === 'function') showToast('報告產生失敗：' + sanitizeText(error.message, 80));
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = originalHtml;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  function bindButton() {
    const button = document.getElementById('btn-download-bug-report');
    if (button && !button.dataset.bound) {
      button.dataset.bound = 'true';
      button.addEventListener('click', generateReport);
    }
  }

  window.ReadmooBugReport = {
    buildMarkdown,
    collectDiagnostics,
    generateReport,
    sanitizeText,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButton);
  } else {
    bindButton();
  }
})();
