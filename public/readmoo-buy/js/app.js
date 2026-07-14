/* 讀墨省錢計算機 — app.js */

(function () {
  'use strict';

  /* ---- State ---- */
  var currentInput = '';
  var display = document.getElementById('price-display');
  var hintEl = document.getElementById('screen-hint');
  var hiddenInput = document.getElementById('hidden-input');
  var calcScreen = document.getElementById('calc-screen');

  /* ---- 領書額度成本 ---- */
  var POINT_COST = 999 / 6; /* ~166.5 */

  function pointsNeeded(price) {
    return Math.ceil(price / 250);
  }

  function redeemCost(price) {
    return pointsNeeded(price) * POINT_COST;
  }

  /* ---- 更新螢幕 ---- */
  function updateDisplay() {
    display.textContent = currentInput || '0';

    /* 同步隱藏 input */
    if (hiddenInput) hiddenInput.value = currentInput;

    if (currentInput.length === 0) {
      hintEl.textContent = '點這裡可用手機鍵盤輸入';
      hintEl.classList.remove('hint-warn');
      display.classList.remove('has-value');
    } else {
      var val = parseInt(currentInput, 10);
      if (val > 9999) {
        hintEl.textContent = '最多 $9999';
        hintEl.classList.add('hint-warn');
      } else if (val < 50 && currentInput.length >= 2) {
        hintEl.textContent = '最少 $50';
        hintEl.classList.add('hint-warn');
      } else {
        hintEl.textContent = '按「計算」看結果';
        hintEl.classList.remove('hint-warn');
      }
      display.classList.add('has-value');
    }
  }

  /* ---- 按鍵處理 ---- */
  function handleDigit(digit) {
    var next = (currentInput + digit).replace(/^0+(?=\d)/, '');
    if (parseInt(next, 10) > 9999 || next.length > 4) {
      hintEl.textContent = '最多 $9999';
      hintEl.classList.add('hint-warn');
      return;
    }
    currentInput = next;
    updateDisplay();
  }

  function handleBackspace() {
    currentInput = currentInput.slice(0, -1);
    updateDisplay();
    /* 清空時也清結果 */
    if (currentInput.length === 0) {
      clearResults();
    }
  }

  function handleClear() {
    currentInput = '';
    updateDisplay();
    clearResults();
  }

  function clearResults() {
    var container = document.getElementById('calc-results');
    var adviceEl = document.getElementById('calc-advice');
    container.innerHTML =
      '<div class="calc-result-placeholder">' +
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>' +
      '<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>' +
      '</svg>' +
      '<p>輸入書價，按「計算」看結果</p>' +
      '</div>';
    adviceEl.innerHTML = '';
    adviceEl.classList.remove('visible');
  }

  /* ---- 計算六種方案 ---- */
  function calculate(price) {
    if (!price || price < 50) return null;

    var methods = [
      { name: '7折券', cost: Math.round(price * 0.7), tag: '7折優惠券' },
      { name: '75折券', cost: Math.round(price * 0.75), tag: '375券（3本以上75折）' },
      { name: '8折券', cost: Math.round(price * 0.8), tag: '單本8折' },
      { name: '折50券', cost: Math.max(price - 50, 0), tag: price >= 250 ? '滿250折$50（紅利兌換）' : '不限金額折$50' },
      { name: '領書額度', cost: Math.round(redeemCost(price)), tag: '嗜讀999（1點=$167）', points: pointsNeeded(price) },
      { name: '原價', cost: price, tag: '無折扣' }
    ];

    methods.sort(function (a, b) { return a.cost - b.cost; });
    return methods;
  }

  /* ---- 建議文字 ---- */
  function getAdvice(price, methods) {
    if (!methods) return '';

    var best = methods[0];
    var saved = price - best.cost;
    var pts = pointsNeeded(price);
    var isRedeem = best.name === '領書額度';
    var isCoupon50 = best.name === '折50券';

    /* 根據實際計算結果決定建議，不靠固定區間 */
    if (isCoupon50) {
      /* 折50券最划算：通常在 $200 以下 */
      return '<strong>折50券</strong>最省，省 $' + saved + '。便宜書直接用折50券最划算，打折券和領書額度留給貴的書。';
    }

    if (isRedeem) {
      /* 領書額度最划算的情況 */
      if (price <= 250) {
        return '領書額度的甜蜜區，<strong>' + pts + ' 點</strong>只要 $' + best.cost + '，省 $' + saved + '。有嗜讀999的話直接領。';
      }
      return '<strong>領書額度（' + pts + '點）</strong>最划算，省 $' + saved + '。書價剛好卡在領書有利的區間。';
    }

    /* 75折或8折最划算的情況 */
    if (price > 500) {
      return '書價偏高，<strong>' + best.name + '</strong>省 $' + saved + '。買 3 本以上搭 375 券可能更好，也可以等活動疊疊樂。';
    }
    /* 一般情況 */
    var second = methods[1];
    var gap = second.cost - best.cost;
    if (gap <= 5) {
      return '<strong>' + best.name + '</strong>和<strong>' + second.name + '</strong>差不多（只差 $' + gap + '），看手邊有哪張券就用哪張。';
    }
    return '<strong>' + best.name + '</strong>最省，省 $' + saved + '。有活動折扣的書記得先疊再用券。';
  }

  /* ---- 渲染結果 ---- */
  function renderResults(price) {
    var container = document.getElementById('calc-results');
    var adviceEl = document.getElementById('calc-advice');
    var methods = calculate(price);

    if (!methods) {
      hintEl.textContent = price < 50 ? '最少 $50' : '按數字鍵輸入書價';
      if (price < 50) hintEl.classList.add('hint-warn');
      return;
    }

    hintEl.textContent = '$' + price + ' 的最佳買法｜點螢幕重新輸入';
    hintEl.classList.remove('hint-warn');

    var html = '<div class="calc-result-cards">';
    methods.forEach(function (m, i) {
      var rankClass = i === 0 ? 'calc-card--best' : '';
      var label = i === 0 ? '<span class="calc-card-badge">最划算</span>' : '';
      var savedText = i === 0 && price > m.cost ? '<div class="calc-card-saved">省 $' + (price - m.cost) + '</div>' : '';
      var pointsText = m.points ? '<div class="calc-card-points">' + m.points + '點</div>' : '';

      html +=
        '<div class="calc-card ' + rankClass + '">' +
        label +
        '<div class="calc-card-name">' + m.name + '</div>' +
        '<div class="calc-card-cost">$' + m.cost + '</div>' +
        pointsText +
        savedText +
        '<div class="calc-card-tag">' + m.tag + '</div>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;

    adviceEl.innerHTML = getAdvice(price, methods);
    adviceEl.classList.add('visible');
  }

  /* ---- 事件綁定：按鈕 ---- */
  document.querySelectorAll('.calc-key').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var digit = this.dataset.digit;
      var action = this.dataset.action;

      if (digit !== undefined) {
        handleDigit(digit);
        /* 按數字就即時算 */
        var val = parseInt(currentInput, 10);
        if (val >= 50) renderResults(val);
      } else if (action === 'backspace') {
        handleBackspace();
        var val2 = parseInt(currentInput, 10);
        if (val2 >= 50) renderResults(val2);
        else clearResults();
      } else if (action === 'clear') {
        handleClear();
      } else if (action === 'calc') {
        var val3 = parseInt(currentInput, 10);
        renderResults(val3);
      }

      /* 按鈕按下動畫 */
      this.classList.add('pressed');
      var self = this;
      setTimeout(function () { self.classList.remove('pressed'); }, 120);
    });
  });

  /* ---- 鍵盤支援（桌面用，hidden-input focus 時跳過避免重複） ---- */
  document.addEventListener('keydown', function (e) {
    /* 如果 hidden-input 有 focus，讓它的 input 事件處理就好 */
    if (hiddenInput && document.activeElement === hiddenInput) return;

    if (e.key >= '0' && e.key <= '9') {
      handleDigit(e.key);
      var val = parseInt(currentInput, 10);
      if (val >= 50) renderResults(val);
    } else if (e.key === 'Backspace') {
      handleBackspace();
      var val2 = parseInt(currentInput, 10);
      if (val2 >= 50) renderResults(val2);
      else clearResults();
    } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
      handleClear();
    } else if (e.key === 'Enter') {
      var val3 = parseInt(currentInput, 10);
      renderResults(val3);
    }
  });

  /* ---- 隱藏 input 同步（手機軟鍵盤） ---- */
  if (hiddenInput) {
    /* 點螢幕區域 → 清空重新輸入 + focus 隱藏 input */
    calcScreen.addEventListener('click', function () {
      if (currentInput.length > 0) {
        currentInput = '';
        updateDisplay();
        clearResults();
        hiddenInput.value = '';
      }
      hiddenInput.focus();
    });

    /* 監聽隱藏 input 的輸入 */
    hiddenInput.addEventListener('input', function () {
      var val = this.value.replace(/\D/g, '').substring(0, 4).replace(/^0+(?=\d)/, '');
      currentInput = val;
      this.value = val;
      updateDisplay();
      var num = parseInt(val, 10);
      if (num >= 50) renderResults(num);
      else clearResults();
    });
  }

  /* ---- 深色模式 ---- */
  var toggle = document.getElementById('theme-toggle');
  var stored = null;
  try {
    stored = localStorage.getItem('helloruru-theme');
  } catch (error) {
    stored = null;
  }

  if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }

  function syncThemeToggle() {
    var isDark = document.documentElement.classList.contains('dark');
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? '切換為淺色模式' : '切換為深色模式');
  }

  syncThemeToggle();
  toggle.addEventListener('click', function () {
    document.documentElement.classList.toggle('dark');
    syncThemeToggle();
    try {
      localStorage.setItem('helloruru-theme',
        document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    } catch (error) {
      /* 無痕模式或儲存空間停用時，仍保留本次切換 */
    }
  });

  /* ---- Footer 年份 ---- */
  var yearEl = document.getElementById('footer-year');
  if (yearEl) {
    var startYear = 2026;
    var currentYear = new Date().getFullYear();
    yearEl.textContent = currentYear > startYear ? startYear + '–' + currentYear : String(startYear);
  }

  /* ---- Stagger 淡入 ---- */
  var fadeElements = document.querySelectorAll('.fade');
  if ('IntersectionObserver' in window || typeof IntersectionObserver !== 'undefined') {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    fadeElements.forEach(function (el) { io.observe(el); });
  } else {
    fadeElements.forEach(function (el) { el.classList.add('visible'); });
  }

})();
