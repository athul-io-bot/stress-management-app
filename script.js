
const CONFIG = {
  emojis: ["😊", "🙂", "😐", "😕", "😢"],
  colors: ["Red", "Green", "Blue", "Yellow"]
};

function generatePlan(mood, stress, sleep, tags) {
    let plan = [];

    // Mood
    if (mood <= 2) {
        plan.push("Take it slow today");
        plan.push("Talk to someone you trust");
    } else if (mood == 3) {
        plan.push("Do light tasks only");
    } else {
        plan.push("Focus on important work");
    }

    // Stress
    if (stress >= 7) {
        plan.push("Do a 5-minute breathing exercise");
        plan.push("Avoid heavy workload");
    } else if (stress >= 4) {
        plan.push("Take breaks regularly");
    }

    // Sleep
    if (sleep <= 5) {
        plan.push("Take rest or short nap");
    }

    // Tags
    if (tags.includes("Study")) {
        plan.push("Use Pomodoro technique (25 min)");
    }
    if (tags.includes("Exams")) {
        plan.push("Revise key topics only");
    }
    if (tags.includes("Friends")) {
        plan.push("Spend time with friends");
    }
    if (tags.includes("Family")) {
        plan.push("Have a calm conversation");
    }
    if (tags.includes("Health")) {
        plan.push("Do light exercise");
    }

    if (plan.length === 0) {
        plan.push("Maintain normal routine");
    }

    return plan;
}

// Single state object instead of multiple globals
const state = {
  entries: [],
  selectedMood: null,
  selectedTags: [],
  chart: null,
  games: {
    tap: { active: false, score: 0, timer: null, timeLeft: 10 }
  }
};

// STORAGE UTILITIES
const storage = {
  get: (key, defaultVal) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultVal;
  },
  set: (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

const KEYS = {
  entries: "mindtrackentries",
};


function toISODate(d) {
  return new Date(d).toISOString().split("T")[0];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function getLastNDaysEntries(n = 7) {
  const cutoff = toISODate(daysAgo(n - 1));
  return state.entries
    .filter(e => e.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// FEATURE 1: RISK DETECTION
function computeRisk(last7) {
  const highStressDays = last7.filter(e => e.stress >= 8).length;
  const lowSleepDays = last7.filter(e => e.sleep <= 5).length;
  const lowMoodDays = last7.filter(e => e.mood <= 2).length;

  let level = "Low";
  let reason = "No major risk signals in the last 7 days.";

  if (highStressDays >= 2 || lowSleepDays >= 2 || lowMoodDays >= 2) {
    level = "Medium";
    reason = `Signals: high stress (${highStressDays}d), low sleep (${lowSleepDays}d), low mood (${lowMoodDays}d)`;
  }
  if (highStressDays >= 3 || lowSleepDays >= 3 || lowMoodDays >= 3) {
    level = "High";
    reason = `⚠️ STRONG SIGNALS: high stress (${highStressDays}d), low sleep (${lowSleepDays}d), low mood (${lowMoodDays}d)`;
  }
  return { level, reason, highStressDays, lowSleepDays, lowMoodDays };
}

// RENDER RISK & PLAN (Features 1+2)
function renderRiskAndPlan() {
  const last7 = getLastNDaysEntries(7);
  const riskBox = document.getElementById("riskBox");
  const planBox = document.getElementById("planBox");
  
  if (!riskBox || !planBox) return;

  if (!last7.length) {
    riskBox.style.display = "none";
    planBox.style.display = "none";
    return;
  }

  const r = computeRisk(last7);
  document.getElementById("riskTitle").textContent = `Risk Level: ${r.level}`;
  document.getElementById("riskReason").textContent = r.reason;
  riskBox.style.display = "block";

  const latest = last7[last7.length - 1];
  const plan = generatePlan(
    latest.mood,
    latest.stress,
    latest.sleep,
    latest.tags || []
  );
  const ul = document.getElementById("planList");
  ul.innerHTML = plan.map(x => `<li>${x}</li>`).join("");
  planBox.style.display = "block";

  // Dynamic border color
  const colors = { High: "#e74c3c", Medium: "#f39c12", Low: "#2ecc71" };
  riskBox.style.borderLeftColor = colors[r.level];
}

// FEATURE 3: GOALS & STREAK
function computeStreak() {
  if (!state.entries.length) return 0;
  const dates = new Set(state.entries.map(e => e.date));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = toISODate(daysAgo(i));
    if (dates.has(d)) streak++;
    else break;
  }
  return streak;
}

function renderGoalsStats() {
  const last7 = getLastNDaysEntries(7);
  const sleepGoalEl = document.getElementById("sleepGoalStat");
  const stressGoalEl = document.getElementById("stressGoalStat");
  const streakEl = document.getElementById("streakStat");
  
  if (!sleepGoalEl || !stressGoalEl || !streakEl) return;

  if (!last7.length) {
    sleepGoalEl.textContent = "-";
    stressGoalEl.textContent = "-";
    streakEl.textContent = "0";
    return;
  }

  const sleepMet = last7.filter(e => e.sleep >= 7).length;
  const stressMet = last7.filter(e => e.stress <= 5).length;

  sleepGoalEl.textContent = `${sleepMet}/7 days`;
  stressGoalEl.textContent = `${stressMet}/7 days`;
  streakEl.textContent = `${computeStreak()} days`;
}


// CHART
function initChart() {
  const ctx = document.getElementById("myChart")?.getContext("2d");
  if (!ctx) return;
  
  state.chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Mood", data: [], borderColor: "#4a90e2", tension: 0.4 },
        { label: "Stress", data: [], borderColor: "#e74c3c", tension: 0.4 },
        { label: "Sleep", data: [], borderColor: "#9b59b6", tension: 0.4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, max: 10 } }
    }
  });
}

