/* ================= CONSTANTS ================= */
const CATEGORIES = ["Food","Transport","Shopping","Entertainment","Education","Health","Bills","Travel","Subscriptions","Other"];
const CATEGORY_ICON = { Food:"🍔", Transport:"🚗", Shopping:"🛍", Entertainment:"🎮", Education:"📚", Health:"💊", Bills:"🏠", Travel:"✈", Subscriptions:"💻", Other:"💰" };
const PALETTE = ["#d97742","#c9a88a","#7fb89a","#2a4d40","#7fa0c9","#b3502a","#f0c9a8","#8a6a49"];
const LOADING_LINES = [
  "Checking where your money went 👀",
  "Counting those expenses…",
  "Your wallet is doing the math 💸",
  "Making your budget smarter…",
  "Finding your spending patterns…",
  "Almost ready…",
  "Preparing your financial glow-up ✨"
];

/* ================= STATE ================= */
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

let state = {
  transactions: store.get("sprout_tx", []),
  monthlyBudget: store.get("sprout_monthly_budget", 0),
  categoryBudgets: store.get("sprout_cat_budgets", {}),
  goals: store.get("sprout_goals", []),
  reminders: store.get("sprout_reminders", []),
  dismissed: store.get("sprout_dismissed", []),
  snoozed: store.get("sprout_snoozed", {}),
  settings: store.get("sprout_settings", { theme: "light", font: "'Manrope', sans-serif", anim: "full", notif: { budget: true, expense: true, bills: true, weekly: false, unusual: true } }),
  user: store.get("sprout_user", null)
};

function persist() {
  store.set("sprout_tx", state.transactions);
  store.set("sprout_monthly_budget", state.monthlyBudget);
  store.set("sprout_cat_budgets", state.categoryBudgets);
  store.set("sprout_goals", state.goals);
  store.set("sprout_reminders", state.reminders);
  store.set("sprout_dismissed", state.dismissed);
  store.set("sprout_snoozed", state.snoozed);
  store.set("sprout_settings", state.settings);
  store.set("sprout_user", state.user);
}

let currentType = "expense";
let currentTrendRange = "week";

/* ================= UTIL ================= */
function formatMoney(n) { return "₹" + Math.round(n).toLocaleString("en-IN"); }
function todayISO() { return new Date().toISOString().slice(0,10); }
function escapeHtml(str) { const d = document.createElement("div"); d.textContent = str; return d.innerHTML; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function isSameMonth(dateStr) {
  const d = new Date(dateStr), now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}
function expensesOf() { return state.transactions.filter(t => t.type === "expense"); }
function incomeOf() { return state.transactions.filter(t => t.type === "income"); }
function sum(arr) { return arr.reduce((s,t) => s + t.amount, 0); }

/* ================= COUNT-UP ANIMATION ================= */
function countUp(el, target) {
  const start = 0;
  const duration = document.documentElement.dataset.anim === "off" ? 0 : 650;
  if (duration === 0) { el.textContent = formatMoney(target); return; }
  const startTime = performance.now();
  function step(now) {
    const p = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = formatMoney(start + (target - start) * eased);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ================= TOASTS ================= */
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/* ================= LOADING OVERLAY / VIEW ROUTING ================= */
const overlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");

function switchView(view, cb) {
  loadingText.textContent = LOADING_LINES[Math.floor(Math.random() * LOADING_LINES.length)];
  overlay.classList.add("open");
  overlay.querySelector(".loading-bar-fill").style.animation = "none";
  void overlay.offsetWidth;
  overlay.querySelector(".loading-bar-fill").style.animation = "";

  const delay = document.documentElement.dataset.anim === "off" ? 0 : 420;
  setTimeout(() => {
    document.querySelectorAll(".view").forEach(v => v.hidden = v.dataset.view !== view);
    document.querySelectorAll(".nav-item[data-view]").forEach(n => n.classList.toggle("active", n.dataset.view === view));
    document.querySelectorAll(".bn-item").forEach(n => n.classList.toggle("active", n.dataset.view === view));
    renderView(view);
    overlay.classList.remove("open");
    if (cb) cb();
  }, delay);
}

function renderView(view) {
  if (view === "dashboard") renderDashboard();
  else if (view === "expenses") renderExpensesView();
  else if (view === "budget") renderBudgetView();
  else if (view === "analytics") renderAnalyticsView();
  else if (view === "goals") renderGoalsView();
  else if (view === "reminders") renderRemindersView();
  else if (view === "admin") renderAdminView();
}

document.querySelectorAll(".nav-item[data-view], .bn-item[data-view]").forEach(btn => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});
document.querySelectorAll("[data-goto]").forEach(btn => {
  btn.addEventListener("click", () => switchView(btn.dataset.goto));
});

/* ================= AUTH ================= */
const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");

document.getElementById("show-signup").addEventListener("click", () => {
  document.getElementById("auth-login").hidden = true;
  document.getElementById("auth-signup").hidden = false;
});
document.getElementById("show-login").addEventListener("click", () => {
  document.getElementById("auth-signup").hidden = true;
  document.getElementById("auth-login").hidden = false;
});

function enterApp(name) {
  state.user = { name: name || "Guest" };
  persist();
  authScreen.hidden = true;
  appShell.hidden = false;
  document.getElementById("profile-name").textContent = state.user.name;
  document.querySelector(".avatar").textContent = state.user.name.charAt(0).toUpperCase();
  bootApp();
}

document.getElementById("guest-btn").addEventListener("click", () => enterApp("Guest"));
document.getElementById("login-form").addEventListener("submit", e => {
  e.preventDefault();
  const email = e.target.querySelector("input[type=email]").value;
  enterApp(email.split("@")[0]);
});
document.getElementById("signup-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = e.target.querySelector("input[type=text]").value;
  enterApp(name);
});
document.getElementById("logout-btn").addEventListener("click", () => {
  appShell.hidden = true;
  authScreen.hidden = false;
});

/* ================= GREETING ================= */
function setGreeting() {
  const hour = new Date().getHours();
  document.getElementById("greeting").textContent = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  document.getElementById("today-date").textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" });
}

/* ================= ADD EXPENSE MODAL ================= */
const modalOverlay = document.getElementById("modal-overlay");
function openTxModal() { document.getElementById("tx-date").valueAsDate = new Date(); modalOverlay.classList.add("open"); }
document.getElementById("open-add-modal").addEventListener("click", openTxModal);
document.getElementById("fab-add").addEventListener("click", openTxModal);
document.getElementById("close-modal").addEventListener("click", () => modalOverlay.classList.remove("open"));
modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) modalOverlay.classList.remove("open"); });

