/* Accounts: a QuickBooks-style ledger for the wedding.
   Accounts, register, bills, reconciliation, reports and CSV import.
   Expense categories are the budget categories, so every payment can roll up into the budget. */
(window.WP_PLUGINS = window.WP_PLUGINS || []).push(function accounting(core) {
  "use strict";
  const { esc, num, uid, money2: m, parseDate, fmtDate, todayStart, diffDays, isoToday, icon, pageHead, openForm, toast, $ } = core;
  const S = () => core.state;
  const B = () => core.state.books;

  /* ---------- Registration ---------- */
  core.ICONS.ledger = '<path d="M6 3h10l3 3v15H6z"/><path d="M9.5 8h6M9.5 12h6M9.5 16h4"/>';
  core.NAV.splice(2, 0, { id: "accounts", label: "Accounts", icon: "ledger" });

  const ACCOUNT_TYPES = [
    { value: "checking", label: "Checking" }, { value: "savings", label: "Savings" },
    { value: "credit", label: "Credit card" }, { value: "cash", label: "Cash" },
  ];
  const DEFAULT_INCOME = ["Couple's savings", "Family contributions", "Cash gifts", "Refunds", "Other income"];
  const CLEARED = { u: "Uncleared", c: "Cleared", r: "Reconciled" };

  function defaultBooks() {
    return {
      accounts: [{ id: uid(), name: "Wedding checking", type: "checking", opening: 0, openingDate: isoToday(), recon: null, archived: false }],
      incomeCats: DEFAULT_INCOME.map((name) => ({ id: uid(), name })),
      txns: [],
      bills: [],
    };
  }
  core.hooks.defaults.push((s) => { s.books = defaultBooks(); });
  core.hooks.migrate.push((s) => {
    const d = defaultBooks();
    if (!s.books || typeof s.books !== "object") s.books = d;
    for (const k of ["accounts", "incomeCats", "txns", "bills"]) if (!Array.isArray(s.books[k])) s.books[k] = d[k];
    if (!s.books.accounts.length) s.books.accounts = d.accounts;
  });

  core.ui.books = { tab: "overview", acct: "all", range: "all", type: "all", q: "", billFilter: "open", report: "pl", from: "", to: "", recon: null };
  const ui = () => core.ui.books;

  /* ---------- Lookups ---------- */
  const acct = (id) => B().accounts.find((a) => a.id === id);
  const activeAccounts = () => B().accounts.filter((a) => !a.archived);
  const isCredit = (a) => a && a.type === "credit";
  const budgetCat = (id) => S().categories.find((c) => c.id === id);
  const incomeCat = (id) => B().incomeCats.find((c) => c.id === id);
  function findItem(itemId) {
    for (const c of S().categories) { const i = c.items.find((x) => x.id === itemId); if (i) return { cat: c, item: i }; }
    return null;
  }
  const typeLabel = (a) => (ACCOUNT_TYPES.find((t) => t.value === a.type) || ACCOUNT_TYPES[0]).label;
  // Show card balances as a positive amount owed
  const shown = (a, v) => (isCredit(a) ? -v : v);

  // Signed effect of a transaction on one account: assets go up with deposits, card debt is negative
  function effect(t, accountId) {
    const amt = num(t.amount);
    if (t.type === "transfer") {
      if (t.accountId === accountId) return -amt;
      if (t.toAccountId === accountId) return amt;
      return 0;
    }
    if (t.accountId !== accountId) return 0;
    return t.type === "income" ? amt : -amt;
  }
  const touches = (t, id) => t.accountId === id || (t.type === "transfer" && t.toAccountId === id);
  const byDate = (a, b) => (a.date || "").localeCompare(b.date || "") || (a.created || 0) - (b.created || 0);

  function balance(a, { clearedOnly = false, through = null } = {}) {
    let b = num(a.opening);
    B().txns.forEach((t) => {
      if (!touches(t, a.id)) return;
      if (clearedOnly && t.cleared !== "c" && t.cleared !== "r") return;
      if (through && t.date > through) return;
      b += effect(t, a.id);
    });
    return Math.round(b * 100) / 100;
  }

  /* ---------- Budget integration ---------- */
  let paidCache = { books: null, version: -1, map: new Map() };
  let version = 0;
  const touched = () => { version++; };
  function paidMap() {
    if (paidCache.books === B() && paidCache.version === version) return paidCache.map;
    const map = new Map();
    B().txns.forEach((t) => {
      if (!t.itemId || t.type === "transfer") return;
      map.set(t.itemId, (map.get(t.itemId) || 0) + (t.type === "expense" ? num(t.amount) : -num(t.amount)));
    });
    paidCache = { books: B(), version, map };
    return map;
  }
  core.hooks.paidFor = (item) => (S() && S().books ? paidMap().get(item.id) || 0 : 0);

  // Expense total for a budget category: expenses in it, minus refunds linked to its items
  function spentByCategory(txns) {
    const itemCat = new Map();
    S().categories.forEach((c) => c.items.forEach((i) => itemCat.set(i.id, c.id)));
    const map = new Map();
    const add = (k, v) => map.set(k, (map.get(k) || 0) + v);
    txns.forEach((t) => {
      if (t.type === "expense") add(t.categoryId || "", num(t.amount));
      else if (t.type === "income" && t.itemId && itemCat.has(t.itemId)) add(itemCat.get(t.itemId), -num(t.amount));
    });
    return map;
  }
  const isRefund = (t) => t.type === "income" && t.itemId && findItem(t.itemId);

  /* ---------- Bills ---------- */
  const billPayments = (b) => B().txns.filter((t) => t.billId === b.id);
  const billPaid = (b) => billPayments(b).reduce((a, t) => a + (t.type === "expense" ? num(t.amount) : -num(t.amount)), 0);
  const billOpen = (b) => Math.max(Math.round((num(b.amount) - billPaid(b)) * 100) / 100, 0);
  function billStatus(b) {
    const open = billOpen(b), due = parseDate(b.dueDate);
    if (open <= 0) return ["Paid", "good"];
    if (due && due < todayStart()) return ["Overdue", "bad"];
    if (billPaid(b) > 0) return ["Partly paid", "gold"];
    if (due && diffDays(due, todayStart()) <= 14) return ["Due soon", "warn"];
    return ["Open", ""];
  }

  core.hooks.insights.push(() => {
    if (!S().books) return [];
    const out = [];
    const overdue = B().bills.filter((b) => billStatus(b)[0] === "Overdue");
    if (overdue.length) out.push({ level: "bad", html: `${overdue.length} vendor bill${overdue.length === 1 ? " is" : "s are"} past due, ${m(overdue.reduce((a, b) => a + billOpen(b), 0))} in total. <a href="#/accounts" data-act="bkGoTab" data-tab="bills">Pay bills</a>` });
    const uncategorized = B().txns.filter((t) => t.type !== "transfer" && !t.categoryId).length;
    if (uncategorized) out.push({ level: "warn", html: `${uncategorized} transaction${uncategorized === 1 ? " needs" : "s need"} a category in Accounts. <a href="#/accounts" data-act="bkGoTab" data-tab="register" data-uncat="1">Review</a>` });
    return out;
  });

  /* ---------- Date ranges ---------- */
  function rangeBounds(key) {
    const t = todayStart(), iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (key === "month") return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)];
    if (key === "30") { const f = new Date(t); f.setDate(f.getDate() - 30); return [iso(f), iso(t)]; }
    if (key === "90") { const f = new Date(t); f.setDate(f.getDate() - 90); return [iso(f), iso(t)]; }
    if (key === "year") return [iso(new Date(t.getFullYear(), 0, 1)), iso(t)];
    return ["", ""];
  }
  const inRange = (date, from, to) => (!from || date >= from) && (!to || date <= to);

  /* ---------- Shared options ---------- */
  const accountOptions = (includeArchivedId) => B().accounts.filter((a) => !a.archived || a.id === includeArchivedId).map((a) => ({ value: a.id, label: `${a.name} (${typeLabel(a)})` }));
  const expenseCatOptions = () => [{ value: "", label: "Uncategorized" }, ...S().categories.map((c) => ({ value: c.id, label: c.name }))];
  const incomeCatOptions = () => [{ value: "", label: "Uncategorized" }, ...B().incomeCats.map((c) => ({ value: c.id, label: c.name }))];
  const itemOptions = (emptyLabel = "Not linked") => [{ value: "", label: emptyLabel }, ...S().categories.flatMap((c) => c.items.map((i) => ({ value: i.id, label: `${c.name}: ${i.name}` })))];
  const payeeList = () => [...new Set([...S().vendors.map((v) => v.name), ...B().txns.map((t) => t.payee), ...B().bills.map((b) => b.vendor)].filter(Boolean))].sort();
  const clearedOptions = [{ value: "u", label: "Uncleared" }, { value: "c", label: "Cleared" }, { value: "r", label: "Reconciled" }];

  function categoryLabel(t) {
    if (t.type === "transfer") return "Transfer";
    const link = t.itemId && findItem(t.itemId);
    if (t.type === "income") {
      if (link) return `Refund: ${link.cat.name}`;
      const c = incomeCat(t.categoryId);
      return c ? c.name : "Uncategorized";
    }
    const c = budgetCat(t.categoryId);
    return c ? c.name : "Uncategorized";
  }

  /* =========================================================
     Views
     ========================================================= */
  const TABS = [["overview", "Overview"], ["register", "Register"], ["bills", "Bills"], ["reconcile", "Reconcile"], ["reports", "Reports"], ["setup", "Chart of accounts"]];

  core.VIEWS.accounts = () => {
    const u = ui();
    return `
      ${pageHead("Accounts", "Record money in and out, pay vendor bills, reconcile statements and run reports. Payments linked to budget items show as paid on the Budget page.",
        `<button class="btn" data-act="bkNewTxn" data-type="transfer">Transfer</button>
         <button class="btn" data-act="bkNewTxn" data-type="income">${icon("plus")}Money in</button>
         <button class="btn primary" data-act="bkNewTxn" data-type="expense">${icon("plus")}Expense</button>`)}
      <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button class="tab ${u.tab === k ? "active" : ""}" role="tab" aria-selected="${u.tab === k}" data-act="bkTab" data-tab="${k}">${l}</button>`).join("")}</div>
      ${TAB_VIEWS[u.tab]()}`;
  };

  const TAB_VIEWS = {
    overview() {
      const accts = activeAccounts();
      const cash = accts.filter((a) => !isCredit(a)).reduce((s, a) => s + balance(a), 0);
      const owed = accts.filter(isCredit).reduce((s, a) => s - balance(a), 0);
      const txns = B().txns;
      const received = txns.filter((t) => t.type === "income" && !isRefund(t)).reduce((s, t) => s + num(t.amount), 0);
      const spent = [...spentByCategory(txns).values()].reduce((s, v) => s + v, 0);
      const openBills = B().bills.filter((b) => billOpen(b) > 0).sort((a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9"));
      const recent = [...txns].sort(byDate).reverse().slice(0, 8);
      const uncategorized = txns.filter((t) => t.type !== "transfer" && !t.categoryId && !(t.type === "income" && t.itemId)).length;
      const unlinked = txns.filter((t) => t.type === "expense" && !t.itemId).length;
      const stale = txns.filter((t) => t.cleared === "u" && t.date && diffDays(todayStart(), parseDate(t.date)) > 30).length;

      return `
        <div class="stats">
          <div class="stat"><div class="stat-label">Cash on hand</div><div class="stat-value">${m(cash)}</div><div class="stat-note">Checking, savings and cash</div></div>
          <div class="stat"><div class="stat-label">Owed on cards</div><div class="stat-value ${owed > 0 ? "neg" : ""}">${m(owed)}</div><div class="stat-note">Credit card balances</div></div>
          <div class="stat"><div class="stat-label">Money received</div><div class="stat-value">${m(received)}</div><div class="stat-note">Savings, contributions and gifts</div></div>
          <div class="stat"><div class="stat-label">Spent</div><div class="stat-value">${m(spent)}</div><div class="stat-note">${m(openBills.reduce((s, b) => s + billOpen(b), 0))} in open bills</div></div>
        </div>
        <div class="grid-2">
          <section class="panel">
            <div class="panel-head"><h2>Bank and card accounts</h2><button class="btn small" data-act="bkEditAccount">${icon("plus")}Account</button></div>
            <ul class="mini-list">${accts.map((a) => {
              const bal = balance(a), cl = balance(a, { clearedOnly: true });
              return `<li><div class="grow"><button class="link-btn strong-link" data-act="bkOpenRegister" data-id="${a.id}">${esc(a.name)}</button>
                <div class="sub">${typeLabel(a)}${a.recon ? `, reconciled through ${esc(fmtDate(parseDate(a.recon.date)))}` : ", not reconciled yet"}</div></div>
                <div class="num-col"><strong>${m(shown(a, bal))}</strong><div class="sub">${m(shown(a, cl))} cleared</div></div></li>`;
            }).join("")}</ul>
          </section>
          <section class="panel">
            <div class="panel-head"><h2>Bills to pay</h2><button class="btn small" data-act="bkEditBill">${icon("plus")}Bill</button></div>
            ${openBills.length ? `<ul class="mini-list">${openBills.slice(0, 6).map((b) => {
              const [label, cls] = billStatus(b);
              return `<li><div class="grow"><div>${esc(b.vendor)}</div><div class="sub">${b.dueDate ? `Due ${esc(fmtDate(parseDate(b.dueDate)))}` : "No due date"} <span class="pill ${cls}">${label}</span></div></div>
                <div class="num-col"><strong>${m(billOpen(b))}</strong><div><button class="btn small" data-act="bkPayBill" data-id="${b.id}">Pay</button></div></div></li>`;
            }).join("")}</ul>` : `<p class="empty">No open bills. Enter vendor invoices here to track what's due and pay them from an account.</p>`}
          </section>
        </div>
        <div class="grid-2" style="margin-top:16px">
          <section class="panel">
            <div class="panel-head"><h2>Recent transactions</h2><button class="link-btn small" data-act="bkTab" data-tab="register">Open register</button></div>
            ${recent.length ? `<ul class="mini-list">${recent.map((t) => `<li class="clickable" data-act="bkEditTxn" data-id="${t.id}">
              <div class="grow"><div>${esc(t.payee || (t.type === "transfer" ? "Transfer" : "No payee"))}</div><div class="sub">${esc(fmtDate(parseDate(t.date)))}, ${esc(categoryLabel(t))}</div></div>
              <div class="num-col ${t.type === "income" ? "pos" : ""}">${t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}${m(t.amount)}</div></li>`).join("")}</ul>`
              : `<p class="empty">No transactions yet. Record an expense, money coming in, or import a bank CSV.</p>`}
          </section>
          <section class="panel">
            <h2>Needs attention</h2>
            <ul class="insights">
              ${uncategorized ? `<li><span class="dot warn"></span><div>${uncategorized} transaction${uncategorized === 1 ? " has" : "s have"} no category. <button class="link-btn" data-act="bkShowUncategorized">Review them</button></div></li>` : ""}
              ${unlinked ? `<li><span class="dot"></span><div>${unlinked} expense${unlinked === 1 ? " isn't" : "s aren't"} linked to a budget item. Link them so the Budget page shows what's paid.</div></li>` : ""}
              ${stale ? `<li><span class="dot warn"></span><div>${stale} transaction${stale === 1 ? " has" : "s have"} been uncleared for over 30 days. Check them against your statement.</div></li>` : ""}
              ${B().bills.some((b) => billStatus(b)[0] === "Overdue") ? `<li><span class="dot bad"></span><div>Some bills are past due. <button class="link-btn" data-act="bkTab" data-tab="bills">See bills</button></div></li>` : ""}
              ${!uncategorized && !unlinked && !stale ? `<li><span class="dot good"></span><div>Your books are in good shape.</div></li>` : ""}
              <li><span class="dot"></span><div>Import transactions from your bank's CSV download. <button class="link-btn" data-act="bkImport">Import CSV</button></div></li>
            </ul>
          </section>
        </div>`;
    },

    register() {
      const u = ui();
      return `
        <div class="toolbar reg-filters">
          <select data-change="bkFilter" data-key="acct" aria-label="Account">
            <option value="all">All accounts</option>
            ${B().accounts.map((a) => `<option value="${a.id}" ${u.acct === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}
          </select>
          <select data-change="bkFilter" data-key="type" aria-label="Type">
            ${[["all", "All types"], ["expense", "Expenses"], ["income", "Money in"], ["transfer", "Transfers"], ["uncat", "Uncategorized"], ["uncleared", "Uncleared"]].map(([k, l]) => `<option value="${k}" ${u.type === k ? "selected" : ""}>${l}</option>`).join("")}
          </select>
          <select data-change="bkFilter" data-key="range" aria-label="Dates">
            ${[["all", "All dates"], ["month", "This month"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["year", "This year"]].map(([k, l]) => `<option value="${k}" ${u.range === k ? "selected" : ""}>${l}</option>`).join("")}
          </select>
          <input type="search" class="search" placeholder="Search payee, memo, ref" value="${esc(u.q)}" data-input="bkSearch" aria-label="Search transactions"/>
          <button class="btn" data-act="bkExportRegister">Export CSV</button>
          <button class="btn" data-act="bkImport">Import CSV</button>
        </div>
        <div id="bk-register">${registerHtml()}</div>`;
    },

    bills() {
      const u = ui();
      const list = B().bills
        .filter((b) => u.billFilter === "all" || (u.billFilter === "open" ? billOpen(b) > 0 : billOpen(b) <= 0))
        .sort((a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9"));
      const openTotal = B().bills.reduce((s, b) => s + billOpen(b), 0);
      return `
        <div class="toolbar" style="margin-bottom:14px">
          <div class="filters">${[["open", "Open"], ["paid", "Paid"], ["all", "All"]].map(([k, l]) => `<button class="chip ${u.billFilter === k ? "active" : ""}" data-act="bkBillFilter" data-f="${k}">${l}</button>`).join("")}</div>
          <span class="muted">${m(openTotal)} still to pay</span>
          <button class="btn primary" data-act="bkEditBill" style="margin-left:auto">${icon("plus")}Bill</button>
        </div>
        ${list.length ? `<div class="list">${list.map((b) => {
          const [label, cls] = billStatus(b), link = b.itemId && findItem(b.itemId), open = billOpen(b);
          return `<div class="list-row" data-act="bkEditBill" data-id="${b.id}">
            <div class="list-main">
              <div class="list-title">${esc(b.vendor)}${b.ref ? ` <span class="muted small">#${esc(b.ref)}</span>` : ""}</div>
              <div class="list-sub">${[link ? `${link.cat.name}: ${link.item.name}` : budgetCat(b.categoryId)?.name, b.dueDate ? `Due ${fmtDate(parseDate(b.dueDate))}` : ""].filter(Boolean).map(esc).join(", ")}</div>
            </div>
            <div class="list-side">
              <div class="num-col"><strong>${m(b.amount)}</strong>${open > 0 && open < num(b.amount) ? `<div class="sub">${m(open)} left</div>` : ""}</div>
              <span class="pill ${cls}">${label}</span>
              ${open > 0 ? `<button class="btn small primary" data-act="bkPayBill" data-id="${b.id}">Pay</button>` : ""}
            </div>
          </div>`;
        }).join("")}</div>` : `<p class="empty">${u.billFilter === "open" ? "No open bills. Add a vendor invoice or deposit request to track what's due." : "No bills to show."}</p>`}`;
    },

    reconcile() {
      const r = ui().recon;
      if (!r) {
        return `
          <section class="panel">
            <h2>Reconcile an account</h2>
            <p class="muted">Match your records to a bank or card statement. Check off each transaction that appears on the statement until the difference is zero.</p>
            <form id="recon-start" class="form-grid" onsubmit="return false">
              ${core.fieldHtml({ key: "accountId", label: "Account", type: "select", options: accountOptions() }, {})}
              ${core.fieldHtml({ key: "date", label: "Statement ending date", type: "date" }, { date: isoToday() })}
              ${core.fieldHtml({ key: "ending", label: "Statement ending balance", type: "money", hint: "For credit cards, enter the balance owed." }, {})}
            </form>
            <button class="btn primary" data-act="bkReconStart">Start reconciling</button>
          </section>
          <section class="panel">
            <h2>Reconciliation history</h2>
            <ul class="mini-list">${B().accounts.map((a) => `<li><div class="grow">${esc(a.name)}</div><div class="num-col">${a.recon ? `${m(shown(a, a.recon.balance))}<div class="sub">through ${esc(fmtDate(parseDate(a.recon.date)))}</div>` : `<span class="muted">Never reconciled</span>`}</div></li>`).join("")}</ul>
          </section>`;
      }
      const a = acct(r.accountId);
      const rows = B().txns.filter((t) => touches(t, a.id) && t.cleared !== "r" && t.date <= r.date).sort(byDate);
      const cleared = balance(a, { clearedOnly: true, through: r.date });
      const diff = Math.round((r.ending - cleared) * 100) / 100;
      const begin = num(a.opening) + B().txns.filter((t) => touches(t, a.id) && t.cleared === "r").reduce((s, t) => s + effect(t, a.id), 0);
      let ins = 0, outs = 0;
      rows.forEach((t) => { if (t.cleared === "c") { const e = effect(t, a.id); if (e > 0) ins += e; else outs -= e; } });
      return `
        <section class="panel recon-summary">
          <div class="panel-head"><h2>${esc(a.name)}, statement ending ${esc(fmtDate(parseDate(r.date)))}</h2><button class="btn small ghost" data-act="bkReconCancel">Cancel</button></div>
          <div class="summary-row recon-row">
            <div><div class="k">Beginning balance</div><div class="v">${m(shown(a, begin))}</div></div>
            <div><div class="k">${isCredit(a) ? "Payments and credits" : "Deposits"} checked</div><div class="v">${m(ins)}</div></div>
            <div><div class="k">${isCredit(a) ? "Charges" : "Payments"} checked</div><div class="v">${m(outs)}</div></div>
            <div><div class="k">Cleared balance</div><div class="v">${m(shown(a, cleared))}</div></div>
            <div><div class="k">Statement balance</div><div class="v">${m(shown(a, r.ending))}</div></div>
            <div><div class="k">Difference</div><div class="v ${diff === 0 ? "good" : "bad"}">${m(Math.abs(diff))}</div></div>
          </div>
          <div class="toolbar">
            <button class="btn" data-act="bkReconAll">Check all</button>
            <button class="btn" data-act="bkReconNone">Uncheck all</button>
            <button class="btn" data-act="bkNewTxn" data-type="expense" data-acct="${a.id}">Add missing transaction</button>
            <button class="btn primary" data-act="bkReconFinish" ${diff === 0 ? "" : "disabled"}>Finish reconciling</button>
          </div>
          ${diff !== 0 ? `<p class="muted small" style="margin:10px 0 0">When the difference reaches ${m(0)}, you can finish. Look for missing transactions, wrong amounts or items that aren't on this statement.</p>` : ""}
        </section>
        ${rows.length ? `<div class="list" style="margin-top:12px">${rows.map((t) => {
          const e = effect(t, a.id);
          return `<label class="list-row recon-line">
            <span class="recon-check"><input type="checkbox" data-change="bkReconToggle" data-id="${t.id}" ${t.cleared === "c" ? "checked" : ""}/>
              <span class="list-main"><span class="list-title">${esc(t.payee || categoryLabel(t))}</span><span class="list-sub">${esc(fmtDate(parseDate(t.date)))}${t.ref ? `, #${esc(t.ref)}` : ""}, ${esc(categoryLabel(t))}</span></span></span>
            <span class="num-col ${e > 0 ? "pos" : ""}">${e > 0 ? "+" : "-"}${m(Math.abs(e))}</span>
          </label>`;
        }).join("")}</div>` : `<p class="empty">No unreconciled transactions on or before this date.</p>`}`;
    },

    reports() {
      const u = ui();
      const reports = [["pl", "Money in and out"], ["bva", "Budget vs. actual"], ["vendor", "Spending by vendor"], ["monthly", "Monthly cash flow"], ["balances", "Account balances"], ["sources", "Money received by source"]];
      const rep = REPORTS[u.report]();
      return `
        <div class="toolbar no-print" style="margin-bottom:12px">
          <select data-change="bkReport" aria-label="Report">${reports.map(([k, l]) => `<option value="${k}" ${u.report === k ? "selected" : ""}>${l}</option>`).join("")}</select>
          ${rep.dated ? `<label class="inline-field">From <input type="date" value="${esc(u.from)}" data-change="bkReportDate" data-key="from"/></label>
          <label class="inline-field">To <input type="date" value="${esc(u.to)}" data-change="bkReportDate" data-key="to"/></label>
          ${u.from || u.to ? `<button class="btn small ghost" data-act="bkReportClear">All dates</button>` : ""}` : ""}
          <button class="btn" data-act="bkExportReport" style="margin-left:auto">Export CSV</button>
          <button class="btn" data-act="print">Print</button>
        </div>
        <section class="panel report">
          <div class="report-head">
            <h2>${esc(rep.title)}</h2>
            <p class="muted small">${esc([S().settings.partner1, S().settings.partner2].filter(Boolean).join(" & ") || "Our wedding")}, ${rep.dated ? (u.from || u.to ? `${u.from ? fmtDate(parseDate(u.from)) : "Beginning"} to ${u.to ? fmtDate(parseDate(u.to)) : "today"}` : "all dates") : `as of ${fmtDate(todayStart())}`}</p>
          </div>
          ${rep.html}
        </section>`;
    },

    setup() {
      const spent = spentByCategory(B().txns);
      const used = (id) => B().txns.some((t) => t.categoryId === id);
      return `
        <section class="panel">
          <div class="panel-head"><h2>Bank, card and cash accounts</h2><button class="btn small primary" data-act="bkEditAccount">${icon("plus")}Account</button></div>
          <table class="ledger simple">
            <thead><tr><th>Name</th><th>Type</th><th class="num">Opening</th><th class="num">Balance</th><th></th></tr></thead>
            <tbody>${B().accounts.map((a) => `<tr class="row" data-act="bkEditAccount" data-id="${a.id}">
              <td>${esc(a.name)}${a.archived ? ' <span class="pill">Archived</span>' : ""}</td><td>${typeLabel(a)}</td>
              <td class="num">${m(shown(a, a.opening))}</td><td class="num">${m(shown(a, balance(a)))}</td><td class="num"><span class="muted small">Edit</span></td></tr>`).join("")}</tbody>
          </table>
        </section>
        <div class="grid-2" style="margin-top:16px">
          <section class="panel">
            <div class="panel-head"><h2>Income categories</h2><button class="btn small" data-act="bkEditIncomeCat">${icon("plus")}Category</button></div>
            <ul class="mini-list">${B().incomeCats.map((c) => `<li class="clickable" data-act="bkEditIncomeCat" data-id="${c.id}"><div class="grow">${esc(c.name)}</div>
              <div class="num-col">${m(B().txns.filter((t) => t.type === "income" && t.categoryId === c.id).reduce((s, t) => s + num(t.amount), 0))}${used(c.id) ? "" : `<div class="sub">Unused</div>`}</div></li>`).join("")}</ul>
          </section>
          <section class="panel">
            <div class="panel-head"><h2>Expense categories</h2><a class="small" href="#/budget">Edit on Budget</a></div>
            <p class="muted small" style="margin-top:-6px">Expense categories are your budget categories, so spending lines up with the budget automatically.</p>
            <ul class="mini-list">${S().categories.map((c) => `<li><div class="grow">${esc(c.name)}</div><div class="num-col">${m(spent.get(c.id) || 0)}</div></li>`).join("")}
              ${spent.get("") ? `<li><div class="grow">Uncategorized</div><div class="num-col">${m(spent.get(""))}</div></li>` : ""}</ul>
          </section>
        </div>`;
    },
  };

  /* ---------- Register ---------- */
  function registerRows() {
    const u = ui();
    const [from, to] = rangeBounds(u.range);
    const q = u.q.toLowerCase();
    const single = u.acct !== "all" ? acct(u.acct) : null;

    // Running balances are calculated across all of an account's history, oldest first
    const running = new Map();
    if (single) {
      let b = num(single.opening);
      B().txns.filter((t) => touches(t, single.id)).sort(byDate).forEach((t) => { b += effect(t, single.id); running.set(t.id, b); });
    }
    const rows = B().txns.filter((t) => {
      if (single && !touches(t, single.id)) return false;
      if (!inRange(t.date || "", from, to)) return false;
      if (u.type === "uncat") { if (t.type === "transfer" || t.categoryId || (t.type === "income" && t.itemId)) return false; }
      else if (u.type === "uncleared") { if (t.cleared !== "u") return false; }
      else if (u.type !== "all" && t.type !== u.type) return false;
      if (q && !`${t.payee} ${t.memo} ${t.ref} ${categoryLabel(t)}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort(byDate).reverse();
    return { rows, single, running };
  }

  function registerHtml() {
    const { rows, single, running } = registerRows();
    if (!B().txns.length) return `<p class="empty">No transactions yet. Use Expense or Money in above, or import a CSV from your bank.</p>`;
    if (!rows.length) return `<p class="empty">No transactions match these filters.</p>`;
    let pay = 0, dep = 0;
    const body = rows.map((t) => {
      const acctId = single ? single.id : t.accountId;
      const e = single ? effect(t, single.id) : (t.type === "income" ? num(t.amount) : t.type === "expense" ? -num(t.amount) : 0);
      if (e < 0) pay -= e; else dep += e;
      const a = acct(t.accountId), to = acct(t.toAccountId);
      const payee = t.type === "transfer"
        ? (single && t.toAccountId === single.id ? `Transfer from ${a ? a.name : "?"}` : `Transfer to ${to ? to.name : "?"}`)
        : (t.payee || "");
      const cl = t.cleared || "u";
      return `<tr class="row" data-act="bkEditTxn" data-id="${t.id}">
        <td class="l-date">${esc(fmtDate(parseDate(t.date)))}</td>
        <td class="l-hide">${esc(t.ref || "")}</td>
        <td class="l-payee">${esc(payee) || '<span class="muted">No payee</span>'}<div class="l-sub"><span class="mob-only">${esc(single ? categoryLabel(t) : `${a ? a.name : ""}, ${categoryLabel(t)}`)}</span>${t.memo ? `<span>${esc(t.memo)}</span>` : ""}</div></td>
        <td class="l-hide l-cat">${esc(categoryLabel(t))}${!t.categoryId && t.type !== "transfer" && !(t.type === "income" && t.itemId) ? ' <span class="pill warn">Needs category</span>' : ""}</td>
        ${single ? "" : `<td class="l-hide">${esc(a ? a.name : "")}</td>`}
        <td class="num l-hide">${e < 0 ? m(-e) : ""}</td>
        <td class="num l-hide pos">${e > 0 ? m(e) : ""}</td>
        <td class="l-amt num ${e > 0 ? "pos" : ""}">${e > 0 ? "+" : "-"}${m(Math.abs(e))}</td>
        <td class="l-clr"><button class="clr ${cl}" data-act="bkCycleCleared" data-id="${t.id}" title="${CLEARED[cl]}" aria-label="${CLEARED[cl]}">${cl === "u" ? "" : cl.toUpperCase()}</button></td>
        ${single ? `<td class="num l-hide">${m(shown(single, running.get(t.id)))}</td>` : ""}
      </tr>`;
    }).join("");
    return `
      <div class="table-wrap"><table class="ledger">
        <thead><tr><th>Date</th><th class="l-hide">Ref</th><th>Payee</th><th class="l-hide">Category</th>${single ? "" : '<th class="l-hide">Account</th>'}
          <th class="num l-hide">${single && isCredit(single) ? "Charge" : "Payment"}</th><th class="num l-hide">${single && isCredit(single) ? "Payment" : "Deposit"}</th><th class="l-amt"></th><th title="Cleared status">C</th>${single ? `<th class="num l-hide">${isCredit(single) ? "Owed" : "Balance"}</th>` : ""}</tr></thead>
        <tbody>${body}</tbody>
      </table></div>
      <div class="register-foot">
        <span>${rows.length} transaction${rows.length === 1 ? "" : "s"}</span>
        <span>Out ${m(pay)}</span><span class="pos">In ${m(dep)}</span>
        ${single ? `<strong>${isCredit(single) ? "Owed" : "Balance"} ${m(shown(single, balance(single)))}</strong>` : ""}
      </div>
      <p class="muted small">C column: blank is uncleared, C is cleared, R is reconciled. Tap to mark cleared.</p>`;
  }

  /* ---------- Reports ---------- */
  const reportTxns = () => {
    const { from, to } = ui();
    return B().txns.filter((t) => inRange(t.date || "", from, to));
  };
  const table = (head, rows, foot) => `
    <div class="table-wrap"><table class="ledger report-table">
      <thead><tr>${head.map((h, i) => `<th class="${i ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr class="${r.cls || ""}">${r.cells.map((c, i) => `<td class="${i ? "num" : ""}">${c}</td>`).join("")}</tr>`).join("")}</tbody>
      ${foot ? `<tfoot><tr>${foot.map((c, i) => `<td class="${i ? "num" : ""}">${c}</td>`).join("")}</tr></tfoot>` : ""}
    </table></div>`;

  const REPORTS = {
    pl() {
      const txns = reportTxns();
      const income = new Map();
      txns.filter((t) => t.type === "income" && !isRefund(t)).forEach((t) => {
        const k = incomeCat(t.categoryId)?.name || "Uncategorized";
        income.set(k, (income.get(k) || 0) + num(t.amount));
      });
      const spent = spentByCategory(txns);
      const expRows = [...spent.entries()].filter(([, v]) => v).map(([id, v]) => [budgetCat(id)?.name || "Uncategorized", v]).sort((a, b) => b[1] - a[1]);
      const inRows = [...income.entries()].sort((a, b) => b[1] - a[1]);
      const tIn = inRows.reduce((s, r) => s + r[1], 0), tOut = expRows.reduce((s, r) => s + r[1], 0), net = tIn - tOut;
      const csv = [["Section", "Category", "Amount"], ...inRows.map(([k, v]) => ["Money in", k, v.toFixed(2)]), ["Money in", "Total", tIn.toFixed(2)],
        ...expRows.map(([k, v]) => ["Spending", k, v.toFixed(2)]), ["Spending", "Total", tOut.toFixed(2)], ["", "Net", net.toFixed(2)]];
      return {
        title: "Money in and out", dated: true, csv,
        html: `
          <h3 class="report-section">Money in</h3>
          ${inRows.length ? table(["Source", "Amount"], inRows.map(([k, v]) => ({ cells: [esc(k), m(v)] })), ["Total money in", m(tIn)]) : '<p class="empty">No money recorded coming in.</p>'}
          <h3 class="report-section">Spending</h3>
          ${expRows.length ? table(["Category", "Amount"], expRows.map(([k, v]) => ({ cells: [esc(k), m(v)] })), ["Total spending", m(tOut)]) : '<p class="empty">No spending recorded.</p>'}
          <div class="net-line ${net < 0 ? "neg" : "pos"}"><span>${net < 0 ? "Spent more than received" : "Received more than spent"}</span><strong>${m(Math.abs(net))}</strong></div>
          <p class="muted small">Refunds linked to a budget item reduce that category's spending. Transfers between your accounts aren't counted.</p>`,
      };
    },

    bva() {
      const spent = spentByCategory(B().txns);
      let tA = 0, tC = 0, tP = 0;
      const rows = S().categories.map((c) => {
        const ct = core.catTotals(c), paid = spent.get(c.id) || 0;
        tA += ct.alloc; tC += ct.projected; tP += paid;
        return { c, alloc: ct.alloc, committed: ct.projected, paid, left: ct.alloc - ct.projected, owed: Math.max(ct.projected - paid, 0) };
      });
      const csv = [["Category", "Budget", "Committed", "Paid in Accounts", "Left in budget", "Still owed"], ...rows.map((r) => [r.c.name, r.alloc.toFixed(2), r.committed.toFixed(2), r.paid.toFixed(2), r.left.toFixed(2), r.owed.toFixed(2)])];
      return {
        title: "Budget vs. actual", dated: false, csv,
        html: `${table(["Category", "Budget", "Committed", "Paid", "Left in budget", "Still owed"],
          rows.map((r) => ({ cls: r.left < 0 ? "over" : "", cells: [esc(r.c.name), m(r.alloc), m(r.committed), m(r.paid), `<span class="${r.left < 0 ? "neg" : ""}">${r.left < 0 ? "-" : ""}${m(Math.abs(r.left))}</span>`, m(r.owed)] })),
          ["Total", m(tA), m(tC), m(tP), `<span class="${tA - tC < 0 ? "neg" : ""}">${m(tA - tC)}</span>`, m(Math.max(tC - tP, 0))])}
          <p class="muted small">Committed is each category's actual or estimated cost from the Budget page. Paid counts transactions in Accounts only.</p>`,
      };
    },

    vendor() {
      const map = new Map();
      reportTxns().filter((t) => t.type === "expense").forEach((t) => {
        const k = t.payee || "No payee";
        const e = map.get(k) || { n: 0, total: 0, last: "" };
        e.n++; e.total += num(t.amount); if ((t.date || "") > e.last) e.last = t.date;
        map.set(k, e);
      });
      const rows = [...map.entries()].sort((a, b) => b[1].total - a[1].total);
      const total = rows.reduce((s, [, e]) => s + e.total, 0);
      return {
        title: "Spending by vendor", dated: true,
        csv: [["Vendor", "Payments", "Last payment", "Total"], ...rows.map(([k, e]) => [k, e.n, e.last, e.total.toFixed(2)])],
        html: rows.length ? table(["Vendor", "Payments", "Last payment", "Total"], rows.map(([k, e]) => ({ cells: [esc(k), e.n, esc(fmtDate(parseDate(e.last))), m(e.total)] })), ["Total", rows.reduce((s, [, e]) => s + e.n, 0), "", m(total)]) : '<p class="empty">No expenses in this period.</p>',
      };
    },

    monthly() {
      const map = new Map();
      reportTxns().forEach((t) => {
        if (t.type === "transfer" || !t.date) return;
        const k = t.date.slice(0, 7);
        const e = map.get(k) || { in: 0, out: 0 };
        if (t.type === "income" && !isRefund(t)) e.in += num(t.amount);
        else if (t.type === "income") e.out -= num(t.amount);
        else e.out += num(t.amount);
        map.set(k, e);
      });
      const rows = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      const max = Math.max(1, ...rows.map(([, e]) => Math.max(e.in, e.out)));
      let run = 0;
      const label = (k) => { const [y, mo] = k.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" }); };
      return {
        title: "Monthly cash flow", dated: true,
        csv: [["Month", "Money in", "Money out", "Net", "Running net"], ...rows.map(([k, e]) => { run += e.in - e.out; return [k, e.in.toFixed(2), e.out.toFixed(2), (e.in - e.out).toFixed(2), run.toFixed(2)]; })],
        html: rows.length ? (() => { run = 0; return `
          <div class="flow">${rows.map(([k, e]) => `<div class="flow-row"><span class="flow-label">${esc(label(k))}</span>
            <span class="flow-bars"><span class="flow-in" style="width:${(e.in / max) * 100}%"></span><span class="flow-out" style="width:${(Math.max(e.out, 0) / max) * 100}%"></span></span></div>`).join("")}
            <div class="flow-legend"><span><i class="flow-in"></i>Money in</span><span><i class="flow-out"></i>Money out</span></div></div>
          ${table(["Month", "Money in", "Money out", "Net", "Running net"], rows.map(([k, e]) => { run += e.in - e.out; return { cells: [esc(label(k)), m(e.in), m(e.out), `<span class="${e.in - e.out < 0 ? "neg" : "pos"}">${m(e.in - e.out)}</span>`, m(run)] }; }))}`; })()
          : '<p class="empty">No activity in this period.</p>',
      };
    },

    balances() {
      const rows = B().accounts.map((a) => ({ a, bal: shown(a, balance(a)), cl: shown(a, balance(a, { clearedOnly: true })) }));
      return {
        title: "Account balances", dated: false,
        csv: [["Account", "Type", "Balance", "Cleared balance", "Reconciled through"], ...rows.map((r) => [r.a.name, typeLabel(r.a), r.bal.toFixed(2), r.cl.toFixed(2), r.a.recon ? r.a.recon.date : ""])],
        html: table(["Account", "Type", "Balance", "Cleared", "Reconciled through"], rows.map((r) => ({ cells: [esc(r.a.name), typeLabel(r.a), m(r.bal), m(r.cl), r.a.recon ? esc(fmtDate(parseDate(r.a.recon.date))) : "Never"] })))
          + '<p class="muted small">Credit card balances show the amount owed.</p>',
      };
    },

    sources() {
      const map = new Map();
      reportTxns().filter((t) => t.type === "income" && !isRefund(t)).forEach((t) => {
        const k = t.payee || "Not specified";
        const e = map.get(k) || { cat: incomeCat(t.categoryId)?.name || "Uncategorized", n: 0, total: 0 };
        e.n++; e.total += num(t.amount); map.set(k, e);
      });
      const rows = [...map.entries()].sort((a, b) => b[1].total - a[1].total);
      const total = rows.reduce((s, [, e]) => s + e.total, 0);
      return {
        title: "Money received by source", dated: true,
        csv: [["Received from", "Category", "Times", "Total"], ...rows.map(([k, e]) => [k, e.cat, e.n, e.total.toFixed(2)])],
        html: rows.length ? table(["Received from", "Category", "Times", "Total"], rows.map(([k, e]) => ({ cells: [esc(k), esc(e.cat), e.n, m(e.total)] })), ["Total", "", "", m(total)])
          + '<p class="muted small">Handy for thank-you notes and knowing who contributed what.</p>' : '<p class="empty">No money received in this period.</p>',
      };
    },
  };

  /* =========================================================
     Forms
     ========================================================= */
  function openTxn(txn, type, presetAccount, preset = {}) {
    const isNew = !txn;
    type = txn ? txn.type : type;
    if (!activeAccounts().length) { toast("Add a bank, card or cash account first."); return; }
    const defaults = { date: isoToday(), accountId: presetAccount || (ui().acct !== "all" && acct(ui().acct) ? ui().acct : activeAccounts()[0].id), cleared: "u", ...preset };
    const values = txn ? { ...txn } : defaults;
    const common = [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "amount", label: "Amount", type: "money", required: true },
    ];
    let fields, title;
    if (type === "expense") {
      title = isNew ? "Record an expense" : "Edit expense";
      fields = [...common,
        { key: "accountId", label: "Paid from", type: "select", options: accountOptions(values.accountId) },
        { key: "payee", label: "Payee", list: payeeList(), placeholder: "Vendor or store" },
        { key: "itemId", label: "Budget item", type: "select", options: itemOptions(), hint: "Linking marks this amount as paid on the Budget page.", full: true },
        { key: "categoryId", label: "Category", type: "select", options: expenseCatOptions(), hint: "Filled in from the budget item when linked." },
        { key: "ref", label: "Check or reference #" },
        { key: "cleared", label: "Status", type: "select", options: clearedOptions },
        { key: "receipt", label: "Receipt link", type: "url", placeholder: "Link to a photo or PDF" },
        { key: "memo", label: "Memo", type: "textarea", rows: 2 }];
    } else if (type === "income") {
      title = isNew ? "Record money in" : "Edit money in";
      fields = [...common,
        { key: "accountId", label: "Deposited to", type: "select", options: accountOptions(values.accountId) },
        { key: "payee", label: "Received from", list: payeeList(), placeholder: "e.g. Mom and Dad" },
        { key: "categoryId", label: "Category", type: "select", options: incomeCatOptions() },
        { key: "itemId", label: "Refund for a budget item", type: "select", options: itemOptions("Not a refund"), hint: "Choose an item if a vendor refunded money. It reduces what's paid on that item." },
        { key: "ref", label: "Reference #" },
        { key: "cleared", label: "Status", type: "select", options: clearedOptions },
        { key: "memo", label: "Memo", type: "textarea", rows: 2 }];
    } else {
      title = isNew ? "Transfer between accounts" : "Edit transfer";
      fields = [...common,
        { key: "accountId", label: "From", type: "select", options: accountOptions(values.accountId) },
        { key: "toAccountId", label: "To", type: "select", options: accountOptions(values.toAccountId), hint: "Paying a credit card is a transfer from checking to the card." },
        { key: "cleared", label: "Status", type: "select", options: clearedOptions },
        { key: "memo", label: "Memo", type: "textarea", rows: 2 }];
      if (!values.toAccountId) values.toAccountId = (B().accounts.find((a) => a.id !== values.accountId && !a.archived) || {}).id;
    }
    const bill = txn && txn.billId && B().bills.find((b) => b.id === txn.billId);
    openForm({
      title,
      intro: [bill ? `Payment on the bill from ${esc(bill.vendor)}.` : "", txn && txn.cleared === "r" ? "This transaction is reconciled. Changing the amount or date will affect your reconciled balance." : "", txn && txn.receipt ? `<a href="${esc(txn.receipt)}" target="_blank" rel="noopener">Open receipt</a>` : ""].filter(Boolean).join(" "),
      values, fields,
      saveLabel: isNew ? "Save transaction" : "Save changes",
      onSave(v) {
        if (num(v.amount) <= 0) { toast("Enter an amount greater than zero."); return false; }
        if (type === "transfer" && v.accountId === v.toAccountId) { toast("Choose two different accounts."); return false; }
        if (type === "expense" && v.itemId) { const link = findItem(v.itemId); if (link) v.categoryId = link.cat.id; }
        v.amount = Math.round(num(v.amount) * 100) / 100;
        if (isNew) B().txns.push({ id: uid(), type, created: Date.now(), ...preset, ...v });
        else Object.assign(txn, v);
        touched(); core.commit();
        toast(isNew ? "Transaction saved" : "Changes saved");
      },
      onDelete: isNew ? null : () => {
        if (!confirm(txn.cleared === "r" ? "This transaction is reconciled. Delete it anyway?" : "Delete this transaction?")) return false;
        B().txns = B().txns.filter((t) => t !== txn);
        touched(); core.commit(); toast("Transaction deleted");
      },
    });
  }

  function openAccount(a) {
    const isNew = !a;
    const values = a ? { ...a, opening: Math.abs(num(a.opening)) } : { type: "checking", openingDate: isoToday() };
    const inUse = a && B().txns.some((t) => touches(t, a.id));
    openForm({
      title: isNew ? "Add account" : a.name,
      intro: isNew ? "Add each bank account, credit card or cash envelope you'll use for wedding money." : "",
      values,
      fields: [
        { key: "name", label: "Account name", required: true, placeholder: "e.g. Joint checking" },
        { key: "type", label: "Type", type: "select", options: ACCOUNT_TYPES },
        { key: "opening", label: "Opening balance", type: "money", hint: "For a credit card, enter the amount owed." },
        { key: "openingDate", label: "As of", type: "date" },
        ...(isNew ? [] : [{ key: "archived", label: "Archive this account (hide it from new transactions)", type: "checkbox" }]),
      ],
      onSave(v) {
        const opening = v.type === "credit" ? -Math.abs(num(v.opening)) : num(v.opening);
        if (isNew) B().accounts.push({ id: uid(), recon: null, ...v, opening });
        else Object.assign(a, v, { opening });
        touched(); core.commit(); toast(isNew ? "Account added" : "Account saved");
      },
      onDelete: isNew ? null : () => {
        if (inUse) { toast("This account has transactions. Archive it instead."); return false; }
        if (B().accounts.length === 1) { toast("Keep at least one account."); return false; }
        if (!confirm(`Delete ${a.name}?`)) return false;
        B().accounts = B().accounts.filter((x) => x !== a);
        if (ui().acct === a.id) ui().acct = "all";
        core.commit(); toast("Account deleted");
      },
    });
  }

  function openIncomeCat(c) {
    const isNew = !c;
    openForm({
      title: isNew ? "Add income category" : "Edit income category",
      values: c || {},
      fields: [{ key: "name", label: "Name", required: true, full: true }],
      onSave(v) {
        if (isNew) B().incomeCats.push({ id: uid(), name: v.name }); else c.name = v.name;
        core.commit(); toast("Category saved");
      },
      onDelete: isNew ? null : () => {
        if (B().txns.some((t) => t.categoryId === c.id)) { toast("This category is in use. Rename it instead."); return false; }
        B().incomeCats = B().incomeCats.filter((x) => x !== c);
        core.commit(); toast("Category deleted");
      },
    });
  }

  function openBill(b) {
    const isNew = !b;
    const payments = b ? billPayments(b).sort(byDate) : [];
    openForm({
      title: isNew ? "Enter a bill" : `Bill from ${b.vendor}`,
      intro: b ? `${payments.length ? `Payments: ${payments.map((t) => `${esc(fmtDate(parseDate(t.date)))} ${m(t.amount)}`).join(", ")}. ` : "No payments yet. "}${billOpen(b) > 0 ? `${m(billOpen(b))} left to pay.` : "Paid in full."}`
        : "Use bills for vendor invoices and deposit requests you haven't paid yet. Pay them later from any account.",
      values: b ? { ...b } : { billDate: isoToday(), setActual: true },
      fields: [
        { key: "vendor", label: "Vendor", required: true, list: payeeList() },
        { key: "amount", label: "Amount due", type: "money", required: true },
        { key: "billDate", label: "Bill date", type: "date" },
        { key: "dueDate", label: "Due date", type: "date" },
        { key: "itemId", label: "Budget item", type: "select", options: itemOptions(), full: true },
        { key: "categoryId", label: "Category", type: "select", options: expenseCatOptions() },
        { key: "ref", label: "Invoice #" },
        { key: "memo", label: "Memo", type: "textarea", rows: 2 },
        ...(isNew ? [{ key: "setActual", label: "Use this amount as the budget item's actual cost if it doesn't have one", type: "checkbox" }] : []),
      ],
      saveLabel: isNew ? "Save bill" : "Save changes",
      onSave(v) {
        if (num(v.amount) <= 0) { toast("Enter an amount greater than zero."); return false; }
        const link = v.itemId && findItem(v.itemId);
        if (link) v.categoryId = link.cat.id;
        const setActual = v.setActual; delete v.setActual;
        if (isNew) B().bills.push({ id: uid(), ...v });
        else {
          Object.assign(b, v);
          billPayments(b).forEach((t) => { t.itemId = b.itemId; t.categoryId = b.categoryId; });
        }
        if (isNew && setActual && link && !num(link.item.actual)) link.item.actual = num(v.amount);
        if (!link || !link.item.due) { if (link && v.dueDate) link.item.due = v.dueDate; }
        touched(); core.commit(); toast(isNew ? "Bill saved" : "Changes saved");
      },
      onDelete: isNew ? null : () => {
        if (!confirm(payments.length ? "Delete this bill? Its payments stay in the register." : "Delete this bill?")) return false;
        payments.forEach((t) => { delete t.billId; });
        B().bills = B().bills.filter((x) => x !== b);
        core.commit(); toast("Bill deleted");
      },
    });
  }

  function openPayBill(b) {
    if (!activeAccounts().length) { toast("Add an account first."); return; }
    openForm({
      title: `Pay ${b.vendor}`,
      intro: `${m(billOpen(b))} is open on this bill.`,
      values: { date: isoToday(), amount: billOpen(b), accountId: activeAccounts()[0].id, cleared: "u" },
      fields: [
        { key: "date", label: "Payment date", type: "date", required: true },
        { key: "amount", label: "Amount", type: "money", required: true },
        { key: "accountId", label: "Pay from", type: "select", options: accountOptions() },
        { key: "ref", label: "Check or reference #" },
        { key: "memo", label: "Memo", type: "textarea", rows: 2 },
      ],
      saveLabel: "Record payment",
      onSave(v) {
        if (num(v.amount) <= 0) { toast("Enter an amount greater than zero."); return false; }
        B().txns.push({ id: uid(), created: Date.now(), type: "expense", cleared: "u", payee: b.vendor, billId: b.id, itemId: b.itemId || "", categoryId: b.categoryId || "", ...v, amount: Math.round(num(v.amount) * 100) / 100 });
        touched(); core.commit(); toast("Payment recorded");
      },
    });
  }

  /* ---------- CSV import ---------- */
  function parseCsv(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
  }
  function parseAmount(s) {
    if (!s) return null;
    const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s);
    const n = parseFloat(s.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? (neg ? -n : n) : null;
  }
  function parseDateLoose(s) {
    if (!s) return "";
    let mt = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (mt) return `${mt[1]}-${mt[2].padStart(2, "0")}-${mt[3].padStart(2, "0")}`;
    mt = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (mt) { const y = mt[3].length === 2 ? "20" + mt[3] : mt[3]; return `${y}-${mt[1].padStart(2, "0")}-${mt[2].padStart(2, "0")}`; }
    return "";
  }
  let pendingImport = null;

  function openImport() {
    if (!activeAccounts().length) { toast("Add an account first."); return; }
    core.renderModal("Import bank transactions", `
      <div class="modal-intro">Download transactions from your bank or card website as a CSV file, then choose it here. Columns for date, description and amount (or debit and credit) are detected automatically. Imported items start uncategorized so you can review them in the register.</div>
      <form id="import-form" class="form-grid" onsubmit="return false">
        ${core.fieldHtml({ key: "accountId", label: "Import into", type: "select", options: accountOptions() }, { accountId: ui().acct !== "all" ? ui().acct : activeAccounts()[0].id })}
        ${core.fieldHtml({ key: "flip", label: "Charges are positive numbers in this file (common for credit cards)", type: "checkbox" }, {})}
        <label class="field full"><span>CSV file</span><input type="file" accept=".csv,text/csv" data-change="bkImportFile"/></label>
      </form>
      <div id="import-preview"></div>`,
      `<div class="right"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button><button type="button" class="btn primary" data-act="bkImportConfirm" id="import-go" disabled>Import</button></div>`);
  }

  async function readImport(input) {
    const file = input.files && input.files[0];
    const preview = $("#import-preview"), go = $("#import-go");
    pendingImport = null; go.disabled = true;
    if (!file) { preview.innerHTML = ""; return; }
    const rows = parseCsv(await file.text());
    const headerIdx = rows.findIndex((r) => r.some((c) => /date/i.test(c)));
    if (headerIdx < 0) { preview.innerHTML = `<p class="form-error">Couldn't find a Date column. Check that the file has a header row.</p>`; return; }
    const head = rows[headerIdx].map((h) => h.toLowerCase());
    const find = (re, not) => head.findIndex((h) => re.test(h) && !(not && not.test(h)));
    const col = {
      date: find(/date/, /post/) >= 0 ? find(/date/, /post/) : find(/date/),
      desc: [find(/description/), find(/payee|merchant|name/), find(/memo|details/)].find((i) => i >= 0),
      amount: find(/^amount$|amount/, /balance/),
      debit: find(/debit|withdraw/),
      credit: find(/credit|deposit/, /card/),
      ref: find(/check|ref/),
    };
    if (col.desc == null) col.desc = -1;
    if (col.amount < 0 && col.debit < 0) { preview.innerHTML = `<p class="form-error">Couldn't find an Amount column, or Debit and Credit columns.</p>`; return; }
    const form = $("#import-form").elements;
    const accountId = form.accountId.value, flip = form.flip.checked;
    const parsed = rows.slice(headerIdx + 1).map((r) => {
      let amt;
      if (col.amount >= 0) amt = parseAmount(r[col.amount]);
      else { const d = parseAmount(r[col.debit]), c = parseAmount(r[col.credit]); amt = (c ? Math.abs(c) : 0) - (d ? Math.abs(d) : 0); }
      if (amt == null || amt === 0) return null;
      if (flip) amt = -amt;
      const date = parseDateLoose(r[col.date]);
      if (!date) return null;
      return { date, amount: Math.round(Math.abs(amt) * 100) / 100, type: amt < 0 ? "expense" : "income", payee: col.desc >= 0 ? r[col.desc] : "", ref: col.ref >= 0 ? r[col.ref] || "" : "" };
    }).filter(Boolean);
    const existing = new Set(B().txns.filter((t) => t.accountId === accountId).map((t) => `${t.date}|${t.type}|${num(t.amount).toFixed(2)}`));
    const fresh = parsed.filter((p) => !existing.has(`${p.date}|${p.type}|${p.amount.toFixed(2)}`));
    pendingImport = { accountId, rows: fresh };
    const outTotal = fresh.filter((p) => p.type === "expense").reduce((s, p) => s + p.amount, 0);
    const inTotal = fresh.filter((p) => p.type === "income").reduce((s, p) => s + p.amount, 0);
    preview.innerHTML = `<div class="panel" style="padding:12px 14px">
      <strong>${fresh.length} new transaction${fresh.length === 1 ? "" : "s"}</strong>${parsed.length - fresh.length ? `, ${parsed.length - fresh.length} skipped as likely duplicates` : ""}
      <div class="muted small">${m(outTotal)} out, ${m(inTotal)} in</div>
      <ul class="mini-list small" style="margin-top:6px">${fresh.slice(0, 5).map((p) => `<li><div class="grow">${esc(p.payee || "No description")}<div class="sub">${esc(fmtDate(parseDate(p.date)))}</div></div><div class="num-col ${p.type === "income" ? "pos" : ""}">${p.type === "income" ? "+" : "-"}${m(p.amount)}</div></li>`).join("")}</ul>
      ${fresh.length > 5 ? `<div class="muted small">and ${fresh.length - 5} more</div>` : ""}</div>`;
    go.disabled = !fresh.length;
  }

  /* =========================================================
     Actions
     ========================================================= */
  const findTxn = (id) => B().txns.find((t) => t.id === id);
  const findBill = (id) => B().bills.find((b) => b.id === id);
  const rerenderRegister = () => { const el = $("#bk-register"); if (el) el.innerHTML = registerHtml(); };

  Object.assign(core.ACTIONS, {
    bkTab(el) { ui().tab = el.dataset.tab; if (location.hash !== "#/accounts") location.hash = "#/accounts"; else core.render(); },
    bkGoTab(el) { ui().tab = el.dataset.tab; if (el.dataset.uncat) { ui().type = "uncat"; ui().acct = "all"; } },
    bkNewTxn(el) { openTxn(null, el.dataset.type, el.dataset.acct); },
    bkEditTxn(el) { const t = findTxn(el.dataset.id); if (t) openTxn(t); },
    bkCycleCleared(el) {
      const t = findTxn(el.dataset.id);
      if (!t) return;
      if (t.cleared === "r") { toast("Reconciled. Open the transaction to change its status."); return; }
      t.cleared = t.cleared === "c" ? "u" : "c";
      core.commit();
    },
    bkOpenRegister(el) { Object.assign(ui(), { tab: "register", acct: el.dataset.id, type: "all" }); core.render(); },
    bkShowUncategorized() { Object.assign(ui(), { tab: "register", acct: "all", type: "uncat", range: "all", q: "" }); core.render(); },
    bkExportRegister() {
      const { rows } = registerRows();
      const out = [["Date", "Type", "Account", "To account", "Payee", "Category", "Budget item", "Ref", "Memo", "Amount", "Status"]];
      rows.slice().reverse().forEach((t) => {
        const link = t.itemId && findItem(t.itemId);
        const signed = t.type === "expense" ? -num(t.amount) : num(t.amount);
        out.push([t.date, t.type, acct(t.accountId)?.name || "", acct(t.toAccountId)?.name || "", t.payee, categoryLabel(t), link ? link.item.name : "", t.ref, t.memo, signed.toFixed(2), CLEARED[t.cleared || "u"]]);
      });
      core.download(`wedding-register-${isoToday()}.csv`, core.toCsv(out), "text/csv;charset=utf-8");
    },
    bkEditAccount(el) { openAccount(el.dataset.id ? acct(el.dataset.id) : null); },
    bkEditIncomeCat(el) { openIncomeCat(el.dataset.id ? incomeCat(el.dataset.id) : null); },
    bkEditBill(el) { openBill(el.dataset.id ? findBill(el.dataset.id) : null); },
    bkPayBill(el) { const b = findBill(el.dataset.id); if (b) openPayBill(b); },
    bkBillFilter(el) { ui().billFilter = el.dataset.f; core.render(); },
    bkReconStart() {
      const f = $("#recon-start").elements;
      const a = acct(f.accountId.value);
      if (!a || !f.date.value) { toast("Choose an account and statement date."); return; }
      const entered = num(f.ending.value);
      ui().recon = { accountId: a.id, date: f.date.value, ending: isCredit(a) ? -Math.abs(entered) : entered };
      core.render();
    },
    bkReconCancel() {
      if (!confirm("Leave reconciliation? Transactions you checked stay marked as cleared.")) return;
      ui().recon = null; core.render();
    },
    bkReconAll() { const r = ui().recon; B().txns.forEach((t) => { if (touches(t, r.accountId) && t.cleared !== "r" && t.date <= r.date) t.cleared = "c"; }); core.commit(); },
    bkReconNone() { const r = ui().recon; B().txns.forEach((t) => { if (touches(t, r.accountId) && t.cleared === "c" && t.date <= r.date) t.cleared = "u"; }); core.commit(); },
    bkReconFinish() {
      const r = ui().recon, a = acct(r.accountId);
      let n = 0;
      B().txns.forEach((t) => { if (touches(t, a.id) && t.cleared === "c" && t.date <= r.date) { t.cleared = "r"; n++; } });
      a.recon = { date: r.date, balance: r.ending };
      ui().recon = null;
      core.commit(); toast(`${a.name} reconciled. ${n} transaction${n === 1 ? "" : "s"} marked reconciled.`);
    },
    bkReportClear() { ui().from = ""; ui().to = ""; core.render(); },
    bkExportReport() {
      const rep = REPORTS[ui().report]();
      core.download(`wedding-${rep.title.toLowerCase().replace(/[^a-z]+/g, "-")}-${isoToday()}.csv`, core.toCsv(rep.csv), "text/csv;charset=utf-8");
    },
    bkImport: openImport,
    bkImportConfirm() {
      if (!pendingImport || !pendingImport.rows.length) return;
      const { accountId, rows } = pendingImport;
      rows.forEach((p) => B().txns.push({ id: uid(), created: Date.now(), accountId, cleared: "c", categoryId: "", itemId: "", memo: "Imported", ...p }));
      pendingImport = null;
      Object.assign(ui(), { tab: "register", acct: accountId, type: "uncat", range: "all", q: "" });
      core.closeModal();
      touched(); core.commit();
      if (location.hash !== "#/accounts") location.hash = "#/accounts";
      toast(`${rows.length} transactions imported. Add categories below.`);
    },
  });

  Object.assign(core.CHANGES, {
    bkFilter(el) { ui()[el.dataset.key] = el.value; core.render(); },
    bkReport(el) { ui().report = el.value; core.render(); },
    bkReportDate(el) { ui()[el.dataset.key] = el.value; core.render(); },
    bkReconToggle(el) { const t = findTxn(el.dataset.id); if (t) { t.cleared = el.checked ? "c" : "u"; core.commit(); } },
    bkImportFile(el) { readImport(el); },
  });

  Object.assign(core.INPUTS, {
    bkSearch(el) { ui().q = el.value; rerenderRegister(); },
  });
});