function updateChart() {
  if (!state.chart) return;
  const labels = state.entries.map(e => e.date.slice(5)); // MM-DD
  state.chart.data.labels = labels;
  state.chart.data.datasets[0].data = state.entries.map(e => e.mood);
  state.chart.data.datasets[1].data = state.entries.map(e => e.stress);
  state.chart.data.datasets[2].data = state.entries.map(e => e.sleep);
  state.chart.update();
}

// ENTRY MANAGEMENT
function saveEntry() {
  if (state.selectedMood === null) {
    alert("Please select your mood");
    return;
  }

  const today = toISODate(new Date());
  const entry = {
    date: today,
    mood: parseInt(state.selectedMood),
    stress: parseInt(document.getElementById("stress").value),
    sleep: parseInt(document.getElementById("sleep").value),
    tags: [...state.selectedTags],
    notes: document.getElementById("notes").value
  };

  const existingIdx = state.entries.findIndex(e => e.date === today);
  if (existingIdx !== -1) {
    state.entries[existingIdx] = entry;
    showNotification("Today's entry updated");
  } else {
    state.entries.push(entry);
    showNotification("New entry saved");
  }

  storage.set(KEYS.entries, state.entries);
  generateInsights();
  renderRiskAndPlan();
  resetForm();

  // Update chart if on history page
  if (document.getElementById("history")?.classList.contains("active")) {
    renderHistory();
  }
}

function resetForm() {
  state.selectedMood = null;
  state.selectedTags = [];
  document.querySelectorAll(".mood-btn, .tag-btn").forEach(b => b.classList.remove("selected"));
  document.getElementById("notes").value = "";
  document.getElementById("stress").value = 5;
  document.getElementById("stressNum").textContent = 5;
  document.getElementById("sleep").value = 7;
}

function generateInsights() {
  const insightBox = document.getElementById("insightBox");
  const insightText = document.getElementById("insightText");

  if (state.entries.length < 3) return;

  let lowSleepStress = 0;

  state.entries.forEach(e => {
    if (e.sleep < 6 && e.stress > 6) lowSleepStress++;
  });

  if (lowSleepStress >= 2) {
    insightText.textContent = "Your stress increases when you sleep less than 6 hours. Try targeting 7‑8 hours sleep.";
  } else {
    insightText.textContent = "Your stress levels are fairly stable. Keep maintaining your routine.";
  }

  insightBox.style.display = "block";
}

// HISTORY RENDERING
function renderHistory() {
  const list = document.getElementById("entryList");
  const stats = {
    count: document.getElementById("totalCount"),
    mood: document.getElementById("avgMood"),
    sleep: document.getElementById("avgSleep")
  };

  if (!state.entries.length) {
    list.innerHTML = '<p class="empty-state">No entries yet</p>';
    Object.values(stats).forEach(el => el.textContent = el.id === "totalCount" ? "0" : "-");
    return;
  }

  const totals = state.entries.reduce((acc, e) => ({
    mood: acc.mood + e.mood,
    sleep: acc.sleep + e.sleep
  }), { mood: 0, sleep: 0 });

  stats.count.textContent = state.entries.length;
  stats.mood.textContent = (totals.mood / state.entries.length).toFixed(1);
  stats.sleep.textContent = (totals.sleep / state.entries.length).toFixed(1);

  list.innerHTML = state.entries
    .slice(-10)
    .reverse()
    .map(entry => createEntryHTML(entry))
    .join("");

  updateChart();
  renderGoalsStats();
}

