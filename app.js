import { SUPABASE_CONFIG, IS_DEMO_MODE } from "./config.js";

// --- SOUND & HAPTICS ENGINE (Zero external audio files needed) ---
class SoundFX {
  constructor() {
    this.enabled = localStorage.getItem("stat_sound") !== "off";
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playTone(freq, type = "sine", duration = 0.12, gainVal = 0.15) {
    if (!this.enabled) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  tick(urgent = false) {
    this.playTone(urgent ? 880 : 520, "triangle", 0.05, 0.06);
  }

  reveal(tier) {
    if (tier === "exact" || tier === "close") {
      this.playTone(587.33, "sine", 0.12, 0.2);
      setTimeout(() => this.playTone(880, "sine", 0.25, 0.2), 110);
      if (navigator.vibrate) navigator.vibrate([40, 30, 80]);
    } else if (tier === "near") {
      this.playTone(440, "triangle", 0.18, 0.15);
      if (navigator.vibrate) navigator.vibrate(50);
    } else {
      this.playTone(190, "sawtooth", 0.25, 0.15);
      if (navigator.vibrate) navigator.vibrate(150);
    }
  }
}

const sfx = new SoundFX();

// --- LOCAL DEMO QUESTION BANK (Used only when Supabase is not configured) ---
const DEMO_QUESTIONS = [
  { id: "d1", prompt: "Highest individual BBL innings score (Glenn Maxwell, BBL|11)?", unit: "runs", correct_answer: 154, tolerance: 25, explanation: "Glenn Maxwell blasted 154* off 64 balls for the Melbourne Stars vs Hobart Hurricanes in Jan 2022.", category: "player", difficulty: "easy" },
  { id: "d2", prompt: "Total BBL sixes hit by Chris Lynn during his Brisbane Heat career?", unit: "sixes", correct_answer: 180, tolerance: 35, explanation: "Chris Lynn hit 180 sixes in teal for the Brisbane Heat.", category: "player", difficulty: "medium" },
  { id: "d3", prompt: "Lowest team innings total in BBL history (Sydney Thunder, BBL|12)?", unit: "runs", correct_answer: 15, tolerance: 10, explanation: "Sydney Thunder were bowled out for 15 by the Adelaide Strikers in December 2022.", category: "team", difficulty: "easy" },
  { id: "d4", prompt: "Wickets taken by Rashid Khan in his first 5 BBL seasons?", unit: "wickets", correct_answer: 92, tolerance: 20, explanation: "Rashid Khan claimed 92 wickets across his opening five BBL campaigns.", category: "player", difficulty: "hard" },
  { id: "d5", prompt: "Highest successful run chase in BBL history (Hurricanes vs Heat, 2017)?", unit: "runs", correct_answer: 223, tolerance: 25, explanation: "Hobart Hurricanes chased down 223 at the Gabba in BBL|06.", category: "venue", difficulty: "medium" },
  { id: "d6", prompt: "Runs scored by D'Arcy Short in BBL|07?", unit: "runs", correct_answer: 572, tolerance: 60, explanation: "D'Arcy Short scored 572 runs at 57.20 in BBL|07.", category: "season", difficulty: "hard" },
  { id: "d7", prompt: "BBL championships won by the Perth Scorchers up to BBL|13?", unit: "titles", correct_answer: 5, tolerance: 2, explanation: "Perth Scorchers have won 5 BBL titles.", category: "team", difficulty: "easy" },
];

// --- APPLICATION STATE ---
const state = {
  sessionId: null,
  mode: "daily",
  nickname: localStorage.getItem("stat_nickname") || "",
  currentIndex: 0,
  totalQuestions: 7,
  totalScore: 0,
  currentQuestion: null,
  timerInterval: null,
  timeLeft: 12.0,
  questionStartTime: 0,
  resultsHistory: [], // Stores tier emojis for sharing
  demoQueue: [],
};

// --- DOM ELEMENTS ---
const screens = {
  home: document.getElementById("homeScreen"),
  game: document.getElementById("gameScreen"),
  summary: document.getElementById("summaryScreen"),
  leaderboard: document.getElementById("leaderboardScreen"),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// --- INITIALIZATION ---
function initApp() {
  document.getElementById("nicknameInput").value = state.nickname;
  updateStreakUI();

  if (IS_DEMO_MODE) {
    document.getElementById("demoBanner").classList.remove("hidden");
  }

  document.getElementById("soundToggle").textContent = sfx.enabled ? "🔊" : "🔇";
  document.getElementById("soundToggle").addEventListener("click", () => {
    sfx.enabled = !sfx.enabled;
    localStorage.setItem("stat_sound", sfx.enabled ? "on" : "off");
    document.getElementById("soundToggle").textContent = sfx.enabled ? "🔊" : "🔇";
  });

  document.getElementById("startDailyBtn").addEventListener("click", () => startGame("daily"));
  document.getElementById("startSuperOverBtn").addEventListener("click", () => startGame("super_over"));
  document.getElementById("guessForm").addEventListener("submit", handleGuessSubmit);
  document.getElementById("nextQuestionBtn").addEventListener("click", loadNextStep);
  document.getElementById("nativeShareBtn").addEventListener("click", shareNative);
  document.getElementById("copyShareBtn").addEventListener("click", copyShareText);
  document.getElementById("leaderboardBtn").addEventListener("click", () => openLeaderboard("daily"));
  document.getElementById("viewBoardFromSummary").addEventListener("click", () => openLeaderboard(state.mode));
  document.getElementById("closeLbBtn").addEventListener("click", () => showScreen("home"));
  document.getElementById("playAgainBtn").addEventListener("click", () => showScreen("home"));
  document.getElementById("logoHome").addEventListener("click", () => {
    clearInterval(state.timerInterval);
    showScreen("home");
  });

  document.querySelectorAll(".lb-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      document.querySelectorAll(".lb-tab").forEach((t) => t.classList.remove("active"));
      e.target.classList.add("active");
      fetchLeaderboard(e.target.dataset.mode);
    });
  });
}

