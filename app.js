import { hasSupabaseConfig } from "./config.js";
import {
  sendMagicLink,
  getSession,
  onAuthStateChange,
  signOut,
  ensureUserDefaults,
  getAccessToken
} from "./supabaseClient.js";
import { buildQuiz, getResultLabel } from "./quizEngine.js";
import {
  loadWords,
  loadUserProgress,
  saveQuizAttempt,
  loadStats,
  loadReminderSettings,
  saveReminderSettings
} from "./progressService.js";
import { isPushSupported, requestNotificationPermission, subscribeForPush } from "./pushService.js";

const state = {
  mode: hasSupabaseConfig() ? "supabase" : "local",
  session: null,
  user: null,
  words: [],
  progressMap: new Map(),
  quiz: null,
  quizIndex: 0,
  score: 0,
  answers: [],
  startedAt: 0,
  busy: false
};

const dom = {
  sessionBadge: document.querySelector("#session-badge"),
  authView: document.querySelector("#auth-view"),
  appView: document.querySelector("#app-view"),
  authForm: document.querySelector("#auth-form"),
  authEmail: document.querySelector("#email"),
  authMessage: document.querySelector("#auth-message"),
  tabs: [...document.querySelectorAll(".tab[data-view]")],
  logoutBtn: document.querySelector("#logout-btn"),

  quizView: document.querySelector("#quiz-view"),
  statsView: document.querySelector("#stats-view"),
  settingsView: document.querySelector("#settings-view"),

  quizStartPanel: document.querySelector("#quiz-start-panel"),
  quizPanel: document.querySelector("#quiz-panel"),
  quizResultPanel: document.querySelector("#quiz-result-panel"),
  quizWordCount: document.querySelector("#quiz-word-count"),
  quizLoadMessage: document.querySelector("#quiz-load-message"),
  startQuizBtn: document.querySelector("#start-quiz-btn"),
  reloadWordsBtn: document.querySelector("#reload-words-btn"),
  quizProgress: document.querySelector("#quiz-progress"),
  quizScore: document.querySelector("#quiz-score"),
  quizPrompt: document.querySelector("#quiz-prompt"),
  quizExample: document.querySelector("#quiz-example"),
  quizOptions: document.querySelector("#quiz-options"),
  quizFeedback: document.querySelector("#quiz-feedback"),
  quizResultScore: document.querySelector("#quiz-result-score"),
  quizResultLabel: document.querySelector("#quiz-result-label"),
  restartQuizBtn: document.querySelector("#restart-quiz-btn"),

  statsAttempts: document.querySelector("#stats-attempts"),
  statsAverage: document.querySelector("#stats-average"),
  statsBest: document.querySelector("#stats-best"),
  statsRecentList: document.querySelector("#stats-recent-list"),

  settingsForm: document.querySelector("#settings-form"),
  reminderEnabled: document.querySelector("#reminder-enabled"),
  reminderTime: document.querySelector("#reminder-time"),
  timezone: document.querySelector("#timezone"),
  settingsMessage: document.querySelector("#settings-message"),
  toast: document.querySelector("#toast")
};

function setHidden(el, value) {
  if (!el) {
    return;
  }

  el.classList.toggle("hidden", value);
}

function showToast(message) {
  dom.toast.textContent = message;
  setHidden(dom.toast, false);

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    setHidden(dom.toast, true);
  }, 2600);
}

function setSessionBadge() {
  if (state.mode === "local") {
    dom.sessionBadge.textContent = "Lokal rejim";
    return;
  }

  if (state.user?.email) {
    dom.sessionBadge.textContent = state.user.email;
    return;
  }

  dom.sessionBadge.textContent = "Kirish talab qilinadi";
}

function switchMainView(isLoggedIn) {
  if (state.mode === "local") {
    setHidden(dom.authView, true);
    setHidden(dom.appView, false);
    return;
  }

  setHidden(dom.authView, isLoggedIn);
  setHidden(dom.appView, !isLoggedIn);
}

function setTab(viewId) {
  const allViews = [dom.quizView, dom.statsView, dom.settingsView];
  allViews.forEach((section) => setHidden(section, section.id !== viewId));

  dom.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === viewId);
  });
}

function setAuthMessage(message, isError = false) {
  dom.authMessage.textContent = message;
  dom.authMessage.style.color = isError ? "var(--warn)" : "var(--muted)";
}

function setQuizLoadMessage(message, isError = false) {
  dom.quizLoadMessage.textContent = message;
  dom.quizLoadMessage.style.color = isError ? "var(--warn)" : "var(--muted)";
}

function setSettingsMessage(message, isError = false) {
  dom.settingsMessage.textContent = message;
  dom.settingsMessage.style.color = isError ? "var(--warn)" : "var(--muted)";
}

