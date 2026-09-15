(() => {
  "use strict";

  /* =========================================================
     Utilities
     ========================================================= */
  const $ = (s, r = document) => r.querySelector(s);
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const cur = () => (state && state.settings.currency) || "$";
  const money = (n) => {
    const v = Math.round(num(n));
    return (v < 0 ? "-" : "") + cur() + Math.abs(v).toLocaleString();
  };
  const pctOf = (a, b) => (b > 0 ? clamp(Math.round((a / b) * 100), 0, 100) : 0);
  const round500 = (x) => Math.max(500, Math.round(x / 500) * 500);
  const money2 = (n) => {
    const v = num(n);
    return (v < 0 ? "-" : "") + cur() + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  // Extension points used by plugins (accounting.js, local.js)
  const hooks = { defaults: [], migrate: [], insights: [], paidFor: () => 0 };

  const parseDate = (s) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const todayStart = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const diffDays = (a, b) => Math.round((a - b) / 864e5);
  const fmtDate = (d) => d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
  const fmtLong = (d) => d ? d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "";
  const isoToday = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
  const fmtTime = (t) => {
    if (!/^\d{2}:\d{2}$/.test(t || "")) return esc(t || "");
    const [h, m] = t.split(":").map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };

  const TOKEN_KEY = "wp_token", USER_KEY = "wp_user", CACHE_KEY = "wp_cache";
  const PALETTE = ["#1F3A33", "#3E6B5C", "#8FA89A", "#C2A36B", "#B5566A", "#5C4B6B", "#6D8196", "#A68A4E", "#4F6D7A", "#C98B7E"];

  /* =========================================================
     Icons
     ========================================================= */
  const ICONS = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .6 3.5 2.8 3.5 6"/>',
    store: '<path d="M4 9l1.5-5h13L20 9M4 9h16v11H4zM9 20v-6h6v6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

  const NAV = [
    { id: "dashboard", label: "Overview", icon: "home" },
    { id: "budget", label: "Budget", icon: "wallet" },
    { id: "checklist", label: "Checklist", icon: "check" },
    { id: "guests", label: "Guests", icon: "users" },
    { id: "vendors", label: "Vendors", icon: "store" },
    { id: "timeline", label: "Day-of timeline", icon: "clock" },
    { id: "tips", label: "Ideas & tips", icon: "bulb" },
    { id: "settings", label: "Settings", icon: "gear" },
  ];

  const ITEM_WEIGHTS = new Map(WP.CATEGORIES.flatMap((c) => c.items.map(([n, w]) => [n.toLowerCase(), w])));

  const MAIN_MOBILE = ["dashboard", "budget", "checklist", "guests"];

  const VENDOR_TO_CATEGORY = {
    "Venue": "Venue & Rentals", "Rentals": "Venue & Rentals", "Caterer": "Catering, Bar & Cake", "Bakery": "Catering, Bar & Cake",
    "Photographer": "Photography & Video", "Videographer": "Photography & Video", "DJ / Band": "Music & Entertainment",
    "Florist": "Flowers & Decor", "Officiant": "Ceremony & Legal", "Hair & Makeup": "Attire & Beauty", "Attire": "Attire & Beauty",
    "Planner / Coordinator": "Wedding Planner", "Transportation": "Transportation", "Stationery": "Stationery & Postage",
    "Jeweler": "Rings",
  };

  /* =========================================================
     State
     ========================================================= */
  let state = null;
  let token = null;
  let currentUser = null;      // { id, username, name, role }
  let serverSnapshot = null;   // last known server copy, used to undo changes for view-only users
  const readOnly = () => Boolean(currentUser && currentUser.role === "viewer");
  const isAdmin = () => Boolean(currentUser && currentUser.role === "admin");
  const ROLE_LABELS = { admin: "Admin", planner: "Planner", viewer: "Viewer" };
  let saveTimer = null, saving = false, saveAgain = false;
  const ui = { taskFilter: "todo", taskSearch: "", guestFilter: "all", guestSearch: "", guestView: "list", openCats: new Set() };

  function baseState() {
    return {
      version: 1,
      settings: {
        partner1: "", partner2: "", date: "", venue: "", city: "",
        totalBudget: 30000, guestEstimate: 120, currency: "$",
        mealOptions: "Chicken, Beef, Fish, Vegetarian, Kids meal", setupDone: false,
      },
      categories: WP.CATEGORIES.map((c) => ({
        id: uid(), name: c.name, pct: c.pct, color: c.color,
        items: c.items.map(([n]) => newItem(n)),
      })),
      tasks: defaultTasks(),
      guests: [],
      vendors: [],
      timeline: WP.TIMELINE.map((t) => ({ id: uid(), notes: "", ...t })),
      kit: WP.KIT.map((k) => ({ id: uid(), name: k, done: false })),
      meta: {},
    };
  }
  function defaultState() {
    const s = baseState();
    hooks.defaults.forEach((fn) => fn(s));
    return s;
  }
  function defaultTasks() {
    return WP.PHASES.flatMap((p) => (WP.TASKS[p.key] || []).map((t) => ({ id: uid(), title: t, phase: p.key, done: false, due: "", notes: "" })));
  }
  function newItem(name, extra = {}) {
    return { id: uid(), name, est: 0, actual: 0, paid: 0, due: "", vendor: "", notes: "", ...extra };
  }
  function migrate(d) {
    const base = defaultState();
    const s = { ...base, ...(d || {}) };
    s.settings = { ...base.settings, ...((d && d.settings) || {}) };
    for (const k of ["categories", "tasks", "guests", "vendors", "timeline", "kit"]) {
      if (!Array.isArray(s[k])) s[k] = base[k];
    }
    s.categories.forEach((c, i) => { c.id = c.id || uid(); c.items = Array.isArray(c.items) ? c.items : []; c.color = c.color || PALETTE[i % PALETTE.length]; });
    s.meta = s.meta || {};
    hooks.migrate.forEach((fn) => fn(s));
    return s;
  }

  /* ---------- Derived numbers ---------- */
  const weddingDate = () => parseDate(state.settings.date);
  const daysUntil = () => { const d = weddingDate(); return d ? diffDays(d, todayStart()) : null; };
  const p1 = () => state.settings.partner1 || "Partner one";
  const p2 = () => state.settings.partner2 || "Partner two";
  const itemCost = (i) => (num(i.actual) > 0 ? num(i.actual) : num(i.est));
  // Paid = amount entered on the item plus payments recorded in Accounts
  const itemPaid = (i) => num(i.paid) + num(hooks.paidFor(i));
  const itemBalance = (i) => Math.max(itemCost(i) - itemPaid(i), 0);

  function catTotals(c) {
    const total = num(state.settings.totalBudget);
    const t = { alloc: (num(c.pct) / 100) * total, est: 0, actual: 0, paid: 0, projected: 0, balance: 0 };
    c.items.forEach((i) => { t.est += num(i.est); t.actual += num(i.actual); t.paid += itemPaid(i); t.projected += itemCost(i); t.balance += itemBalance(i); });
    return t;
  }
  function budgetTotals() {
    const t = { total: num(state.settings.totalBudget), pct: 0, est: 0, actual: 0, paid: 0, projected: 0, balance: 0 };
    state.categories.forEach((c) => {
      const ct = catTotals(c);
      t.pct += num(c.pct); t.est += ct.est; t.actual += ct.actual; t.paid += ct.paid; t.projected += ct.projected; t.balance += ct.balance;
    });
    t.remaining = t.total - t.projected;
    t.pct = Math.round(t.pct * 10) / 10;
    return t;
  }
  function phaseDue(key) {
    const d = weddingDate();
    const p = WP.PHASES.find((x) => x.key === key);
    if (!d || !p) return null;
    const r = new Date(d);
    if (p.months != null) r.setMonth(r.getMonth() - p.months); else r.setDate(r.getDate() - p.days);
    return r;
  }
  const taskDue = (t) => parseDate(t.due) || phaseDue(t.phase);
  const isOverdue = (t) => { const d = taskDue(t); return !t.done && d && d < todayStart(); };
  function taskStats() {
    const total = state.tasks.length, done = state.tasks.filter((t) => t.done).length;
    return { total, done, overdue: state.tasks.filter(isOverdue).length, pct: pctOf(done, total) };
  }
  function guestStats() {
    const s = { invited: 0, yes: 0, no: 0, pending: 0, meals: {}, households: state.guests.length };
    state.guests.forEach((g) => {
      const heads = 1 + (g.plusOne ? 1 : 0);
      s.invited += heads;
      if (g.rsvp === "yes") {
        s.yes += heads;
        if (g.meal) s.meals[g.meal] = (s.meals[g.meal] || 0) + 1;
        if (g.plusOne && g.plusOneMeal) s.meals[g.plusOneMeal] = (s.meals[g.plusOneMeal] || 0) + 1;
      } else if (g.rsvp === "no") s.no += heads;
      else s.pending += heads;
    });
    return s;
  }
  function upcomingPayments(withinDays = 60) {
    const today = todayStart(), out = [];
    state.categories.forEach((c) => c.items.forEach((i) => {
      const d = parseDate(i.due);
      if (d && itemBalance(i) > 0 && diffDays(d, today) <= withinDays) out.push({ cat: c, item: i, date: d });
    }));
    return out.sort((a, b) => a.date - b.date);
  }
  const mealOptions = () => state.settings.mealOptions.split(",").map((s) => s.trim()).filter(Boolean);
  const findCategory = (name) => state.categories.find((c) => c.name.toLowerCase() === String(name).toLowerCase())
    || state.categories.find((c) => c.name === "Contingency") || state.categories[0];

  function dueText(date, done) {
    if (!date) return state.settings.date ? "" : "Add a wedding date to schedule";
    if (done) return `Complete by ${fmtDate(date)}`;
    const n = diffDays(date, todayStart());
    if (n < 0) return `Overdue by ${-n} day${n === -1 ? "" : "s"}`;
    if (n === 0) return "Due today";
    if (n <= 30) return `Due in ${n} day${n === 1 ? "" : "s"}`;
    return `Complete by ${fmtDate(date)}`;
  }

  function insights() {
    const out = [];
    const s = state.settings, bt = budgetTotals(), ts = taskStats(), gs = guestStats(), days = daysUntil();
    if (!s.date) out.push({ level: "warn", html: `Add your wedding date so the checklist can schedule itself. <button class="link-btn" data-act="setup">Add date</button>` });
    if (bt.total <= 0) out.push({ level: "warn", html: `Set a total budget to see category allowances. <button class="link-btn" data-act="estimateBudget">Estimate a budget</button>` });
    if (bt.total > 0 && bt.projected > bt.total) {
      const worst = state.categories.map((c) => ({ c, over: catTotals(c).projected - catTotals(c).alloc })).sort((a, b) => b.over - a.over)[0];
      out.push({ level: "bad", html: `Projected spending is ${money(bt.projected - bt.total)} over budget${worst && worst.over > 0 ? `. ${esc(worst.c.name)} is the furthest over its allowance.` : "."}` });
    }
    if (Math.abs(bt.pct - 100) > 0.05) out.push({ level: "warn", html: `Your category split adds up to ${bt.pct}% instead of 100%. <a href="#/budget">Adjust the split</a>` });
    if (ts.overdue) out.push({ level: "bad", html: `${ts.overdue} checklist task${ts.overdue === 1 ? " is" : "s are"} overdue. <a href="#/checklist">See tasks</a>` });
    const soon = upcomingPayments(30);
    if (soon.length) out.push({ level: "warn", html: `${soon.length} payment${soon.length === 1 ? "" : "s"} totaling ${money(soon.reduce((a, p) => a + itemBalance(p.item), 0))} due in the next 30 days.` });
    const guests = gs.invited || num(s.guestEstimate);
    if (bt.total > 0 && guests > 0) {
      const catering = state.categories.find((c) => /cater/i.test(c.name));
      const perGuest = bt.total / guests;
      let msg = `Your budget works out to about ${money(perGuest)} per guest`;
      if (catering) msg += `, with ${money(catTotals(catering).alloc / guests)} per guest for catering, bar and cake`;
      out.push({ level: "info", html: msg + "." });
    }
    if (num(s.guestEstimate) > 0 && gs.invited > num(s.guestEstimate)) out.push({ level: "warn", html: `You've invited ${gs.invited} people, which is ${gs.invited - num(s.guestEstimate)} more than your planned ${s.guestEstimate}.` });
    if (days != null && days <= 45 && days >= 0 && gs.pending > 0) out.push({ level: "warn", html: `${gs.pending} guest${gs.pending === 1 ? " hasn't" : "s haven't"} replied. Most caterers need a final count 2 to 3 weeks out.` });
    const contingency = state.categories.find((c) => /contingen/i.test(c.name));
    if (!contingency || num(contingency.pct) < 3) out.push({ level: "info", html: "Keep around 5% of the budget as a cushion for tips, overtime and surprises." });
    if (days != null && days <= 300) {
      const booked = new Set(state.vendors.filter((v) => v.status === "Booked").map((v) => v.category));
      const missing = WP.ESSENTIAL_VENDORS.filter((v) => !booked.has(v));
      if (missing.length) out.push({ level: "info", html: `Vendors still to book: ${missing.map(esc).join(", ")}. <a href="#/vendors">Vendors</a>` });
    }
    hooks.insights.forEach((fn) => out.push(...fn()));
    if (!out.some((o) => o.level === "bad" || o.level === "warn")) out.unshift({ level: "good", html: "You're on track. Nothing needs attention right now." });
    return out;
  }

  /* =========================================================
     Server sync & auth
     ========================================================= */
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
    let body = null;
    try { body = await res.json(); } catch { /* no body */ }
    if (res.status === 401) { logout("Your session ended. Sign in again.", true); throw new Error("unauthorized"); }
    if (!res.ok) throw new Error((body && body.error) || `Request failed (${res.status})`);
    return body;
  }

  function setSync(status, when) {
    const el = $("#sync-status");
    if (!el) return;
    const labels = { pending: "Saving soon", saving: "Saving", saved: "All changes saved", error: "Not synced, saved on this device", viewonly: "View only" };
    el.textContent = labels[status] || "";
    el.className = "sync" + (status === "error" ? " error" : "");
    if (when) el.title = `Last saved ${new Date(when).toLocaleString()}`;
  }

  function persist() {
    state.meta.updatedAt = new Date().toISOString();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch { /* storage full */ }
    setSync("pending");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(pushSave, 800);
  }
  async function pushSave() {
    if (!state || !token) return;
    if (saving) { saveAgain = true; return; }
    saving = true;
    setSync("saving");
    try {
      const r = await api("/api/data", { method: "PUT", body: JSON.stringify({ data: state }) });
      serverSnapshot = JSON.stringify(state);
      setSync("saved", r.savedAt);
    } catch (e) {
      if (e.message !== "unauthorized") setSync("error");
    } finally {
      saving = false;
      if (saveAgain) { saveAgain = false; pushSave(); }
    }
  }
  function commit() {
    if (readOnly()) {
      // View-only accounts can look around but changes are rolled back
      state = migrate(serverSnapshot ? JSON.parse(serverSnapshot) : defaultState());
      render();
      toast("You have view-only access. Ask an admin if you need to make changes.", true);
      muteToastsUntil = Date.now() + 1500;
      return;
    }
    persist();
    render();
  }

  async function loadData() {
    try {
      currentUser = (await api("/api/me")).user;
    } catch (e) {
      if (e.message === "unauthorized") return;
      try { currentUser = JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { currentUser = null; }
      if (!currentUser) { logout("Can't reach the server. Try again when you're online."); return; }
    }
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { cached = null; }
    let server = null, offline = false;
    try {
      server = (await api("/api/data")).data;
    } catch (e) {
      if (e.message === "unauthorized") return;
      offline = true;
    }
    let pick = server || cached;
    let push = !server && !readOnly();
    if (!readOnly() && server && cached && (cached.meta?.updatedAt || "") > (server.meta?.updatedAt || "")) { pick = cached; push = true; }
    if (readOnly() && server) pick = server;
    state = migrate(pick || defaultState());
    serverSnapshot = server ? JSON.stringify(migrate(server)) : null;

    $("#auth").hidden = true;
    $("#app").hidden = false;
    render();

    if (offline) { setSync("error"); toast("Can't reach the server. Changes are kept on this device until it reconnects."); }
    else if (push) pushSave();
    else if (server) setSync("saved", server.meta?.savedAt);
    if (readOnly()) setSync("viewonly");

    if (!state.settings.setupDone && !readOnly()) openSetup();
  }

  const friendlyError = (ex, res) => {
    if (ex.message === "Failed to fetch") return "Can't reach the server. Check your connection and try again.";
    return ex.message;
  };
  async function postJson(path, payload) {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    let body = {};
    try { body = await res.json(); } catch { /* ignore */ }
    if (!res.ok) {
      const err = new Error(body.error || (res.status === 404
        ? "The server functions aren't deployed. Deploy from Git or the Netlify CLI so functions are included."
        : "Something went wrong. Try again."));
      err.body = body;
      throw err;
    }
    return body;
  }
  function startSession(body, remember) {
    token = body.token;
    currentUser = body.user;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(body.user));
    return loadData();
  }

  async function handleLogin(e) {
    e.preventDefault();
    const f = e.target, btn = $("#login-btn"), err = $("#login-error");
    err.textContent = "";
    btn.disabled = true; btn.textContent = "Signing in";
    try {
      const body = await postJson("/api/login", { username: f.elements.username.value, password: f.elements.password.value, remember: f.elements.remember.checked });
      f.elements.password.value = "";
      await startSession(body);
    } catch (ex) {
      if (ex.body && ex.body.needsSetup) { showAuth(); return; }
      err.textContent = friendlyError(ex);
    } finally {
      btn.disabled = false; btn.textContent = "Sign in";
    }
  }

  async function handleSetup(e) {
    e.preventDefault();
    const f = e.target, btn = $("#setup-btn"), err = $("#setup-error");
    err.textContent = "";
    if (f.elements.password.value !== f.elements.confirm.value) { err.textContent = "The passwords don't match."; return; }
    btn.disabled = true; btn.textContent = "Creating admin account";
    try {
      const body = await postJson("/api/setup", {
        setupKey: f.elements.setupKey.value, name: f.elements.name.value,
        username: f.elements.username.value, password: f.elements.password.value,
      });
      f.reset();
      await startSession(body);
      toast("Admin account created. Welcome!");
    } catch (ex) {
      err.textContent = friendlyError(ex);
    } finally {
      btn.disabled = false; btn.textContent = "Create admin account";
    }
  }

  // Decide whether to show first-run setup or the sign-in form
  async function showAuth(message) {
    $("#app").hidden = true;
    $("#auth").hidden = false;
    $("#login-error").textContent = message || "";
    let status = null;
    try {
      const res = await fetch("/api/setup");
      if (res.ok) status = await res.json();
    } catch { /* offline or functions missing: fall back to sign in */ }
    const setup = Boolean(status && status.needsSetup);
    $("#setup-card").hidden = !setup;
    $("#login-card").hidden = setup;
    if (setup && !status.configured) {
      $("#setup-error").textContent = "Add AUTH_SECRET and SETUP_KEY in your Netlify environment variables and redeploy before creating the admin account.";
    }
  }

  function logout(message, keepCache = false) {
    clearTimeout(saveTimer);
    token = null; state = null; currentUser = null; serverSnapshot = null;
    [TOKEN_KEY, USER_KEY].forEach((k) => localStorage.removeItem(k));
    if (!keepCache) localStorage.removeItem(CACHE_KEY); // keep unsynced edits when a session simply expires
    closeModal();
    showAuth(message);
  }

  /* =========================================================
     Toast & modal
     ========================================================= */
  let muteToastsUntil = 0;
  function toast(msg, force = false) {
    // After a view-only rollback, hide the "saved" style message the action would show next
    if (!force && Date.now() < muteToastsUntil) return;
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("show"), 2800);
  }

  let modal = null;
  function renderModal(title, body, footer) {
    $("#modal-root").innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <header><h3 id="modal-title">${esc(title)}</h3><button type="button" class="icon-btn" data-act="closeModal" aria-label="Close">&times;</button></header>
          <div class="modal-body">${body}</div>
          ${footer ? `<footer>${footer}</footer>` : ""}
        </div>
      </div>`;
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    modal = null;
    $("#modal-root").innerHTML = "";
    document.body.style.overflow = "";
  }
  function openInfo(title, bodyHtml) {
    modal = {};
    renderModal(title, bodyHtml, `<div class="right"><button type="button" class="btn primary" data-act="closeModal">Done</button></div>`);
  }

  function fieldHtml(f, values) {
    const v = values[f.key] ?? f.default ?? "";
    const full = f.full || f.type === "textarea" || f.type === "checkbox";
    const cls = `field${full ? " full" : ""}`;
    const label = `<span>${esc(f.label)}${f.required ? " *" : ""}</span>`;
    const hint = f.hint ? `<small>${esc(f.hint)}</small>` : "";
    switch (f.type) {
      case "checkbox":
        return `<label class="check-row full"><input type="checkbox" name="${f.key}" ${v ? "checked" : ""}/><span>${esc(f.label)}</span></label>`;
      case "textarea":
        return `<label class="${cls}">${label}<textarea name="${f.key}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || "")}">${esc(v)}</textarea>${hint}</label>`;
      case "select":
        return `<label class="${cls}">${label}<select name="${f.key}">${f.options.map((o) => {
          const val = typeof o === "object" ? o.value : o, lab = typeof o === "object" ? o.label : o;
          return `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`;
        }).join("")}</select>${hint}</label>`;
      case "money":
        return `<label class="${cls}">${label}<div class="money-input" data-cur="${esc(cur())}"><input type="number" inputmode="decimal" step="0.01" min="0" name="${f.key}" value="${num(v) ? esc(v) : ""}" placeholder="0"/></div>${hint}</label>`;
      default: {
        const dl = f.list ? `<datalist id="dl_${f.key}">${f.list.map((o) => `<option value="${esc(o)}"></option>`).join("")}</datalist>` : "";
        return `<label class="${cls}">${label}<input type="${f.type || "text"}" name="${f.key}" value="${esc(v)}" placeholder="${esc(f.placeholder || "")}" ${f.list ? `list="dl_${f.key}"` : ""} ${f.type === "number" ? 'inputmode="numeric" min="0"' : ""}/>${dl}${hint}</label>`;
      }
    }
  }

  function openForm({ title, intro = "", fields, values = {}, onSave, onDelete, saveLabel = "Save", deleteLabel = "Delete" }) {
    const body = `${intro ? `<div class="modal-intro">${intro}</div>` : ""}
      <form id="mform" class="form-grid" novalidate>${fields.map((f) => fieldHtml(f, values)).join("")}<button type="submit" hidden></button></form>`;
    const footer = `${onDelete ? `<button type="button" class="btn ghost danger" data-act="modalDelete">${esc(deleteLabel)}</button>` : ""}
      <div class="right"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button type="button" class="btn primary" data-act="modalSave">${esc(saveLabel)}</button></div>`;
    renderModal(title, body, footer);
    modal = { fields, onSave, onDelete };
    if (window.matchMedia("(min-width: 861px)").matches) {
      const first = $("#mform input:not([type=checkbox]), #mform select, #mform textarea");
      if (first) first.focus();
    }
  }

  function collectForm() {
    const form = $("#mform");
    const out = {};
    let ok = true;
    modal.fields.forEach((f) => {
      const el = form.elements[f.key];
      if (!el) return;
      let val;
      if (f.type === "checkbox") val = el.checked;
      else if (f.type === "money" || f.type === "number") val = el.value === "" ? 0 : num(el.value);
      else if (f.type === "password") val = el.value;
      else val = el.value.trim();
      const wrap = el.closest(".field");
      if (f.required && (val === "" || val == null)) { ok = false; if (wrap) wrap.classList.add("invalid"); }
      else if (wrap) wrap.classList.remove("invalid");
      out[f.key] = val;
    });
    return ok ? out : null;
  }

  function modalSave() {
    if (!modal || !modal.onSave) return;
    const vals = collectForm();
    if (!vals) { toast("Fill in the fields marked with *"); return; }
    if (modal.onSave(vals) !== false) closeModal();
  }

  /* =========================================================
     Shell & routing
     ========================================================= */
  const navAllowed = (n) => !n.adminOnly || isAdmin();
  const currentRoute = () => {
    const r = location.hash.replace(/^#\/?/, "").split("?")[0];
    const n = NAV.find((x) => x.id === r);
    return VIEWS[r] && n && navAllowed(n) ? r : "dashboard";
  };

  function renderNav(route) {
    const overdue = taskStats().overdue;
    $("#side-nav").innerHTML = NAV.filter(navAllowed).map((n) => `
      <a class="nav-link ${route === n.id ? "active" : ""}" href="#/${n.id}" ${route === n.id ? 'aria-current="page"' : ""}>
        ${icon(n.icon)}<span>${n.label}</span>${n.id === "checklist" && overdue ? `<span class="nav-badge" title="Overdue tasks">${overdue}</span>` : ""}
      </a>`).join("");
    const main = MAIN_MOBILE;
    $("#bottom-nav").innerHTML = main.map((id) => {
      const n = NAV.find((x) => x.id === id);
      return `<a href="#/${id}" class="${route === id ? "active" : ""}">${icon(n.icon)}<span>${id === "dashboard" ? "Home" : n.label}</span></a>`;
    }).join("") + `<button type="button" data-act="moreMenu" class="${main.includes(route) ? "" : "active"}">${icon("more")}<span>More</span></button>`;

    const s = state.settings;
    $("#brand-names").textContent = s.partner1 || s.partner2 ? `${s.partner1 || "?"} & ${s.partner2 || "?"}` : "Our Wedding";
    const d = weddingDate();
    $("#brand-date").textContent = d ? fmtDate(d) : "";
    $("#user-chip").textContent = currentUser ? `${currentUser.name} (${ROLE_LABELS[currentUser.role] || currentUser.role})` : "";
  }

  function render() {
    if (!state) return;
    const route = currentRoute();
    renderNav(route);
    $("#view").innerHTML = VIEWS[route]();
    document.title = `${NAV.find((n) => n.id === route).label} | Wedding Planner`;
  }

  const pageHead = (title, sub, actions = "") => `
    <div class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>${actions ? `<div class="toolbar">${actions}</div>` : ""}</div>`;
  const bar = (pct, cls = "") => `<span class="bar ${cls}" style="display:block"><span style="width:${clamp(pct, 0, 100)}%"></span></span>`;

  /* =========================================================
     Views
     ========================================================= */
  const VIEWS = {
    dashboard() {
      const s = state.settings, d = weddingDate(), days = daysUntil();
      const bt = budgetTotals(), ts = taskStats(), gs = guestStats();
      const place = [s.venue, s.city].filter(Boolean).join(", ");

      let count = "";
      if (days != null) {
        if (days > 1) count = `<strong>${days}</strong><span>days to go</span>`;
        else if (days === 1) count = `<strong>1</strong><span>day to go</span>`;
        else if (days === 0) count = `<strong>Today</strong><span>is the day</span>`;
        else count = `<span>Married</span><strong>${-days}</strong><span>days</span>`;
      }

      const upcoming = state.tasks.filter((t) => !t.done)
        .sort((a, b) => (taskDue(a) || Infinity) - (taskDue(b) || Infinity)).slice(0, 6);
      const payments = upcomingPayments(60).slice(0, 6);

      return `
        <section class="invite">
          <div class="invite-inner">
            <p class="invite-lead">The wedding of</p>
            <h1 class="invite-names">${esc(p1())}<span class="invite-amp">&amp;</span>${esc(p2())}</h1>
            <p class="invite-date">${d ? esc(fmtLong(d)) : `<button class="link-btn" data-act="setup">Add your wedding date</button>`}</p>
            ${place ? `<p class="invite-place">${esc(place)}</p>` : ""}
            ${count ? `<div class="invite-count">${count}</div>` : ""}
          </div>
        </section>

        <div class="stats">
          <a class="stat" href="#/budget">
            <div class="stat-label">Projected spend</div>
            <div class="stat-value">${money(bt.projected)}</div>
            ${bar(pctOf(bt.projected, bt.total), bt.projected > bt.total ? "over" : "")}
            <div class="stat-note" style="margin-top:6px">of ${money(bt.total)} budget</div>
          </a>
          <a class="stat" href="#/budget">
            <div class="stat-label">Paid so far</div>
            <div class="stat-value">${money(bt.paid)}</div>
            ${bar(pctOf(bt.paid, bt.projected), "done")}
            <div class="stat-note" style="margin-top:6px">${money(bt.balance)} still to pay</div>
          </a>
          <a class="stat" href="#/checklist">
            <div class="stat-label">Checklist</div>
            <div class="stat-value">${ts.pct}%</div>
            ${bar(ts.pct, "done")}
            <div class="stat-note" style="margin-top:6px">${ts.done} of ${ts.total} done${ts.overdue ? `, <span style="color:var(--rose)">${ts.overdue} overdue</span>` : ""}</div>
          </a>
          <a class="stat" href="#/guests">
            <div class="stat-label">Attending</div>
            <div class="stat-value">${gs.yes}</div>
            ${bar(pctOf(gs.yes, gs.invited))}
            <div class="stat-note" style="margin-top:6px">${gs.invited} invited, ${gs.pending} awaiting reply</div>
          </a>
        </div>

        <div class="grid-2">
          <section class="panel">
            <h2>Suggestions</h2>
            <ul class="insights">${insights().map((i) => `<li><span class="dot ${i.level === "info" ? "" : i.level}"></span><div>${i.html}</div></li>`).join("")}</ul>
          </section>
          <section class="panel">
            <div class="panel-head"><h2>Coming up</h2><a href="#/checklist" class="small">All tasks</a></div>
            ${upcoming.length ? `<ul class="mini-list">${upcoming.map((t) => {
              const due = taskDue(t);
              return `<li><input type="checkbox" data-change="toggleTask" data-id="${t.id}" aria-label="Mark done" style="width:18px;height:18px;accent-color:var(--evergreen)"/>
                <div class="grow"><div>${esc(t.title)}</div><div class="sub" ${isOverdue(t) ? 'style="color:var(--rose)"' : ""}>${esc(dueText(due, false))}</div></div></li>`;
            }).join("")}</ul>` : `<p class="empty">Every task is done. Enjoy the moment.</p>`}
          </section>
        </div>

        <div class="grid-2" style="margin-top:16px">
          <section class="panel">
            <div class="panel-head"><h2>Payments due</h2><a href="#/budget" class="small">Budget</a></div>
            ${payments.length ? `<ul class="mini-list">${payments.map((p) => {
              const n = diffDays(p.date, todayStart());
              return `<li><div class="grow"><div>${esc(p.item.name)}</div><div class="sub">${esc(p.cat.name)}${p.item.vendor ? `, ${esc(p.item.vendor)}` : ""}</div></div>
                <div style="text-align:right"><strong>${money(itemBalance(p.item))}</strong><div class="sub" ${n < 0 ? 'style="color:var(--rose)"' : ""}>${n < 0 ? "Overdue" : fmtDate(p.date)}</div></div></li>`;
            }).join("")}</ul>` : `<p class="empty">No payments due in the next 60 days. Add due dates to budget items to track them here.</p>`}
          </section>
          <section class="panel">
            <div class="panel-head"><h2>Spending by category</h2></div>
            <ul class="mini-list">${state.categories.filter((c) => num(c.pct) > 0 || catTotals(c).projected > 0).map((c) => {
              const t = catTotals(c);
              return `<li><div class="grow"><div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(c.name)}</span><span class="sub">${money(t.projected)} of ${money(t.alloc)}</span></div>
                ${bar(pctOf(t.projected, t.alloc || 1), t.projected > t.alloc ? "over" : "")}</div></li>`;
            }).join("")}</ul>
          </section>
        </div>`;
    },

    budget() {
      const bt = budgetTotals();
      const pctOk = Math.abs(bt.pct - 100) <= 0.05;
      return `
        ${pageHead("Budget", "Plan each category, record quotes as they come in, and track what you've paid.",
          `<button class="btn" data-act="estimateBudget">Estimate budget</button>
           <button class="btn" data-act="fillAll">Suggest estimates</button>
           <button class="btn" data-act="exportBudget">Export CSV</button>
           <button class="btn primary" data-act="addCategory">${icon("plus")}Category</button>`)}

        <div class="summary-row">
          <div><div class="k">Total budget</div><div class="v"><button class="link-btn" data-act="editTotal" style="text-decoration:none;font-weight:700">${money(bt.total)}</button></div></div>
          <div><div class="k">Projected</div><div class="v ${bt.projected > bt.total ? "bad" : ""}">${money(bt.projected)}</div></div>
          <div><div class="k">Estimated</div><div class="v">${money(bt.est)}</div></div>
          <div><div class="k">Quoted / actual</div><div class="v">${money(bt.actual)}</div></div>
          <div><div class="k">Paid</div><div class="v good">${money(bt.paid)}</div></div>
          <div><div class="k">${bt.remaining < 0 ? "Over budget" : "Left to assign"}</div><div class="v ${bt.remaining < 0 ? "bad" : ""}">${money(Math.abs(bt.remaining))}</div></div>
        </div>
        <p class="muted small" style="margin:-6px 0 14px">Projected uses the actual amount when you have one, otherwise the estimate.</p>

        ${pctOk ? "" : `<div class="alloc-warning"><span>Category percentages add up to <strong>${bt.pct}%</strong>. Adjust them to total 100%.</span><button class="btn small" data-act="applySplit">Use suggested split</button></div>`}

        ${state.categories.map((c) => {
          const t = catTotals(c), open = ui.openCats.has(c.id), over = t.projected > t.alloc && t.projected > 0;
          return `
          <div class="cat ${open ? "open" : ""}">
            <button class="cat-head" data-act="toggleCat" data-id="${c.id}" aria-expanded="${open}">
              <span class="cat-swatch" style="background:${esc(c.color)}"></span>
              <span>
                <span class="cat-title" style="display:block">${esc(c.name)}</span>
                <span class="cat-meta" style="display:block">${num(c.pct)}% share, ${money(t.alloc)} allowance, ${c.items.length} item${c.items.length === 1 ? "" : "s"}</span>
                <span class="cat-bar" style="display:block">${bar(pctOf(t.projected, t.alloc || 1), over ? "over" : "")}</span>
              </span>
              <span class="cat-nums"><strong class="${over ? "bad" : ""}">${money(t.projected)}</strong>${over ? `${money(t.projected - t.alloc)} over` : `${money(t.alloc - t.projected)} left`}</span>
            </button>
            ${open ? `<div class="cat-body">
              ${c.items.length ? `<table class="items">
                <thead><tr><th>Item</th><th class="num">Estimated</th><th class="num">Actual</th><th class="num">Paid</th><th>Next due</th><th>Status</th></tr></thead>
                <tbody>${c.items.map((i) => itemRow(c, i)).join("")}</tbody></table>` : `<p class="empty">No items in this category yet.</p>`}
              <div class="cat-actions">
                <button class="btn small primary" data-act="addItem" data-cat="${c.id}">${icon("plus")}Add item</button>
                <button class="btn small" data-act="fillCat" data-cat="${c.id}">Suggest estimates</button>
                <button class="btn small ghost" data-act="editCat" data-cat="${c.id}">Edit category</button>
              </div>
            </div>` : ""}
          </div>`;
        }).join("")}
        <p class="muted small">"Suggest estimates" spreads each category's unused allowance across its items that don't have a number yet. Tap a category to see its items. Tap an item to enter estimates, quotes, payments and due dates.</p>`;
    },

    checklist() {
      const ts = taskStats();
      const filters = [["todo", "To do"], ["overdue", `Overdue${ts.overdue ? ` (${ts.overdue})` : ""}`], ["done", "Done"], ["all", "All"]];
      return `
        ${pageHead("Checklist", state.settings.date
          ? "Tasks are scheduled back from your wedding date. Check them off as you go."
          : "Add your wedding date in Settings and every task gets a due date.",
          `<button class="btn primary" data-act="addTask">${icon("plus")}Task</button>`)}
        <section class="panel" style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px"><strong>${ts.done} of ${ts.total} tasks done</strong><span class="muted">${ts.pct}%</span></div>
          ${bar(ts.pct, "done")}
        </section>
        <div class="toolbar" style="margin-bottom:16px">
          <div class="filters">${filters.map(([k, l]) => `<button class="chip ${ui.taskFilter === k ? "active" : ""}" data-act="taskFilter" data-f="${k}">${l}</button>`).join("")}</div>
          <input class="search" type="search" placeholder="Search tasks" value="${esc(ui.taskSearch)}" data-input="taskSearch" aria-label="Search tasks"/>
        </div>
        <div id="task-list">${taskListHtml()}</div>`;
    },

    guests() {
      const gs = guestStats();
      const meals = Object.entries(gs.meals);
      const rsvpFilters = [["all", "Everyone"], ["yes", "Attending"], ["pending", "Awaiting reply"], ["no", "Declined"]];
      return `
        ${pageHead("Guests", "Track invitations, RSVPs, meals and seating in one list.",
          `<button class="btn" data-act="bulkGuests">Add several</button>
           <button class="btn" data-act="exportGuests">Export CSV</button>
           <button class="btn primary" data-act="addGuest">${icon("plus")}Guest</button>`)}
        <div class="chips-row">
          <div class="count-chip"><strong>${gs.invited}</strong> invited</div>
          <div class="count-chip"><strong style="color:var(--ok)">${gs.yes}</strong> attending</div>
          <div class="count-chip"><strong>${gs.pending}</strong> awaiting reply</div>
          <div class="count-chip"><strong style="color:var(--rose)">${gs.no}</strong> declined</div>
          ${num(state.settings.guestEstimate) ? `<div class="count-chip"><strong>${state.settings.guestEstimate}</strong> planned</div>` : ""}
        </div>
        ${meals.length ? `<p class="muted" style="margin:-4px 0 14px">Meal counts for attending guests: ${meals.map(([m, n]) => `${esc(m)} ${n}`).join(", ")}</p>` : ""}
        <div class="toolbar" style="margin-bottom:16px">
          <div class="filters">
            <button class="chip ${ui.guestView === "list" ? "active" : ""}" data-act="guestView" data-v="list">List</button>
            <button class="chip ${ui.guestView === "tables" ? "active" : ""}" data-act="guestView" data-v="tables">Seating</button>
          </div>
          ${ui.guestView === "list" ? `<div class="filters">${rsvpFilters.map(([k, l]) => `<button class="chip ${ui.guestFilter === k ? "active" : ""}" data-act="guestFilter" data-f="${k}">${l}</button>`).join("")}</div>
          <input class="search" type="search" placeholder="Search guests" value="${esc(ui.guestSearch)}" data-input="guestSearch" aria-label="Search guests"/>` : ""}
        </div>
        <div id="guest-list">${ui.guestView === "list" ? guestListHtml() : seatingHtml()}</div>`;
    },

    vendors() {
      const booked = new Set(state.vendors.filter((v) => v.status === "Booked").map((v) => v.category));
      const missing = WP.ESSENTIAL_VENDORS.filter((c) => !booked.has(c));
      const cats = [...WP.VENDOR_CATEGORIES, ...new Set(state.vendors.map((v) => v.category).filter((c) => !WP.VENDOR_CATEGORIES.includes(c)))];
      const groups = cats.map((c) => [c, state.vendors.filter((v) => v.category === c)]).filter(([, list]) => list.length);
      return `
        ${pageHead("Vendors", "Keep contacts and quotes side by side, then mark who you book.",
          `<a class="btn" href="#/local">North Alabama vendors</a>
           <button class="btn" data-act="vendorQuestions">Questions to ask</button>
           <button class="btn primary" data-act="addVendor">${icon("plus")}Vendor</button>`)}
        <section class="panel" style="margin-bottom:8px">
          <div class="panel-head"><h2>Still to book</h2><span class="muted small">${WP.ESSENTIAL_VENDORS.length - missing.length} of ${WP.ESSENTIAL_VENDORS.length} booked</span></div>
          ${missing.length ? `<div class="need-list">${missing.map((m) => `<button class="pill warn" data-act="addVendor" data-cat="${esc(m)}">${esc(m)}</button>`).join("")}</div>
            <p class="muted small" style="margin:10px 0 0">Tap one to add a vendor you're considering.</p>`
            : `<p class="empty">All of the key vendors are booked.</p>`}
        </section>
        ${groups.length ? groups.map(([c, list]) => `
          <div class="vendor-group">
            <h2>${esc(c)}</h2>
            <div class="list">${list.map(vendorRow).join("")}</div>
          </div>`).join("") : `<p class="empty" style="margin-top:16px">No vendors yet. Add the ones you're considering to compare quotes.</p>`}`;
    },

    timeline() {
      const items = [...state.timeline].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
      return `
        ${pageHead("Day-of timeline", "A starting schedule for the wedding day. Adjust the times, then print or share it with your vendors and wedding party.",
          `<button class="btn" data-act="resetTimeline">Reset to template</button>
           <button class="btn" data-act="print">Print</button>
           <button class="btn primary" data-act="addEvent">${icon("plus")}Event</button>`)}
        ${items.length ? `<ol class="timeline">${items.map((t) => `
          <li class="tl-item" data-act="editEvent" data-id="${t.id}">
            <span class="tl-time">${fmtTime(t.time)}</span>
            <span class="tl-dot"></span>
            <div class="tl-card">
              <div class="tl-title">${esc(t.title)}</div>
              ${t.location || t.who ? `<div class="muted small">${[t.location, t.who].filter(Boolean).map(esc).join(", ")}</div>` : ""}
              ${t.notes ? `<div class="small" style="margin-top:4px">${esc(t.notes)}</div>` : ""}
            </div>
          </li>`).join("")}</ol>` : `<p class="empty">No events yet. Add one or reset to the template.</p>`}`;
    },

    tips() {
      return `
        ${pageHead("Ideas & tips", "Suggestions to help you plan, save money and avoid surprises.")}
        <div class="grid-2">
          <section class="panel">
            <h2>Costs couples often forget</h2>
            <ul class="forgot">${WP.FORGOTTEN.map((f, i) => {
              const cat = findCategory(f.category);
              const exists = cat && cat.items.some((it) => it.name.toLowerCase() === f.name.toLowerCase());
              return `<li><div><strong>${esc(f.name)}</strong><div class="muted small">${esc(f.note)}</div></div>
                ${exists ? `<span class="pill good">In budget</span>` : `<button class="btn small" data-act="addForgotten" data-i="${i}">Add</button>`}</li>`;
            }).join("")}</ul>
          </section>
          <div class="stack">
            <section class="panel">
              <h2>Ways to save</h2>
              <ul class="tip-list">${WP.SAVING_TIPS.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
            </section>
            <section class="panel">
              <h2>Typical budget split</h2>
              <table class="tip-table">${WP.CATEGORIES.filter((c) => c.pct > 0).map((c) => `<tr><td>${esc(c.name)}</td><td>${c.pct}%</td></tr>`).join("")}</table>
              <p class="muted small">Honeymoon is usually budgeted separately.</p>
            </section>
          </div>
          <section class="panel">
            <div class="panel-head"><h2>Emergency kit</h2><span class="muted small">${state.kit.filter((k) => k.done).length} of ${state.kit.length} packed</span></div>
            <ul class="kit">${state.kit.map((k) => `<li class="${k.done ? "done" : ""}"><label><input type="checkbox" data-change="toggleKit" data-id="${k.id}" ${k.done ? "checked" : ""}/><span>${esc(k.name)}</span></label></li>`).join("")}</ul>
          </section>
          <section class="panel">
            <h2>Tipping guide</h2>
            <table class="tip-table">${WP.TIPPING.map((t) => `<tr><td>${esc(t.who)}</td><td>${esc(t.amount)}</td></tr>`).join("")}</table>
            <p class="muted small">Common US guidance. Check contracts first, since many include a service charge.</p>
          </section>
        </div>
        <section class="panel" style="margin-top:16px">
          <h2>Questions to ask vendors</h2>
          ${questionsHtml()}
        </section>`;
    },

    settings() {
      const s = state.settings;
      return `
        ${pageHead("Settings", "Wedding details, backups and your account.")}
        <section class="panel">
          <h2>Wedding details</h2>
          <form id="settings-form" class="form-grid" onsubmit="return false">
            ${[
              { key: "partner1", label: "Partner one" }, { key: "partner2", label: "Partner two" },
              { key: "date", label: "Wedding date", type: "date" }, { key: "guestEstimate", label: "Planned guest count", type: "number" },
              { key: "venue", label: "Venue" }, { key: "city", label: "City" },
              { key: "totalBudget", label: "Total budget", type: "money" }, { key: "currency", label: "Currency symbol", hint: "For example $, £ or €" },
              { key: "mealOptions", label: "Meal choices", type: "textarea", rows: 2, hint: "Separate choices with commas." },
            ].map((f) => fieldHtml(f, s)).join("")}
          </form>
          <button class="btn primary" data-act="saveSettings">Save changes</button>
        </section>

        <section class="panel">
          <h2>Backups and exports</h2>
          <p class="muted">Your plan saves to your Netlify site automatically. Download a backup now and then for safekeeping.</p>
          <div class="toolbar">
            <button class="btn" data-act="exportJson">Download backup</button>
            <label class="btn" style="cursor:pointer">Restore backup<input type="file" accept="application/json,.json" data-change="importJson" hidden/></label>
            <button class="btn" data-act="exportGuests">Guest list CSV</button>
            <button class="btn" data-act="exportBudget">Budget CSV</button>
          </div>
        </section>

        <section class="panel">
          <h2>Start over</h2>
          <p class="muted">These can't be undone. Download a backup first.</p>
          <div class="toolbar">
            <button class="btn danger" data-act="resetTasks">Reset checklist</button>
            <button class="btn danger solid" data-act="resetAll">Erase everything</button>
          </div>
        </section>

        <section class="panel">
          <h2>Your account</h2>
          <p class="muted">Signed in as <strong>${esc(currentUser ? currentUser.name : "")}</strong> (${esc(currentUser ? currentUser.username : "")}), ${esc(ROLE_LABELS[currentUser && currentUser.role] || "")} access.${isAdmin() ? ' Manage other people\'s access under <a href="#/admin">Website &amp; users</a>.' : ""}</p>
          <div class="toolbar">
            <button class="btn" data-act="changePassword">Change password</button>
            <a class="btn" href="/" target="_blank" rel="noopener">View wedding website</a>
            <button class="btn" data-act="logout">Sign out</button>
          </div>
        </section>`;
    },
  };

  /* ---------- View fragments ---------- */
  function itemRow(c, i) {
    const cost = itemCost(i), bal = itemBalance(i), due = parseDate(i.due);
    const m = (v) => (num(v) ? money(v) : `<span class="zero">&ndash;</span>`);
    let status = "";
    if (cost > 0 && bal <= 0) status = `<span class="pill good">Paid in full</span>`;
    else if (due && bal > 0 && due < todayStart()) status = `<span class="pill bad">Payment overdue</span>`;
    else if (due && bal > 0 && diffDays(due, todayStart()) <= 30) status = `<span class="pill warn">Due ${esc(fmtDate(due))}</span>`;
    else if (itemPaid(i) > 0) status = `<span class="pill gold">Deposit paid</span>`;
    else if (num(i.actual) > 0) status = `<span class="pill">Quoted</span>`;
    return `<tr class="row" data-act="editItem" data-cat="${c.id}" data-id="${i.id}">
      <td class="c-name">${esc(i.name)}${i.vendor ? `<div class="muted small">${esc(i.vendor)}</div>` : ""}</td>
      <td class="c-cost num">${m(cost)}${itemPaid(i) ? `<div class="muted small">${money(itemPaid(i))} paid</div>` : ""}</td>
      <td class="num c-hide">${m(i.est)}</td>
      <td class="num c-hide">${m(i.actual)}</td>
      <td class="num c-hide">${m(itemPaid(i))}</td>
      <td class="c-hide">${due ? esc(fmtDate(due)) : ""}</td>
      <td class="c-status">${status}</td>
    </tr>`;
  }

  function taskListHtml() {
    const q = ui.taskSearch.toLowerCase();
    const match = (t) => {
      if (q && !(`${t.title} ${t.notes}`.toLowerCase().includes(q))) return false;
      if (ui.taskFilter === "todo") return !t.done;
      if (ui.taskFilter === "done") return t.done;
      if (ui.taskFilter === "overdue") return isOverdue(t);
      return true;
    };
    const phases = [...WP.PHASES, { key: "__other", label: "Other tasks" }];
    const html = phases.map((p) => {
      const inPhase = state.tasks.filter((t) => (p.key === "__other" ? !WP.PHASES.some((x) => x.key === t.phase) : t.phase === p.key));
      const list = inPhase.filter(match);
      if (!list.length) return "";
      const pd = phaseDue(p.key), doneCount = inPhase.filter((t) => t.done).length;
      return `<section class="phase">
        <div class="phase-head"><h2>${esc(p.label)}</h2><span class="muted">${pd ? `${p.key === "after" ? "Finish by" : "Complete by"} ${esc(fmtDate(pd))}, ` : ""}${doneCount}/${inPhase.length} done</span></div>
        <ul class="tasks">${list.map((t) => {
          const due = taskDue(t), overdue = isOverdue(t);
          return `<li class="task ${t.done ? "done" : ""}">
            <input type="checkbox" data-change="toggleTask" data-id="${t.id}" ${t.done ? "checked" : ""} aria-label="Mark ${esc(t.title)} done"/>
            <div class="task-body" data-act="editTask" data-id="${t.id}">
              <div class="task-title">${esc(t.title)}</div>
              <div class="task-sub ${overdue ? "bad" : ""}">${esc(dueText(due, t.done))}${t.due ? " (custom date)" : ""}${t.notes ? `${due || !state.settings.date ? ". " : ""}${esc(t.notes.length > 80 ? t.notes.slice(0, 80) + "..." : t.notes)}` : ""}</div>
            </div>
          </li>`;
        }).join("")}</ul>
      </section>`;
    }).join("");
    if (html) return html;
    const msgs = { todo: "Nothing left to do. Nicely done.", overdue: "Nothing is overdue.", done: "No finished tasks yet. Check one off to see it here.", all: "No tasks match." };
    return `<p class="empty">${q ? "No tasks match your search." : msgs[ui.taskFilter]}</p>`;
  }

  const sideLabel = (side) => ({ p1: `${p1()}'s side`, p2: `${p2()}'s side`, both: "Both" }[side] || "");
  const RSVP = { yes: ["Attending", "good"], no: ["Declined", "bad"], pending: ["Awaiting reply", "warn"] };

  function guestListHtml() {
    const q = ui.guestSearch.toLowerCase();
    const list = state.guests
      .filter((g) => ui.guestFilter === "all" || (g.rsvp || "pending") === ui.guestFilter)
      .filter((g) => !q || `${g.name} ${g.plusOneName} ${g.group} ${g.table} ${g.email}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!state.guests.length) return `<p class="empty">Your guest list is empty. Add guests one at a time, or paste in a list with "Add several".</p>`;
    if (!list.length) return `<p class="empty">No guests match.</p>`;
    return `<div class="list">${list.map((g) => {
      const [label, cls] = RSVP[g.rsvp] || RSVP.pending;
      const sub = [sideLabel(g.side), g.group, g.table ? `Table ${g.table}` : "", g.meal].filter(Boolean).map(esc).join(", ");
      return `<div class="list-row" data-act="editGuest" data-id="${g.id}">
        <div class="list-main"><div class="list-title">${esc(g.name)}${g.plusOne ? ` <span class="muted small">+ ${esc(g.plusOneName || "guest")}</span>` : ""}</div>${sub ? `<div class="list-sub">${sub}</div>` : ""}</div>
        <div class="list-side"><button class="pill ${cls}" data-act="cycleRsvp" data-id="${g.id}" title="Tap to change reply">${label}</button></div>
      </div>`;
    }).join("")}</div>`;
  }

  function seatingHtml() {
    const seated = state.guests.filter((g) => g.rsvp !== "no");
    if (!seated.length) return `<p class="empty">Add guests and give them a table number to build your seating chart.</p>`;
    const tables = {};
    seated.forEach((g) => { const k = String(g.table || "").trim() || "Not seated yet"; (tables[k] = tables[k] || []).push(g); });
    const keys = Object.keys(tables).sort((a, b) => {
      if (a === "Not seated yet") return 1; if (b === "Not seated yet") return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    return `<p class="muted small" style="margin-top:0">Declined guests are hidden. Tap a name to change their table.</p>
      <div class="tables-grid">${keys.map((k) => {
        const seats = tables[k].reduce((a, g) => a + 1 + (g.plusOne ? 1 : 0), 0);
        return `<div class="table-card"><h3><span>${k === "Not seated yet" ? k : `Table ${esc(k)}`}</span><span class="muted small">${seats} seat${seats === 1 ? "" : "s"}</span></h3>
          <ul>${tables[k].sort((a, b) => a.name.localeCompare(b.name)).map((g) => `<li><button class="link-btn" style="text-decoration:none" data-act="editGuest" data-id="${g.id}">${esc(g.name)}${g.plusOne ? ` + ${esc(g.plusOneName || "guest")}` : ""}</button>${g.rsvp === "pending" ? ` <span class="muted small">(awaiting)</span>` : ""}</li>`).join("")}</ul></div>`;
      }).join("")}</div>`;
  }

  function vendorRow(v) {
    const statusCls = { Booked: "good", "Meeting set": "gold", Contacted: "warn", "Not a fit": "bad" }[v.status] || "";
    const links = [
      v.phone ? `<a data-act="link" href="tel:${esc(v.phone.replace(/[^0-9+]/g, ""))}">Call</a>` : "",
      v.email ? `<a data-act="link" href="mailto:${esc(v.email)}">Email</a>` : "",
      v.website ? `<a data-act="link" href="${esc(/^https?:\/\//i.test(v.website) ? v.website : "https://" + v.website)}" target="_blank" rel="noopener">Website</a>` : "",
    ].filter(Boolean).join("");
    const canBudget = v.status === "Booked" && num(v.quote) > 0 && !v.budgetItemId;
    return `<div class="list-row" data-act="editVendor" data-id="${v.id}">
      <div class="list-main">
        <div class="list-title">${esc(v.name)}</div>
        <div class="list-sub">${[v.contact, num(v.quote) ? `Quote ${money(v.quote)}` : ""].filter(Boolean).map(esc).join(", ")}</div>
        ${links ? `<div class="contact-links">${links}</div>` : ""}
      </div>
      <div class="list-side">
        ${canBudget ? `<button class="btn small" data-act="vendorToBudget" data-id="${v.id}">Add to budget</button>` : ""}
        <span class="pill ${statusCls}">${esc(v.status || "Researching")}</span>
      </div>
    </div>`;
  }

  const questionsHtml = () => Object.entries(WP.VENDOR_QUESTIONS).map(([k, qs]) => `
    <details class="qa"><summary>${esc(k)}</summary><ul>${qs.map((q) => `<li>${esc(q)}</li>`).join("")}</ul></details>`).join("");

  /* =========================================================
     Forms for each record type
     ========================================================= */
  function openSetup() {
    const s = state.settings;
    openForm({
      title: "Let's set up your plan",
      intro: "A few details and your budget split, checklist dates and suggestions are ready to go. You can change anything later in Settings.",
      saveLabel: "Start planning",
      values: { ...s, tier: "moderate", totalBudget: s.setupDone ? s.totalBudget : "" },
      fields: [
        { key: "partner1", label: "Your name" },
        { key: "partner2", label: "Your partner's name" },
        { key: "date", label: "Wedding date", type: "date", hint: "Not set yet? Leave blank and add it later." },
        { key: "guestEstimate", label: "About how many guests?", type: "number" },
        { key: "venue", label: "Venue", placeholder: "If you have one" },
        { key: "city", label: "City" },
        { key: "tier", label: "Style of wedding", type: "select", options: WP.BUDGET_TIERS.map((t) => ({ value: t.key, label: `${t.label} (about ${cur()}${t.perGuest} per guest)` })) },
        { key: "totalBudget", label: "Total budget", type: "money", hint: "Leave blank to use a suggested budget based on guests and style." },
      ],
      onSave(v) {
        const tier = WP.BUDGET_TIERS.find((t) => t.key === v.tier) || WP.BUDGET_TIERS[1];
        const guests = num(v.guestEstimate) || 100;
        const budget = num(v.totalBudget) || round500(guests * tier.perGuest);
        Object.assign(state.settings, {
          partner1: v.partner1, partner2: v.partner2, date: v.date, venue: v.venue, city: v.city,
          guestEstimate: guests, totalBudget: budget, setupDone: true,
        });
        commit();
        toast(num(v.totalBudget) ? "Your plan is ready" : `Your plan is ready with a suggested budget of ${money(budget)}`);
      },
    });
  }

  function openEstimate() {
    const g = num(state.settings.guestEstimate) || 100;
    openForm({
      title: "Estimate your budget",
      intro: `<p style="margin-top:0">A rough all-in cost per guest, based on typical US weddings. Prices vary a lot by city and season.</p>
        <table class="tip-table">${WP.BUDGET_TIERS.map((t) => `<tr><td>${esc(t.label)}</td><td>${cur()}${t.perGuest} per guest, about ${money(round500(g * t.perGuest))} for ${g}</td></tr>`).join("")}</table>`,
      saveLabel: "Use this budget",
      values: { guests: g, tier: "moderate" },
      fields: [
        { key: "guests", label: "Guests", type: "number", required: true },
        { key: "tier", label: "Style", type: "select", options: WP.BUDGET_TIERS.map((t) => ({ value: t.key, label: t.label })) },
      ],
      onSave(v) {
        const tier = WP.BUDGET_TIERS.find((t) => t.key === v.tier);
        const total = round500(num(v.guests) * tier.perGuest);
        state.settings.totalBudget = total;
        state.settings.guestEstimate = num(v.guests);
        commit();
        toast(`Total budget set to ${money(total)}`);
      },
    });
  }

  function openItem(cat, item) {
    const isNew = !item;
    const t = catTotals(cat);
    const otherProjected = t.projected - (item ? itemCost(item) : 0);
    const open = Math.max(t.alloc - otherProjected, 0);
    openForm({
      title: isNew ? `Add to ${cat.name}` : item.name,
      intro: `${esc(cat.name)} has a ${money(t.alloc)} allowance. ${money(open)} of it isn't assigned to other items yet.`,
      values: item ? { ...item, category: cat.id } : { category: cat.id },
      fields: [
        { key: "name", label: "Item", required: true, full: true },
        { key: "est", label: "Estimated cost", type: "money", hint: "Your planning number" },
        { key: "actual", label: "Actual or quoted cost", type: "money", hint: "From the contract or invoice" },
        { key: "paid", label: "Paid outside Accounts", type: "money", hint: item && hooks.paidFor(item) ? `Plus ${money2(hooks.paidFor(item))} recorded in Accounts` : "Payments recorded in Accounts are added automatically" },
        { key: "due", label: "Next payment due", type: "date" },
        { key: "vendor", label: "Vendor", list: state.vendors.map((v) => v.name) },
        { key: "category", label: "Category", type: "select", options: state.categories.map((c) => ({ value: c.id, label: c.name })) },
        { key: "notes", label: "Notes", type: "textarea", rows: 2 },
      ],
      onSave(v) {
        const target = state.categories.find((c) => c.id === v.category) || cat;
        const data = { name: v.name, est: v.est, actual: v.actual, paid: v.paid, due: v.due, vendor: v.vendor, notes: v.notes };
        if (isNew) {
          target.items.push(newItem(v.name, data));
        } else {
          Object.assign(item, data);
          if (target !== cat) { cat.items = cat.items.filter((i) => i !== item); target.items.push(item); }
        }
        ui.openCats.add(target.id);
        commit();
        toast(isNew ? "Item added" : "Item saved");
      },
      onDelete: isNew ? null : () => {
        if (!confirm(`Delete "${item.name}"?`)) return false;
        cat.items = cat.items.filter((i) => i !== item);
        commit(); toast("Item deleted");
      },
    });
  }

  function openCategory(cat) {
    const isNew = !cat;
    const suggested = cat && WP.CATEGORIES.find((c) => c.name === cat.name);
    openForm({
      title: isNew ? "Add category" : "Edit category",
      values: cat || { pct: 0 },
      fields: [
        { key: "name", label: "Name", required: true, full: true },
        { key: "pct", label: "Share of total budget (%)", type: "number", hint: suggested ? `Suggested: ${suggested.pct}%` : "Other categories may need lowering so the total stays at 100%." },
      ],
      onSave(v) {
        if (isNew) {
          const c = { id: uid(), name: v.name, pct: v.pct, color: PALETTE[state.categories.length % PALETTE.length], items: [] };
          state.categories.push(c); ui.openCats.add(c.id);
        } else Object.assign(cat, { name: v.name, pct: v.pct });
        commit();
        toast(isNew ? "Category added" : "Category saved");
      },
      onDelete: isNew ? null : () => {
        if (!confirm(`Delete ${cat.name} and its ${cat.items.length} item(s)?`)) return false;
        state.categories = state.categories.filter((c) => c !== cat);
        commit(); toast("Category deleted");
      },
    });
  }

  function openTask(task) {
    const isNew = !task;
    openForm({
      title: isNew ? "Add task" : "Edit task",
      values: task || { phase: "1" },
      fields: [
        { key: "title", label: "Task", required: true, full: true },
        { key: "phase", label: "When", type: "select", options: WP.PHASES.map((p) => ({ value: p.key, label: p.label })) },
        { key: "due", label: "Custom due date", type: "date", hint: "Leave blank to use the date for this stage." },
        { key: "notes", label: "Notes", type: "textarea" },
        ...(isNew ? [] : [{ key: "done", label: "Done", type: "checkbox" }]),
      ],
      onSave(v) {
        if (isNew) state.tasks.push({ id: uid(), done: false, ...v });
        else Object.assign(task, v);
        commit(); toast(isNew ? "Task added" : "Task saved");
      },
      onDelete: isNew ? null : () => {
        if (!confirm("Delete this task?")) return false;
        state.tasks = state.tasks.filter((t) => t !== task);
        commit(); toast("Task deleted");
      },
    });
  }

  function openGuest(guest) {
    const isNew = !guest;
    const meals = [{ value: "", label: "Not chosen" }, ...mealOptions()];
    const groups = [...new Set(["Family", "Friends", "Work", "Wedding party", "Neighbors", ...state.guests.map((g) => g.group).filter(Boolean)])];
    openForm({
      title: isNew ? "Add guest" : guest.name,
      values: guest || { rsvp: "pending", side: "both" },
      fields: [
        { key: "name", label: "Name", required: true, full: true },
        { key: "side", label: "Side", type: "select", options: [{ value: "p1", label: sideLabel("p1") }, { value: "p2", label: sideLabel("p2") }, { value: "both", label: "Both" }] },
        { key: "group", label: "Group", list: groups, placeholder: "Family, friends, work" },
        { key: "rsvp", label: "Reply", type: "select", options: [{ value: "pending", label: "Awaiting reply" }, { value: "yes", label: "Attending" }, { value: "no", label: "Declined" }] },
        { key: "meal", label: "Meal", type: "select", options: meals },
        { key: "plusOne", label: "Bringing a plus-one", type: "checkbox" },
        { key: "plusOneName", label: "Plus-one name" },
        { key: "plusOneMeal", label: "Plus-one meal", type: "select", options: meals },
        { key: "table", label: "Table", placeholder: "e.g. 4" },
        { key: "dietary", label: "Allergies or dietary needs" },
        { key: "email", label: "Email", type: "email" },
        { key: "phone", label: "Phone", type: "tel" },
        { key: "address", label: "Mailing address", type: "textarea", rows: 2 },
        { key: "gift", label: "Gift received" },
        { key: "thankYou", label: "Thank-you note sent", type: "checkbox" },
      ],
      onSave(v) {
        if (isNew) state.guests.push({ id: uid(), ...v });
        else Object.assign(guest, v);
        commit(); toast(isNew ? "Guest added" : "Guest saved");
      },
      onDelete: isNew ? null : () => {
        if (!confirm(`Remove ${guest.name} from the guest list?`)) return false;
        state.guests = state.guests.filter((g) => g !== guest);
        commit(); toast("Guest removed");
      },
    });
  }

  function openBulkGuests() {
    openForm({
      title: "Add several guests",
      intro: "Put one guest per line. Add a comma and a group name if you like, for example: <em>Maria Lopez, Family</em>",
      saveLabel: "Add guests",
      fields: [
        { key: "lines", label: "Guests", type: "textarea", rows: 8, required: true },
        { key: "side", label: "Side", type: "select", options: [{ value: "both", label: "Both" }, { value: "p1", label: sideLabel("p1") }, { value: "p2", label: sideLabel("p2") }] },
      ],
      onSave(v) {
        const rows = v.lines.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        rows.forEach((l) => {
          const [name, ...rest] = l.split(",");
          state.guests.push({ id: uid(), name: name.trim(), group: rest.join(",").trim(), side: v.side, rsvp: "pending" });
        });
        commit(); toast(`${rows.length} guest${rows.length === 1 ? "" : "s"} added`);
      },
    });
  }

  function openVendor(vendor, presetCategory) {
    const isNew = !vendor;
    openForm({
      title: isNew ? "Add vendor" : vendor.name,
      values: vendor || { category: presetCategory || "Venue", status: "Researching" },
      fields: [
        { key: "name", label: "Business name", required: true },
        { key: "category", label: "Type", type: "select", options: WP.VENDOR_CATEGORIES },
        { key: "status", label: "Status", type: "select", options: WP.VENDOR_STATUSES },
        { key: "quote", label: "Quote", type: "money" },
        { key: "contact", label: "Contact person" },
        { key: "phone", label: "Phone", type: "tel" },
        { key: "email", label: "Email", type: "email" },
        { key: "website", label: "Website", type: "url", placeholder: "example.com" },
        { key: "notes", label: "Notes", type: "textarea", placeholder: "What's included, deposit terms, impressions" },
      ],
      onSave(v) {
        if (isNew) state.vendors.push({ id: uid(), ...v });
        else Object.assign(vendor, v);
        commit();
        toast(v.status === "Booked" && num(v.quote) && !(vendor && vendor.budgetItemId) ? "Saved. Use Add to budget to track the cost." : isNew ? "Vendor added" : "Vendor saved");
      },
      onDelete: isNew ? null : () => {
        if (!confirm(`Delete ${vendor.name}?`)) return false;
        state.vendors = state.vendors.filter((x) => x !== vendor);
        commit(); toast("Vendor deleted");
      },
    });
  }

  function openEvent(ev) {
    const isNew = !ev;
    openForm({
      title: isNew ? "Add event" : "Edit event",
      values: ev || {},
      fields: [
        { key: "time", label: "Time", type: "time", required: true },
        { key: "title", label: "What's happening", required: true },
        { key: "location", label: "Where" },
        { key: "who", label: "Who's involved" },
        { key: "notes", label: "Notes", type: "textarea", rows: 2 },
      ],
      onSave(v) {
        if (isNew) state.timeline.push({ id: uid(), ...v });
        else Object.assign(ev, v);
        commit(); toast(isNew ? "Event added" : "Event saved");
      },
      onDelete: isNew ? null : () => {
        state.timeline = state.timeline.filter((x) => x !== ev);
        commit(); toast("Event deleted");
      },
    });
  }

  // Spread a category's unassigned allowance across items with no estimate or actual yet
  function fillEstimates(cat) {
    const blank = cat.items.filter((i) => !num(i.est) && !num(i.actual));
    const t = catTotals(cat);
    const room = t.alloc - t.projected;
    if (!blank.length || room <= 0) return 0;
    const weight = (i) => ITEM_WEIGHTS.get(i.name.toLowerCase()) || 10;
    const totalWeight = blank.reduce((a, i) => a + weight(i), 0);
    let filled = 0;
    blank.forEach((i) => {
      const est = Math.floor((room * weight(i)) / totalWeight / 10) * 10;
      if (est > 0) { i.est = est; filled++; }
    });
    return filled;
  }

  /* =========================================================
     Exports
     ========================================================= */
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  const csvCell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = "'" + s; // guard against spreadsheet formula injection
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const toCsv = (rows) => "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

  /* =========================================================
     Actions
     ========================================================= */
  const byId = (arr, id) => arr.find((x) => x.id === id);
  const catById = (id) => state.categories.find((c) => c.id === id);

  const ACTIONS = {
    closeModal,
    modalSave,
    modalDelete() { if (modal && modal.onDelete && modal.onDelete() !== false) closeModal(); },
    link() { /* let the browser follow tel:, mailto: and website links */ },
    togglePw(el) {
      const input = el.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      el.textContent = show ? "Hide" : "Show";
      el.setAttribute("aria-label", show ? "Hide password" : "Show password");
    },
    logout() { if (confirm("Sign out of the planner on this device?")) logout(); },
    changePassword() {
      openForm({
        title: "Change password",
        intro: "Changing your password signs you out on your other devices.",
        fields: [
          { key: "currentPassword", label: "Current password", type: "password", required: true, full: true },
          { key: "newPassword", label: "New password", type: "password", required: true, hint: "At least 8 characters" },
          { key: "confirm", label: "Confirm new password", type: "password", required: true },
        ],
        saveLabel: "Change password",
        onSave(v) {
          if (v.newPassword !== v.confirm) { toast("The new passwords don't match."); return false; }
          api("/api/me", { method: "POST", body: JSON.stringify({ currentPassword: v.currentPassword, newPassword: v.newPassword }) })
            .then((r) => { token = r.token; localStorage.setItem(TOKEN_KEY, token); toast("Password changed"); })
            .catch((e) => { if (e.message !== "unauthorized") toast(e.message); });
        },
      });
    },
    setup: openSetup,
    estimateBudget: openEstimate,
    moreMenu() {
      modal = {};
      renderModal("More", `<ul class="more-sheet">${NAV.filter((n) => !MAIN_MOBILE.includes(n.id) && navAllowed(n)).map((n) => `<li><a href="#/${n.id}">${icon(n.icon)}${n.label}</a></li>`).join("")}
        <li><a href="#" data-act="logout">${icon("users")}Sign out</a></li></ul>`, "");
    },
    print() { window.print(); },

    // Budget
    toggleCat(el) { const id = el.dataset.id; ui.openCats.has(id) ? ui.openCats.delete(id) : ui.openCats.add(id); render(); },
    addCategory() { openCategory(null); },
    editCat(el) { openCategory(catById(el.dataset.cat)); },
    addItem(el) { openItem(catById(el.dataset.cat), null); },
    editItem(el) { const c = catById(el.dataset.cat); openItem(c, byId(c.items, el.dataset.id)); },
    editTotal() {
      openForm({
        title: "Total budget", values: { totalBudget: state.settings.totalBudget },
        fields: [{ key: "totalBudget", label: "Total budget", type: "money", full: true, hint: "Category allowances update automatically." }],
        onSave(v) { state.settings.totalBudget = v.totalBudget; commit(); toast("Budget updated"); },
      });
    },
    fillCat(el) {
      const n = fillEstimates(catById(el.dataset.cat));
      if (!n) { toast("Every item already has a number, or the allowance is used up."); return; }
      commit(); toast(`Suggested estimates added to ${n} item${n === 1 ? "" : "s"}`);
    },
    fillAll() {
      if (!num(state.settings.totalBudget)) { toast("Set a total budget first."); return; }
      if (!confirm("Fill in suggested estimates for items that don't have a number yet? Items you've already priced stay as they are.")) return;
      const n = state.categories.reduce((a, c) => a + fillEstimates(c), 0);
      if (!n) { toast("Nothing to fill in. Every item already has a number."); return; }
      commit(); toast(`Suggested estimates added to ${n} items`);
    },
    applySplit() {
      if (!confirm("Set every category to the suggested percentage? Custom categories are set to 0%.")) return;
      state.categories.forEach((c) => { const d = WP.CATEGORIES.find((x) => x.name === c.name); c.pct = d ? d.pct : 0; });
      commit(); toast("Suggested split applied");
    },
    exportBudget() {
      const rows = [["Category", "Item", "Vendor", "Estimated", "Actual", "Paid", "Balance", "Next due", "Notes"]];
      state.categories.forEach((c) => c.items.forEach((i) => rows.push([c.name, i.name, i.vendor, num(i.est), num(i.actual), itemPaid(i), itemBalance(i), i.due, i.notes])));
      download(`wedding-budget-${isoToday()}.csv`, toCsv(rows), "text/csv;charset=utf-8");
    },
    addForgotten(el) {
      const f = WP.FORGOTTEN[+el.dataset.i];
      const c = findCategory(f.category);
      c.items.push(newItem(f.name, { notes: f.note }));
      commit(); toast(`Added to ${c.name}`);
    },

    // Checklist
    taskFilter(el) { ui.taskFilter = el.dataset.f; render(); },
    addTask() { openTask(null); },
    editTask(el) { openTask(byId(state.tasks, el.dataset.id)); },
    resetTasks() {
      if (!confirm("Replace your checklist with the original template? Custom tasks and check marks will be lost.")) return;
      state.tasks = defaultTasks(); commit(); toast("Checklist reset");
    },

    // Guests
    guestView(el) { ui.guestView = el.dataset.v; render(); },
    guestFilter(el) { ui.guestFilter = el.dataset.f; render(); },
    addGuest() { openGuest(null); },
    editGuest(el) { openGuest(byId(state.guests, el.dataset.id)); },
    bulkGuests: openBulkGuests,
    cycleRsvp(el) {
      const g = byId(state.guests, el.dataset.id);
      g.rsvp = { pending: "yes", yes: "no", no: "pending" }[g.rsvp || "pending"];
      commit();
    },
    exportGuests() {
      const rows = [["Name", "Side", "Group", "Reply", "Meal", "Plus-one", "Plus-one name", "Plus-one meal", "Table", "Dietary needs", "Email", "Phone", "Address", "Gift", "Thank-you sent"]];
      state.guests.forEach((g) => rows.push([g.name, sideLabel(g.side), g.group, (RSVP[g.rsvp] || RSVP.pending)[0], g.meal, g.plusOne ? "Yes" : "No", g.plusOneName, g.plusOneMeal, g.table, g.dietary, g.email, g.phone, g.address, g.gift, g.thankYou ? "Yes" : "No"]));
      download(`wedding-guests-${isoToday()}.csv`, toCsv(rows), "text/csv;charset=utf-8");
    },

    // Vendors
    addVendor(el) { openVendor(null, el.dataset.cat); },
    editVendor(el) { openVendor(byId(state.vendors, el.dataset.id)); },
    vendorQuestions() { openInfo("Questions to ask vendors", questionsHtml()); },
    vendorToBudget(el) {
      const v = byId(state.vendors, el.dataset.id);
      const c = findCategory(VENDOR_TO_CATEGORY[v.category] || "Contingency");
      const item = newItem(`${v.category}: ${v.name}`, { actual: num(v.quote), vendor: v.name });
      c.items.push(item);
      v.budgetItemId = item.id;
      ui.openCats.add(c.id);
      commit(); toast(`Added to ${c.name}`);
    },

    // Timeline
    addEvent() { openEvent(null); },
    editEvent(el) { openEvent(byId(state.timeline, el.dataset.id)); },
    resetTimeline() {
      if (!confirm("Replace your timeline with the template?")) return;
      state.timeline = WP.TIMELINE.map((t) => ({ id: uid(), notes: "", ...t }));
      commit(); toast("Timeline reset");
    },

    // Settings
    saveSettings() {
      const f = $("#settings-form").elements;
      const s = state.settings;
      ["partner1", "partner2", "date", "venue", "city", "mealOptions"].forEach((k) => { s[k] = f[k].value.trim(); });
      s.currency = f.currency.value.trim() || "$";
      s.guestEstimate = num(f.guestEstimate.value);
      s.totalBudget = num(f.totalBudget.value);
      s.setupDone = true;
      commit(); toast("Changes saved");
    },
    exportJson() {
      download(`wedding-plan-backup-${isoToday()}.json`, JSON.stringify(state, null, 2), "application/json");
    },
    resetAll() {
      const typed = prompt('This erases your whole plan. Type ERASE to confirm.');
      if (typed !== "ERASE") return;
      state = defaultState(); ui.openCats.clear();
      commit(); openSetup();
    },
  };

  const CHANGES = {
    toggleTask(el) {
      const t = byId(state.tasks, el.dataset.id);
      if (!t) return;
      t.done = el.checked;
      commit();
      if (t.done) toast("Task done");
    },
    toggleKit(el) { const k = byId(state.kit, el.dataset.id); k.done = el.checked; commit(); },
    async importJson(el) {
      const file = el.files && el.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data || !data.settings || !Array.isArray(data.categories)) throw new Error("bad");
        if (!confirm("Replace your current plan with this backup?")) return;
        state = migrate(data);
        commit(); toast("Backup restored");
      } catch {
        toast("That file isn't a planner backup.");
      } finally {
        el.value = "";
      }
    },
  };

  const INPUTS = {
    taskSearch(el) { ui.taskSearch = el.value; $("#task-list").innerHTML = taskListHtml(); },
    guestSearch(el) { ui.guestSearch = el.value; $("#guest-list").innerHTML = guestListHtml(); },
  };

  /* =========================================================
     Wiring
     ========================================================= */
  document.addEventListener("click", (e) => {
    if (e.target.classList && e.target.classList.contains("modal-backdrop")) { closeModal(); return; }
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    if (el.tagName === "A" && el.getAttribute("href") === "#") e.preventDefault();
    if (!state && !["togglePw"].includes(el.dataset.act)) return;
    fn(el, e);
  });
  document.addEventListener("change", (e) => {
    const el = e.target.closest("[data-change]");
    if (el && state && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el, e);
  });
  document.addEventListener("input", (e) => {
    const el = e.target.closest("[data-input]");
    if (el && state && INPUTS[el.dataset.input]) INPUTS[el.dataset.input](el, e);
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "mform") { e.preventDefault(); modalSave(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal) closeModal();
  });
  window.addEventListener("hashchange", () => {
    closeModal();
    render();
    window.scrollTo(0, 0);
  });
  window.addEventListener("online", () => { if (state) pushSave(); });
  window.addEventListener("beforeunload", (e) => {
    const label = $("#sync-status") ? $("#sync-status").textContent : "";
    if (state && (saving || label === "Saving soon")) { e.preventDefault(); e.returnValue = ""; }
  });

  $("#login-form").addEventListener("submit", handleLogin);
  $("#setup-form").addEventListener("submit", handleSetup);

  // Plugins register views, actions and hooks before the first render
  const core = {
    get state() { return state; },
    get user() { return currentUser; },
    get token() { return token; },
    api, readOnly, isAdmin, ROLE_LABELS,
    ui, NAV, VIEWS, ACTIONS, CHANGES, INPUTS, ICONS, hooks, VENDOR_TO_CATEGORY,
    $, esc, num, uid, clamp, money, money2, pctOf, parseDate, todayStart, diffDays, fmtDate, isoToday, cur,
    icon, bar, pageHead, openForm, openInfo, renderModal, closeModal, toast, commit, render, fieldHtml,
    download, toCsv, catTotals, itemCost, itemPaid, itemBalance, budgetTotals, findCategory, byId, catById,
  };
  (window.WP_PLUGINS || []).forEach((plugin) => plugin(core));

  // Start
  token = localStorage.getItem(TOKEN_KEY);
  if (token) loadData(); else showAuth();
})();