document.querySelectorAll(".type-toggle .type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    btn.parentElement.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentType = btn.dataset.type;
  });
});

document.getElementById("tx-form").addEventListener("submit", e => {
  e.preventDefault();
  const amount = Number(document.getElementById("tx-amount").value);
  const title = document.getElementById("tx-title").value.trim();
  const category = document.getElementById("tx-category").value;
  const payment = document.getElementById("tx-payment").value;
  const date = document.getElementById("tx-date").value;
  const receiptFile = document.getElementById("tx-receipt").files[0];

  if (!amount || !title || !date) return;

  state.transactions.unshift({
    id: Date.now(), type: currentType, amount, title, category, payment, date,
    receipt: receiptFile ? receiptFile.name : null
  });
  persist();
  e.target.reset();
  modalOverlay.classList.remove("open");
  toast("Expense added ✓");
  renderView(getActiveView());
});

function getActiveView() {
  const active = document.querySelector(".nav-item.active[data-view]");
  return active ? active.dataset.view : "dashboard";
}

function deleteTransaction(id) {
  const row = document.querySelector(`.tx-row[data-id="${id}"]`);
  if (row) row.classList.add("removing");
  setTimeout(() => {
    state.transactions = state.transactions.filter(t => t.id !== id);
    persist();
    renderView(getActiveView());
  }, document.documentElement.dataset.anim === "off" ? 0 : 280);
}

/* ================= DASHBOARD ================= */
function renderDashboard() {
  const allExpense = sum(expensesOf());
  const allIncome = sum(incomeOf());
  const balance = allIncome - allExpense;
  const monthExpense = sum(expensesOf().filter(t => isSameMonth(t.date)));
  const remaining = state.monthlyBudget > 0 ? state.monthlyBudget - monthExpense : balance;

  countUp(document.getElementById("stat-balance"), balance);
  countUp(document.getElementById("stat-income"), allIncome);
  countUp(document.getElementById("stat-expense"), allExpense);
  countUp(document.getElementById("stat-remaining"), remaining);

  renderStatusBanner(monthExpense);
  renderWeeklyChart(document.getElementById("weekly-chart"));
  renderDonut(monthExpense);
  renderRecentTx();
  renderDashboardRing(monthExpense);
  renderMiniGoals();
  updateAlertBadge();
}