function createEntryHTML(entry) {
  const moodEmoji = CONFIG.emojis[entry.mood - 1];
  return `
    <div class="entry-item">
      <div class="entry-header">
        <span class="entry-mood">${moodEmoji}</span>
        <span class="entry-date">${entry.date}</span>
      </div>
      <div class="entry-details">
        <p><b>Stress:</b> ${entry.stress}/10 <b>Sleep:</b> ${entry.sleep} hrs</p>
        <p><b>Tags:</b> ${entry.tags.join(", ") || "None"}</p>
        ${entry.notes ? `<div class="entry-notes">${entry.notes}</div>` : ""}
      </div>
    </div>
  `;
}

// EVENT LISTENERS SETUP
function setupEventListeners() {
  // Mood selection
  document.querySelectorAll(".mood-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.selectedMood = btn.dataset.mood;
    });
  });

  // Tag selection
  document.querySelectorAll(".tag-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("selected");
      const tag = btn.dataset.tag;
      const idx = state.selectedTags.indexOf(tag);
      if (idx === -1) {
        state.selectedTags.push(tag);
      } else {
        state.selectedTags.splice(idx, 1);
      }
    });
  });

  // Stress slider
  const stressSlider = document.getElementById("stress");
  stressSlider?.addEventListener("input", (e) => {
    document.getElementById("stressNum").textContent = e.target.value;
  });
}

// NOTIFICATIONS
function showNotification(msg) {
  const toast = document.createElement("div");
  toast.className = "toast-notification";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// NAVIGATION
function goToPage(pageName) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageName).classList.add("active");
  
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`nav-${pageName}`).classList.add("active");
  
  if (pageName === "history") renderHistory();
  if (pageName === "checkin") renderRiskAndPlan();
}

// BREATHING EXERCISE
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function doBreathing() {
  const status = document.getElementById("breathStatus");
  const steps = [
    { text: "Breathe IN", duration: 4000 },
    { text: "HOLD", duration: 4000 },
    { text: "Breathe OUT", duration: 6000 }
  ];

  for (const step of steps) {
    status.textContent = step.text;
    await sleep(step.duration);
  }
  status.textContent = "Done! Feel better?";
}

