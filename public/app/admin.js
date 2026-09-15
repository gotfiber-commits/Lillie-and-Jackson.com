/* Website & users (admin only) plus website RSVPs on the Guests page. */
(window.WP_PLUGINS = window.WP_PLUGINS || []).push(function adminPlugin(core) {
  "use strict";
  const { esc, uid, num, pageHead, openForm, toast, icon, parseDate, fmtDate } = core;

  core.ICONS.globe = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>';
  const settingsIdx = core.NAV.findIndex((n) => n.id === "settings");
  core.NAV.splice(settingsIdx < 0 ? core.NAV.length : settingsIdx, 0, { id: "admin", label: "Website & users", icon: "globe", adminOnly: true });

  const photoUrl = (id) => `/api/photos/${encodeURIComponent(id)}`;
  const ui = (core.ui.admin = { tab: "website" });
  let site = null, siteSaved = false, siteState = "idle"; // idle | loading | ready | error
  let users = [], usersState = "idle";
  let pickCallback = null;

  /* =========================================================
     Website content
     ========================================================= */
  const DEFAULT_FAQ = [
    "When should I RSVP by?", "Can I bring a guest?", "Are children welcome?",
    "What should I wear?", "Is there parking at the venue?", "Will the ceremony be indoors or outdoors?",
  ];

  function defaultSite() {
    const s = core.state.settings;
    return {
      published: false,
      name1: s.partner1 || "", name2: s.partner2 || "",
      date: s.date || "", city: s.city || "",
      headline: "We're getting married",
      intro: "We can't wait to celebrate with the people we love most. Here's everything you need to know about the day.",
      hashtag: "", contactEmail: "", footerNote: "",
      heroPhoto: "",
      story: { title: "Our story", body: "", photo: "", photo2: "" },
      events: [
        { id: uid(), title: "Ceremony", date: s.date || "", time: "16:00", endTime: "", venue: s.venue || "", address: "", dress: "", notes: "" },
        { id: uid(), title: "Reception", date: s.date || "", time: "17:30", endTime: "22:00", venue: s.venue || "", address: "", dress: "", notes: "" },
      ],
      party: [],
      travel: { intro: "", gettingThere: "", hotels: [] },
      registry: [],
      faq: DEFAULT_FAQ.map((q) => ({ id: uid(), q, a: "" })),
      rsvp: { enabled: false, deadline: "", message: "", meals: s.mealOptions || "", maxParty: 2, askSong: true },
      photos: [],
    };
  }
  function normalizeSite(x) {
    const d = defaultSite();
    const out = { ...d, ...(x || {}) };
    out.story = { ...d.story, ...(x && x.story) };
    out.travel = { ...d.travel, ...(x && x.travel) };
    out.rsvp = { ...d.rsvp, ...(x && x.rsvp) };
    for (const k of ["events", "party", "registry", "faq", "photos"]) if (!Array.isArray(out[k])) out[k] = d[k];
    if (!Array.isArray(out.travel.hotels)) out.travel.hotels = [];
    return out;
  }

  async function loadSite() {
    if (siteState === "loading") return;
    siteState = "loading";
    try {
      const r = await core.api("/api/site");
      site = normalizeSite(r.site);
      siteSaved = Boolean(r.site);
      siteState = "ready";
    } catch (e) {
      siteState = e.message === "unauthorized" ? "idle" : "error";
    }
    if (location.hash.startsWith("#/admin")) core.render();
  }

  async function saveSite(message) {
    try {
      await core.api("/api/site", { method: "PUT", body: JSON.stringify({ site }) });
      siteSaved = true;
      if (message) toast(message);
    } catch (e) {
      if (e.message !== "unauthorized") toast(`Couldn't save the website: ${e.message}`);
    }
    core.render();
  }

  /* ---------- Photo upload ---------- */
  function resizeImage(file, max = 2400) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (!blob) { reject(new Error("Couldn't process that image.")); return; }
          const reader = new FileReader();
          reader.onload = () => resolve({ data: String(reader.result).split(",")[1], contentType: "image/jpeg", w, h });
          reader.onerror = () => reject(new Error("Couldn't read that image."));
          reader.readAsDataURL(blob);
        }, "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name} isn't an image this browser can read. Try a JPEG or PNG.`)); };
      img.src = url;
    });
  }

  async function uploadFiles(fileList, { addToGallery = true } = {}) {
    const files = [...(fileList || [])].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    if (!files.length) return [];
    const ids = [];
    for (let i = 0; i < files.length; i++) {
      toast(`Uploading photo ${i + 1} of ${files.length}`);
      try {
        const img = await resizeImage(files[i]);
        const res = await core.api("/api/photos", { method: "POST", body: JSON.stringify({ data: img.data, contentType: img.contentType }) });
        site.photos.push({ id: res.id, caption: "", w: img.w, h: img.h, gallery: addToGallery });
        ids.push(res.id);
      } catch (e) {
        if (e.message === "unauthorized") return ids;
        toast(e.message);
      }
    }
    if (ids.length) await saveSite(`${ids.length} photo${ids.length === 1 ? "" : "s"} uploaded`);
    return ids;
  }

  function pickPhoto(title, current, cb) {
    pickCallback = cb;
    core.renderModal(title, `
      ${site.photos.length ? `<div class="photo-pick">${site.photos.map((p) => `
        <button type="button" class="pick ${p.id === current ? "selected" : ""}" data-act="adminPick" data-id="${p.id}" aria-label="${esc(p.caption || "Photo")}">
          <img src="${photoUrl(p.id)}" alt="" loading="lazy"/></button>`).join("")}</div>`
        : `<p class="empty">No photos yet. Upload one to use it here.</p>`}
      <label class="btn" style="margin-top:12px;cursor:pointer">${icon("plus")}Upload a photo<input type="file" accept="image/*" data-change="adminUploadPick" hidden/></label>`,
      `${current ? `<button type="button" class="btn ghost danger" data-act="adminPick" data-id="">Remove photo</button>` : ""}
       <div class="right"><button type="button" class="btn ghost" data-act="closeModal">Cancel</button></div>`);
  }

  const thumb = (id, cls = "thumb") => id ? `<img class="${cls}" src="${photoUrl(id)}" alt="" loading="lazy"/>` : `<span class="${cls} empty-thumb">No photo</span>`;

  /* ---------- Lists (events, party, hotels, registry, FAQ) ---------- */
  const LISTS = {
    events: {
      noun: "event", get: () => site.events,
      fields: () => [
        { key: "title", label: "Event name", required: true, placeholder: "Ceremony, Reception, Rehearsal dinner" },
        { key: "date", label: "Date", type: "date" },
        { key: "time", label: "Start time", type: "time" },
        { key: "endTime", label: "End time", type: "time" },
        { key: "venue", label: "Venue" },
        { key: "address", label: "Address", type: "textarea", rows: 2, hint: "Used for the directions link." },
        { key: "dress", label: "Dress code", placeholder: "Cocktail attire" },
        { key: "notes", label: "Notes for guests", type: "textarea", rows: 2 },
      ],
      defaults: () => ({ date: site.date }),
      title: (e) => e.title, sub: (e) => [e.date ? fmtDate(parseDate(e.date)) : "", e.venue].filter(Boolean).join(", "),
    },
    party: {
      noun: "person", get: () => site.party, photo: true,
      fields: () => [
        { key: "name", label: "Name", required: true },
        { key: "role", label: "Role", placeholder: "Maid of honor, Best man", list: ["Maid of honor", "Matron of honor", "Best man", "Bridesmaid", "Groomsman", "Flower girl", "Ring bearer", "Officiant", "Parent of the bride", "Parent of the groom"] },
        { key: "bio", label: "A line about them", type: "textarea", rows: 2 },
      ],
      title: (p) => p.name, sub: (p) => p.role || "",
    },
    hotels: {
      noun: "hotel", get: () => site.travel.hotels,
      fields: () => [
        { key: "name", label: "Hotel name", required: true },
        { key: "url", label: "Booking link", type: "url" },
        { key: "phone", label: "Phone", type: "tel" },
        { key: "code", label: "Group code or block name" },
        { key: "deadline", label: "Book by", type: "date" },
        { key: "address", label: "Address", type: "textarea", rows: 2 },
        { key: "notes", label: "Notes", type: "textarea", rows: 2, placeholder: "Shuttle, distance to venue, rate" },
      ],
      title: (h) => h.name, sub: (h) => [h.code ? `Code ${h.code}` : "", h.deadline ? `Book by ${fmtDate(parseDate(h.deadline))}` : ""].filter(Boolean).join(", "),
    },
    registry: {
      noun: "registry", get: () => site.registry,
      fields: () => [
        { key: "name", label: "Store or fund", required: true, placeholder: "Honeymoon fund" },
        { key: "url", label: "Link", type: "url", required: true },
        { key: "note", label: "Note", type: "textarea", rows: 2 },
      ],
      title: (r) => r.name, sub: (r) => r.url,
    },
    faq: {
      noun: "question", get: () => site.faq,
      fields: () => [
        { key: "q", label: "Question", required: true, full: true },
        { key: "a", label: "Answer", type: "textarea", rows: 4, hint: "Questions without an answer stay hidden on the website." },
      ],
      title: (f) => f.q, sub: (f) => (f.a ? "" : "Needs an answer"),
    },
  };

  function openListItem(key, id) {
    const cfg = LISTS[key], list = cfg.get();
    const item = id ? list.find((x) => x.id === id) : null;
    openForm({
      title: item ? `Edit ${cfg.noun}` : `Add ${cfg.noun}`,
      values: item || (cfg.defaults ? cfg.defaults() : {}),
      fields: cfg.fields(),
      onSave(v) {
        if (v.url && !/^https?:\/\//i.test(v.url)) v.url = `https://${v.url}`;
        if (item) Object.assign(item, v); else list.push({ id: uid(), ...v });
        saveSite(item ? "Saved" : `${cfg.noun[0].toUpperCase()}${cfg.noun.slice(1)} added`);
      },
      onDelete: item ? () => {
        if (!confirm(`Remove this ${cfg.noun} from the website?`)) return false;
        list.splice(list.indexOf(item), 1);
        saveSite("Removed");
      } : null,
    });
  }

  const listBlock = (key) => {
    const cfg = LISTS[key], list = cfg.get();
    return `${list.length ? `<ul class="admin-list">${list.map((x, i) => `
      <li>
        ${cfg.photo ? thumb(x.photo, "thumb small") : ""}
        <div class="grow"><div class="strong">${esc(cfg.title(x) || "Untitled")}</div>${cfg.sub(x) ? `<div class="sub ${key === "faq" && !x.a ? "warn-text" : ""}">${esc(cfg.sub(x))}</div>` : ""}</div>
        <div class="row-actions">
          ${cfg.photo ? `<button class="btn small ghost" data-act="adminItemPhoto" data-list="${key}" data-id="${x.id}">Photo</button>` : ""}
          <button class="icon-btn small" data-act="adminMove" data-list="${key}" data-id="${x.id}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">&uarr;</button>
          <button class="icon-btn small" data-act="adminMove" data-list="${key}" data-id="${x.id}" data-dir="1" ${i === list.length - 1 ? "disabled" : ""} aria-label="Move down">&darr;</button>
          <button class="btn small" data-act="adminListEdit" data-list="${key}" data-id="${x.id}">Edit</button>
        </div>
      </li>`).join("")}</ul>` : `<p class="empty">Nothing added yet.</p>`}
      <button class="btn small" data-act="adminListEdit" data-list="${key}">${icon("plus")}Add ${cfg.noun}</button>`;
  };

  /* ---------- Views ---------- */
  function websiteTab() {
    const hasNames = site.name1 && site.name2;
    const answered = site.faq.filter((f) => f.a).length;
    const ready = [
      [hasNames, "Couple's names"], [Boolean(site.date), "Wedding date"], [Boolean(site.heroPhoto), "Cover photo"],
      [Boolean(site.story.body), "Your story"], [site.events.some((e) => e.venue), "Event venues"], [site.rsvp.enabled, "Online RSVP"],
    ];
    return `
      <section class="panel site-status">
        <div class="site-status-main">
          <div>
            <h2>Wedding website <span class="pill ${site.published ? "good" : "warn"}">${site.published ? "Published" : "Draft"}</span></h2>
            <p class="muted">${site.published ? "Anyone with your site's address can see it." : "Only admins can preview it until you publish."} Changes save as soon as you make them.</p>
          </div>
          <div class="toolbar">
            <button class="btn" data-act="adminPreview">Preview website</button>
            <button class="btn" data-act="adminFillFromPlanner">Copy details from planner</button>
            <button class="btn ${site.published ? "" : "primary"}" data-act="adminPublish">${site.published ? "Unpublish" : "Publish website"}</button>
          </div>
        </div>
        <ul class="ready-list">${ready.map(([ok, label]) => `<li class="${ok ? "ok" : ""}"><span class="tick" aria-hidden="true">${ok ? "&#10003;" : ""}</span>${label}</li>`).join("")}</ul>
      </section>

      <div class="admin-grid">
        <section class="panel">
          <div class="panel-head"><h2>Welcome</h2><button class="btn small" data-act="adminEditWelcome">Edit</button></div>
          <div class="hero-edit">
            <button class="hero-thumb" data-act="adminChooseHero" aria-label="Choose cover photo">${thumb(site.heroPhoto, "thumb wide")}<span>Cover photo</span></button>
            <div>
              <div class="strong big-names">${esc(site.name1 || "Name")} &amp; ${esc(site.name2 || "Name")}</div>
              <div class="sub">${esc(site.headline)}</div>
              <div class="sub">${site.date ? esc(fmtDate(parseDate(site.date))) : "No date yet"}${site.city ? `, ${esc(site.city)}` : ""}</div>
              ${site.hashtag ? `<div class="sub">${esc(site.hashtag)}</div>` : ""}
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Our story</h2><button class="btn small" data-act="adminEditStory">Edit</button></div>
          <div class="hero-edit">
            <button class="hero-thumb" data-act="adminChooseStory" data-slot="photo" aria-label="Choose story photo">${thumb(site.story.photo, "thumb")}<span>Photo</span></button>
            <div class="grow">
              <div class="strong">${esc(site.story.title)}</div>
              <p class="sub clamp">${site.story.body ? esc(site.story.body.slice(0, 220)) : "Tell guests how you met and how the proposal happened."}</p>
            </div>
          </div>
        </section>

        <section class="panel"><div class="panel-head"><h2>Events</h2></div>${listBlock("events")}</section>
        <section class="panel"><div class="panel-head"><h2>Wedding party</h2></div>${listBlock("party")}</section>

        <section class="panel">
          <div class="panel-head"><h2>Travel and places to stay</h2><button class="btn small" data-act="adminEditTravel">Edit text</button></div>
          <p class="sub">${site.travel.intro ? esc(site.travel.intro.slice(0, 160)) : "Add airport, parking and hotel details for out-of-town guests."}</p>
          ${listBlock("hotels")}
        </section>

        <section class="panel"><div class="panel-head"><h2>Registry</h2></div>${listBlock("registry")}</section>

        <section class="panel">
          <div class="panel-head"><h2>Questions and answers</h2><span class="muted small">${answered} of ${site.faq.length} answered</span></div>
          ${listBlock("faq")}
        </section>

        <section class="panel">
          <div class="panel-head"><h2>RSVP</h2><button class="btn small" data-act="adminEditRsvp">Edit</button></div>
          <p><span class="pill ${site.rsvp.enabled ? "good" : ""}">${site.rsvp.enabled ? "Open" : "Closed"}</span>
            ${site.rsvp.deadline ? `<span class="muted small">Deadline ${esc(fmtDate(parseDate(site.rsvp.deadline)))}</span>` : ""}</p>
          <p class="sub">Replies arrive on the Guests page, where you can add them to your guest list in one tap. Guests can reply for up to ${num(site.rsvp.maxParty) || 1} ${num(site.rsvp.maxParty) === 1 ? "person" : "people"}.</p>
          <a class="btn small" href="#/guests">See RSVPs</a>
        </section>
      </div>`;
  }

  function photosTab() {
    const used = (id) => [site.heroPhoto === id ? "Cover" : "", site.story.photo === id || site.story.photo2 === id ? "Story" : "", site.party.some((p) => p.photo === id) ? "Wedding party" : ""].filter(Boolean);
    const gallery = site.photos.filter((p) => p.gallery);
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Photos</h2>
          <label class="btn primary" style="cursor:pointer">${icon("plus")}Upload photos<input type="file" accept="image/*" multiple data-change="adminUpload" hidden/></label>
        </div>
        <p class="muted" style="margin-top:-4px">Photos are resized for the web before uploading. Checked photos appear in the website gallery, in this order. Once the site is published, anyone who visits can see them.</p>
        ${site.photos.length ? `<div class="photo-grid">${site.photos.map((p) => {
          const tags = used(p.id), gi = gallery.indexOf(p);
          return `<figure class="photo-card">
            <img src="${photoUrl(p.id)}" alt="${esc(p.caption)}" loading="lazy"/>
            <figcaption>
              <div class="photo-cap">${p.caption ? esc(p.caption) : '<span class="muted">No caption</span>'}</div>
              ${tags.length ? `<div class="photo-tags">${tags.map((t) => `<span class="pill gold">${t}</span>`).join("")}</div>` : ""}
              <label class="check-row small"><input type="checkbox" data-change="adminGallery" data-id="${p.id}" ${p.gallery ? "checked" : ""}/><span>Show in gallery${p.gallery ? ` (#${gi + 1})` : ""}</span></label>
              <div class="row-actions">
                <button class="icon-btn small" data-act="adminPhotoMove" data-id="${p.id}" data-dir="-1" aria-label="Move earlier">&larr;</button>
                <button class="icon-btn small" data-act="adminPhotoMove" data-id="${p.id}" data-dir="1" aria-label="Move later">&rarr;</button>
                <button class="btn small" data-act="adminCaption" data-id="${p.id}">Caption</button>
                <button class="btn small ghost danger" data-act="adminDeletePhoto" data-id="${p.id}">Delete</button>
              </div>
            </figcaption>
          </figure>`;
        }).join("")}</div>` : `<p class="empty">No photos yet. Upload engagement photos, a cover photo for the top of the site, and a few favorites for the gallery.</p>`}
      </section>`;
  }

  async function loadUsers() {
    if (usersState === "loading") return;
    usersState = "loading";
    try {
      users = (await core.api("/api/users")).users;
      usersState = "ready";
    } catch (e) {
      usersState = e.message === "unauthorized" ? "idle" : "error";
      if (usersState === "error") toast(e.message);
    }
    if (location.hash.startsWith("#/admin")) core.render();
  }

  function usersTab() {
    if (usersState !== "ready") {
      if (usersState === "idle") loadUsers();
      return `<p class="empty">${usersState === "error" ? `Couldn't load users. <button class="link-btn" data-act="adminReloadUsers">Try again</button>` : "Loading users"}</p>`;
    }
    const me = core.user;
    return `
      <section class="panel">
        <div class="panel-head"><h2>People with access</h2><button class="btn primary small" data-act="adminAddUser">${icon("plus")}Add person</button></div>
        <div class="table-wrap"><table class="ledger report-table users-table">
          <thead><tr><th>Name</th><th>Username</th><th>Access</th><th>Status</th><th>Last signed in</th></tr></thead>
          <tbody>${users.map((u) => `<tr class="row" data-act="adminEditUser" data-id="${u.id}">
            <td><strong>${esc(u.name)}</strong>${me && u.id === me.id ? ' <span class="pill">You</span>' : ""}</td>
            <td>${esc(u.username)}</td>
            <td><span class="pill ${u.role === "admin" ? "gold" : u.role === "planner" ? "good" : ""}">${esc(core.ROLE_LABELS[u.role] || u.role)}</span></td>
            <td>${u.disabled ? '<span class="pill bad">Turned off</span>' : "Active"}</td>
            <td>${u.lastLogin ? esc(new Date(u.lastLogin).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })) : '<span class="muted">Never</span>'}</td>
          </tr>`).join("")}</tbody>
        </table></div>
      </section>
      <section class="panel">
        <h2>Access levels</h2>
        <table class="tip-table">
          <tr><td>Admin</td><td>Everything, including managing people and editing and publishing the website.</td></tr>
          <tr><td>Planner</td><td>Can change the budget, accounts, checklist, guests, vendors and timeline. Can't manage people or the website.</td></tr>
          <tr><td>Viewer</td><td>Can see the whole planner but can't change anything. Good for parents who want to follow along.</td></tr>
        </table>
      </section>`;
  }

  core.VIEWS.admin = () => {
    if (!core.isAdmin()) return "";
    const tabs = [["website", "Website"], ["photos", "Photos"], ["users", "People"]];
    let body;
    if (ui.tab === "users") body = usersTab();
    else if (siteState !== "ready") {
      if (siteState === "idle") loadSite();
      body = `<p class="empty">${siteState === "error" ? `Couldn't load the website content. <button class="link-btn" data-act="adminReloadSite">Try again</button>` : "Loading website content"}</p>`;
    } else body = ui.tab === "photos" ? photosTab() : websiteTab();
    return `
      ${pageHead("Website & users", "Edit and publish your public wedding website, manage its photos, and control who can sign in.")}
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab ${ui.tab === k ? "active" : ""}" role="tab" aria-selected="${ui.tab === k}" data-act="adminTab" data-tab="${k}">${l}</button>`).join("")}</div>
      ${body}`;
  };

  /* =========================================================
     Website RSVPs on the Guests page
     ========================================================= */
  const rsvp = { state: "idle", list: [], showHandled: false, loadedAt: 0 };
  async function loadRsvps() {
    if (rsvp.state === "loading") return;
    rsvp.state = "loading";
    try {
      rsvp.list = (await core.api("/api/rsvp")).rsvps;
      rsvp.state = "ready";
      rsvp.loadedAt = Date.now();
    } catch (e) {
      rsvp.state = e.message === "unauthorized" ? "idle" : "error";
    }
    const r = location.hash;
    if (r.startsWith("#/guests") || r === "" || r.startsWith("#/dashboard")) core.render();
  }

  function rsvpPanel() {
    // Check for new replies when the list is more than a minute old
    if (rsvp.state === "idle" || (rsvp.state === "ready" && Date.now() - rsvp.loadedAt > 60000)) loadRsvps();
    if (rsvp.state !== "ready") return "";
    const fresh = rsvp.list.filter((r) => !r.handled);
    const shown = rsvp.showHandled ? rsvp.list : fresh;
    if (!rsvp.list.length) {
      return `<section class="panel rsvp-panel"><div class="panel-head"><h2>Website RSVPs</h2><button class="btn small ghost" data-act="rsvpReload">Refresh</button></div>
        <p class="muted" style="margin:0">Replies from your wedding website will show up here.${core.isAdmin() ? ' Turn on online RSVPs under <a href="#/admin">Website &amp; users</a>.' : ""}</p></section>`;
    }
    return `
      <section class="panel rsvp-panel">
        <div class="panel-head">
          <h2>Website RSVPs ${fresh.length ? `<span class="pill warn">${fresh.length} new</span>` : ""}</h2>
          <div class="toolbar">
            <button class="btn small ghost" data-act="rsvpToggleHandled">${rsvp.showHandled ? "Hide handled" : `Show all (${rsvp.list.length})`}</button>
            <button class="btn small ghost" data-act="rsvpReload">Refresh</button>
          </div>
        </div>
        ${shown.length ? `<ul class="mini-list">${shown.map((r) => `
          <li class="rsvp-item ${r.handled ? "handled" : ""}">
            <div class="grow">
              <div><strong>${esc(r.name)}</strong> <span class="pill ${r.attending === "yes" ? "good" : "bad"}">${r.attending === "yes" ? `Attending, party of ${r.partySize}` : "Can't attend"}</span></div>
              <div class="sub">${[r.guestNames ? `With ${r.guestNames}` : "", r.meal ? `Meal: ${r.meal}` : "", r.dietary ? `Dietary: ${r.dietary}` : "", r.song ? `Song: ${r.song}` : "", r.email, r.phone].filter(Boolean).map(esc).join(". ")}</div>
              ${r.message ? `<div class="rsvp-note">${esc(r.message)}</div>` : ""}
              <div class="sub">Received ${esc(new Date(r.submittedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}</div>
            </div>
            <div class="row-actions stack-actions">
              ${r.handled ? `<button class="btn small ghost" data-act="rsvpHandled" data-id="${r.id}" data-v="0">Mark new</button>`
                : `<button class="btn small primary" data-act="rsvpApply" data-id="${r.id}">Add to guest list</button>
                   <button class="btn small ghost" data-act="rsvpHandled" data-id="${r.id}" data-v="1">Mark handled</button>`}
              <button class="btn small ghost danger" data-act="rsvpDelete" data-id="${r.id}">Delete</button>
            </div>
          </li>`).join("")}</ul>` : `<p class="empty">No new replies. Everything's been handled.</p>`}
      </section>`;
  }

  const origGuests = core.VIEWS.guests;
  core.VIEWS.guests = () => {
    const html = origGuests();
    const panel = rsvpPanel();
    const marker = '<div class="chips-row">';
    return html.includes(marker) ? html.replace(marker, panel + marker) : panel + html;
  };

  core.hooks.insights.push(() => {
    if (rsvp.state === "idle") loadRsvps();
    const n = rsvp.list.filter((r) => !r.handled).length;
    return n ? [{ level: "warn", html: `${n} new RSVP${n === 1 ? "" : "s"} from your website. <a href="#/guests">Review</a>` }] : [];
  });

  async function setHandled(r, handled) {
    try {
      const res = await core.api(`/api/rsvp/${encodeURIComponent(r.id)}`, { method: "PATCH", body: JSON.stringify({ handled }) });
      Object.assign(r, res.rsvp);
    } catch (e) {
      if (e.message !== "unauthorized") toast(e.message);
    }
    core.render();
  }

  function applyRsvp(r) {
    if (core.readOnly()) { toast("You have view-only access."); return; }
    const guests = core.state.guests;
    const norm = (s) => String(s || "").trim().toLowerCase();
    const reply = r.attending === "yes" ? "yes" : "no";
    let g = guests.find((x) => norm(x.name) === norm(r.name));
    const added = !g;
    if (!g) { g = { id: uid(), name: r.name, side: "both", group: "Website RSVP" }; guests.push(g); }
    g.rsvp = reply;
    if (r.email) g.email = r.email;
    if (r.phone) g.phone = r.phone;
    if (r.meal) g.meal = r.meal;
    if (r.dietary) g.dietary = r.dietary;
    let extraCount = 0;
    if (reply === "yes" && r.partySize > 1) {
      const names = String(r.guestNames || "").split(/,|\n| and | & /i).map((s) => s.trim()).filter(Boolean);
      g.plusOne = true;
      g.plusOneName = names[0] || g.plusOneName || "";
      // Anyone beyond the first extra guest becomes their own row
      for (let i = 1; i < r.partySize - 1 && i < names.length; i++) {
        if (guests.some((x) => norm(x.name) === norm(names[i]))) continue;
        guests.push({ id: uid(), name: names[i], side: g.side || "both", group: g.group || "Website RSVP", rsvp: "yes" });
        extraCount++;
      }
    }
    core.commit();
    setHandled(r, true);
    toast(`${added ? "Added" : "Updated"} ${r.name}${extraCount ? ` and ${extraCount} more` : ""} on the guest list`);
  }

  /* =========================================================
     Actions
     ========================================================= */
  const findPhoto = (id) => site.photos.find((p) => p.id === id);
  const genPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    return [...bytes].map((b) => chars[b % chars.length]).join("");
  };

  Object.assign(core.ACTIONS, {
    adminTab(el) { ui.tab = el.dataset.tab; core.render(); },
    adminReloadSite() { siteState = "idle"; core.render(); },
    adminReloadUsers() { usersState = "idle"; core.render(); },

    async adminPreview() {
      const win = window.open("about:blank", "_blank");
      if (!siteSaved) await saveSite();
      if (win) win.location.href = "/?preview=1"; else location.href = "/?preview=1";
    },
    adminPublish() {
      if (!site.published) {
        const missing = [];
        if (!site.name1 || !site.name2) missing.push("both names");
        if (!site.date) missing.push("the wedding date");
        if (missing.length && !confirm(`The website is missing ${missing.join(" and ")}. Publish anyway?`)) return;
      } else if (!confirm("Unpublish the website? Visitors will see a coming soon page.")) return;
      site.published = !site.published;
      saveSite(site.published ? "Your website is live" : "Website unpublished");
    },
    adminFillFromPlanner() {
      const s = core.state.settings;
      Object.assign(site, { name1: s.partner1 || site.name1, name2: s.partner2 || site.name2, date: s.date || site.date, city: s.city || site.city });
      if (s.mealOptions && !site.rsvp.meals) site.rsvp.meals = s.mealOptions;
      site.events.forEach((e) => { if (!e.date && s.date) e.date = s.date; if (!e.venue && s.venue) e.venue = s.venue; });
      saveSite("Copied names, date, city and venue from the planner");
    },
    adminEditWelcome() {
      openForm({
        title: "Welcome section",
        values: site,
        fields: [
          { key: "name1", label: "First name shown", required: true },
          { key: "name2", label: "Second name shown", required: true },
          { key: "date", label: "Wedding date", type: "date" },
          { key: "city", label: "City and state", placeholder: "Florence, Alabama" },
          { key: "headline", label: "Headline", placeholder: "We're getting married" },
          { key: "hashtag", label: "Wedding hashtag", placeholder: "#SamAndAlex2027" },
          { key: "intro", label: "Welcome message", type: "textarea", rows: 3 },
          { key: "contactEmail", label: "Contact email for guests", type: "email" },
          { key: "footerNote", label: "Footer message", placeholder: "Thank you for being part of our story" },
        ],
        onSave(v) {
          if (v.hashtag && !v.hashtag.startsWith("#")) v.hashtag = `#${v.hashtag.replace(/\s+/g, "")}`;
          Object.assign(site, v); saveSite("Saved");
        },
      });
    },
    adminEditStory() {
      openForm({
        title: "Our story",
        values: site.story,
        fields: [
          { key: "title", label: "Section title", full: true },
          { key: "body", label: "Story", type: "textarea", rows: 10, hint: "Leave a blank line between paragraphs." },
        ],
        onSave(v) { Object.assign(site.story, v); saveSite("Saved"); },
      });
    },
    adminEditTravel() {
      openForm({
        title: "Travel details",
        values: site.travel,
        fields: [
          { key: "intro", label: "Introduction", type: "textarea", rows: 3, placeholder: "We've reserved rooms nearby for out-of-town guests." },
          { key: "gettingThere", label: "Getting there", type: "textarea", rows: 4, placeholder: "Nearest airports, driving time, parking and shuttles" },
        ],
        onSave(v) { Object.assign(site.travel, v); saveSite("Saved"); },
      });
    },
    adminEditRsvp() {
      openForm({
        title: "Online RSVP",
        intro: "Replies arrive on the Guests page. Match them to your guest list with one tap.",
        values: site.rsvp,
        fields: [
          { key: "enabled", label: "Accept RSVPs on the website", type: "checkbox" },
          { key: "deadline", label: "Reply by", type: "date" },
          { key: "maxParty", label: "Most people per reply", type: "number", hint: "Including the person replying" },
          { key: "meals", label: "Meal choices", hint: "Separate with commas. Leave blank to skip the meal question." },
          { key: "askSong", label: "Ask for a song request", type: "checkbox" },
          { key: "message", label: "Message above the form", type: "textarea", rows: 2 },
        ],
        onSave(v) { v.maxParty = Math.min(Math.max(num(v.maxParty) || 1, 1), 10); Object.assign(site.rsvp, v); saveSite("RSVP settings saved"); },
      });
    },
    adminChooseHero() { pickPhoto("Choose a cover photo", site.heroPhoto, (id) => { site.heroPhoto = id; saveSite(id ? "Cover photo set" : "Cover photo removed"); }); },
    adminChooseStory() { pickPhoto("Choose a story photo", site.story.photo, (id) => { site.story.photo = id; saveSite("Story photo updated"); }); },
    adminItemPhoto(el) {
      const item = LISTS[el.dataset.list].get().find((x) => x.id === el.dataset.id);
      if (item) pickPhoto(`Photo for ${item.name || "this person"}`, item.photo, (id) => { item.photo = id; saveSite("Photo updated"); });
    },
    adminPick(el) {
      const cb = pickCallback;
      pickCallback = null;
      core.closeModal();
      if (cb) cb(el.dataset.id);
    },
    adminListEdit(el) { openListItem(el.dataset.list, el.dataset.id); },
    adminMove(el) {
      const list = LISTS[el.dataset.list].get();
      const i = list.findIndex((x) => x.id === el.dataset.id), j = i + Number(el.dataset.dir);
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      saveSite();
    },
    adminCaption(el) {
      const p = findPhoto(el.dataset.id);
      openForm({
        title: "Photo caption", values: p,
        fields: [{ key: "caption", label: "Caption", full: true, hint: "Also used as the description for screen readers." }],
        onSave(v) { p.caption = v.caption; saveSite("Caption saved"); },
      });
    },
    adminPhotoMove(el) {
      const i = site.photos.findIndex((p) => p.id === el.dataset.id), j = i + Number(el.dataset.dir);
      if (i < 0 || j < 0 || j >= site.photos.length) return;
      [site.photos[i], site.photos[j]] = [site.photos[j], site.photos[i]];
      saveSite();
    },
    async adminDeletePhoto(el) {
      const p = findPhoto(el.dataset.id);
      if (!p || !confirm("Delete this photo from the website? This can't be undone.")) return;
      try {
        await core.api(`/api/photos/${encodeURIComponent(p.id)}`, { method: "DELETE" });
      } catch (e) {
        if (e.message === "unauthorized") return;
        toast(e.message); return;
      }
      site.photos = site.photos.filter((x) => x !== p);
      if (site.heroPhoto === p.id) site.heroPhoto = "";
      if (site.story.photo === p.id) site.story.photo = "";
      site.party.forEach((m) => { if (m.photo === p.id) m.photo = ""; });
      saveSite("Photo deleted");
    },

    // People
    adminAddUser() {
      openForm({
        title: "Add a person",
        intro: "Choose their access level, then share the username and temporary password with them. They can change the password under Settings.",
        values: { role: "planner", password: genPassword() },
        fields: [
          { key: "name", label: "Name", required: true },
          { key: "username", label: "Username", required: true, hint: "Letters, numbers, dots, dashes or underscores" },
          { key: "role", label: "Access", type: "select", options: [{ value: "planner", label: "Planner" }, { value: "viewer", label: "Viewer" }, { value: "admin", label: "Admin" }] },
          { key: "password", label: "Temporary password", required: true, hint: "At least 8 characters" },
        ],
        saveLabel: "Add person",
        onSave(v) {
          core.api("/api/users", { method: "POST", body: JSON.stringify({ ...v, username: v.username.toLowerCase() }) })
            .then(() => {
              usersState = "idle"; core.render();
              core.openInfo("Account created", `<p>Share these sign-in details with ${esc(v.name)}:</p>
                <table class="tip-table"><tr><td>Website</td><td>${esc(location.origin)}/app/</td></tr><tr><td>Username</td><td>${esc(v.username.toLowerCase())}</td></tr><tr><td>Password</td><td><code>${esc(v.password)}</code></td></tr></table>
                <p class="muted small">This password won't be shown again. They can change it under Settings after signing in.</p>`);
            })
            .catch((e) => { if (e.message !== "unauthorized") toast(e.message); });
        },
      });
    },
    adminEditUser(el) {
      const u = users.find((x) => x.id === el.dataset.id);
      if (!u) return;
      const self = core.user && core.user.id === u.id;
      openForm({
        title: u.name,
        intro: self ? "This is your account. Another admin would need to change your access level." : `Username: ${esc(u.username)}`,
        values: { name: u.name, role: u.role, disabled: u.disabled, password: "" },
        fields: [
          { key: "name", label: "Name", required: true },
          { key: "role", label: "Access", type: "select", options: [{ value: "admin", label: "Admin" }, { value: "planner", label: "Planner" }, { value: "viewer", label: "Viewer" }] },
          { key: "password", label: "Set a new password", hint: "Leave blank to keep their current password. Setting one signs them out." },
          ...(self ? [] : [{ key: "disabled", label: "Turn off this account (they can't sign in)", type: "checkbox" }]),
        ],
        onSave(v) {
          const patch = { name: v.name, role: v.role };
          if (!self) patch.disabled = v.disabled;
          if (v.password) patch.password = v.password;
          core.api(`/api/users/${encodeURIComponent(u.id)}`, { method: "PATCH", body: JSON.stringify(patch) })
            .then(() => { usersState = "idle"; core.render(); toast(v.password ? "Saved. Share the new password with them." : "Saved"); })
            .catch((e) => { if (e.message !== "unauthorized") toast(e.message); });
        },
        onDelete: self ? null : () => {
          if (!confirm(`Delete ${u.name}'s account? They won't be able to sign in.`)) return false;
          core.api(`/api/users/${encodeURIComponent(u.id)}`, { method: "DELETE" })
            .then(() => { usersState = "idle"; core.render(); toast("Account deleted"); })
            .catch((e) => { if (e.message !== "unauthorized") toast(e.message); });
        },
      });
    },

    // RSVPs
    rsvpReload() { rsvp.state = "idle"; core.render(); },
    rsvpToggleHandled() { rsvp.showHandled = !rsvp.showHandled; core.render(); },
    rsvpApply(el) { const r = rsvp.list.find((x) => x.id === el.dataset.id); if (r) applyRsvp(r); },
    rsvpHandled(el) { const r = rsvp.list.find((x) => x.id === el.dataset.id); if (r) setHandled(r, el.dataset.v === "1"); },
    async rsvpDelete(el) {
      const r = rsvp.list.find((x) => x.id === el.dataset.id);
      if (!r || !confirm(`Delete the RSVP from ${r.name}?`)) return;
      try {
        await core.api(`/api/rsvp/${encodeURIComponent(r.id)}`, { method: "DELETE" });
        rsvp.list = rsvp.list.filter((x) => x !== r);
      } catch (e) { if (e.message !== "unauthorized") toast(e.message); }
      core.render();
    },
  });

  Object.assign(core.CHANGES, {
    adminUpload(el) { uploadFiles(el.files).finally(() => { el.value = ""; }); },
    async adminUploadPick(el) {
      const cb = pickCallback;
      const ids = await uploadFiles(el.files, { addToGallery: false });
      pickCallback = null;
      core.closeModal();
      if (cb && ids[0]) cb(ids[0]);
    },
    adminGallery(el) { const p = findPhoto(el.dataset.id); if (p) { p.gallery = el.checked; saveSite(); } },
  });
});