function renderStatusBanner(monthExpense) {
  const el = document.getElementById("status-banner");
  let msg = "Welcome — add your first transaction to see insights here.";
  if (state.transactions.length > 0) {
    if (state.monthlyBudget > 0) {
      const pct = monthExpense / state.monthlyBudget;
      if (pct < 0.8) msg = `Nice! You're ${Math.round((1 - pct) * 100)}% under your monthly budget. 🌱`;
      else if (pct < 1) msg = `Careful — you've used ${Math.round(pct * 100)}% of your monthly budget.`;
      else msg = `You've gone over your monthly budget by ${formatMoney(monthExpense - state.monthlyBudget)}.`;
    } else {
      const last7 = sum(expensesOf().filter(t => new Date(t.date) >= daysAgo(7)));
      const prev7 = sum(expensesOf().filter(t => new Date(t.date) >= daysAgo(14) && new Date(t.date) < daysAgo(7)));
      if (prev7 > 0 && last7 > prev7 * 1.2) msg = "Careful — your spending is increasing this week. 📈";
      else msg = "You're keeping a steady pace this week. Add a monthly budget to unlock more insights.";
    }
    const foodTotal = sum(expensesOf().filter(t => t.category === "Food" && isSameMonth(t.date)));
    const otherCatTotals = CATEGORIES.filter(c => c !== "Food").map(c => sum(expensesOf().filter(t => t.category === c && isSameMonth(t.date))));
    const avgOther = otherCatTotals.length ? sum(otherCatTotals.map(v => ({amount:v}))) / otherCatTotals.length : 0;
    if (foodTotal > 0 && avgOther > 0 && foodTotal > avgOther * 1.6) msg += " Your food expenses are higher than usual this month.";
  }
  el.innerHTML = `<span>💬</span><span>${msg}</span>`;
}

function renderWeeklyChart(container) {
  const labels = [];
  const values = [];
  for (let i = 6; i >= 0; i--) {
    const d = daysAgo(i);
    labels.push(d.toLocaleDateString("en-IN", { weekday: "short" }));
    const dayTotal = sum(expensesOf().filter(t => t.date === d.toISOString().slice(0,10)));
    values.push(dayTotal);
  }
  const max = Math.max(...values, 1);
  container.innerHTML = values.map((v, i) => `
    <div class="wk-bar-wrap">
      <div class="wk-bar" style="height:${Math.max(4,(v/max)*120)}px" title="${formatMoney(v)}"></div>
      <span class="wk-label">${labels[i]}</span>
    </div>
  `).join("");
}