function currentUserId() {
  return state.user?.id || null;
}

async function refreshWordsAndProgress() {
  dom.startQuizBtn.disabled = true;
  setQuizLoadMessage("Sozlar yuklanmoqda...");

  try {
    const [words, progressMap] = await Promise.all([
      loadWords(),
      loadUserProgress(currentUserId())
    ]);

    state.words = words;
    state.progressMap = progressMap;

    dom.quizWordCount.textContent = `Toplam sozlar: ${words.length} ta (A1-A2)`;
    dom.startQuizBtn.disabled = words.length < 4;

    if (words.length < 4) {
      setQuizLoadMessage("Kamida 4 ta soz kerak.", true);
    } else {
      setQuizLoadMessage("Sozlar tayyor.");
    }
  } catch (error) {
    dom.quizWordCount.textContent = "Sozlar yuklanmadi.";
    setQuizLoadMessage(`Xato: ${error.message}`, true);
  }
}

function resetQuizPanels() {
  setHidden(dom.quizStartPanel, false);
  setHidden(dom.quizPanel, true);
  setHidden(dom.quizResultPanel, true);
  dom.quizFeedback.textContent = "";
}

function renderQuestion() {
  const question = state.quiz?.questions[state.quizIndex];
  if (!question) {
    finishQuiz();
    return;
  }

  dom.quizProgress.textContent = `Savol ${state.quizIndex + 1} / ${state.quiz.total}`;
  dom.quizScore.textContent = `Ball: ${state.score}`;
  dom.quizPrompt.textContent = `"${question.word}" sozi nimani anglatadi?`;
  dom.quizExample.textContent = question.example ? `Misol: ${question.example}` : "";
  dom.quizFeedback.textContent = "";
  dom.quizOptions.innerHTML = "";

  question.options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-btn";
    button.textContent = option;
    button.addEventListener("click", () => {
      selectOption(option, button);
    });
    dom.quizOptions.appendChild(button);
  });
}

function selectOption(selectedOption, selectedButton) {
  if (state.busy) {
    return;
  }

  state.busy = true;
  const question = state.quiz.questions[state.quizIndex];
  const isCorrect = selectedOption === question.correctAnswer;

  const optionButtons = [...dom.quizOptions.querySelectorAll("button")];
  optionButtons.forEach((button) => {
    button.disabled = true;
    if (button.textContent === question.correctAnswer) {
      button.classList.add("correct");
    }
  });

  if (!isCorrect) {
    selectedButton.classList.add("wrong");
    dom.quizFeedback.textContent = `Noto'g'ri. To'g'ri javob: ${question.correctAnswer}`;
  } else {
    selectedButton.classList.add("correct");
    dom.quizFeedback.textContent = "To'g'ri javob.";
    state.score += 1;
  }

  state.answers.push({
    wordId: question.wordId,
    isCorrect
  });

  dom.quizScore.textContent = `Ball: ${state.score}`;

  window.setTimeout(() => {
    state.quizIndex += 1;
    state.busy = false;
    renderQuestion();
  }, 650);
}

async function finishQuiz() {
  const total = state.quiz?.total || 0;
  const durationSec = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
  let saveError = null;

  try {
    await saveQuizAttempt({
      userId: currentUserId(),
      score: state.score,
      total,
      durationSec,
      answers: state.answers
    });

    state.progressMap = await loadUserProgress(currentUserId());
    await renderStats();
  } catch (error) {
    saveError = error;
  }

  const label = getResultLabel(state.score, total);
  dom.quizResultScore.textContent = `${state.score}/${total}`;
  dom.quizResultLabel.textContent = `Daraja: ${label}`;

  setHidden(dom.quizPanel, true);
  setHidden(dom.quizResultPanel, false);
  if (saveError) {
    showToast(`Saqlashda xato: ${saveError.message}`);
  }
}

function startQuiz() {
  if (state.words.length < 4) {
    setQuizLoadMessage("Quizni boshlash uchun sozlar yetarli emas.", true);
    return;
  }

  state.quiz = buildQuiz(state.words, state.progressMap, 10);
  state.quizIndex = 0;
  state.score = 0;
  state.answers = [];
  state.busy = false;
  state.startedAt = Date.now();

  setHidden(dom.quizStartPanel, true);
  setHidden(dom.quizResultPanel, true);
  setHidden(dom.quizPanel, false);
  renderQuestion();
}

