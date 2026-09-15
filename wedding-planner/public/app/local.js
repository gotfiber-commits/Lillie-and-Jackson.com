/* North Alabama vendors: a reference directory with one-tap "Save to my vendors". */
(window.WP_PLUGINS = window.WP_PLUGINS || []).push(function localVendors(core) {
  "use strict";
  const { esc, uid, pageHead, toast } = core;
  const L = window.WP.LOCAL;
  if (!L) return;

  core.ICONS.pin = '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>';
  const vendorsIdx = core.NAV.findIndex((n) => n.id === "vendors");
  core.NAV.splice(vendorsIdx + 1, 0, { id: "local", label: "Local vendors", icon: "pin" });
  core.ui.local = { area: "all", cat: "all", q: "" };
  const ui = () => core.ui.local;

  const saved = (v) => core.state.vendors.some((x) => x.name.toLowerCase() === v.name.toLowerCase());
  const areaLabel = (k) => (L.areas.find((a) => a.key === k) || {}).label || "";

  function cards() {
    const u = ui(), q = u.q.toLowerCase();
    const list = L.vendors
      .map((v, i) => ({ ...v, i }))
      .filter((v) => (u.area === "all" || v.area === u.area || v.area === "region") && (u.cat === "all" || v.category === u.cat))
      .filter((v) => !q || `${v.name} ${v.city} ${v.note} ${v.category}`.toLowerCase().includes(q));
    if (!list.length) return `<p class="empty">No local listings match. Try another area or category, or browse the directories below.</p>`;
    const cats = [...new Set(list.map((v) => v.category))];
    return cats.map((c) => `
      <div class="vendor-group">
        <h2>${esc(c === "DJ / Band" ? "Music" : c === "Attire" ? "Bridal and formalwear" : c === "Venue" ? "Venues" : c === "Photographer" ? "Photographers" : c === "Florist" ? "Florists" : c === "Bakery" ? "Cakes" : c === "Videographer" ? "Videographers" : c)}</h2>
        <div class="local-grid">${list.filter((v) => v.category === c).map((v) => `
          <article class="local-card">
            <div class="local-top"><h3>${esc(v.name)}</h3><span class="pill">${esc(areaLabel(v.area))}</span></div>
            <div class="muted small">${esc(v.city)}</div>
            <p>${esc(v.note)}</p>
            <div class="contact-links">
              ${v.url ? `<a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.urlLabel || "Website")}</a>` : ""}
              ${v.phone ? `<a href="tel:${esc(v.phone.replace(/[^0-9]/g, ""))}">${esc(v.phone)}</a>` : ""}
              ${v.email ? `<a href="mailto:${esc(v.email)}">Email</a>` : ""}
            </div>
            <div class="local-actions">${saved(v) ? `<span class="pill good">In your vendors</span>` : `<button class="btn small" data-act="localSave" data-i="${v.i}">Save to my vendors</button>`}</div>
          </article>`).join("")}</div>
      </div>`).join("");
  }

  core.VIEWS.local = () => {
    const u = ui();
    const categories = [...new Set(L.vendors.map((v) => v.category))];
    return `
      ${pageHead("North Alabama vendors", "A starting list of venues and wedding services around the Shoals and Huntsville. Save any of them to your Vendors list to track quotes and bookings.")}
      <div class="notice">Listings were gathered from public websites in ${esc(L.updated)}. They aren't endorsements or paid placements. Call to confirm availability, pricing and details.</div>
      <section class="panel" style="margin-bottom:16px">
        <h2>Getting married in Alabama</h2>
        <p>${esc(L.marriage.summary)}</p>
        <ul class="link-list">${L.marriage.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a><span class="muted small">${esc(l.source)}</span></li>`).join("")}</ul>
      </section>
      <div class="toolbar" style="margin-bottom:6px">
        <div class="filters">
          <button class="chip ${u.area === "all" ? "active" : ""}" data-act="localArea" data-a="all">All areas</button>
          ${L.areas.filter((a) => a.key !== "region").map((a) => `<button class="chip ${u.area === a.key ? "active" : ""}" data-act="localArea" data-a="${a.key}">${esc(a.label)}</button>`).join("")}
        </div>
        <select data-change="localCat" aria-label="Category">
          <option value="all">All categories</option>
          ${categories.map((c) => `<option value="${esc(c)}" ${u.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
        </select>
        <input type="search" class="search" placeholder="Search listings" value="${esc(u.q)}" data-input="localSearch" aria-label="Search listings"/>
      </div>
      <div id="local-list">${cards()}</div>
      <section class="panel" style="margin-top:20px">
        <h2>Browse more local vendors</h2>
        <ul class="link-list">${L.directories.map((d) => `<li><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a><span class="muted small">${esc(d.source)}</span></li>`).join("")}</ul>
      </section>`;
  };

  Object.assign(core.ACTIONS, {
    localArea(el) { ui().area = el.dataset.a; core.render(); },
    localSave(el) {
      const v = L.vendors[+el.dataset.i];
      if (!v || saved(v)) return;
      core.state.vendors.push({
        id: uid(), name: v.name, category: v.category, status: "Researching",
        phone: v.phone || "", email: v.email || "", website: v.url || "", contact: "",
        notes: `${v.city}. ${v.note}`,
      });
      core.commit();
      toast(`${v.name} saved to your vendors`);
    },
  });
  Object.assign(core.CHANGES, { localCat(el) { ui().cat = el.value; core.render(); } });
  Object.assign(core.INPUTS, { localSearch(el) { ui().q = el.value; document.getElementById("local-list").innerHTML = cards(); } });
});