function renderDonut(monthExpense) {
  const svg = document.getElementById("donut-chart");
  const legend = document.getElementById("donut-legend");
  document.getElementById("donut-total").textContent = formatMoney(monthExpense);

  const byCat = {};
  expensesOf().filter(t => isSameMonth(t.date)).forEach(t => byCat[t.category] = (byCat[t.category]||0) + t.amount);
  const entries = Object.entries(byCat).sort((a,b) => b[1]-a[1]);

  if (!entries.length) {
    svg.innerHTML = `<circle cx="60" cy="60" r="50" fill="none" stroke="var(--cream-soft)" stroke-width="16"/>`;
    legend.innerHTML = `<span class="subtle small">No expenses logged this month.</span>`;
    return;
  }

  const total = entries.reduce((s,[,v]) => s+v, 0);
  const r = 50, cx = 60, cy = 60, circumference = 2 * Math.PI * r;
  let offset = 0;
  let circles = "";
  legend.innerHTML = "";
  entries.forEach(([cat, val], i) => {
    const color = PALETTE[i % PALETTE.length];
    const frac = val / total;
    const dash = frac * circumference;
    circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="16" stroke-dasharray="${dash} ${circumference-dash}" stroke-dashoffset="${-offset}"/>`;
    offset += dash;
    const li = document.createElement("span");
    li.className = "legend-item";
    li.innerHTML = `<span class="legend-dot" style="background:${color}"></span>${CATEGORY_ICON[cat]||""} ${cat} — ${Math.round(frac*100)}%`;
    legend.appendChild(li);
  });
  svg.innerHTML = circles;
}

function renderRecentTx() {
  const container = document.getElementById("recent-tx");
  const list = state.transactions.slice(0, 6);
  container.innerHTML = "";
  list.forEach(t => container.appendChild(txRowEl(t)));
  if (!list.length) container.innerHTML = `<p class="subtle small" style="text-align:center;padding:20px 0">No expenses yet — your spending story starts here ✨</p>`;
}

function txRowEl(t) {
  const row = document.createElement("div");
  row.className = "tx-row";
  row.dataset.id = t.id;
  row.innerHTML = `
    <div class="tx-left">
      <div class="tx-dot">${CATEGORY_ICON[t.category] || "•"}</div>
      <div>
        <div class="tx-title">${escapeHtml(t.title)}</div>
        <div class="tx-meta">${t.category} · ${t.payment || ""} · ${new Date(t.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</div>
      </div>
    </div>
    <div class="tx-right">
      <span class="tx-amount ${t.type}">${t.type === "income" ? "+" : "−"}${formatMoney(t.amount)}</span>
      <button class="tx-delete" data-id="${t.id}">&times;</button>
    </div>
  `;
  row.querySelector(".tx-delete").addEventListener("click", () => deleteTransaction(t.id));
  return row;
}

function renderDashboardRing(monthExpense) {
  const fill = document.getElementById("ring-fill");
  const pctEl = document.getElementById("ring-pct");
  const circumference = 264;
  const pct = state.monthlyBudget > 0 ? Math.min(100, Math.round((monthExpense/state.monthlyBudget)*100)) : 0;
  fill.style.strokeDashoffset = circumference - (circumference * pct/100);
  fill.style.stroke = pct >= 100 ? "var(--danger)" : pct >= 80 ? "var(--orange)" : "var(--mint)";
  pctEl.textContent = pct + "%";
}

function renderMiniGoals() {
  const container = document.getElementById("mini-goals");
  const top = state.goals.slice(0,2);
  if (!top.length) { container.innerHTML = `<p class="subtle small">No goals yet.</p>`; return; }
  container.innerHTML = top.map(g => {
    const pct = Math.min(100, Math.round((g.saved/g.target)*100));
    return `<div class="cat-row"><div class="cat-row-top"><span>${g.name}</span><span>${pct}%</span></div><div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%;background:var(--orange)"></div></div></div>`;
  }).join("");
}

/* ================= EXPENSES VIEW ================= */
function renderExpensesView() {
  const filterSel = document.getElementById("filter-category");
  const current = filterSel.value;
  const cats = [...new Set(state.transactions.map(t => t.category))];
  filterSel.innerHTML = `<option value="all">All categories</option>` + cats.map(c => `<option value="${c}">${CATEGORY_ICON[c]||""} ${c}</option>`).join("");
  filterSel.value = cats.includes(current) ? current : "all";
  filterSel.onchange = renderExpensesView;

  const list = filterSel.value === "all" ? state.transactions : state.transactions.filter(t => t.category === filterSel.value);
  const container = document.getElementById("expense-list");
  container.innerHTML = "";
  list.forEach(t => container.appendChild(txRowEl(t)));
  document.getElementById("expense-empty").style.display = list.length ? "none" : "block";
}

/* ================= BUDGET VIEW ================= */
function renderBudgetView() {
  document.getElementById("monthly-budget-input").value = state.monthlyBudget || "";
  const monthExpense = sum(expensesOf().filter(t => isSameMonth(t.date)));
  const pct = state.monthlyBudget > 0 ? Math.min(100, Math.round((monthExpense/state.monthlyBudget)*100)) : 0;
  const fill = document.getElementById("budget-ring-fill");
  fill.style.strokeDashoffset = 264 - (264*pct/100);
  fill.style.stroke = pct >= 100 ? "var(--danger)" : pct >= 80 ? "var(--orange)" : "var(--mint)";
  document.getElementById("budget-ring-pct").textContent = pct + "%";

  const container = document.getElementById("category-budgets");
  container.innerHTML = CATEGORIES.map(cat => {
    const spent = sum(expensesOf().filter(t => t.category === cat && isSameMonth(t.date)));
    const budget = state.categoryBudgets[cat] || 0;
    const catPct = budget > 0 ? Math.min(100, Math.round((spent/budget)*100)) : 0;
    const cls = catPct >= 100 ? "danger" : catPct >= 80 ? "warn" : "ok";
    return `
      <div class="cat-budget-row">
        <div class="cat-budget-top">
          <span>${CATEGORY_ICON[cat]} ${cat} — ${formatMoney(spent)}</span>
          <input type="number" min="0" placeholder="budget" value="${budget||""}" data-cat="${cat}">
        </div>
        <div class="cat-budget-bar"><div class="cat-budget-fill ${cls}" style="width:${budget>0?catPct:Math.min(100,(spent/500))}%"></div></div>
      </div>
    `;
  }).join("");

  container.querySelectorAll("input[data-cat]").forEach(inp => {
    inp.addEventListener("change", () => {
      state.categoryBudgets[inp.dataset.cat] = Number(inp.value) || 0;
      persist();
      renderBudgetView();
    });
  });
}

document.getElementById("save-monthly-budget").addEventListener("click", () => {
  state.monthlyBudget = Number(document.getElementById("monthly-budget-input").value) || 0;
  persist();
  toast("Budget updated ✓");
  renderBudgetView();
  renderDashboard();
});

/* ================= ANALYTICS VIEW ================= */
document.querySelectorAll(".pill-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    btn.parentElement.querySelectorAll(".pill-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentTrendRange = btn.dataset.range;
    renderAnalyticsView();
  });
});

