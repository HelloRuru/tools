/**
 * 身份選擇 + 快速驗證模組
 * 流程：選名字 → 答一題 → 完成
 * 新人：引導去填 AP 登記表
 */

const QUIZ_ANSWERS = { q1: 'C', q2: 'B' }; // 讀墨1500日挑戰 + 五花

function initQuiz() {
  const identityStep = document.getElementById('identity-step');
  const quizStep = document.getElementById('quiz-step');
  const identitySelect = document.getElementById('identity-select');
  const btnIdentity = document.getElementById('btn-identity-confirm');
  const btnQuizSubmit = document.getElementById('btn-quiz-submit');
  const quizError = document.getElementById('quiz-error');

  let selectedName = '';

  // Populate member dropdown from AppState.members
  function populateMembers() {
    identitySelect.innerHTML = '<option value="">-- 選擇你的名字 --</option>';
    AppState.members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = `#${m.id} ${m.name}`;
      identitySelect.appendChild(opt);
    });
  }

  // Enable/disable confirm button
  identitySelect.addEventListener('change', () => {
    btnIdentity.disabled = !identitySelect.value;
  });

  // Step 1 → 判斷是否跳過 quiz
  btnIdentity.addEventListener('click', () => {
    selectedName = identitySelect.value;
    if (!selectedName) return;

    // 書單/接龍只需選身分，不需答題
    if (AppState._identityOnly) {
      const today = new Date().toISOString().split('T')[0];
      saveUser(selectedName, today);
      closeModal('quiz-modal');
      showToast(`歡迎，${selectedName}！`);
      resetModal();
      if (AppState._authCallback) {
        AppState._authCallback();
        AppState._authCallback = null;
      }
      AppState._identityOnly = false;
      return;
    }

    // 名冊編輯需要答題
    identityStep.style.display = 'none';
    quizStep.style.display = 'block';
  });

  // Quiz submit
  btnQuizSubmit.addEventListener('click', () => {
    const a1 = document.querySelector('input[name="q1"]:checked');
    const a2 = document.querySelector('input[name="q2"]:checked');

    if (!a1 || !a2) {
      quizError.style.display = 'flex';
      quizError.querySelector('span').textContent = '兩題都要選喔！';
      return;
    }

    if (a1.value === QUIZ_ANSWERS.q1 && a2.value === QUIZ_ANSWERS.q2) {
      // Pass!
      const today = new Date().toISOString().split('T')[0];
      saveUser(selectedName, today);
      closeModal('quiz-modal');
      showToast(`歡迎回來，${selectedName}！`);
      resetModal();

      // Execute pending auth callback
      if (AppState._authCallback) {
        AppState._authCallback();
        AppState._authCallback = null;
      }
    } else {
      quizError.style.display = 'flex';
      quizError.querySelector('span').textContent = '答案不正確，請再試一次。';
      document.querySelectorAll('input[name="q1"], input[name="q2"]').forEach(r => r.checked = false);
    }
  });

  function resetModal() {
    identityStep.style.display = 'block';
    quizStep.style.display = 'none';
    quizError.style.display = 'none';
    identitySelect.value = '';
    btnIdentity.disabled = true;
    document.querySelectorAll('input[name="q1"], input[name="q2"]').forEach(r => r.checked = false);
    selectedName = '';
  }

  // Close modal resets
  document.getElementById('quiz-modal-close').addEventListener('click', () => {
    closeModal('quiz-modal');
    resetModal();
    AppState._identityOnly = false;
  });

  // Populate on init (members already loaded)
  populateMembers();

  // Re-populate if members update later
  document.addEventListener('members-updated', populateMembers);
}

window.initQuiz = initQuiz;
