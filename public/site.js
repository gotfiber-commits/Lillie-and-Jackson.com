(() => {
  "use strict";

  const root = document.getElementById("site");
  const params = new URLSearchParams(location.search);
  const wantsPreview = params.has("preview");

  /* ---------- Helpers ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => {
    try {
      const url = new URL(u, location.origin);
      return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  };
  const photo = (id) => `/api/photos/${encodeURIComponent(id)}`;
  const parseDate = (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return null;
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const longDate = (d) => d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const fmtTime = (t) => {
    if (!/^\d{2}:\d{2}$/.test(t || "")) return "";
    const [h, m] = t.split(":").map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };
  const paragraphs = (text) => String(text || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`).join("");
  const initials = (a, b) => `${(a || "").trim().charAt(0)}${(b || "").trim().charAt(0)}`.toUpperCase();
  const daysUntil = (d) => { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 864e5); };
  const mapLink = (e) => {
    const q = [e.venue, e.address].filter(Boolean).join(", ");
    return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : "";
  };

  /* ---------- Load ---------- */
  async function load() {
    const headers = {};
    const token = localStorage.getItem("wp_token");
    if (wantsPreview && token) headers.authorization = `Bearer ${token}`;
    try {
      const res = await fetch("/api/site", { headers });
      const body = await res.json();
      if (body.site && (body.site.published || body.draft)) return renderSite(body.site, Boolean(body.draft));
      renderComingSoon(body.couple, body.draft);
    } catch {
      renderComingSoon(null, false);
    }
  }

  function renderComingSoon(couple, draft) {
    const names = couple && couple.name1 && couple.name2 ? `${esc(couple.name1)} <span class="amp">&amp;</span> ${esc(couple.name2)}` : "Our wedding";
    document.title = couple && couple.name1 ? `${couple.name1} & ${couple.name2}` : "Our Wedding";
    root.innerHTML = `
      <main class="soon">
        <div class="soon-frame">
          <p class="soon-lead">Coming soon</p>
          <h1 class="soon-names">${names}</h1>
          <p>${draft ? "Add your details under Website &amp; users in the planner, then preview again." : "Our wedding website is on its way. Check back soon for all the details."}</p>
        </div>
        <a class="soon-signin" href="/app/">Planner sign in</a>
      </main>`;
    root.removeAttribute("aria-busy");
  }

  /* ---------- Sections ---------- */
  function renderSite(s, draft) {
    const date = parseDate(s.date);
    const n1 = s.name1 || "", n2 = s.name2 || "";
    document.title = n1 && n2 ? `${n1} & ${n2}${date ? ` | ${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}` : ""}` : "Our Wedding";

    const events = (s.events || []).filter((e) => e.title).sort((a, b) => `${a.date || ""}${a.time || ""}`.localeCompare(`${b.date || ""}${b.time || ""}`));
    const gallery = (s.photos || []).filter((p) => p.gallery);
    const party = (s.party || []).filter((p) => p.name);
    const hotels = ((s.travel && s.travel.hotels) || []).filter((h) => h.name);
    const hasTravel = Boolean(s.travel && (s.travel.intro || s.travel.gettingThere)) || hotels.length > 0;
    const registry = (s.registry || []).filter((r) => r.name && safeUrl(r.url));
    const faq = (s.faq || []).filter((f) => f.q && f.a);
    const rsvpOpen = Boolean(s.rsvp && s.rsvp.enabled);
    const heroList = (Array.isArray(s.heroPhotos) && s.heroPhotos.length ? s.heroPhotos : [s.heroPhoto]).filter(Boolean);
    const hasStory = Boolean(s.story && (s.story.body || s.story.photo));

    const nav = [
      hasStory && ["story", (s.story && s.story.title) || "Our story"],
      events.length && ["details", "Details"],
      gallery.length && ["gallery", "Photos"],
      party.length && ["party", "Wedding party"],
      hasTravel && ["travel", "Travel"],
      registry.length && ["registry", "Registry"],
      faq.length && ["faq", "Q&amp;A"],
    ].filter(Boolean);

    const days = date ? daysUntil(date) : null;
    const countdown = days == null ? "" : days > 1 ? `${days} days to go` : days === 1 ? "Tomorrow" : days === 0 ? "Today is the day" : "Just married";

    root.innerHTML = `
      ${draft ? `<div class="preview-bar">${s.published ? "You're viewing the live site as an admin." : "Preview. This site isn't published yet, so only admins can see it."} <a href="/app/#/admin">Back to the planner</a></div>` : ""}
      <header class="topnav" id="topnav">
        <a class="monogram" href="#top" aria-label="Back to top">${esc(initials(n1, n2)).split("").join('<span class="mono-amp">&amp;</span>')}</a>
        <button class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="nav-links"><span></span><span></span><span class="sr">Menu</span></button>
        <nav id="nav-links" class="nav-links" aria-label="Sections">
          ${nav.map(([id, label]) => `<a href="#${id}">${label}</a>`).join("")}
          ${rsvpOpen ? `<a class="nav-rsvp" href="#rsvp">RSVP</a>` : ""}
        </nav>
      </header>

      <section class="hero ${heroList.length ? "has-photo" : ""} h-${["full", "mid", "short"].includes(s.heroHeight) ? s.heroHeight : "mid"} ${s.heroFit === "whole" ? "fit-whole" : ""}" id="top">
        ${heroList.map((id, i) => `<span class="hero-slide ${i === 0 ? "on" : ""}">
          ${s.heroFit === "whole" ? `<img class="hero-blur" src="${photo(id)}" alt="" aria-hidden="true" ${i === 0 ? "" : 'loading="lazy"'}/>` : ""}
          <img class="hero-img" src="${photo(id)}" alt="${i === 0 ? `${esc(n1)} and ${esc(n2)}` : ""}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}/>
        </span>`).join("")}
        <div class="hero-shade"></div>
        ${heroList.length > 1 ? `<div class="hero-dots" role="tablist" aria-label="Cover photos">${heroList.map((_, i) => `<button type="button" class="dot ${i === 0 ? "on" : ""}" data-slide="${i}" aria-label="Photo ${i + 1}"></button>`).join("")}</div>` : ""}
        <div class="hero-content">
          ${s.headline ? `<p class="hero-lead">${esc(s.headline)}</p>` : ""}
          <h1 class="hero-names"><span>${esc(n1)}</span><span class="amp">&amp;</span><span>${esc(n2)}</span></h1>
        </div>
      </section>

      <section class="dateband" aria-label="Date and place">
        <div class="dateband-inner">
          <div class="db-item"><span class="db-label">When</span><span class="db-value">${date ? esc(longDate(date)) : "Date to be announced"}</span></div>
          ${s.city ? `<div class="db-item"><span class="db-label">Where</span><span class="db-value">${esc(s.city)}</span></div>` : ""}
          ${countdown ? `<div class="db-item"><span class="db-label">Countdown</span><span class="db-value">${esc(countdown)}</span></div>` : ""}
          ${rsvpOpen ? `<a class="btn-gold" href="#rsvp">RSVP</a>` : ""}
        </div>
      </section>

      ${s.intro ? `<section class="intro"><p>${esc(s.intro)}</p>${s.hashtag ? `<p class="hashtag">${esc(s.hashtag)}</p>` : ""}</section>` : ""}

      ${hasStory ? `
      <section class="section story" id="story">
        <div class="wrap story-grid ${s.story.photo ? "" : "no-photo"}">
          ${s.story.photo ? `<figure class="story-photo"><img src="${photo(s.story.photo)}" alt="${esc(n1)} and ${esc(n2)}" loading="lazy"/></figure>` : ""}
          <div class="story-text">
            <h2>${esc(s.story.title || "Our story")}</h2>
            ${paragraphs(s.story.body)}
          </div>
        </div>
      </section>` : ""}

      ${events.length ? `
      <section class="section details" id="details">
        <div class="wrap">
          <h2>The details</h2>
          <div class="events">${events.map((e) => {
            const d = parseDate(e.date), map = mapLink(e);
            return `<article class="event">
              <h3>${esc(e.title)}</h3>
              ${d || e.time ? `<p class="event-when">${d ? esc(longDate(d)) : ""}${e.time ? `<span>${esc(fmtTime(e.time))}${e.endTime ? ` to ${esc(fmtTime(e.endTime))}` : ""}</span>` : ""}</p>` : ""}
              ${e.venue ? `<p class="event-venue">${esc(e.venue)}</p>` : ""}
              ${e.address ? `<p class="event-address">${esc(e.address).replace(/\n/g, "<br/>")}</p>` : ""}
              ${e.dress ? `<p class="event-meta"><strong>Attire</strong> ${esc(e.dress)}</p>` : ""}
              ${e.notes ? `<p class="event-notes">${esc(e.notes)}</p>` : ""}
              <div class="event-actions">
                ${map ? `<a class="btn-line" href="${map}" target="_blank" rel="noopener">Get directions</a>` : ""}
                ${d ? `<button class="btn-line" type="button" data-ics="${esc(e.id || e.title)}">Add to calendar</button>` : ""}
              </div>
            </article>`;
          }).join("")}</div>
        </div>
      </section>` : ""}

      ${gallery.length ? `
      <section class="section gallery" id="gallery">
        <div class="wrap">
          <h2>Photos</h2>
          <div class="masonry">${gallery.map((p, i) => `
            <button class="shot" type="button" data-lightbox="${i}" aria-label="Open photo${p.caption ? `: ${esc(p.caption)}` : ""}">
              <img src="${photo(p.id)}" alt="${esc(p.caption || "")}" loading="lazy" ${p.w && p.h ? `width="${p.w}" height="${p.h}"` : ""}/>
              ${p.caption ? `<span class="shot-cap">${esc(p.caption)}</span>` : ""}
            </button>`).join("")}</div>
        </div>
      </section>` : ""}

      ${party.length ? `
      <section class="section party" id="party">
        <div class="wrap">
          <h2>The wedding party</h2>
          <div class="party-grid">${party.map((p) => `
            <article class="member">
              ${p.photo ? `<img src="${photo(p.photo)}" alt="${esc(p.name)}" loading="lazy"/>` : `<span class="member-initial" aria-hidden="true">${esc(p.name.trim().charAt(0).toUpperCase())}</span>`}
              <h3>${esc(p.name)}</h3>
              ${p.role ? `<p class="member-role">${esc(p.role)}</p>` : ""}
              ${p.bio ? `<p class="member-bio">${esc(p.bio)}</p>` : ""}
            </article>`).join("")}</div>
        </div>
      </section>` : ""}

      ${hasTravel ? `
      <section class="section travel" id="travel">
        <div class="wrap travel-grid">
          <div>
            <h2>Travel and stay</h2>
            ${paragraphs(s.travel.intro)}
            ${s.travel.gettingThere ? `<h3 class="sub-head">Getting there</h3>${paragraphs(s.travel.gettingThere)}` : ""}
          </div>
          <div class="hotels">${hotels.map((h) => {
            const url = safeUrl(h.url), dl = parseDate(h.deadline);
            return `<article class="hotel">
              <h3>${esc(h.name)}</h3>
              ${h.address ? `<p class="muted">${esc(h.address).replace(/\n/g, "<br/>")}</p>` : ""}
              ${h.code ? `<p><strong>Group code</strong> ${esc(h.code)}</p>` : ""}
              ${dl ? `<p><strong>Book by</strong> ${esc(dl.toLocaleDateString(undefined, { month: "long", day: "numeric" }))}</p>` : ""}
              ${h.notes ? `<p>${esc(h.notes)}</p>` : ""}
              <div class="event-actions">
                ${url ? `<a class="btn-line" href="${esc(url)}" target="_blank" rel="noopener">Book a room</a>` : ""}
                ${h.phone ? `<a class="btn-line" href="tel:${esc(h.phone.replace(/[^0-9+]/g, ""))}">${esc(h.phone)}</a>` : ""}
              </div>
            </article>`;
          }).join("")}</div>
        </div>
      </section>` : ""}

      ${registry.length ? `
      <section class="section registry" id="registry">
        <div class="wrap narrow">
          <h2>Registry</h2>
          <p class="section-lead">Your presence is the best gift. If you'd like to give something more, we're registered here.</p>
          <div class="registry-list">${registry.map((r) => `
            <a class="registry-card" href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener">
              <span class="registry-name">${esc(r.name)}</span>
              ${r.note ? `<span class="registry-note">${esc(r.note)}</span>` : ""}
              <span class="registry-go">Visit registry</span>
            </a>`).join("")}</div>
        </div>
      </section>` : ""}

      ${faq.length ? `
      <section class="section faq" id="faq">
        <div class="wrap narrow">
          <h2>Questions and answers</h2>
          ${faq.map((f) => `<details class="qa"><summary>${esc(f.q)}</summary><div class="qa-a">${paragraphs(f.a)}</div></details>`).join("")}
          ${s.contactEmail ? `<p class="faq-contact">Still have a question? Email us at <a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a>.</p>` : ""}
        </div>
      </section>` : ""}

      ${rsvpOpen ? rsvpSection(s) : ""}

      <footer class="footer">
        <p class="footer-names">${esc(n1)} <span class="amp">&amp;</span> ${esc(n2)}</p>
        ${date ? `<p>${esc(longDate(date))}${s.city ? `, ${esc(s.city)}` : ""}</p>` : ""}
        ${s.footerNote ? `<p class="footer-note">${esc(s.footerNote)}</p>` : ""}
        ${s.hashtag ? `<p class="hashtag">${esc(s.hashtag)}</p>` : ""}
        <p class="footer-signin"><a href="/app/">Planner sign in</a></p>
      </footer>

      <div class="lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="Photo viewer">
        <button class="lb-close" data-lb="close" aria-label="Close">&times;</button>
        <button class="lb-nav lb-prev" data-lb="prev" aria-label="Previous photo">&lsaquo;</button>
        <figure><img id="lb-img" alt=""/><figcaption id="lb-cap"></figcaption></figure>
        <button class="lb-nav lb-next" data-lb="next" aria-label="Next photo">&rsaquo;</button>
      </div>`;

    root.removeAttribute("aria-busy");
    wire(s, events, gallery);
    startSlideshow(heroList.length);
  }

  function startSlideshow(count) {
    if (count < 2) return;
    const imgs = [...document.querySelectorAll(".hero-slide")];
    const dots = [...document.querySelectorAll(".hero-dots .dot")];
    let idx = 0, timer = null;
    const show = (i) => {
      idx = (i + count) % count;
      imgs.forEach((img, k) => img.classList.toggle("on", k === idx));
      dots.forEach((d, k) => d.classList.toggle("on", k === idx));
    };
    const auto = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = () => { if (auto && !timer) timer = setInterval(() => show(idx + 1), 6000); };
    const stop = () => { clearInterval(timer); timer = null; };
    dots.forEach((d) => d.addEventListener("click", () => { stop(); show(Number(d.dataset.slide)); start(); }));
    // Pause while the tab is hidden so slides don't jump when you come back
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    start();
  }

  function rsvpSection(s) {
    const r = s.rsvp;
    const deadline = parseDate(r.deadline);
    const meals = String(r.meals || "").split(",").map((m) => m.trim()).filter(Boolean);
    const maxParty = Math.min(Math.max(Number(r.maxParty) || 1, 1), 10);
    const closed = deadline && daysUntil(deadline) < 0;
    return `
      <section class="section rsvp" id="rsvp">
        <div class="wrap rsvp-grid">
          <div class="rsvp-intro">
            <h2>RSVP</h2>
            ${r.message ? paragraphs(r.message) : "<p>We'd love to know if you can join us.</p>"}
            ${deadline ? `<p class="rsvp-deadline">Please reply by ${esc(deadline.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }))}.</p>` : ""}
          </div>
          <div class="rsvp-card">
            ${closed ? `<p>The RSVP deadline has passed. ${s.contactEmail ? `Please email <a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a> if you still need to reply.` : "Please contact us directly."}</p>` : `
            <form id="rsvp-form" novalidate>
              <label class="f"><span>Your name</span><input name="name" autocomplete="name" required maxlength="100"/></label>
              <fieldset class="f attend">
                <legend>Will you be there?</legend>
                <label class="choice"><input type="radio" name="attending" value="yes" required/><span>Joyfully accepts</span></label>
                <label class="choice"><input type="radio" name="attending" value="no"/><span>Regretfully declines</span></label>
              </fieldset>
              <div class="yes-only" hidden>
                ${maxParty > 1 ? `<label class="f"><span>How many in your party, including you?</span>
                  <select name="partySize">${Array.from({ length: maxParty }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("")}</select></label>
                <label class="f guest-names" hidden><span>Names of your guests</span><input name="guestNames" maxlength="400" placeholder="Separate names with commas"/></label>` : ""}
                ${meals.length ? `<label class="f"><span>Meal choice</span><select name="meal"><option value="">Choose one</option>${meals.map((m) => `<option>${esc(m)}</option>`).join("")}</select></label>` : ""}
                <label class="f"><span>Allergies or dietary needs</span><input name="dietary" maxlength="300"/></label>
                ${r.askSong ? `<label class="f"><span>A song that will get you dancing</span><input name="song" maxlength="150"/></label>` : ""}
              </div>
              <div class="f-row">
                <label class="f"><span>Email</span><input name="email" type="email" autocomplete="email" maxlength="120"/></label>
                <label class="f"><span>Phone</span><input name="phone" type="tel" autocomplete="tel" maxlength="40"/></label>
              </div>
              <label class="f"><span>A note for us</span><textarea name="message" rows="3" maxlength="1000"></textarea></label>
              <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"/></label>
              <p class="form-msg" id="rsvp-msg" role="alert"></p>
              <button class="btn-gold wide" type="submit">Send RSVP</button>
            </form>`}
          </div>
        </div>
      </section>`;
  }

  /* ---------- Behavior ---------- */
  function wire(s, events, gallery) {
    // Solid nav after the hero
    const nav = document.getElementById("topnav");
    const hero = document.querySelector(".hero");
    if ("IntersectionObserver" in window && hero) {
      new IntersectionObserver(([entry]) => nav.classList.toggle("solid", !entry.isIntersecting), { rootMargin: "-80px 0px 0px 0px" }).observe(hero);
    } else nav.classList.add("solid");

    // Mobile menu
    const btn = document.getElementById("menu-btn"), links = document.getElementById("nav-links");
    btn.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("menu-open", open);
    });
    links.addEventListener("click", (e) => {
      if (e.target.closest("a")) { links.classList.remove("open"); nav.classList.remove("menu-open"); btn.setAttribute("aria-expanded", "false"); }
    });

    // Calendar files
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-ics]");
      if (!b) return;
      const ev = events.find((x) => (x.id || x.title) === b.dataset.ics);
      if (ev) downloadIcs(ev, s);
    });

    // Gallery lightbox
    const lb = document.getElementById("lightbox"), img = document.getElementById("lb-img"), cap = document.getElementById("lb-cap");
    let idx = 0, lastFocus = null;
    const show = (i) => {
      idx = (i + gallery.length) % gallery.length;
      img.src = photo(gallery[idx].id);
      img.alt = gallery[idx].caption || "";
      cap.textContent = gallery[idx].caption || "";
    };
    const open = (i) => { lastFocus = document.activeElement; show(i); lb.hidden = false; document.body.style.overflow = "hidden"; lb.querySelector(".lb-close").focus(); };
    const close = () => { lb.hidden = true; document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); };
    root.addEventListener("click", (e) => {
      const shot = e.target.closest("[data-lightbox]");
      if (shot) { open(Number(shot.dataset.lightbox)); return; }
      const ctl = e.target.closest("[data-lb]");
      if (ctl) { ({ close, prev: () => show(idx - 1), next: () => show(idx + 1) })[ctl.dataset.lb](); return; }
      if (e.target === lb) close();
    });
    document.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });

    // RSVP form
    const form = document.getElementById("rsvp-form");
    if (!form) return;
    const started = Date.now();
    const yesOnly = form.querySelector(".yes-only");
    const guestNames = form.querySelector(".guest-names");
    form.addEventListener("change", () => {
      const yes = form.elements.attending.value === "yes";
      yesOnly.hidden = !yes;
      if (guestNames && form.elements.partySize) guestNames.hidden = !(yes && Number(form.elements.partySize.value) > 1);
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("rsvp-msg");
      const data = Object.fromEntries(new FormData(form).entries());
      msg.textContent = "";
      msg.className = "form-msg";
      if (!data.name || !data.name.trim()) { msg.textContent = "Please enter your name."; form.elements.name.focus(); return; }
      if (!data.attending) { msg.textContent = "Please let us know whether you can attend."; return; }
      const submit = form.querySelector("button[type=submit]");
      submit.disabled = true; submit.textContent = "Sending";
      try {
        const res = await fetch("/api/rsvp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, elapsed: Date.now() - started }) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "We couldn't send your RSVP. Please try again.");
        form.outerHTML = `<div class="rsvp-thanks"><h3>Thank you, ${esc(data.name.trim().split(" ")[0])}</h3><p>${data.attending === "yes" ? "We can't wait to celebrate with you." : "We'll miss you, and we appreciate you letting us know."}</p></div>`;
      } catch (err) {
        msg.textContent = err.message === "Failed to fetch" ? "We couldn't reach the server. Check your connection and try again." : err.message;
        submit.disabled = false; submit.textContent = "Send RSVP";
      }
    });
  }

  function downloadIcs(ev, s) {
    const d = ev.date.replace(/-/g, "");
    const t = (x) => (x ? `T${x.replace(":", "")}00` : "");
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wedding//Website//EN", "BEGIN:VEVENT",
      `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@wedding`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      ev.time ? `DTSTART:${d}${t(ev.time)}` : `DTSTART;VALUE=DATE:${d}`,
      ev.time ? `DTEND:${d}${t(ev.endTime || ev.time)}` : "",
      `SUMMARY:${icsText(`${ev.title}: ${s.name1} & ${s.name2}`)}`,
      `LOCATION:${icsText([ev.venue, ev.address].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${icsText([ev.dress ? `Attire: ${ev.dress}` : "", ev.notes, location.origin].filter(Boolean).join("\n"))}`,
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean);
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${ev.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const icsText = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  load();
})();