function renderAnalyticsView() {
  renderPersonality();

  const trendContainer = document.getElementById("trend-chart");
  if (currentTrendRange === "week") {
    renderWeeklyChart(trendContainer);
  } else {
    const labels = ["Week 1","Week 2","Week 3","Week 4"];
    const values = [21,14,7,0].map((offsetStart, idx) => {
      const from = daysAgo(offsetStart + 6), to = daysAgo(offsetStart);
      return sum(expensesOf().filter(t => { const d = new Date(t.date); return d >= from && d <= to; }));
    });
    const max = Math.max(...values, 1);
    trendContainer.innerHTML = values.map((v,i) => `
      <div class="wk-bar-wrap"><div class="wk-bar" style="height:${Math.max(4,(v/max)*120)}px" title="${formatMoney(v)}"></div><span class="wk-label">${labels[i]}</span></div>
    `).join("");
  }

  const byCat = {};
  expensesOf().filter(t => isSameMonth(t.date)).forEach(t => byCat[t.category] = (byCat[t.category]||0) + t.amount);
  const entries = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
  const total = entries.reduce((s,[,v]) => s+v, 0);
  const compare = document.getElementById("category-compare");
  compare.innerHTML = entries.length ? entries.map(([cat,val],i) => `
    <div class="cat-row"><div class="cat-row-top"><span>${CATEGORY_ICON[cat]} ${cat}</span><span>${formatMoney(val)} · ${Math.round((val/total)*100)}%</span></div>
    <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${Math.round((val/total)*100)}%;background:${PALETTE[i%PALETTE.length]}"></div></div></div>
  `).join("") : `<p class="subtle small">No expenses logged yet.</p>`;

  document.getElementById("an-highest").textContent = entries.length ? `${CATEGORY_ICON[entries[0][0]]} ${entries[0][0]}` : "—";
  const allIncome = sum(incomeOf()), allExpense = sum(expensesOf());
  document.getElementById("an-savings").textContent = allIncome > 0 ? Math.max(0,Math.round(((allIncome-allExpense)/allIncome)*100)) + "%" : "—";
  document.getElementById("an-util").textContent = state.monthlyBudget > 0 ? Math.min(100,Math.round((sum(expensesOf().filter(t=>isSameMonth(t.date)))/state.monthlyBudget)*100)) + "%" : "—";
}

function renderPersonality() {
  const allIncome = sum(incomeOf()), allExpense = sum(expensesOf());
  const savingsRate = allIncome > 0 ? (allIncome-allExpense)/allIncome : 0;
  const weekendExpense = sum(expensesOf().filter(t => [0,6].includes(new Date(t.date).getDay())));
  const weekendRatio = allExpense > 0 ? weekendExpense/allExpense : 0;
  const amounts = expensesOf().map(t => t.amount);
  const avg = amounts.length ? amounts.reduce((a,b)=>a+b,0)/amounts.length : 0;
  const variance = amounts.length ? amounts.reduce((s,a)=>s+Math.pow(a-avg,2),0)/amounts.length : 0;
  const stdDev = Math.sqrt(variance);

  let title, desc, emoji;
  if (state.transactions.length < 3) { title = "Getting to know you"; desc = "Add a few more transactions to reveal your money personality."; emoji = "🌱"; }
  else if (savingsRate >= 0.3) { title = "The Smart Saver"; desc = "You consistently spend well below what you earn. Keep it up!"; emoji = "🦉"; }
  else if (weekendRatio > 0.4) { title = "The Weekend Spender"; desc = "A big chunk of your spending happens on weekends."; emoji = "🎉"; }
  else if (stdDev > avg * 1.2 && amounts.length > 4) { title = "The Impulse Buyer"; desc = "Your spending amounts vary a lot — some big surprise purchases."; emoji = "⚡"; }
  else { title = "The Balanced Spender"; desc = "Your spending is steady and well distributed across categories."; emoji = "⚖️"; }

  document.getElementById("personality-title").textContent = title;
  document.getElementById("personality-desc").textContent = desc;
  document.querySelector(".personality-emoji").textContent = emoji;
}

