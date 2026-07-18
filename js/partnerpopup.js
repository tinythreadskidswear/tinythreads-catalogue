/* ============================================
   TinyThreads — Society Partner Popup Logic
   Uses plain fetch() against the Supabase REST API,
   same pattern as app.js (loadProducts()) — no
   supabase-js client dependency, fully consistent
   with the rest of the codebase.
   ANON KEY only — RLS restricts what's exposed:
     - societies: public read (active only)
     - resellers: public read (no commission/payout fields)
     - partner_leads: insert-only, no read
   ============================================ */

(function () {
  const STORAGE_KEY = "tt_partner_match"; // { societyId, resellerId, name, photo, whatsapp, location, quote, rating, ts }
  const WHATSAPP_BASE = "https://wa.me/"; // partner numbers stored without '+' e.g. 9198xxxxxx
  const OWNER_WHATSAPP = "917879976016"; // used for "Become a Partner" leads

  const SUPABASE_URL = "https://gtszuhmfpywqwdetoqqo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c3p1aG1mcHl3cXdkZXRvcXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzU5ODcsImV4cCI6MjA5NTIxMTk4N30.-LVroO9ReQEjlLO1XQ3pTrijydMBNH739k05ixo3ZE0";
  const REST = SUPABASE_URL + "/rest/v1";
  const HEADERS = {
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + SUPABASE_KEY,
  };

  let els = {};
  let currentSocietyName = "";

  const DEFAULT_ICON_SVG = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>';

  function cacheEls() {
    els.backdrop = document.getElementById("tt-sheet-backdrop");
    els.sheet = document.getElementById("tt-partner-sheet");
    els.content = document.getElementById("tt-sheet-content");
    els.closeBtn = document.getElementById("tt-sheet-close");
    els.chip = document.getElementById("tt-partner-chip");
  }

  function openSheet() {
    els.backdrop.classList.add("tt-open");
    els.sheet.classList.add("tt-open");
  }
  function closeSheet() {
    els.backdrop.classList.remove("tt-open");
    els.sheet.classList.remove("tt-open");
  }

  // ---------- Keep the partner cutout photo from clipping off the top ----------
  // Base numbers match the original fixed design: a 280px photo that rises
  // 210px above the sheet's top edge, with an 80px flow-spacer underneath
  // (280 - 210 + 10 = 80, so at full scale nothing visually changes).
  const PHOTO_BASE_SIZE = 280;
  const PHOTO_BASE_RISE = 210;
  const PHOTO_MIN_SCALE = 0.55;

  function fitPartnerPhoto() {
    if (!els.sheet || !document.getElementById("tt-photo-wrap")) return;

    // Space available above the sheet, minus whatever fixed header
    // (nav bar / promo ticker) sits at the very top of the viewport.
    const navEl = document.querySelector("nav");
    const safeTop = (navEl ? navEl.getBoundingClientRect().bottom : 0) + 12;

    // Bottom sheet is anchored to the bottom of the viewport, so its resting
    // top edge is simply viewport height minus its own rendered height —
    // true even mid-animation, since offsetHeight isn't affected by transform.
    const sheetTop = window.innerHeight - els.sheet.offsetHeight;
    const available = sheetTop - safeTop;

    const scale = Math.max(PHOTO_MIN_SCALE, Math.min(1, available / PHOTO_BASE_RISE));
    const size = Math.round(PHOTO_BASE_SIZE * scale);
    const rise = Math.round(PHOTO_BASE_RISE * scale);
    const spacer = size - rise + 10;

    els.sheet.style.setProperty("--tt-photo-size", size + "px");
    els.sheet.style.setProperty("--tt-photo-rise", rise + "px");
    els.sheet.style.setProperty("--tt-photo-spacer", spacer + "px");
  }

  function renderTemplate(id) {
    const tpl = document.getElementById(id);
    els.content.innerHTML = "";
    els.content.appendChild(tpl.content.cloneNode(true));
    wireActionButtons();
  }

  function wireActionButtons() {
    els.content.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const action = e.currentTarget.getAttribute("data-action");
        if (action === "dismiss") closeSheet();
        if (action === "retry") showEntry();
        if (action === "locate") handleLocate();
        if (action === "become-partner") showBecomePartner(currentSocietyName);
      });
    });

    const input = document.getElementById("tt-society-input");
    if (input) {
      input.addEventListener("input", debounce(handleSocietySearch, 300));
    }
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // ---------- Entry state ----------
  function showEntry() {
    renderTemplate("tt-tpl-entry");
  }

  async function handleSocietySearch(e) {
    const q = e.target.value.trim();
    const list = document.getElementById("tt-autocomplete-list");
    if (q.length < 2) {
      list.classList.remove("tt-show");
      list.innerHTML = "";
      return;
    }

    let data = [];
    try {
      const url =
        REST +
        "/resellers?select=id,society_name,area,pincode&active=eq.true&society_name=ilike.*" +
        encodeURIComponent(q) +
        "*&limit=8";
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error("Supabase " + res.status);
      data = await res.json();
    } catch (err) {
      console.warn("Society search failed:", err.message);
      return;
    }

    if (data.length === 0) {
      // Show a "not found" row that triggers the become-partner flow
      list.innerHTML =
        '<div class="tt-autocomplete-item tt-autocomplete-noresult" data-no-result="true" data-society-name="' + escapeHtml(q) + '">' +
          '<span class="tt-ac-noresult-label">\u{1F3E1} &ldquo;' + escapeHtml(q) + '&rdquo; &mdash; not found yet</span>' +
          '<span class="tt-ac-noresult-cta">Become our Partner &rarr;</span>' +
        '</div>';
      list.classList.add("tt-show");
      list.querySelector("[data-no-result]").addEventListener("click", () => {
        list.classList.remove("tt-show");
        currentSocietyName = q;
        showNotFound(q);
        openSheet();
      });
      return;
    }

    list.innerHTML = data
      .map((s) => {
        const meta = [s.area, s.pincode].filter(Boolean).join(" \u00B7 ");
        return (
          '<div class="tt-autocomplete-item" data-society-id="' + s.id + '" data-society-name="' + escapeHtml(s.society_name) + '">' +
            '<span class="tt-ac-name">' + escapeHtml(s.society_name) + "</span>" +
            (meta ? '<span class="tt-ac-meta">' + escapeHtml(meta) + "</span>" : "") +
          "</div>"
        );
      })
      .join("");
    list.classList.add("tt-show");

    list.querySelectorAll(".tt-autocomplete-item").forEach((item) => {
      item.addEventListener("click", () => {
        list.classList.remove("tt-show");
        lookupSociety(item.dataset.societyId, item.dataset.societyName);
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Geolocation shortcut (placeholder — Worker not built yet) ----------
  function handleLocate() {
    if (!navigator.geolocation) {
      alert("Location isn't available on this browser. Please type your society name instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/reverse-geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          const json = await res.json();
          if (json.societyId) {
            lookupSociety(json.societyId, json.societyName);
          } else {
            alert("Couldn't match your exact society — please type it instead.");
          }
        } catch (err) {
          console.error("Reverse geocode failed", err);
          alert("Couldn't fetch your location right now — please type your society name.");
        }
      },
      () => {
        alert("Location permission denied. Please type your society name instead.");
      }
    );
  }

  // ---------- Lookup + reveal ----------
  async function lookupSociety(resellerId, societyName) {
    currentSocietyName = societyName;

    let partner = null;
    try {
      const res = await fetch(
        REST +
          "/resellers?select=id,society_name,partner_name,reseller_name,photo_url,whatsapp_number,area,wing,rating,families_helped&id=eq." +
          resellerId +
          "&active=eq.true",
        { headers: HEADERS }
      );
      if (!res.ok) throw new Error("Supabase " + res.status);
      const rows = await res.json();
      partner = rows[0];
    } catch (err) {
      console.warn("Partner lookup failed:", err.message);
    }

    if (!partner) {
      showNotFound(societyName);
      return;
    }

    showFound(partner);
  }

  function showFound(partner) {
    renderTemplate("tt-tpl-found");

    const displayName = partner.partner_name || partner.reseller_name;

    document.getElementById("tt-partner-photo").src = partner.photo_url || "/assets/default-partner.png";
    document.getElementById("tt-partner-name").textContent = displayName;
    document.getElementById("tt-partner-location").textContent =
      `📍 ${partner.society_name}${partner.wing ? ", " + partner.wing : ""}`;
    document.getElementById("tt-partner-rating").textContent = `⭐ ${partner.rating || "4.9"}`;
    document.getElementById("tt-partner-quote").textContent = partner.families_helped
      ? `"Helped ${partner.families_helped} families in your society find the perfect fit"`
      : `"Excited to help your family find the perfect fit!"`;

    const waNumber = (partner.whatsapp_number || "").replace(/\D/g, "");
    const waMsg = encodeURIComponent(
      `Hi ${displayName}! I found you via TinyThreads as the partner for ${partner.society_name}.`
    );
    document.getElementById("tt-whatsapp-link").href = `${WHATSAPP_BASE}${waNumber}?text=${waMsg}`;

    const matchData = {
      resellerId: partner.id,
      name: displayName,
      photo: partner.photo_url,
      whatsapp: waNumber,
      societyName: partner.society_name,
      ts: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matchData));
    renderChip(matchData);

    openSheet();
    fitPartnerPhoto();

    // trigger one-time sparkle burst around the photo
    const photoWrap = document.getElementById("tt-photo-wrap");
    if (photoWrap) {
      photoWrap.classList.add("tt-sparkle-burst");
      setTimeout(() => photoWrap.classList.remove("tt-sparkle-burst"), 1200);
    }
  }

  function showNotFound(societyName) {
    renderTemplate("tt-tpl-not-found");
    document.getElementById("tt-society-name-echo").textContent = societyName;
  }

  function showBecomePartner(societyName) {
    renderTemplate("tt-tpl-become-partner");
    document.getElementById("tt-bp-society-name").textContent = societyName || "your society";

    const waMsg = encodeURIComponent(
      `Hi! I'd like to become a TinyThreads Partner for ${societyName || "my society"}.`
    );
    document.getElementById("tt-bp-whatsapp-link").href = `${WHATSAPP_BASE}${OWNER_WHATSAPP}?text=${waMsg}`;

    fetch(REST + "/partner_leads", {
      method: "POST",
      headers: {
        ...HEADERS,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify([{ society_name: societyName || "Unknown" }]),
    }).catch((err) => console.warn("Lead insert failed:", err.message));
  }

  // ---------- Returning-visit badge ----------
  // The chip now lives permanently in the top nav (index.html .nav-right,
  // beside the basket button) — it is never floated or moved. We only ever
  // swap its icon between the default store icon and the matched partner's
  // photo, and swap the label between "Chat with a Partner" and
  // "Chat with <PartnerName>" once a match is found.
  function renderChip(matchData) {
    const iconEl = els.chip.querySelector(".tt-partner-navbtn-icon");
    const labelEl = els.chip.querySelector(".tt-partner-navbtn-label");

    if (matchData) {
      // Partner matched — show avatar (face anchored to top), swap label
      els.chip.classList.remove("tt-partner-chip--default");
      els.chip.classList.add("tt-partner-chip--identified");
      if (iconEl) {
        iconEl.innerHTML = `<img class="tt-partner-navbtn-avatar" src="${matchData.photo || "/assets/default-partner.png"}" alt="${matchData.name}">`;
      }
      const firstName = (matchData.name || "").trim().split(" ")[0];
      if (labelEl) labelEl.textContent = firstName ? `Chat with ${firstName}` : "Chat with your Partner";
      els.chip.title = matchData.name + " · Your TinyThreads Partner";
      els.chip.setAttribute("aria-label", "Chat with " + matchData.name + ", your TinyThreads Partner");
      els.chip.onclick = () => reopenFromCache(matchData);
    } else {
      // No match yet — show store icon, keep default class + label
      els.chip.classList.add("tt-partner-chip--default");
      els.chip.classList.remove("tt-partner-chip--identified");
      if (iconEl) {
        iconEl.innerHTML = DEFAULT_ICON_SVG;
      }
      if (labelEl) labelEl.textContent = "Chat Partner";
      els.chip.title = "Chat with a TinyThreads Partner";
      els.chip.setAttribute("aria-label", "Chat with a TinyThreads Partner");
      els.chip.onclick = () => { showEntry(); openSheet(); };
    }
  }

  function reopenFromCache(matchData) {
    lookupSociety(matchData.resellerId, matchData.societyName);
  }

  // ---------- Init ----------
  function init() {
    cacheEls();
    els.closeBtn.addEventListener("click", closeSheet);
    els.backdrop.addEventListener("click", closeSheet);

    // Re-fit the partner photo if the viewport height changes while the
    // "found" sheet is open (orientation change, mobile address-bar show/hide)
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (els.sheet.classList.contains("tt-open") && document.getElementById("tt-photo-wrap")) {
          fitPartnerPhoto();
        }
      }, 150);
    });

    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const matchData = JSON.parse(cached);
        renderChip(matchData);
      } catch (e) {
        renderChip(null);
        showEntry();
        openSheet();
      }
    } else {
      // No match yet — chip shows 🏪 icon; sheet auto-opens after brief delay
      renderChip(null);
      showEntry();
      setTimeout(openSheet, 600);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
