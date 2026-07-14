/**
 * 書單管理模組
 * CRUD + 購買追蹤 + 快速貼入
 */

function getBooks() {
  return readStoredJson(CONFIG.STORAGE_KEYS.BOOKS, []);
}

function saveBooks(books) {
  localStorage.setItem(CONFIG.STORAGE_KEYS.BOOKS, JSON.stringify(books));
}

function initBooks() {
  const listEl = document.getElementById('books-list');
  const emptyEl = document.getElementById('books-empty');
  const btnAdd = document.getElementById('btn-add-book');
  const btnBatch = document.getElementById('btn-batch-add');
  const btnExport = document.getElementById('btn-export-books');
  const filterBtns = document.querySelectorAll('.filter-btn');

  // Book modal
  const bookModal = document.getElementById('book-modal');
  const btnBookSave = document.getElementById('btn-book-save');
  const bookTitle = document.getElementById('book-title');
  const bookAuthor = document.getElementById('book-author');
  const bookPublisher = document.getElementById('book-publisher');
  const bookPubdate = document.getElementById('book-pubdate');
  const bookEditId = document.getElementById('book-edit-id');
  const bookModalTitle = document.getElementById('book-modal-title');
  const bookOrderNumber = document.getElementById('book-order-number');
  const bookNotes = document.getElementById('book-notes');

  // Batch modal
  const batchModal = document.getElementById('batch-modal');
  const batchInput = document.getElementById('batch-input');
  const btnBatchSave = document.getElementById('btn-batch-save');

  // Purchase modal
  const purchaseModal = document.getElementById('purchase-modal');
  const purchaseDate = document.getElementById('purchase-date');
  const purchaseVia = document.getElementById('purchase-via');
  const purchaseBookId = document.getElementById('purchase-book-id');
  const btnPurchaseSave = document.getElementById('btn-purchase-save');

  let currentFilter = 'all';

  function render() {
    const books = getBooks();
    const wantCount = books.filter(b => b.status === 'want').length;
    const boughtCount = books.filter(b => b.status === 'bought').length;

    // 更新 filter 按鈕上的數量
    filterBtns.forEach(btn => {
      const f = btn.dataset.filter;
      if (f === 'all') btn.textContent = books.length > 0 ? `全部 ${books.length}` : '全部';
      else if (f === 'want') btn.textContent = wantCount > 0 ? `想買 ${wantCount}` : '想買';
      else if (f === 'bought') btn.textContent = boughtCount > 0 ? `已購買 ${boughtCount}` : '已購買';
    });

    // 「清除已購買」按鈕：已購買 tab + 有已購買的書時顯示
    const clearBtn = document.getElementById('btn-clear-bought');
    if (clearBtn) {
      clearBtn.style.display = (currentFilter === 'bought' && boughtCount > 0) ? 'inline-flex' : 'none';
    }

    const filtered = currentFilter === 'all' ? books
      : currentFilter === 'want' ? books.filter(b => b.status === 'want')
      : books.filter(b => b.status === 'bought');

    emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';
    listEl.style.display = filtered.length === 0 ? 'none' : 'flex';

    listEl.innerHTML = filtered.map(b => `
      <div class="book-card ${b.status === 'bought' ? 'bought' : ''}" data-id="${b.id}">
        <div class="book-cover-thumb">
          ${b.cover
            ? `<img src="${escapeHtml(b.cover)}" alt="${escapeHtml(b.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <div class="book-cover-fallback" style="display:none"><i data-lucide="book"></i></div>`
            : `<div class="book-cover-fallback"><i data-lucide="book"></i></div>`
          }
        </div>
        <div class="book-info">
          <div class="book-title">${escapeHtml(b.title)}</div>
          <div class="book-meta">
            ${b.author ? escapeHtml(b.author) : ''}
            ${b.publisher ? ' · ' + escapeHtml(b.publisher) : ''}
            ${b.pubdate ? ' · ' + escapeHtml(b.pubdate) : ''}
          </div>
          ${b.status === 'bought' ? `
            <div class="book-purchase-info">
              <i data-lucide="check-circle"></i>
              已購買${b.purchaseDate ? ' ' + b.purchaseDate : ''}
              ${b.purchaseVia ? ' · 透過 ' + escapeHtml(b.purchaseVia) : ''}
            </div>
          ` : ''}
          ${b.orderNumber ? `
            <div class="book-annotation">
              <i data-lucide="receipt"></i>
              訂單編號 ${escapeHtml(b.orderNumber)}
            </div>
          ` : ''}
          ${b.notes ? `
            <div class="book-annotation book-notes-text">
              <i data-lucide="sticky-note"></i>
              ${escapeHtml(b.notes)}
            </div>
          ` : ''}
        </div>
        <div class="book-actions">
          <button class="btn-icon book-copy-btn" data-title="${escapeHtml(b.title)}" title="複製書名">
            <i data-lucide="copy"></i>
          </button>
          ${b.status === 'want' ? `
            <button class="btn-icon book-buy-btn" data-id="${b.id}" title="標記已購買">
              <i data-lucide="shopping-cart"></i>
            </button>
          ` : `
            <button class="btn-icon book-unbuy-btn" data-id="${b.id}" title="取消購買標記">
              <i data-lucide="undo-2"></i>
            </button>
          `}
          <button class="btn-icon book-edit-btn" data-id="${b.id}" title="編輯">
            <i data-lucide="pencil"></i>
          </button>
          <button class="btn-icon book-delete-btn" data-id="${b.id}" title="刪除">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
    bindBookEvents();

    // 刷新 user-bar 的書本數量
    if (typeof updateUserBar === 'function') updateUserBar();
  }

  function bindBookEvents() {
    // Copy
    listEl.querySelectorAll('.book-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => copyToClipboard(btn.dataset.title));
    });

    // Buy
    listEl.querySelectorAll('.book-buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        purchaseBookId.value = btn.dataset.id;
        purchaseDate.value = new Date().toISOString().split('T')[0];

        // Populate AP members
        purchaseVia.innerHTML = '<option value="">-- 選擇 --</option>';
        AppState.members.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.name;
          opt.textContent = m.name;
          purchaseVia.appendChild(opt);
        });

        openModal('purchase-modal');
      });
    });

    // Unbuy
    listEl.querySelectorAll('.book-unbuy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const books = getBooks();
        const book = books.find(b => b.id === btn.dataset.id);
        if (book) {
          book.status = 'want';
          delete book.purchaseDate;
          delete book.purchaseVia;
          saveBooks(books);
          showToast('已取消購買標記');
          render();
        }
      });
    });

    // Edit
    listEl.querySelectorAll('.book-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const books = getBooks();
        const book = books.find(b => b.id === btn.dataset.id);
        if (!book) return;

        bookModalTitle.textContent = '編輯書籍';
        bookTitle.value = book.title;
        bookAuthor.value = book.author || '';
        bookPublisher.value = book.publisher || '';
        bookPubdate.value = book.pubdate || '';
        bookOrderNumber.value = book.orderNumber || '';
        bookNotes.value = book.notes || '';
        bookEditId.value = book.id;
        openModal('book-modal');
      });
    });

    // Delete
    listEl.querySelectorAll('.book-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('確定刪除這本書嗎？')) return;
        let books = getBooks();
        books = books.filter(b => b.id !== btn.dataset.id);
        saveBooks(books);
        showToast('已刪除');
        render();
      });
    });
  }

  // Filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  // Add book
  btnAdd.addEventListener('click', () => {
    bookModalTitle.textContent = '新增書籍';
    bookTitle.value = '';
    bookAuthor.value = '';
    bookPublisher.value = '';
    bookPubdate.value = '';
    bookOrderNumber.value = '';
    bookNotes.value = '';
    bookEditId.value = '';
    openModal('book-modal');
  });

  // Save book
  btnBookSave.addEventListener('click', () => {
    const title = bookTitle.value.trim();
    if (!title) {
      showToast('請輸入書名');
      return;
    }

    const books = getBooks();
    const editId = bookEditId.value;

    if (editId) {
      // Edit
      const book = books.find(b => b.id === editId);
      if (book) {
        book.title = title;
        book.author = bookAuthor.value.trim();
        book.publisher = bookPublisher.value.trim();
        book.pubdate = bookPubdate.value.trim();
        book.orderNumber = bookOrderNumber.value.trim();
        book.notes = bookNotes.value.trim();
      }
      showToast('已更新');
    } else {
      // Add
      books.push({
        id: 'book_' + Date.now(),
        title,
        author: bookAuthor.value.trim(),
        publisher: bookPublisher.value.trim(),
        pubdate: bookPubdate.value.trim(),
        orderNumber: bookOrderNumber.value.trim(),
        notes: bookNotes.value.trim(),
        status: 'want',
        createdAt: new Date().toISOString()
      });
      showToast('已新增');
    }

    saveBooks(books);
    closeModal('book-modal');
    render();
  });

  // Batch add
  btnBatch.addEventListener('click', () => {
    batchInput.value = '';
    openModal('batch-modal');
  });

  btnBatchSave.addEventListener('click', () => {
    const lines = batchInput.value.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      showToast('請輸入至少一本書名');
      return;
    }

    const books = getBooks();
    lines.forEach(title => {
      books.push({
        id: 'book_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        title,
        author: '',
        publisher: '',
        pubdate: '',
        status: 'want',
        createdAt: new Date().toISOString()
      });
    });

    saveBooks(books);
    closeModal('batch-modal');
    showToast(`已新增 ${lines.length} 本書`);
    render();
  });

  // Purchase save
  const purchaseOrderEl = document.getElementById('purchase-order');
  btnPurchaseSave.addEventListener('click', () => {
    const bookId = purchaseBookId.value;
    const books = getBooks();
    const book = books.find(b => b.id === bookId);
    if (book) {
      book.status = 'bought';
      book.purchaseDate = purchaseDate.value;
      book.purchaseVia = purchaseVia.value;
      book.orderNumber = purchaseOrderEl ? purchaseOrderEl.value.trim() : '';
      saveBooks(books);
      closeModal('purchase-modal');
      showToast('已標記為已購買');

      render();
      document.dispatchEvent(new Event('books-updated'));
    }
  });

  // Export books
  btnExport.addEventListener('click', () => {
    openExportModal('books', []);
  });

  // 一鍵清除已購買
  const btnClearBought = document.getElementById('btn-clear-bought');
  if (btnClearBought) {
    btnClearBought.addEventListener('click', () => {
      const books = getBooks();
      const boughtCount = books.filter(b => b.status === 'bought').length;
      if (boughtCount === 0) {
        showToast('沒有已購買的書可以清除');
        return;
      }
      if (!confirm(`確定要清除 ${boughtCount} 本已購買的書嗎？清除後無法復原。`)) return;
      const remaining = books.filter(b => b.status !== 'bought');
      saveBooks(remaining);
      showToast(`已清除 ${boughtCount} 本已購買的書`);
      render();
    });
  }

  // Expose render for readmoo-search module
  window._booksRender = render;

  // Listen for books-updated event
  document.addEventListener('books-updated', render);

  // Initial render
  render();
}

window.initBooks = initBooks;
window.getBooks = getBooks;
window.saveBooks = saveBooks;