/* ================= GOALS ================= */
const goalModal = document.getElementById("goal-modal-overlay");
document.getElementById("open-goal-modal").addEventListener("click", () => goalModal.classList.add("open"));
document.getElementById("close-goal-modal").addEventListener("click", () => goalModal.classList.remove("open"));
goalModal.addEventListener("click", e => { if (e.target === goalModal) goalModal.classList.remove("open"); });

document.getElementById("goal-name").addEventListener("change", e => {
  document.getElementById("goal-custom-wrap").hidden = e.target.value !== "Custom";
});

document.getElementById("goal-form").addEventListener("submit", e => {
  e.preventDefault();
  const nameSel = document.getElementById("goal-name").value;
  const name = nameSel === "Custom" ? document.getElementById("goal-custom-name").value.trim() || "My goal" : nameSel;
  const target = Number(document.getElementById("goal-target").value);
  const saved = Number(document.getElementById("goal-saved").value) || 0;
  const date = document.getElementById("goal-date").value;
  if (!target) return;
  state.goals.unshift({ id: Date.now(), name, target, saved, date, celebrated: false });
  persist();
  e.target.reset();
  document.getElementById("goal-custom-wrap").hidden = true;
  goalModal.classList.remove("open");
  toast("Goal created ✓");
  renderGoalsView();
  renderMiniGoals();
});

function renderGoalsView() {
  const grid = document.getElementById("goals-grid");
  document.getElementById("goals-empty").style.display = state.goals.length ? "none" : "block";
  grid.innerHTML = "";
  state.goals.forEach(g => {
    const pct = Math.min(100, Math.round((g.saved/g.target)*100));
    const circumference = 220;
    const card = document.createElement("div");
    card.className = "goal-card";
    card.innerHTML = `
      <button class="goal-delete" data-id="${g.id}">&times;</button>
      <div class="goal-top"><span class="goal-title">${escapeHtml(g.name)}</span></div>
      <div class="goal-ring-wrap">
        <svg viewBox="0 0 80 80" class="ring" style="width:100%;height:100%">
          <circle class="ring-track" cx="40" cy="40" r="35"/>
          <circle class="ring-fill" cx="40" cy="40" r="35" style="stroke-dasharray:${circumference};stroke-dashoffset:${circumference-(circumference*pct/100)}"/>
        </svg>
        <div class="ring-center"><span>${pct}%</span></div>
      </div>
      <div class="goal-amounts">${formatMoney(g.saved)} of ${formatMoney(g.target)}${g.date ? " · by "+new Date(g.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : ""}</div>
      <input type="range" min="0" max="${g.target}" value="${g.saved}" data-id="${g.id}" class="goal-slider" style="accent-color:var(--orange)">
    `;
    if (pct >= 100 && !g.celebrated) {
      card.classList.add("celebrate");
      g.celebrated = true;
      persist();
      toast(`🎉 Goal "${g.name}" reached!`);
    }
    grid.appendChild(card);
  });

  grid.querySelectorAll(".goal-delete").forEach(btn => btn.addEventListener("click", () => {
    state.goals = state.goals.filter(g => g.id !== Number(btn.dataset.id));
    persist(); renderGoalsView(); renderMiniGoals();
  }));
  grid.querySelectorAll(".goal-slider").forEach(sl => sl.addEventListener("change", () => {
    const g = state.goals.find(g => g.id === Number(sl.dataset.id));
    g.saved = Number(sl.value);
    persist(); renderGoalsView(); renderMiniGoals();
  }));
}

/* ================= REMINDERS / SMART ALERTS ================= */
const reminderModal = document.getElementById("reminder-modal-overlay");
document.getElementById("open-reminder-modal").addEventListener("click", () => reminderModal.classList.add("open"));
document.getElementById("close-reminder-modal").addEventListener("click", () => reminderModal.classList.remove("open"));
reminderModal.addEventListener("click", e => { if (e.target === reminderModal) reminderModal.classList.remove("open"); });

document.getElementById("reminder-form").addEventListener("submit", e => {
  e.preventDefault();
  const title = document.getElementById("reminder-title").value.trim();
  const type = document.getElementById("reminder-type").value;
  const amount = Number(document.getElementById("reminder-amount").value) || 0;
  const date = document.getElementById("reminder-date").value;
  if (!title || !date) return;
  state.reminders.unshift({ id: Date.now(), title, type, amount, date });
  persist();
  e.target.reset();
  reminderModal.classList.remove("open");
  toast("Reminder saved ✓");
  renderRemindersView();
});