async function renderStats() {
  const stats = await loadStats(currentUserId());
  dom.statsAttempts.textContent = String(stats.attempts);
  dom.statsAverage.textContent = `${stats.averagePercent}%`;
  dom.statsBest.textContent = `${stats.bestScore}/${stats.bestTotal}`;

  dom.statsRecentList.innerHTML = "";
  if (!stats.recent.length) {
    const li = document.createElement("li");
    li.textContent = "Hozircha urinishlar yoq.";
    dom.statsRecentList.appendChild(li);
    return;
  }

  stats.recent.forEach((attempt) => {
    const li = document.createElement("li");
    const date = new Date(attempt.created_at);
    const dateText = Number.isNaN(date.getTime()) ? "Noma'lum vaqt" : date.toLocaleString();
    li.textContent = `${dateText} - ${attempt.score}/${attempt.total}`;
    dom.statsRecentList.appendChild(li);
  });
}

async function loadSettings() {
  const settings = await loadReminderSettings(currentUserId());
  dom.reminderEnabled.checked = Boolean(settings.enabled);
  dom.reminderTime.value = settings.daily_time_local || "20:00";
  dom.timezone.value = settings.timezone || "Asia/Tashkent";
}

async function saveSettings(event) {
  event.preventDefault();

  const payload = {
    enabled: dom.reminderEnabled.checked,
    daily_time_local: dom.reminderTime.value || "20:00",
    timezone: dom.timezone.value.trim() || "Asia/Tashkent"
  };

  try {
    await saveReminderSettings(currentUserId(), payload);

    if (payload.enabled) {
      if (!isPushSupported()) {
        setSettingsMessage("Brauzer push notificationni qollamaydi.", true);
        return;
      }

      const permission = await requestNotificationPermission();
      if (permission !== "granted") {
        setSettingsMessage("Notification ruxsati berilmadi.", true);
        return;
      }

      if (state.mode === "supabase") {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          setSettingsMessage("Push obuna uchun qayta login qiling.", true);
          return;
        }

        await subscribeForPush({
          accessToken,
          timezone: payload.timezone
        });
      }
    }

    setSettingsMessage("Sozlamalar saqlandi.");
    showToast("Sozlamalar yangilandi");
  } catch (error) {
    setSettingsMessage(`Xato: ${error.message}`, true);
  }
}

async function applySession(session) {
  state.session = session;
  state.user = session?.user || null;
  setSessionBadge();
  switchMainView(Boolean(state.user));

  if (state.mode === "supabase" && !state.user) {
    resetQuizPanels();
    return;
  }

  if (state.user) {
    try {
      if (state.mode === "supabase") {
        await ensureUserDefaults(state.user);
      }
      await Promise.all([refreshWordsAndProgress(), renderStats(), loadSettings()]);
      resetQuizPanels();
    } catch (error) {
      showToast(`Yuklashda xato: ${error.message}`);
    }
  } else if (state.mode === "local") {
    await Promise.all([refreshWordsAndProgress(), renderStats(), loadSettings()]);
    resetQuizPanels();
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = dom.authEmail.value.trim();

  if (!email) {
    setAuthMessage("Email kiriting.", true);
    return;
  }

  try {
    await sendMagicLink(email);
    setAuthMessage("Magic link yuborildi. Emailni tekshiring.");
  } catch (error) {
    setAuthMessage(`Xato: ${error.message}`, true);
  }
}

async function handleLogout() {
  try {
    await signOut();
    showToast("Hisobdan chiqildi.");
  } catch (error) {
    showToast(`Chiqishda xato: ${error.message}`);
  }
}

function bindEvents() {
  dom.authForm.addEventListener("submit", handleAuthSubmit);
  dom.startQuizBtn.addEventListener("click", startQuiz);
  dom.restartQuizBtn.addEventListener("click", () => {
    resetQuizPanels();
  });
  dom.reloadWordsBtn.addEventListener("click", () => {
    refreshWordsAndProgress().catch((error) => {
      setQuizLoadMessage(`Xato: ${error.message}`, true);
    });
  });
  dom.settingsForm.addEventListener("submit", saveSettings);
  dom.logoutBtn.addEventListener("click", handleLogout);

  dom.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setTab(tab.dataset.view);
      if (tab.dataset.view === "stats-view") {
        renderStats().catch((error) => showToast(error.message));
      }
    });
  });
}

async function bootstrap() {
  bindEvents();
  setTab("quiz-view");
  setSessionBadge();

  if (state.mode === "local") {
    state.user = {
      id: null,
      email: "lokal@qurilma"
    };
    setSessionBadge();
    switchMainView(true);
    await applySession(null);
    return;
  }

  try {
    const session = await getSession();
    await applySession(session);

    onAuthStateChange((nextSession) => {
      applySession(nextSession).catch((error) => {
        showToast(`Session xatosi: ${error.message}`);
      });
    });
  } catch (error) {
    showToast(`Boshlashda xato: ${error.message}`);
  }
}

bootstrap();