// GAMES
const games = {
  getArea() {
    return document.getElementById("gameArea");
  },
  
  bubble() {
    const area = this.getArea();
    let score = 0;
    
    area.innerHTML = `
      <div class="game-box">
        <h4>Bubble Pop (15 sec)</h4>
        <p>Score: <span id="bubbleScore">0</span></p>
        <div id="bubbleField" style="position:relative;height:200px;background:#eef;"></div>
      </div>
    `;

    const interval = setInterval(() => {
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.style.cssText = `top:${Math.random() * 160}px;left:${Math.random() * 260}px`;
      bubble.onclick = () => {
        score++;
        document.getElementById("bubbleScore").textContent = score;
        bubble.remove();
      };
      document.getElementById("bubbleField").appendChild(bubble);
      setTimeout(() => bubble.remove(), 2000);
    }, 800);

    setTimeout(() => {
      clearInterval(interval);
      alert(`Game Over! Score: ${score}`);
    }, 15000);
  },

  memory() {
    const area = this.getArea();
    const emojis = ["🌟", "🍎", "🐱", "🎸", "🍕", "👻", "🤖"];
    const cards = [...emojis, ...emojis].sort(() => 0.5 - Math.random());
    
    area.innerHTML = `
      <div class="game-box">
        <h4>Memory Match</h4>
        <p>Attempts: <span id="memAttempts">0</span></p>
        <div id="memBoard" style="display:flex;flex-wrap:wrap;justify-content:center;"></div>
      </div>
    `;
    
    let first = null, lock = false, matches = 0, attempts = 0;
    
    cards.forEach(emoji => {
      const card = document.createElement("div");
      card.className = "card";
      card.textContent = "?";
      card.dataset.value = emoji;
      
      card.onclick = () => {
        if (lock || card.textContent !== "?") return;
        card.textContent = emoji;
        
        if (!first) {
          first = card;
        } else {
          attempts++;
          document.getElementById("memAttempts").textContent = attempts;
          
          if (first.dataset.value === emoji) {
            matches++;
            first = null;
            if (matches === emojis.length) setTimeout(() => alert("🎉 You Won!"), 300);
          } else {
            lock = true;
            setTimeout(() => {
              first.textContent = "?";
              card.textContent = "?";
              first = null;
              lock = false;
            }, 800);
          }
        }
      };
      document.getElementById("memBoard").appendChild(card);
    });
  },

  color() {
    const area = this.getArea();
    
    const loadRound = () => {
      const text = CONFIG.colors[Math.floor(Math.random() * 4)];
      let color;
      do {
        color = CONFIG.colors[Math.floor(Math.random() * 4)];
      } while (color === text);
      
      area.innerHTML = `
        <div class="game-box">
          <h4>Color Reflex</h4>
          <p>Click the COLOR of the text</p>
          <h2 style="color:${color.toLowerCase()};text-transform:uppercase;">${text}</h2>
          <div id="colorButtons"></div>
          <p id="colorFeedback" style="margin-top:10px;font-weight:bold;"></p>
        </div>
      `;
      
      const btnContainer = document.getElementById("colorButtons");
      CONFIG.colors.forEach(c => {
        const btn = document.createElement("button");
        btn.className = "btn-tool";
        btn.textContent = c;
        btn.onclick = () => {
          const fb = document.getElementById("colorFeedback");
          const isCorrect = c === color;
          fb.textContent = isCorrect ? "Correct ✅" : "Wrong ❌";
          fb.style.color = isCorrect ? "green" : "red";
          if (isCorrect) setTimeout(loadRound, 600);
        };
        btnContainer.appendChild(btn);
      });
    };
    
    loadRound();
  },

  initTap() {
    const area = this.getArea();
    const s = state.games.tap;
    s.active = false;
    s.score = 0;
    s.timeLeft = 10;
    
    area.innerHTML = `
      <div class="game-box">
        <h4>Tap Challenge (10s)</h4>
        <p>Time: <span id="tapTime">10</span>s | Score: <span id="tapScore">0</span></p>
        <p>High: <span id="tapHigh">${storage.get("tapHighScore", 0)}</span></p>
        <button onclick="games.startTap()" id="tapStartBtn" class="btn-tool">Start</button>
        <button onclick="games.doTap()" id="tapActionBtn" class="btn-tool" disabled>TAP!</button>
      </div>
    `;
  },

  startTap() {
    const s = state.games.tap;
    if (s.active) return;
    s.active = true;
    s.score = 0;
    document.getElementById("tapActionBtn").disabled = false;
    document.getElementById("tapStartBtn").disabled = true;
    
    s.timer = setInterval(() => {
      s.timeLeft--;
      document.getElementById("tapTime").textContent = s.timeLeft;
      if (s.timeLeft <= 0) this.endTap();
    }, 1000);
  },

  doTap() {
    const s = state.games.tap;
    if (!s.active) return;
    s.score++;
    document.getElementById("tapScore").textContent = s.score;
  },

  endTap() {
    const s = state.games.tap;
    s.active = false;
    clearInterval(s.timer);
    document.getElementById("tapActionBtn").disabled = true;
    document.getElementById("tapStartBtn").disabled = false;
    
    const high = storage.get("tapHighScore", 0);
    if (s.score > high) {
      storage.set("tapHighScore", s.score);
      document.getElementById("tapHigh").textContent = s.score;
    }
    setTimeout(() => alert(`⏰ Time Up! Score: ${s.score}`), 100);
  }
};

// Make games globally accessible for inline handlers in tap game
window.games = games;


window.startBubbleGame = () => games.bubble();
window.startMemoryGame = () => games.memory();
window.startColorGame = () => games.color();
window.startTapGame = () => games.initTap();

// INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
  state.entries = storage.get(KEYS.entries, []);
  setupEventListeners();
  initChart();
  if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('Service Worker registered', reg))
    .catch(err => console.log('Service Worker registration failed', err));
}
// Editable name - simple
const nameInput = document.getElementById('userName');
if (nameInput) {
    // Load saved name
    nameInput.value = localStorage.getItem('userName') || '';
    // Save on change
    nameInput.addEventListener('change', () => {
        localStorage.setItem('userName', nameInput.value.trim());
    });
}
// Show attention-grabbing popup if name exists
const savedName = localStorage.getItem('userName');
if (savedName && savedName.trim()) {
    const popup = document.createElement('div');
    popup.className = 'center-popup';
    popup.innerHTML = ` Hi ${savedName.trim()}! `;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 5000); // remove after 5 seconds
}
});