function buildSmartAlerts() {
  const alerts = [];
  const notif = state.settings.notif;
  const monthExpense = sum(expensesOf().filter(t => isSameMonth(t.date)));

  if (notif.budget && state.monthlyBudget > 0) {
    const pct = monthExpense / state.monthlyBudget;
    if (pct >= 1) alerts.push({ id: "budget-over", level: "danger", text: `You've gone over your monthly budget by ${formatMoney(monthExpense-state.monthlyBudget)}.`, meta: "Monthly budget" });
    else if (pct >= 0.8) alerts.push({ id: "budget-80", level: "warn", text: `You've spent ${Math.round(pct*100)}% of your monthly budget. ${formatMoney(state.monthlyBudget-monthExpense)} remaining.`, meta: "Monthly budget" });
  }

  if (notif.budget) {
    CATEGORIES.forEach(cat => {
      const budget = state.categoryBudgets[cat];
      if (!budget) return;
      const spent = sum(expensesOf().filter(t => t.category === cat && isSameMonth(t.date)));
      const pct = spent / budget;
      if (pct >= 1) alerts.push({ id: `cat-over-${cat}`, level: "danger", text: `You've crossed your ${cat} budget by ${formatMoney(spent-budget)}.`, meta: cat, category: cat });
      else if (pct >= 0.78) alerts.push({ id: `cat-80-${cat}`, level: "warn", text: `You've used ${Math.round(pct*100)}% of your ${cat} budget. Only ${formatMoney(budget-spent)} remaining.`, meta: cat, category: cat });
      else if (spent > 0 && pct < 0.5) alerts.push({ id: `cat-ok-${cat}`, level: "info", text: `${formatMoney(spent)} spent on ${cat}. You're comfortably within budget.`, meta: cat, category: cat });
    });
  }

  if (notif.unusual) {
    const last7 = sum(expensesOf().filter(t => new Date(t.date) >= daysAgo(7)));
    const prev7 = sum(expensesOf().filter(t => new Date(t.date) >= daysAgo(14) && new Date(t.date) < daysAgo(7)));
    if (prev7 > 200 && last7 > prev7 * 1.5) alerts.push({ id: "unusual-week", level: "warn", text: `Unusual spending detected — this week's spending is ${Math.round((last7/prev7-1)*100)}% higher than last week.`, meta: "This week" });
  }

  if (notif.expense) {
    const balance = sum(incomeOf()) - sum(expensesOf());
    if (state.transactions.length > 0 && balance < 500 && balance >= 0) alerts.push({ id: "low-balance", level: "danger", text: `Your remaining balance is low: ${formatMoney(balance)}.`, meta: "Balance" });
  }

  if (notif.bills) {
    state.reminders.forEach(r => {
      const daysUntil = Math.ceil((new Date(r.date) - new Date()) / (1000*60*60*24));
      if (daysUntil >= 0 && daysUntil <= 7) {
        alerts.push({ id: `reminder-${r.id}`, level: "info", text: `${r.type === "subscription" ? "Subscription renewal" : "Upcoming bill"}: ${r.title}${r.amount ? " — " + formatMoney(r.amount) : ""}, due ${new Date(r.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}.`, meta: daysUntil === 0 ? "Due today" : `Due in ${daysUntil} day(s)`, reminderId: r.id });
      }
    });
  }

  const now = Date.now();
  return alerts.filter(a => !state.dismissed.includes(a.id) && !(state.snoozed[a.id] && state.snoozed[a.id] > now));
}

function renderRemindersView() {
  const alerts = buildSmartAlerts();
  const container = document.getElementById("alerts-list");
  document.getElementById("alerts-empty").style.display = alerts.length ? "none" : "block";
  container.innerHTML = "";
  alerts.forEach(a => {
    const card = document.createElement("div");
    card.className = `alert-card ${a.level}`;
    const dot = a.level === "danger" ? "🔴" : a.level === "warn" ? "🟡" : "🟢";
    card.innerHTML = `
      <div><div class="alert-text">${dot} ${a.text}</div><div class="alert-meta">${a.meta}</div></div>
      <div class="alert-actions">
        ${a.category ? `<button data-action="view" data-cat="${a.category}">View</button>` : ""}
        ${a.id.startsWith("budget") || a.category ? `<button data-action="budget">Change budget</button>` : ""}
        ${a.reminderId ? `<button data-action="delete-reminder" data-id="${a.reminderId}">Delete</button>` : ""}
        <button data-action="snooze" data-id="${a.id}">Snooze</button>
        <button data-action="dismiss" data-id="${a.id}">Dismiss</button>
      </div>
    `;
    card.querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => handleAlertAction(btn)));
    container.appendChild(card);
  });
  updateAlertBadge();
}