function updateStreakUI() {
  const streak = localStorage.getItem("stat_streak") || 0;
  const best = localStorage.getItem("stat_best_daily") || 0;
  document.getElementById("streakCount").textContent = streak;
  document.getElementById("bestDailyScore").textContent = Number(best).toLocaleString();
}

// --- API HELPERS ---
async function callEdgeFunction(fnName, payload) {
  const res = await fetch(`${SUPABASE_CONFIG.URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Server error");
  return data;
}

// --- GAMEPLAY FLOW ---
async function startGame(mode) {
  const nickInput = document.getElementById("nicknameInput").value.trim();
  if (nickInput.length < 2) {
    alert("Enter a nickname (2-16 characters) to take strike!");
    return;
  }

  state.nickname = nickInput;
  state.mode = mode;
  state.currentIndex = 0;
  state.totalScore = 0;
  state.resultsHistory = [];
  localStorage.setItem("stat_nickname", nickInput);
  sfx.init();

  try {
    if (IS_DEMO_MODE) {
      const count = mode === "daily" ? 7 : 6;
      state.demoQueue = [...DEMO_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, count);
      state.totalQuestions = state.demoQueue.length;
      state.currentQuestion = state.demoQueue[0];
    } else {
      const data = await callEdgeFunction("start-game", { nickname: nickInput, mode });
      state.sessionId = data.sessionId;
      state.totalQuestions = data.totalQuestions;
      state.currentQuestion = data.firstQuestion;
    }

    showScreen("game");
    renderQuestion();
  } catch (err) {
    alert("Could not start match: " + err.message);
  }
}

function renderQuestion() {
  const q = state.currentQuestion;
  document.getElementById("revealCard").classList.add("hidden");
  document.getElementById("guessForm").classList.remove("hidden");
  document.getElementById("guessInput").value = "";
  document.getElementById("guessInput").disabled = false;
  document.getElementById("lockGuessBtn").disabled = false;

  document.getElementById("questionCounter").textContent = `${state.currentIndex + 1}/${state.totalQuestions}`;
  document.getElementById("liveScore").textContent = state.totalScore.toLocaleString();
  document.getElementById("qCategory").textContent = q.category;
  document.getElementById("qDifficulty").textContent = q.difficulty;
  document.getElementById("questionPrompt").textContent = q.prompt;
  document.getElementById("unitLabel").textContent = q.unit || "";

  startTimer();
  setTimeout(() => document.getElementById("guessInput").focus(), 100);
}

function startTimer() {
  clearInterval(state.timerInterval);
  state.timeLeft = 12.0;
  state.questionStartTime = performance.now();
  let lastWholeSecond = 12;

  const timerDisplay = document.getElementById("timerDisplay");
  const timerBar = document.getElementById("timerBar");
  timerDisplay.className = "timer-display";
  timerBar.style.backgroundColor = "var(--lime)";

  state.timerInterval = setInterval(() => {
    const elapsed = (performance.now() - state.questionStartTime) / 1000;
    state.timeLeft = Math.max(0, 12.0 - elapsed);

    timerDisplay.textContent = state.timeLeft.toFixed(1);
    const pct = (state.timeLeft / 12.0) * 100;
    timerBar.style.width = `${pct}%`;

    const currentWhole = Math.ceil(state.timeLeft);
    if (currentWhole < lastWholeSecond && currentWhole > 0) {
      lastWholeSecond = currentWhole;
      sfx.tick(currentWhole <= 4);
    }

    if (state.timeLeft <= 6 && state.timeLeft > 3) {
      timerDisplay.className = "timer-display warn";
      timerBar.style.backgroundColor = "var(--amber)";
    } else if (state.timeLeft <= 3) {
      timerDisplay.className = "timer-display danger";
      timerBar.style.backgroundColor = "var(--crimson)";
    }

    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      submitGuess(null); // Timed out
    }
  }, 50);
}

function handleGuessSubmit(e) {
  e.preventDefault();
  const rawVal = document.getElementById("guessInput").value;
  if (rawVal === "") return;
  clearInterval(state.timerInterval);
  submitGuess(Number(rawVal));
}

async function submitGuess(guessVal) {
  document.getElementById("guessInput").disabled = true;
  document.getElementById("lockGuessBtn").disabled = true;

  let result;

  if (IS_DEMO_MODE) {
    // Mirror exact server scoring logic for offline testing
    const q = state.currentQuestion;
    const elapsed = (performance.now() - state.questionStartTime) / 1000;
    const timedOut = guessVal === null || elapsed > 12.5;
    let pointsAwarded = 0;
    let accuracyTier = "miss";

    if (!timedOut) {
      const diff = Math.abs(guessVal - q.correct_answer);
      const accuracyRatio = Math.exp(-Math.pow(diff / q.tolerance, 1.5));
      const accuracyPoints = Math.round(850 * accuracyRatio);
      const speedPoints = accuracyPoints >= 150 ? Math.round(150 * (Math.max(0, 12 - elapsed) / 12)) : 0;
      pointsAwarded = Math.min(1000, accuracyPoints + speedPoints);

      if (diff === 0) accuracyTier = "exact";
      else if (accuracyRatio >= 0.75) accuracyTier = "close";
      else if (accuracyRatio >= 0.35) accuracyTier = "near";
    }

    state.totalScore += pointsAwarded;
    const nextIdx = state.currentIndex + 1;
    const isCompleted = nextIdx >= state.totalQuestions;

    result = {
      correctAnswer: q.correct_answer,
      explanation: q.explanation,
      pointsAwarded,
      totalScore: state.totalScore,
      accuracyTier,
      timedOut,
      isCompleted,
      nextQuestion: isCompleted ? null : state.demoQueue[nextIdx],
    };
  } else {
    result = await callEdgeFunction("submit-guess", {
      sessionId: state.sessionId,
      guess: guessVal,
    });
    state.totalScore = result.totalScore;
  }

  // Record emoji for Wordle-style share card
  const tierEmojiMap = { exact: "🟩", close: "🟦", near: "🟨", miss: "🟥" };
  state.resultsHistory.push(tierEmojiMap[result.accuracyTier] || "🟥");

  // Render Reveal Card
  sfx.reveal(result.accuracyTier);
  document.getElementById("guessForm").classList.add("hidden");
  const revealCard = document.getElementById("revealCard");
  revealCard.classList.remove("hidden");

  const badge = document.getElementById("revealBadge");
  badge.className = `reveal-badge tier-${result.accuracyTier}`;
  const labels = { exact: "BULLSEYE!", close: "CRACKING SHOT!", near: "SOLID EFFORT", miss: result.timedOut ? "TIMED OUT!" : "CLEAN BOWLED!" };
  badge.textContent = labels[result.accuracyTier];

  document.getElementById("revealPoints").textContent = `+${result.pointsAwarded} PTS`;
  document.getElementById("userGuessDisplay").textContent = result.timedOut ? "—" : guessVal;
  document.getElementById("actualAnswerDisplay").textContent = result.correctAnswer;
  document.getElementById("explanationText").textContent = result.explanation;
  document.getElementById("liveScore").textContent = state.totalScore.toLocaleString();

  const nextBtn = document.getElementById("nextQuestionBtn");
  nextBtn.textContent = result.isCompleted ? "VIEW FINAL SCORECARD 🏆" : "NEXT DELIVERY →";

  state.currentQuestion = result.nextQuestion;
  state.isCompleted = result.isCompleted;
}

function loadNextStep() {
  if (state.isCompleted) {
    finishMatch();
  } else {
    state.currentIndex++;
    renderQuestion();
  }
}

function finishMatch() {
  showScreen("summary");
  const maxPts = state.totalQuestions * 1000;
  document.getElementById("summaryModeLabel").textContent =
    state.mode === "daily" ? "DAILY CHALLENGE COMPLETE" : "SUPER OVER COMPLETE";
  document.getElementById("finalScoreDisplay").textContent = state.totalScore.toLocaleString();
  document.getElementById("maxScoreDisplay").textContent = `/ ${maxPts.toLocaleString()}`;
  document.getElementById("emojiGrid").textContent = state.resultsHistory.join(" ");

  if (state.mode === "daily") {
    const today = new Date().toISOString().split("T")[0];
    const lastPlayed = localStorage.getItem("stat_last_daily");
    if (lastPlayed !== today) {
      const currentStreak = Number(localStorage.getItem("stat_streak") || 0) + 1;
      localStorage.setItem("stat_streak", currentStreak);
      localStorage.setItem("stat_last_daily", today);
    }
    const prevBest = Number(localStorage.getItem("stat_best_daily") || 0);
    if (state.totalScore > prevBest) {
      localStorage.setItem("stat_best_daily", state.totalScore);
    }
    updateStreakUI();
  }
}

// --- SHARING ---
function buildShareMessage() {
  const modeTitle = state.mode === "daily" ? "Daily Challenge" : "Super Over";
  const maxPts = state.totalQuestions * 1000;
  return `🏏 STAT ATTACK (${modeTitle})\nScore: ${state.totalScore.toLocaleString()} / ${maxPts.toLocaleString()}\n${state.resultsHistory.join("")}\nCan you beat my BBL stats knowledge?`;
}

async function shareNative() {
  const text = buildShareMessage();
  if (navigator.share) {
    try {
      await navigator.share({ title: "STAT ATTACK", text, url: window.location.origin });
    } catch (_) {}
  } else {
    copyShareText();
  }
}

function copyShareText() {
  navigator.clipboard.writeText(`${buildShareMessage()}\n${window.location.origin}`);
  const btn = document.getElementById("copyShareBtn");
  btn.textContent = "✅ COPIED TO CLIPBOARD!";
  setTimeout(() => (btn.textContent = "📋 COPY SCORE CARD"), 2000);
}

// --- LEADERBOARD ---
function openLeaderboard(mode) {
  showScreen("leaderboard");
  document.querySelectorAll(".lb-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.mode === mode);
  });
  fetchLeaderboard(mode);
}

async function fetchLeaderboard(mode) {
  const listEl = document.getElementById("leaderboardList");
  listEl.innerHTML = `<p class="loading-text">Fetching global rankings...</p>`;

  if (IS_DEMO_MODE) {
    listEl.innerHTML = `
      <div class="lb-row"><span class="lb-rank">#1</span><span class="lb-name">Maxi154</span><span class="lb-score">6,420</span></div>
      <div class="lb-row"><span class="lb-rank">#2</span><span class="lb-name">ScorcherFan</span><span class="lb-score">5,890</span></div>
      <div class="lb-row"><span class="lb-rank">#3</span><span class="lb-name">${state.nickname || "You"}</span><span class="lb-score">${state.totalScore.toLocaleString()}</span></div>
    `;
    return;
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    let query = `${SUPABASE_CONFIG.URL}/rest/v1/leaderboard?select=nickname,score&mode=eq.${mode}&order=score.desc&limit=25`;
    if (mode === "daily") {
      query += `&played_date=eq.${today}`;
    }

    const res = await fetch(query, {
      headers: {
        apikey: SUPABASE_CONFIG.ANON_KEY,
        Authorization: `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
      },
    });
    const rows = await res.json();

    if (!rows.length) {
      listEl.innerHTML = `<p class="loading-text">No scores posted yet today. Be the first!</p>`;
      return;
    }

    listEl.innerHTML = rows
      .map(
        (r, i) => `
        <div class="lb-row">
          <span class="lb-rank">#${i + 1}</span>
          <span class="lb-name">${escapeHtml(r.nickname)}</span>
          <span class="lb-score">${Number(r.score).toLocaleString()}</span>
        </div>`
      )
      .join("");
  } catch (err) {
    listEl.innerHTML = `<p class="loading-text">Unable to load standings.</p>`;
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

initApp();