function handleAlertAction(btn) {
  const action = btn.dataset.action;
  if (action === "dismiss") { state.dismissed.push(btn.dataset.id); persist(); renderRemindersView(); }
  else if (action === "snooze") { state.snoozed[btn.dataset.id] = Date.now() + 24*60*60*1000; persist(); renderRemindersView(); }
  else if (action === "view") { switchView("expenses", () => { document.getElementById("filter-category").value = btn.dataset.cat; renderExpensesView(); }); }
  else if (action === "budget") { switchView("budget"); }
  else if (action === "delete-reminder") { state.reminders = state.reminders.filter(r => r.id !== Number(btn.dataset.id)); persist(); renderRemindersView(); }
}

function updateAlertBadge() {
  const count = buildSmartAlerts().filter(a => a.level !== "info").length;
  const badge = document.getElementById("alert-badge");
  badge.textContent = count;
  badge.hidden = count === 0;
}

/* ================= SETTINGS ================= */
function applyTheme(mode) {
  let effective = mode;
  if (mode === "system") effective = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = effective;
}

document.querySelectorAll("#appearance-options .option-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#appearance-options .option-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.settings.theme = chip.dataset.mode;
    persist();
    applyTheme(chip.dataset.mode);
  });
});

document.querySelectorAll("#font-options .option-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#font-options .option-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.settings.font = chip.dataset.font;
    persist();
    document.documentElement.style.setProperty("--font-main", chip.dataset.font);
  });
});

document.querySelectorAll("#animation-options .option-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#animation-options .option-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.settings.anim = chip.dataset.anim;
    persist();
    document.documentElement.dataset.anim = chip.dataset.anim;
  });
});

document.querySelectorAll("[data-notif]").forEach(cb => {
  cb.addEventListener("change", () => {
    state.settings.notif[cb.dataset.notif] = cb.checked;
    persist();
    updateAlertBadge();
  });
});

function applySettingsToUI() {
  applyTheme(state.settings.theme);
  document.documentElement.style.setProperty("--font-main", state.settings.font);
  document.documentElement.dataset.anim = state.settings.anim;

  document.querySelectorAll("#appearance-options .option-chip").forEach(c => c.classList.toggle("active", c.dataset.mode === state.settings.theme));
  document.querySelectorAll("#font-options .option-chip").forEach(c => c.classList.toggle("active", c.dataset.font === state.settings.font));
  document.querySelectorAll("#animation-options .option-chip").forEach(c => c.classList.toggle("active", c.dataset.anim === state.settings.anim));
  document.querySelectorAll("[data-notif]").forEach(cb => cb.checked = !!state.settings.notif[cb.dataset.notif]);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (state.settings.theme === "system") applyTheme("system");
  });
}

/* ================= ADMIN PREVIEW ================= */
function renderAdminView() {
  const users = [
    { name: "Aditi Sharma", email: "aditi@example.com", tx: 142, active: true },
    { name: "Rohan Mehta", email: "rohan@example.com", tx: 87, active: true },
    { name: "Fatima Khan", email: "fatima@example.com", tx: 203, active: true },
    { name: "Karan Verma", email: "karan@example.com", tx: 12, active: false },
    { name: "Sneha Iyer", email: "sneha@example.com", tx: 65, active: true },
    { name: "Aman Gupta", email: "aman@example.com", tx: 4, active: false }
  ];
  document.getElementById("admin-users").innerHTML = users.map(u => `
    <tr><td>${u.name}</td><td>${u.email}</td><td>${u.tx}</td><td><span class="status-pill ${u.active?"active":"inactive"}">${u.active?"Active":"Inactive"}</span></td></tr>
  `).join("");
}

/* ================= BOOT ================= */
function bootApp() {
  setGreeting();
  applySettingsToUI();
  switchView("dashboard");
}

if (state.user) {
  authScreen.hidden = true;
  appShell.hidden = false;
  document.getElementById("profile-name").textContent = state.user.name;
  document.querySelector(".avatar").textContent = state.user.name.charAt(0).toUpperCase();
  bootApp();
}
