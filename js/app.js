// ════════════════════════════════════════════════════════════
// TINY THREADS — app.js
// Splash screen (IIFE), product loading/rendering, filters/sort,
// basket/cart logic, PDP (product detail page), page routing,
// mobile menu, toasts, swipers, size guide, recently viewed,
// similar items, promo popup
// This is ONE cohesive script — all top-level functions/vars are
// implicit globals (classic, non-module script), exactly as they
// behaved inline. Load this AFTER supabase-js and swiper, BEFORE
// the other smaller feature scripts that call into it.
// ════════════════════════════════════════════════════════════


    // =============================================
// SPLASH SCREEN JS  — video-first patch
// v2 — mobile-hardened edition
// =============================================
// DROP-IN REPLACEMENT for the existing splash IIFE in index.html.
// Delete everything from the opening:
//   // =============================================
//   // SPLASH SCREEN JS
//   // =============================================
//   (function () {
// …all the way down to its closing… })();
// Then paste this entire block in its place.
// =============================================
(function () {
  'use strict';

  if (!document.getElementById('splash-screen')) return;

  // ── CONFIG ────────────────────────────────────────────────────────────────
  // Desktop video
  var SPLASH_VIDEO_URL_DESKTOP = 'https://res.cloudinary.com/tinythreads/video/upload/q_auto,vc_auto/v1781069775/WhatsApp_Video_2026-06-10_at_9.55.04_AM_lva3a6.mp4';

  // Mobile video — portrait-optimised, replace with your actual Cloudinary URL
  var SPLASH_VIDEO_URL_MOBILE  = 'https://res.cloudinary.com/tinythreads/video/upload/q_auto,vc_auto/v1782289816/gemini_generated_video_664377c6_tvfvpm.mp4'


  // Pick video based on screen width: ≤768 px → mobile, wider → desktop
  var SPLASH_VIDEO_URL = (window.innerWidth <= 768) ? SPLASH_VIDEO_URL_MOBILE : SPLASH_VIDEO_URL_DESKTOP;

  // Poster: first splash photo, portrait crop — shown instantly while video buffers
  // This is your existing splash slide 1 image, resized to mobile dimensions
  var SPLASH_POSTER_URL = 'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_600,h_900,g_north,q_auto,f_auto/v1777272488/tinythreads/IMG-20260117-WA0008_ds6761.jpg';

  var SLIDE_DURATION   = 1500;   // ms per photo slide after video ends
  var VIDEO_TIMEOUT_MS = 4000;   // ms before giving up on video (4s — safe for mobile 4G)
  // ─────────────────────────────────────────────────────────────────────────

  var currentSlide = 0, splashTimer = null, slides, SLIDE_COUNT = 0;
  var videoPhaseActive = false;

  // ── PHOTO SLIDESHOW ───────────────────────────────────────────────────────

  function splashNext() {
    if (!slides || SLIDE_COUNT === 0) return;
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % SLIDE_COUNT;
    slides[currentSlide].classList.add('active');
  }

  function startPhotoSlideshow() {
    videoPhaseActive = false;
    var slidesContainer = document.querySelector('.splash-slides');
    if (slidesContainer) {
      slidesContainer.style.transition = 'opacity 0.8s ease';
      // rAF ensures the transition actually fires after opacity:0 was painted
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          slidesContainer.style.opacity = '1';
        });
      });
    }
    if (splashTimer) clearInterval(splashTimer);
    splashTimer = setInterval(splashNext, SLIDE_DURATION);
  }

  function updateSplashCarousel() {
    slides      = document.querySelectorAll('.splash-slide');
    SLIDE_COUNT = slides.length;
    if (SLIDE_COUNT === 0) { console.warn('[Splash] No slides found'); return; }
    slides.forEach(function (s) { s.classList.remove('active'); });
    slides[0].classList.add('active');
    currentSlide = 0;
    if (!videoPhaseActive) {
      if (splashTimer) clearInterval(splashTimer);
      splashTimer = setInterval(splashNext, SLIDE_DURATION);
    }
    console.log('[Splash] Carousel updated: ' + SLIDE_COUNT + ' slides');
  }

  // ── VIDEO PHASE ───────────────────────────────────────────────────────────

  function buildVideoElement(url) {
    var vid = document.createElement('video');
    vid.id  = 'splash-video';

    // ── Autoplay requirements (mobile-critical) ──
    // muted       → required by iOS Safari + Android Chrome for autoplay
    // playsinline → prevents iOS from hijacking into fullscreen player
    // Both the property AND the HTML attribute are set for maximum compatibility
    vid.muted   = true;
    vid.volume  = 0;                           // belt-and-braces mute for Android
    vid.setAttribute('muted', '');
    vid.autoplay = true;
    vid.setAttribute('autoplay', '');
    vid.playsInline = true;
    vid.setAttribute('playsinline', '');       // older iOS WebKit needs the attr
    vid.setAttribute('webkit-playsinline', '');// iOS 9 / WKWebView legacy

    vid.preload = 'auto';
    vid.loop    = false;
    vid.src     = url;

    // Poster: shown immediately while video buffers → no black flash on slow mobile
    if (SPLASH_POSTER_URL) vid.poster = SPLASH_POSTER_URL;

    // Styling: fills the splash card, same as the photo slides
    // z-index 2 → above .splash-slides (z:0), below .splash-content (z:10)
    vid.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'object-fit:cover',
      'object-position:center top',
      'display:block',
      'z-index:2',
      'opacity:0',
      'transition:opacity 0.6s ease',
      '-webkit-transform:translateZ(0)', // GPU layer — smoother on low-end Android
      'transform:translateZ(0)'
    ].join(';');

    return vid;
  }

  function startVideoPhase() {
    if (!SPLASH_VIDEO_URL) {
      startPhotoSlideshow();
      return;
    }

    videoPhaseActive = true;

    // Keep photos at opacity:0 while video plays (they're the fallback, still in DOM)
    var slidesContainer = document.querySelector('.splash-slides');
    if (slidesContainer) {
      slidesContainer.style.transition = 'opacity 0.4s ease';
      slidesContainer.style.opacity    = '0';
    }

    var card = document.getElementById('splash-card');
    if (!card) { startPhotoSlideshow(); return; }

    var vid = buildVideoElement(SPLASH_VIDEO_URL);
    // Insert before .splash-content so branding overlay sits on top
    var content = card.querySelector('.splash-content');
    card.insertBefore(vid, content || null);

    // ── Fallback timer ────────────────────────────────────────────────────
    // If video hasn't fired canplay within VIDEO_TIMEOUT_MS, give up silently.
    // 4 s covers most 4G connections; on Wi-Fi canplay fires in < 500 ms.
    var fallbackTimer = setTimeout(function () {
      if (!videoPhaseActive) return;
      console.warn('[Splash] Video timeout — falling back to photos');
      teardownVideo(vid);
      startPhotoSlideshow();
    }, VIDEO_TIMEOUT_MS);

    // ── Resolved flag — prevents double-resolution ─────────────────────
    var resolved = false;
    function resolve(reason) {
      if (resolved) return;
      resolved = true;
      clearTimeout(fallbackTimer);
      if (reason === 'play') {
        vid.style.opacity = '1';
        // vid.play() returns a Promise on modern browsers; .catch handles
        // the NotAllowedError thrown when autoplay is blocked
        var p = vid.play();
        if (p && p.catch) {
          p.catch(function (err) {
            console.warn('[Splash] Autoplay blocked:', err.message);
            teardownVideo(vid);
            startPhotoSlideshow();
          });
        }
      } else {
        teardownVideo(vid);
        startPhotoSlideshow();
      }
    }

    // canplay fires as soon as the browser has buffered enough to start
    // (fires before canplaythrough — better for slow connections)
    vid.addEventListener('canplay', function () { resolve('play'); }, { once: true });

    // ended → crossfade out video, crossfade in photos
    vid.addEventListener('ended', function () {
      if (!videoPhaseActive) return;
      videoPhaseActive = false;
      clearTimeout(fallbackTimer);
      vid.style.opacity = '0';
      setTimeout(function () {
        teardownVideo(vid);
        startPhotoSlideshow();
      }, 650);
    }, { once: true });

    // Hard error (404, codec unsupported, network offline)
    vid.addEventListener('error', function (e) {
      console.warn('[Splash] Video error:', e);
      resolve('error');
    }, { once: true });

    // stalled / suspend — browser gave up downloading (common on 2G / bad signal)
    vid.addEventListener('stalled',  function () {
      // Give it another 2 s before giving up
      setTimeout(function () {
        if (!videoPhaseActive || resolved) return;
        console.warn('[Splash] Video stalled — falling back');
        resolve('error');
      }, 2000);
    }, { once: true });
  }

  function teardownVideo(vid) {
    videoPhaseActive = false;
    if (!vid) return;
    try {
      vid.pause();
      vid.removeAttribute('src');
      vid.load();   // aborts any pending network request
    } catch (e) { /* ignore */ }
    if (vid.parentNode) vid.parentNode.removeChild(vid);
  }

  // ── ENTER SITE ────────────────────────────────────────────────────────────

  function enterSite() {
    var screen = document.getElementById('splash-screen');
    if (!screen || screen.style.display === 'none') return;

    videoPhaseActive = false;
    if (splashTimer) { clearInterval(splashTimer); splashTimer = null; }
    var vid = document.getElementById('splash-video');
    if (vid) teardownVideo(vid);

    sessionStorage.setItem('tt_splash_seen', '1');

    screen.classList.add('splash-exit');
    setTimeout(function () {
      document.body.classList.remove('splash-active');
      screen.style.display = 'none';
      screen.setAttribute('aria-hidden', 'true');
    }, 520);
  }

  // ── EXPOSE GLOBALS ────────────────────────────────────────────────────────
  window.enterSite            = enterSite;
  window.updateSplashCarousel = updateSplashCarousel;

  // ── INIT ──────────────────────────────────────────────────────────────────

  function initSplash() {
    var onProductPage = window.location.pathname.match(/^\/products\/([^/]+)/);
    if (sessionStorage.getItem('tt_splash_seen') || onProductPage) {
      var screen = document.getElementById('splash-screen');
      if (screen) { screen.style.display = 'none'; screen.setAttribute('aria-hidden', 'true'); }
      document.body.classList.remove('splash-active');
      return;
    }

    slides      = document.querySelectorAll('.splash-slide');
    SLIDE_COUNT = slides.length;
    if (!slides.length) return;

    document.body.classList.add('splash-active');
    startVideoPhase();

    // Keyboard: Escape / Enter → skip to site
    document.addEventListener('keydown', function (e) {
      var screen = document.getElementById('splash-screen');
      if (!screen || screen.style.display === 'none') return;
      var lbx = document.getElementById('lbx-overlay');
      var sg  = document.getElementById('sg-overlay');
      if ((lbx && lbx.classList.contains('open')) || (sg && sg.classList.contains('open'))) return;
      if (e.key === 'Escape' || e.key === 'Enter') enterSite();
    });

    // Tap anywhere on splash card (outside Explore button) → skip to site
    var card = document.getElementById('splash-card');
    if (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.splash-explore-btn')) return;
        enterSite();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSplash);
  } else {
    initSplash();
  }

})();
   
    // =============================================
    // MAIN CATALOGUE JS
    // =============================================
    const WA_NUMBER = '917879976016';
    const SUPABASE_URL = 'https://gtszuhmfpywqwdetoqqo.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c3p1aG1mcHl3cXdkZXRvcXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzU5ODcsImV4cCI6MjA5NTIxMTk4N30.-LVroO9ReQEjlLO1XQ3pTrijydMBNH739k05ixo3ZE0';
    let allProducts = [];
    let PROMO_CODES = {};          // populated from Supabase at boot via loadPromoCodes()
    let basket = [];
    let appliedPromo = null;
    const BASKET_SESSION_KEY = 'tt_basket';

    function getBasketItems() {
      return basket;
    }

    function saveBasketToSession() {
      try {
        sessionStorage.setItem(BASKET_SESSION_KEY, JSON.stringify(basket));
      } catch (e) { }
    }

    function restoreBasketFromSession() {
      try {
        const saved = JSON.parse(sessionStorage.getItem(BASKET_SESSION_KEY) || '[]');
        if (!Array.isArray(saved)) return;

        basket = saved
          .filter(function (item) { return item && item.id && item.name; })
          .map(function (item) {
            return {
              key: item.key || (item.id + '-' + (item.size || '')),
              id: item.id,
              name: item.name,
              desc: item.desc || '',
              price: Number(item.price) || 0,
              qty: Math.max(1, Number(item.qty) || 1),
              size: item.size || '',
              img: item.img || ''
            };
          });
      } catch (e) {
        basket = [];
      }
    }

    function syncCheckoutGlobals() {
      window.getBasketItems = getBasketItems;
      window.appliedPromo = appliedPromo;
    }

    // Returns the actual rupee discount for a given subtotal, respecting max_upto cap
    function calcDiscount(subtotal) {
      if (!appliedPromo) return 0;
      var raw = Math.round(subtotal * appliedPromo.discount);
      return (appliedPromo.max_upto && raw > appliedPromo.max_upto)
        ? Math.round(appliedPromo.max_upto)
        : raw;
    }

    // Legacy name→hex map -- used as fallback when no hex provided
    const COLOR_MAP = {
      'White': '#F5F5F5', 'Blue': '#1565C0', 'Cream': '#FFF8E1', 'Navy': '#0D47A1', 'Grey': '#9E9E9E',
      'Olive': '#827717', 'Red': '#B71C1C', 'Pink': '#E91E63', 'Yellow': '#FDD835', 'Mint': '#80CBC4',
      'Lilac': '#CE93D8', 'Gold': '#FFD600', 'Maroon': '#880E4F', 'Ivory': '#FFFDE7', 'Green': '#388E3C',
      'Sky Blue': '#29B6F6', 'Orange': '#F57C00', 'Teal': '#00796B', 'Mustard': '#F9A825', 'Magenta': '#AD1457',
      'Peach': '#FFAB91', 'Lavender': '#CE93D8', 'Dusty Rose': '#F48FB1', 'Sage': '#A5D6A7',
      'Blush': '#FFCDD2', 'Burgundy': '#4A148C', 'Pink Stars': '#F48FB1', 'Purple Hearts': '#CE93D8', 'Blue Stars': '#90CAF9'
    };

    const MULTICOLOR_BG = 'linear-gradient(135deg,#FF6B6B 0%,#FFD93D 25%,#6BCB77 50%,#4D96FF 75%,#FF6BFF 100%)';

    // Resolve a color entry -- handles:
    //   new format: {name:'Sky Blue', hex:'#87CEEB'}
    //   multicolor: {name:'Floral Print', hex:'multicolor'}
    //   old format: 'Sky Blue'  (string, looked up in COLOR_MAP)
    //   missing hex: {name:'Blue'} → falls back to COLOR_MAP → #CCC grey
    function resolveColor(c) {
      if (typeof c === 'string') {
        // Old string format -- look up in map, fallback grey
        return { name: c, bg: COLOR_MAP[c] || '#CCC' };
      }
      // New object format
      var name = c.name || '';
      var hex = c.hex || '';
      if (hex === 'multicolor') return { name: name, bg: MULTICOLOR_BG };
      if (hex && hex.startsWith('#')) return { name: name, bg: hex };
      // No hex -- try name lookup then grey
      return { name: name, bg: COLOR_MAP[name] || '#CCC' };
    }

    // Configuration loader
    let tinythreadsConfig = {};
    async function loadTinythreadsConfig() {
      try {
        const base = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const res = await fetch(base + 'tinythreads.properties');
        if (!res.ok) throw new Error('Config not found');
        const text = await res.text();
        const lines = text.split('\n');
        lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const [key, val] = trimmed.split('=');
          if (key && val) {
            const cleanKey = key.trim();
            const cleanVal = val.trim();
            if (cleanKey === 'autoPlayInterval') tinythreadsConfig.autoPlayInterval = parseInt(cleanVal) || 3000;
            if (cleanKey === 'enableDotPagination') tinythreadsConfig.enableDotPagination = cleanVal.toLowerCase() === 'true';
            if (cleanKey === 'autoPlayInfiniteLoop') tinythreadsConfig.autoPlayInfiniteLoop = cleanVal.toLowerCase() === 'true';
          }
        });
      } catch (e) {
        console.warn('Could not load tinythreads.properties, using defaults');
      }
      // Apply defaults
      tinythreadsConfig.autoPlayInterval = tinythreadsConfig.autoPlayInterval || 3000;
      tinythreadsConfig.enableDotPagination = tinythreadsConfig.enableDotPagination !== false;
      tinythreadsConfig.autoPlayInfiniteLoop = tinythreadsConfig.autoPlayInfiniteLoop !== false;
    }

    async function loadProducts() {
      // 1. Try Supabase (primary)
      var SUPABASE_URL = 'https://gtszuhmfpywqwdetoqqo.supabase.co';
      var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c3p1aG1mcHl3cXdkZXRvcXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzU5ODcsImV4cCI6MjA5NTIxMTk4N30.-LVroO9ReQEjlLO1XQ3pTrijydMBNH739k05ixo3ZE0';
      var loaded = false;
      try {
        var res = await fetch(
          SUPABASE_URL + '/rest/v1/products?active=eq.true&select=*&order=sort_order.asc.nullslast&order=created_at.desc',
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
        );
        if (!res.ok) throw new Error('Supabase ' + res.status);
        var rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          allProducts = rows.map(function (r) {
            return {
              id: r.id, name: r.name, description: r.description || '',
              price: parseFloat(r.price) || 0, badge: r.badge || '',
              fabric: r.fabric || '', featured: !!r.featured,
              category: r.category, subcategory: r.subcategory || '',
              collections: Array.isArray(r.collections) ? r.collections : [],
              images: Array.isArray(r.images) ? r.images : [],
              sizes: Array.isArray(r.sizes) ? r.sizes : [],
              colors: Array.isArray(r.colors) ? r.colors : [],
              age: r.age || r.ages || r.age_group || r.age_range || r.ageRange || '',
              sort_order: r.sort_order == null ? null : Number(r.sort_order),
              created_at: r.created_at || '',
              created_by: r.created_by || null
            };
          });
          loaded = true;
          console.log('Products loaded from Supabase:', allProducts.length);
        }
      } catch (e) { console.warn('Supabase failed, trying products.json:', e.message); }

      // 3. Last-resort minimal fallback
      if (!loaded) allProducts = getFallbackProducts();

      window.allProducts = allProducts;
      window.dispatchEvent(new CustomEvent('tt:productsloaded', { detail: { products: allProducts } }));
      renderAllGrids(); initTestimonialSwiper(); handleURLRouting();
    }

    function renderAllGrids() {
      const ALL_CATS = ['boys', 'girls', 'babies', 'nightwear', 'footwear', 'accessories', 'toys', 'twinning', 'kidscare', 'school', 'learning', 'celebration'];
      // renderGrid('featured-grid',allProducts.filter(p=>p.featured));
      renderGrid('featured-grid', allProducts.filter(p => p.featured).sort((a, b) => {
        const sa = a.sort_order == null ? Infinity : a.sort_order;
        const sb = b.sort_order == null ? Infinity : b.sort_order;
        return sa - sb;
      }));
      ALL_CATS.forEach(cat => {
        buildFilterBar(cat); // build filter chips based on actual products
        applyFilterAndSort(cat);
        const cnt = document.getElementById('cnt-' + cat);
        if (cnt) { const n = allProducts.filter(p => p.category === cat).length; cnt.textContent = n + (n === 1 ? ' product' : ' products'); }
      });
    }

    // ── FILTER + SORT STATE ──
    const categoryState = {};
    const SUBCAT_LABELS = {
      traditional: '🧵 Traditional', summer: '☀️ Summer', winter: '🧥 Winter',
      nightwear: '🌙 Nightwear', undergarments: '🧸 Undergarments',
      accessories: '💎 Accessories', toys: '🧸 Toys', twinning: '👨‍👧 Twinning',
      kidscare: '🧴 Kids Care', school: '🎒 School', learning: '📚 Learning', celebration: '🎉 Celebration',
      // Footwear -- rename these keys to match whatever values you store
      // in products.subcategory for category='footwear' in Supabase
      sandals: '🩴 Sandals', sports: '👟 Sports Shoes',
      'school-shoes': '🎒 School Shoes', ethnic: '🥿 Ethnic',
      slippers: '🥿 Slippers'
    };

    function getState(cat) {
      if (!categoryState[cat]) categoryState[cat] = { filter: 'all', subcategories: [], ages: [], priceMin: 100, priceMax: 3000, sort: 'default' };
      return categoryState[cat];
    }

    function buildFilterBar(cat) {
      const scroll = document.getElementById('filter-scroll-' + cat);
      if (window.TTFilterTray) {
        window.TTFilterTray.initCategory({
          cat: cat,
          products: allProducts,
          state: getState(cat),
          labels: SUBCAT_LABELS,
          onApply: applyFilterAndSort
        });
        return;
      }
      if (!scroll) return;
      const prods = allProducts.filter(p => p.category === cat);
      const subs = [...new Set(prods.map(p => p.subcategory).filter(Boolean))];

      // Build All button + subcategory chips
      scroll.innerHTML = '<button class="filter-btn active" onclick="filterProducts(\'' + cat + '\',\'all\',this)" data-all="1">All</button>';
      subs.forEach(function (sub) {
        if (!SUBCAT_LABELS[sub]) return;
        var btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.textContent = SUBCAT_LABELS[sub];
        btn.setAttribute('data-sub', sub);
        btn.onclick = function () { filterProducts(cat, sub, btn); };
        scroll.appendChild(btn);
      });
    }

    function _buildMobileFilterOverflow(cat, subs, drop) {
      // Populate the More dropdown with chips beyond the first 2
      drop.innerHTML = '';
      subs.slice(2).forEach(function (sub) {
        if (!SUBCAT_LABELS[sub]) return;
        var btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.textContent = SUBCAT_LABELS[sub];
        btn.setAttribute('data-sub', sub);
        btn.onclick = function (e) { e.stopPropagation(); filterProducts(cat, sub, btn); toggleFilterMore(cat, true); };
        drop.appendChild(btn);
      });
    }

    function toggleFilterMore(cat, forceClose) {
      var drop = document.getElementById('filter-more-drop-' + cat);
      if (!drop) return;
      if (forceClose) { drop.classList.remove('open'); return; }
      drop.classList.toggle('open');
    }

    function filterProducts(cat, sub, btn) {
      // Deactivate all filter chips (inline + dropdown)
      document.querySelectorAll('#filter-scroll-' + cat + ' .filter-btn').forEach(function (b) { b.classList.remove('active'); });
      var drop = document.getElementById('filter-more-drop-' + cat);
      if (drop) drop.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      // Highlight More button if active selection is inside the dropdown
      var moreBtn = document.getElementById('filter-more-btn-' + cat);
      if (moreBtn) {
        var inDrop = drop && drop.contains(btn);
        moreBtn.classList.toggle('has-active', inDrop && sub !== 'all');
      }

      var state = getState(cat);
      state.filter = sub;
      state.subcategories = sub === 'all' ? [] : [sub];
      applyFilterAndSort(cat);
    }

    function applySort(cat, sort, btn) {
      const row = document.getElementById('sort-chips-' + cat);
      if (row) row.querySelectorAll('.sort-chip').forEach(b => b.classList.remove('sort-chip-active'));
      if (btn) btn.classList.add('sort-chip-active');
      getState(cat).sort = sort;
      applyFilterAndSort(cat);
    }

    function applyFilterAndSort(cat) {
      const state = getState(cat);
      let prods = allProducts.filter(p => p.category === cat);
      if (window.TTFilterTray) {
        prods = prods.filter(p => window.TTFilterTray.productMatches(p, state));
      } else if (state.filter !== 'all') {
        prods = prods.filter(p => p.subcategory === state.filter);
      }
      switch (state.sort) {
        case 'price-asc': prods = [...prods].sort((a, b) => a.price - b.price); break;
        case 'price-desc': prods = [...prods].sort((a, b) => b.price - a.price); break;
        case 'new': prods = [...prods].sort((a, b) => {
          const bd = Date.parse(b.created_at || '') || 0;
          const ad = Date.parse(a.created_at || '') || 0;
          if (bd !== ad) return bd - ad;
          return (b.badge === 'New' ? 1 : 0) - (a.badge === 'New' ? 1 : 0);
        }); break;
        case 'az': prods = [...prods].sort((a, b) => a.name.localeCompare(b.name)); break;
        default: prods = [...prods].sort((a, b) => {
          const sa = a.sort_order == null ? Infinity : a.sort_order;
          const sb = b.sort_order == null ? Infinity : b.sort_order;
          return sa - sb;
        }); break;
      }
      renderGrid(cat + '-grid', prods);
    }

    // Legacy stubs (no longer needed)
    function toggleSortMenu() { }
    function toggleFsPanel() { }
    function closeFsPanel() { }

    function renderGrid(id, products) {
      const grid = document.getElementById(id); if (!grid) return;
      if (products.length === 0) { grid.innerHTML = '<div class="loading-grid" style="grid-column:1/-1;">No products found in this category yet.</div>'; return; }
      if (window.TTProductCard && typeof window.TTProductCard.renderInto === 'function') {
        window.TTProductCard.renderInto(grid, products, { context: 'category' });
        return;
      }
      grid.innerHTML = '<div class="loading-grid" style="grid-column:1/-1;">Products are loading...</div>';
    }

    const selectedSizes = {};
    function selectSize(btn, key) {
      btn.closest('.size-pills').querySelectorAll('.size-pill').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected'); selectedSizes[key] = btn.textContent;
    }

    function productCard(p) {
      const key = p.id;
      const badgeHtml = p.badge ? `<div class="prod-badge">${p.badge}</div>` : '';
      const hasRealImages = p.images && p.images.length > 0 && !p.images[0].includes('YOUR_CLOUD_NAME');
      let slidesHtml = '';
      if (hasRealImages) {
        slidesHtml = p.images.map(url => {
          const transformed = url.includes('res.cloudinary.com')
            ? url.replace('/upload/', '/upload/c_fill,ar_3:4,g_north,w_600,q_auto,f_auto/')
            : url;
          return `<div class="swiper-slide"><img src="${transformed}" alt="${p.name}" loading="lazy" onerror="if(this.src!=='${url}')this.src='${url}';"></div>`;
        }).join('');
      } else {
        const icons = { traditional: '🧵', summer: '☀️', winter: '🧥', nightwear: '🌙', undergarments: '🧸',
          sandals: '🩴', sports: '👟', 'school-shoes': '🎒', ethnic: '🥿', slippers: '🥿' };
        slidesHtml = `<div class="swiper-slide"><div class="slide-ph"><span class="ph-icon">${icons[p.subcategory] || '📸'}</span><span class="ph-text">${p.name}</span></div></div>`;
      }
      const sizesHtml = p.sizes ? p.sizes.map(s => `<button type="button" class="size-pill" onclick="event.stopPropagation();selectSize(this,'${key}')">${s}</button>`).join('') : '';
      const colorsHtml = p.colors && p.colors.length ? p.colors.slice(0, 6).map(c => { const r = resolveColor(c); return `<span class="color-dot" title="${r.name}" style="background:${r.bg}"></span>`; }).join('') : '';

      const subcatLabel = { traditional: 'Traditional', summer: 'Summer', winter: 'Winter', nightwear: 'Nightwear', undergarments: 'Undergarments', accessories: 'Accessories', toys: 'Toys', twinning: 'Twinning', kidscare: 'Kids Care', school: 'School', learning: 'Learning', celebration: 'Celebration' }[p.subcategory] || p.subcategory || '';
      return `<div class="prod-card" id="card-${key}">
    <div class="prod-swiper-wrap">
      ${badgeHtml}
      <div class="swiper prod-swiper">
        <div class="swiper-wrapper">${slidesHtml}</div>
        ${p.images && p.images.length > 1 ? '<div class="swiper-pagination"></div>' : ''}
      </div>
      <div class="prod-tap-zone" onclick="openPDP('${key}')"></div>
    </div>
    <div class="prod-info" onclick="openPDP('${key}')">
      <div class="prod-name">${p.name}</div>
      <div class="prod-meta">
        <div class="prod-desc">${subcatLabel}${p.description ? ' · ' + p.description.substring(0, 55) + (p.description.length > 55 ? '...' : '') : ''}</div>
        <span class="fabric-chip">🧶 ${p.fabric || 'Cotton'}</span>
        ${p.sizes && p.sizes.length > 0 ? `<div class="size-label">Select Size:</div><div class="size-pills" id="sizes-${key}">${sizesHtml}</div>` : ''}
      </div>
      <div class="prod-footer">
        <span class="prod-price">₹${p.price.toLocaleString('en-IN')}</span>
        <div class="prod-actions" onclick="event.stopPropagation()">
          <button type="button" class="prod-share-btn" onclick="shareProduct('${key}')" aria-label="Share">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          <button type="button" class="add-basket-btn" id="abtn-${key}" onclick="addToBasket('${key}')">🛒 Add</button>
          <button type="button" class="prod-wa-btn" onclick="waEnquire('${p.name.replace(/'/g, "\\'")}','${p.price}')" aria-label="WhatsApp">
            <svg style="width:13px;height:13px;fill:#25D366;" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>`;
    }

    function addToBasket(key, options) {
      const p = allProducts.find(p => p.id === key); if (!p) return;
      const opts = options && typeof options === 'object' ? options : {};
      const size = opts.size || selectedSizes[key] || (p.sizes && p.sizes.length > 0 ? '(size not selected)' : '');
      const color = opts.color || '';
      const bkey = key + '-' + size + (color ? '-' + color : '');
      const existing = basket.find(i => i.key === bkey);
      if (existing) { existing.qty += 1; }
      else { basket.push({ key: bkey, id: key, name: p.name, desc: `${p.subcategory || ''} · Size: ${size || 'N/A'}${color ? ' · Color: ' + color : ''}`, price: p.price, qty: 1, size, color, img: (p.images && p.images[0]) ? p.images[0] : '' }); }
      updateBasketUI(); showToast(`Added ${p.name} to basket 🛒`);
      const btn = document.getElementById('abtn-' + key);
      if (btn) { btn.classList.add('added'); btn.textContent = '✓ Added!'; setTimeout(() => { btn.classList.remove('added'); btn.innerHTML = '🛒 Add'; }, 1400); }
    }

    function removeFromBasket(key) { basket = basket.filter(i => i.key !== key); updateBasketUI(); }
    function changeQty(key, delta) {
      const item = basket.find(i => i.key === key); if (!item) return;
      item.qty += delta;
      if (item.qty <= 0) basket = basket.filter(i => i.key !== key);
      updateBasketUI();
    }

    function setCheckoutButtonLabel() {
      const label = document.getElementById('checkout-btn-label');
      if (label) label.textContent = appliedPromo ? 'Checkout' : 'Checkout via WhatsApp';
    }

    function updateBasketUI() {
      saveBasketToSession();
      syncCheckoutGlobals();
      setCheckoutButtonLabel();

      const totalItems = basket.reduce((s, i) => s + i.qty, 0);
      const subtotal = basket.reduce((s, i) => s + i.qty * i.price, 0);
      const discountAmt = calcDiscount(subtotal);
      const total = subtotal - discountAmt;
      document.getElementById('nav-basket-count').textContent = totalItems;
      document.getElementById('nav-basket-count').style.background = totalItems > 0 ? 'var(--red)' : '#CCC';
      document.getElementById('basket-subtotal').textContent = '₹' + subtotal.toLocaleString('en-IN');
      document.getElementById('basket-total').textContent = '₹' + total.toLocaleString('en-IN');
      document.getElementById('basket-item-count').textContent = totalItems > 0 ? `${totalItems} item${totalItems > 1 ? 's' : ''} in your basket` : '';
      document.getElementById('checkout-btn').disabled = basket.length === 0;
      var stickyTotal = document.getElementById('basket-sticky-total');
      var stickyCount = document.getElementById('basket-sticky-count');
      if (stickyTotal) stickyTotal.textContent = '₹' + total.toLocaleString('en-IN');
      if (stickyCount) stickyCount.textContent = totalItems > 0 ? `${totalItems} item${totalItems > 1 ? 's' : ''}` : 'Your basket is empty';
      var waCard = document.getElementById('wa-how-it-works');
      if (waCard) { waCard.classList.toggle('dimmed', basket.length === 0); }
      const discRow = document.getElementById('discount-row');
      if (appliedPromo && subtotal > 0) {
        discRow.style.display = 'flex';
        document.getElementById('discount-label').textContent = appliedPromo.label;
        document.getElementById('discount-amount').textContent = '−₹' + discountAmt.toLocaleString('en-IN');
      } else { discRow.style.display = 'none'; }
      const mbnBadge = document.getElementById('mbn-basket-count');
      if (mbnBadge) { mbnBadge.textContent = totalItems; mbnBadge.style.display = totalItems > 0 ? 'flex' : 'none'; }
      const body = document.getElementById('basket-body');
      if (basket.length === 0) { body.innerHTML = `<div class="basket-empty"><span class="basket-empty-icon">🛍️</span><p>Your basket is empty.<br>Add items you love and checkout via WhatsApp!</p></div>`; return; }
      body.innerHTML = basket.map(function(item) {
        var thumbUrl = item.img
          ? item.img.replace('/upload/', '/upload/c_fill,w_100,h_100,g_north,q_auto,f_auto/')
          : '';
        var thumbHtml = thumbUrl
          ? '<img class="basket-item-thumb" src="' + thumbUrl + '" alt="' + item.name + '" loading="lazy" onerror="this.style.display=\'none\'">'
          : '<div class="basket-item-thumb basket-item-thumb--ph"></div>';
        return '<div class="basket-item">'
          + thumbHtml
          + '<div class="basket-item-info">'
          + '<div class="basket-item-name">' + item.name + '</div>'
          + '<div class="basket-item-desc">' + item.desc + '</div>'
          + '<div class="basket-item-price">\u20B9' + (item.price * item.qty).toLocaleString('en-IN')
          + (item.qty > 1 ? ' <span style="font-size:11px;font-weight:400;color:var(--muted);">(\u20B9' + item.price + ' \xd7 ' + item.qty + ')</span>' : '')
          + '</div>'
          + '<div class="basket-item-qty">'
          + '<button class="qty-btn" onclick="changeQty(\'' + item.key + '\',-1)">−</button>'
          + '<span class="qty-val">' + item.qty + '</span>'
          + '<button class="qty-btn" onclick="changeQty(\'' + item.key + '\',1)">+</button>'
          + '</div>'
          + '</div>'
          + '<button class="basket-remove" onclick="removeFromBasket(\'' + item.key + '\')">\u2715</button>'
          + '</div>';
      }).join('');
    }

    function applyPromo() {
      const code = document.getElementById('promo-input').value.trim().toUpperCase();
      const btn  = document.getElementById('promo-apply-btn');
      const msg  = document.getElementById('promo-msg');
      if (appliedPromo) { return; }

      const pc = PROMO_CODES[code];
      if (!pc) {
        msg.className = 'promo-msg error';
        msg.textContent = 'Invalid promo code. Please check and try again.';
        document.getElementById('promo-input').classList.add('invalid');
        setTimeout(() => document.getElementById('promo-input').classList.remove('invalid'), 1500);
        return;
      }

      // min_order check
      const cartTotal = basket.reduce((s, i) => s + i.price * i.qty, 0);
      if (pc.min_order && cartTotal < pc.min_order) {
        msg.className = 'promo-msg error';
        msg.textContent = `Minimum order ₹${pc.min_order} required for this code.`;
        document.getElementById('promo-input').classList.add('invalid');
        setTimeout(() => document.getElementById('promo-input').classList.remove('invalid'), 1500);
        return;
      }

      appliedPromo = { ...pc };
      syncCheckoutGlobals();
      const pct = Math.round(pc.discount * 100);
      let successMsg = `✓ Code applied! ${pct}% off your order.`;
      if (pc.max_upto) successMsg += ` (max discount ₹${pc.max_upto})`;
      msg.className = 'promo-msg success'; msg.textContent = successMsg;
      btn.textContent = 'Applied ✓'; btn.classList.add('applied');
      document.getElementById('promo-input').classList.add('valid');
      updateBasketUI();
    }

    function removePromo() {
      appliedPromo = null;
      syncCheckoutGlobals();
      document.getElementById('promo-input').value = '';
      document.getElementById('promo-input').classList.remove('valid', 'invalid');
      document.getElementById('promo-apply-btn').textContent = 'Apply';
      document.getElementById('promo-apply-btn').classList.remove('applied');
      document.getElementById('promo-msg').className = 'promo-msg';
      document.getElementById('promo-msg').textContent = '';
      updateBasketUI();
    }

    function openBasket() { document.getElementById('basket-drawer').classList.add('open'); document.getElementById('basket-overlay').classList.add('open'); document.body.style.overflow = 'hidden'; }
    function closeBasket() {
      document.getElementById('basket-drawer').classList.remove('open');
      document.getElementById('basket-overlay').classList.remove('open');
      document.body.style.overflow = '';
      closeCheckoutTray(); // collapse nested tray too, so basket re-opens fresh on Preview screen
    }

    // Nested checkout tray (mobile only — CSS makes this a no-op on desktop
    // since .basket-checkout-panel sits inline there already)
    function openCheckoutTray() {
      document.getElementById('basket-checkout-panel').classList.add('open');
      document.getElementById('checkout-tray-overlay').classList.add('open');
    }
    function closeCheckoutTray() {
      document.getElementById('basket-checkout-panel').classList.remove('open');
      document.getElementById('checkout-tray-overlay').classList.remove('open');
    }

    function getProductURL(id) {
      return 'https://mytinythreads.in/products/' + id;
    }

    function shareProduct(key) {
      const p = allProducts.find(p => p.id === key); if (!p) return;
      const url = getProductURL(key);
      const title = p.name + ' -- Tiny Threads Kidswear';
      const text = '✨ Check out ' + p.name + ' at ₹' + p.price + '!\n\nShop at Tiny Threads Kidswear 👶👗';
      // navigator.share opens the native OS share sheet -- WhatsApp, Instagram, SMS, Gmail, Copy etc.
      if (navigator.share) {
        navigator.share({ title: title, text: text, url: url })
          .catch(function (err) { if (err.name !== 'AbortError') _shareFallback(url); });
      } else {
        _shareFallback(url);
      }
    }

    function shareOnWhatsApp(key) {
      const p = allProducts.find(p => p.id === key); if (!p) return;
      const url = getProductURL(key);
      const msg = '✨ Check out this from *Tiny Threads Kidswear*!\n\n'
        + '👕 *' + p.name + '*\n'
        + '💰 ₹' + p.price + '\n\n'
        + '🔗 ' + url + '\n\n'
        + 'Order via WhatsApp: +91 78799 76016';
      window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
    }

    function _shareFallback(url) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url)
          .then(function () { showShareToast('Product link copied! 📋'); })
          .catch(function () { _shareLegacyCopy(url); });
      } else {
        _shareLegacyCopy(url);
      }
    }

    function _shareLegacyCopy(url) {
      try {
        var ta = document.createElement('textarea');
        ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showShareToast('Product link copied! 📋');
      } catch (e) { showShareToast('Copy this link: ' + url); }
    }

    // Early stubs -- full definitions load later in script block 2
    function openShipModal() {
      const o = document.getElementById('shipOverlay');
      if (o) o.classList.add('active');
      document.body.style.overflow = 'hidden';
      if (typeof _shipRestore === 'function') setTimeout(_shipRestore, 60);
    }
    function closeShipModal() {
      const o = document.getElementById('shipOverlay');
      if (o) o.classList.remove('active');
      document.body.style.overflow = '';
    }
    function shipOverlayClick(e) {
      if (e.target === document.getElementById('shipOverlay')) closeShipModal();
    }
    function shipSkip() {
      closeShipModal();
      if (typeof _doCheckoutWA === 'function') _doCheckoutWA(null);
    }

    function checkoutWhatsApp() {
      if (basket.length === 0) return;
      openShipModal(); // collect shipping details first; WA fires after
    }
    function _doCheckoutWA(ship) {
      if (basket.length === 0) return;
      const subtotal = basket.reduce((s, i) => s + i.qty * i.price, 0);
      const discountAmt = calcDiscount(subtotal);
      const total = subtotal - discountAmt;
      const div = '─────────────────────────';
      let msg = `🛍️ *New Order -- Tiny Threads Kidswear*\n${div}\n\n`;
      basket.forEach((item, idx) => {
        msg += `*${idx + 1}. ${item.name}*\n   📏 Size : ${item.size || 'N/A'}\n   🔢 Qty  : ${item.qty} × ₹${item.price} = ₹${(item.qty * item.price).toLocaleString('en-IN')}\n   🔗 Link : ${getProductURL(item.id)}\n\n`;
      });
      msg += `${div}\n🧾 *Order Summary*\n   Items    : ${basket.reduce((s, i) => s + i.qty, 0)}\n   Subtotal : ₹${subtotal.toLocaleString('en-IN')}\n`;
      if (appliedPromo) msg += `   Promo    : *${appliedPromo.code}* (${Math.round(appliedPromo.discount * 100)}% off) −₹${discountAmt.toLocaleString('en-IN')}\n`;
      msg += `   *Total   : ₹${total.toLocaleString('en-IN')}*\n${div}\n`;
      if (ship) {
        msg += `\n📦 *Shipping Details*\n   Name    : ${ship.name}\n   Mobile  : ${ship.mobile}\n   Address : ${ship.addr1}${ship.addr2 ? ', ' + ship.addr2 : ''}\n   Area    : ${ship.area}\n   City    : ${ship.city} - ${ship.pin}\n   State   : ${ship.state}\n   Order # : ${ship.orderId || 'pending'}\n`;
      } else {
        msg += '\n📦 Shipping details: Not shared\n';
      }
      msg += '\nPlease confirm availability. Thank you! 🙏';
      window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg), '_blank');
    }

    function waEnquire(name, price) {
      const msg = `Hi Tiny Threads! I'm interested in:\n\n👕 *${name}*\n💰 Price: ₹${price}\n\nCould you please share availability and sizes? Thank you!`;
      window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg), '_blank');
    }

    function copyPromoCode(el) {
      navigator.clipboard.writeText('WELCOME10').then(() => {
        el.querySelector('.offer-flyer-code-copy').textContent = 'Copied! ✓';
        el.querySelector('.offer-flyer-code').classList.add('copied');
        showToast('Code WELCOME10 copied! 🎉');
        setTimeout(() => { el.querySelector('.offer-flyer-code-copy').textContent = 'Tap to copy 📋'; el.querySelector('.offer-flyer-code').classList.remove('copied'); }, 2000);
      }).catch(() => showToast('Use code: WELCOME10'));
    }

    // PDP (Product Detail Page)
    let currentPDPCategory = 'home', currentPDPKey = '', pdpMainSwiper = null;
    function openPDP(key) {
      const p = allProducts.find(p => p.id === key); if (!p) return;
      currentPDPCategory = p.category || 'home';
      currentPDPKey = key;
      const backLabel = { 'boys': 'Boys', 'girls': 'Girls', 'babies': 'Babies', 'nightwear': 'Nightwear', 'footwear': 'Footwear', 'accessories': 'Accessories', 'toys': 'Toys', 'twinning': 'Twinning', 'kidscare': 'Kids Care', 'school': 'School', 'learning': 'Learning' , 'celebration': 'Celebration' }[p.category] || 'Back';
      document.getElementById('pdp-back-label').textContent = '← Back to ' + backLabel;
      // Build slides
      const hasImgs = p.images && p.images.length > 0 && !p.images[0].includes('YOUR_CLOUD_NAME');
      const icons = { traditional: '🧵', summer: '☀️', winter: '🧥', nightwear: '🌙', undergarments: '🧸' };
      let slidesHtml = '', thumbsHtml = '';
      window._lbxImages = hasImgs ? p.images : [];
      if (hasImgs) {
        p.images.forEach((url, i) => {
          const t = url.includes('res.cloudinary.com') ? url.replace('/upload/', '/upload/q_auto,f_auto/') : url;
          slidesHtml += `<div class="swiper-slide" onclick="lbxOpen(${i})" style="cursor:zoom-in;"><img src="${t}" alt="${p.name} photo ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}">${i === 0 ? '<div class="pdp-img-tap-hint">🔍 Tap to zoom</div>' : ''}</div>`;
          thumbsHtml += `<div class="pdp-thumb${i === 0 ? ' active' : ''}" onclick="pdpGoTo(${i})" data-idx="${i}"><img src="${url.includes('res.cloudinary.com') ? url.replace('/upload/', '/upload/c_fill,w_128,h_128,q_auto,f_auto/') : url}" alt=""></div>`;
        });
      } else {
        slidesHtml = `<div class="swiper-slide"><div class="slide-ph">${icons[p.subcategory] || '📸'}</div></div>`;
      }
      document.getElementById('pdp-slides').innerHTML = slidesHtml;
      document.getElementById('pdp-thumbs').innerHTML = thumbsHtml;
      if (pdpMainSwiper) { pdpMainSwiper.destroy(true, true); pdpMainSwiper = null; }
      // Build info
      const sizesHtml = p.sizes ? p.sizes.map(s => `<button type="button" class="pdp-size-btn" onclick="pdpSelectSize(this,'${key}')">${s}</button>`).join('') : '';
      const colorsHtml = p.colors && p.colors.length ? p.colors.slice(0, 6).map(c => { const r = resolveColor(c); return `<div class="pdp-color-btn" title="${r.name}" style="background:${r.bg}" onclick="pdpSelectColor(this,'${r.name}')"></div>`; }).join('') : '';
      const catEmoji = { 'boys': '👦', 'girls': '👧', 'babies': '👶', 'nightwear': '🌙', 'footwear': '👟', 'accessories': '💎', 'toys': '🧸', 'twinning': '👨‍👧', 'kidscare': '🧴', 'school': '🎒', 'learning': '📚' , 'celebration':'📦' }[p.category] || '📦';
      document.getElementById('pdp-info').innerHTML = `
    <div class="pdp-category-tag">${catEmoji} ${backLabel}</div>
    <h1 class="pdp-name">${p.name}</h1>
    ${p.badge ? `<div class="pdp-badge">${p.badge}</div>` : ''}
    <div class="pdp-price">₹${p.price.toLocaleString('en-IN')} <span>incl. of all taxes</span></div>
    <p class="pdp-desc">${p.description || 'Beautiful, comfortable kidswear crafted with care.'}</p>
    <div class="pdp-section-label">Fabric</div>
    <div class="pdp-fabric-chip">🧶 ${p.fabric || 'Cotton'}</div>
    ${p.sizes && p.sizes.length > 0 ? `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;"><div class="pdp-section-label" style="margin-bottom:0;">Select Size</div><button class="sg-trigger" onclick="openSizeGuide('${p.category}')" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20M2 12l4-4M2 12l4 4M22 12l-4-4M22 12l-4 4"/></svg>Size Guide</button></div><div class="pdp-sizes" id="pdp-sizes-${key}">${sizesHtml}</div>` : ''}
    ${p.colors && p.colors.length > 0 ? `<div class="pdp-section-label">Available Colors</div><div class="pdp-colors" id="pdp-colors-${key}">${colorsHtml}<span class="pdp-color-name" id="pdp-color-name">--</span></div>` : ''}
    <div class="pdp-actions">
      <button type="button" class="pdp-add-btn" id="pdp-abtn-${key}" onclick="pdpAddToBasket('${key}')">🛒 Add to Basket</button>
      <button type="button" class="pdp-wa-btn" onclick="waEnquire('${p.name.replace(/'/g, "\\'")}','${p.price}')">
        <svg style="width:18px;height:18px;fill:#25D366;" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Enquire on WhatsApp
      </button>
      <div class="pdp-share-row">
        <button type="button" class="pdp-share-btn" onclick="shareProduct('${key}')" title="Share via any app">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Share
        </button>
        <button type="button" class="pdp-share-wa-btn" onclick="shareOnWhatsApp('${key}')" title="Share on WhatsApp">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </button>
      </div>
    </div>`;
      trackRecentlyViewed(key);
      renderSimilarItems(key);
      document.title = p.name + ' · Tiny Threads Kidswear';
      // Show page FIRST so element is visible and has real dimensions
      showPage('product');
      window.scrollTo(0, 0);
      // THEN init Swiper -- must happen after display:block so it can measure width
      requestAnimationFrame(function () {
        var imgCount = hasImgs ? p.images.length : 0;
        pdpMainSwiper = new Swiper('.pdp-gallery-swiper', {
          loop: imgCount > 1,
          allowTouchMove: imgCount > 1,
          pagination: { el: '.pdp-gallery-swiper .swiper-pagination', clickable: true, dynamicBullets: true },
          navigation: { nextEl: '.pdp-gallery-swiper .swiper-button-next', prevEl: '.pdp-gallery-swiper .swiper-button-prev' },
          on: {
            slideChange: function () {
              document.querySelectorAll('.pdp-thumb').forEach(function (t, i) { t.classList.toggle('active', i === this.realIndex); }.bind(this));
            }
          }
        });
      });
      // Push PDP into history so back-swipe closes it instead of leaving the app
      history.pushState({ page: 'pdp', id: key }, '', '');
    }

    function pdpSelectSize(btn, key) { btn.closest('.pdp-sizes').querySelectorAll('.pdp-size-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); selectedSizes[key] = btn.textContent; }
    function pdpSelectColor(btn, color) { btn.closest('.pdp-colors').querySelectorAll('.pdp-color-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); const nm = document.getElementById('pdp-color-name'); if (nm) nm.textContent = color; }
    function pdpGoTo(idx) { if (pdpMainSwiper) pdpMainSwiper.slideTo(idx); }
    function pdpAddToBasket(key) { addToBasket(key); const btn = document.getElementById('pdp-abtn-' + key); if (btn) { btn.classList.add('added'); btn.textContent = '✓ Added to Basket!'; setTimeout(() => { btn.classList.remove('added'); btn.innerHTML = '🛒 Add to Basket'; }, 1600); } }
    function closePDP() {
      document.title = 'Tiny Threads Kidswear - Joyful Dailywear for Kids';
      showPage(currentPDPCategory || 'home');
      window.scrollTo(0, 0);
    }

    // Page routing
    let currentPage = 'home';
    let _suppressPush = false;

    // Pages that map to bottom nav tabs (everything else keeps current tab lit)
    const MBN_MAP = { 
      home: 'mn-home', 
      boys: 'mn-boys', 
      girls: 'mn-girls', 
      babies: 'mn-babies',
      traditional: 'mn-traditional',
      summer: 'mn-summer',
      winter: 'mn-winter',
      accessories: 'mn-accessories'
    };

    // Clean URL + <title>/meta description per category — powers direct links
    // like mytinythreads.in/boys (server-side rewrite lives in _worker.js) and
    // keeps the address bar in sync when navigating inside the app.
    const CATEGORY_PATHS = {
      home: '/', boys: '/boys', girls: '/girls', babies: '/babies',
      nightwear: '/nightwear', footwear: '/footwear', accessories: '/accessories',
      toys: '/toys', twinning: '/twinning', kidscare: '/kidscare',
      school: '/school', learning: '/learning', celebration: '/celebration',
    };
    const CATEGORY_TITLES = {
      home: 'Tiny Threads Kidswear - Joyful Dailywear for Kids',
      boys: 'Boys 3–13 Years · Tiny Threads Kidswear',
      girls: 'Girls 3–13 Years · Tiny Threads Kidswear',
      babies: 'Babies 0–3 Years · Tiny Threads Kidswear',
      nightwear: 'Nightwear · Tiny Threads Kidswear',
      footwear: 'Footwear · Tiny Threads Kidswear',
      accessories: 'Accessories · Tiny Threads Kidswear',
      toys: 'Toys · Tiny Threads Kidswear',
      twinning: 'Twinning Sets · Tiny Threads Kidswear',
      kidscare: 'Kids Care · Tiny Threads Kidswear',
      school: 'School · Tiny Threads Kidswear',
      learning: 'Learning · Tiny Threads Kidswear',
      celebration: 'Celebration · Tiny Threads Kidswear',
    };
    const CATEGORY_DESCRIPTIONS = {
      home: 'Playful, comfortable & beautiful kidswear for boys, girls and babies. Shop traditional, summer, winter & nightwear. Checkout via WhatsApp. Prices from ₹99.',
      boys: 'Shop boys\u2019 clothing 3\u201313 years \u2014 traditional, summer & winter wear at Tiny Threads Kidswear. Checkout via WhatsApp.',
      girls: 'Shop girls\u2019 clothing 3\u201313 years \u2014 traditional, summer & winter wear at Tiny Threads Kidswear. Checkout via WhatsApp.',
      babies: 'Shop baby clothing 0\u20133 years at Tiny Threads Kidswear. Soft, comfortable essentials. Checkout via WhatsApp.',
      nightwear: 'Shop cosy kids\u2019 nightwear at Tiny Threads Kidswear. Checkout via WhatsApp.',
      footwear: 'Shop kids\u2019 footwear at Tiny Threads Kidswear. Checkout via WhatsApp.',
      accessories: 'Shop kids\u2019 accessories at Tiny Threads Kidswear. Checkout via WhatsApp.',
      toys: 'Shop toys for kids at Tiny Threads Kidswear. Checkout via WhatsApp.',
      twinning: 'Shop twinning sets for siblings at Tiny Threads Kidswear. Checkout via WhatsApp.',
      kidscare: 'Shop kids\u2019 care essentials at Tiny Threads Kidswear. Checkout via WhatsApp.',
      school: 'Shop school essentials for kids at Tiny Threads Kidswear. Checkout via WhatsApp.',
      learning: 'Shop learning products for kids at Tiny Threads Kidswear. Checkout via WhatsApp.',
      celebration: 'Shop celebration wear for kids at Tiny Threads Kidswear. Checkout via WhatsApp.',
    };

    // ─── PAGE NAVIGATION ─────────────────────────────────────────────────────────
  function showPage(id) {
    const prevMobBtn = document.querySelector('.mob-nav-track .mob-nav-item.active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-links li a').forEach(a => a.classList.remove('active'));
    document.querySelectorAll('.mob-nav-item').forEach(b => b.classList.remove('active'));

    const pageEl = document.getElementById('page-' + id);
    if (!pageEl) return;
    pageEl.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Category banners are built once at load time via features.js's
    // loadBanners(), including for pages that are display:none at that
    // moment — so their Swiper instances measure 0 width/height and
    // never recalculate on their own. Announce that this page just
    // became visible so the banner module can force that category's
    // Swiper to re-measure now that it actually has real dimensions.
    window.dispatchEvent(new CustomEvent('tt:pageshown', { detail: { id } }));

          // Update <title>/meta description and keep the address bar in sync for
    // category (and home) pages. Skipped for ids like 'product' — PDP manages
    // its own document.title in openPDP()/closePDP().
    if (CATEGORY_PATHS.hasOwnProperty(id)) {
      document.title = CATEGORY_TITLES[id];
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', CATEGORY_DESCRIPTIONS[id]);
      if (!_suppressPush && window.location.pathname !== CATEGORY_PATHS[id]) {
        history.pushState({ page: id }, '', CATEGORY_PATHS[id]);
      }
    }

    // Sync desktop nav
    document.querySelectorAll('.nav-links li a').forEach(a => { a.classList.toggle('active', a.getAttribute('onclick') && a.getAttribute('onclick').includes("'" + id + "'")); });
     
    // Highlight + smooth-scroll active pill into centre of track
    const mobBtn = document.getElementById('mn-' + id);
    if (mobBtn) {
      mobBtn.classList.add('active');
      const track = document.getElementById('mob-nav-track');
      if (track) {
        // Keep the active category away from the track edges: slot 3 when
        // moving right and slot 2 when moving left. This preserves visible
        // neighbouring choices in both directions.
        const tabs = Array.from(track.querySelectorAll('.mob-nav-item'));
        const itemW = mobBtn.offsetWidth || 1;
        const visibleSlots = 5;
        const idx = tabs.indexOf(mobBtn);
        const prevIdx = prevMobBtn ? tabs.indexOf(prevMobBtn) : -1;
        const maxFirst = Math.max(0, tabs.length - visibleSlots);
        let nextFirst;

        if (idx === 0) nextFirst = 0;
        else if (prevIdx >= 0 && idx < prevIdx) nextFirst = idx - 1;
        else nextFirst = idx - 2;

        nextFirst = Math.max(0, Math.min(nextFirst, maxFirst));
        const navShell = document.getElementById('mobile-bottom-nav');
        if (navShell) {
          navShell.classList.toggle('has-left-overflow', nextFirst > 0);
          navShell.classList.toggle('has-right-overflow', nextFirst < maxFirst);
        }
        track.scrollTo({ left: nextFirst * itemW, behavior: 'smooth' });
      }
    }
  }

    function handleURLRouting() {
      const hash = window.location.hash.replace('#', '');
      const search = new URLSearchParams(window.location.search);
      const prodId = search.get('product');
      const validPages = ['home', 'boys', 'girls', 'babies', 'nightwear', 'footwear', 'accessories', 'toys', 'twinning', 'kidscare', 'school', 'learning' , 'celebration'];
      // ── handle direct /products/:id URLs served by _worker.js ──
      const pathMatch = window.location.pathname.match(/^\/products\/([^/.]+?)(?:\.html)?$/);
      if (pathMatch) {
        sessionStorage.setItem('tt_splash_seen', '1');
        const splashEl = document.getElementById('splash-screen');
        if (splashEl) { splashEl.style.display = 'none'; }
        document.body.classList.remove('splash-active');
        openPDP(pathMatch[1]);
        return;
      }
      // ── end ──
      // ── handle direct /boys, /girls, etc. URLs served by _worker.js ──
      const catSlug = window.location.pathname.replace(/^\/|\/$/g, '');
      if (catSlug && validPages.includes(catSlug)) {
        sessionStorage.setItem('tt_splash_seen', '1');
        const splashEl = document.getElementById('splash-screen');
        if (splashEl) { splashEl.style.display = 'none'; }
        document.body.classList.remove('splash-active');
        showPage(catSlug);
        return;
      }
      // ── end ──
      if (prodId) { openPDP(prodId); return; }
      if (hash && validPages.includes(hash)) showPage(hash);
    }

    // ══════════════════════════════════════════════════
    // HISTORY STACK -- 4 levels, never exits the app
    //   L1  sentinel   (base -- always re-pushed)
    //   L2  page       (home / category)
    //   L3  pdp        (product detail)
    //   L4  lightbox   (zoom screen)
    // ══════════════════════════════════════════════════

    // Helpers to check current UI state
    function _isLightboxOpen() { var o = document.getElementById('lbx-overlay'); return o && o.classList.contains('open'); }
    function _isPDPOpen() { var p = document.getElementById('page-product'); return p && p.classList.contains('active'); }

    // On load: base sentinel + one real entry so first back fires popstate
    history.replaceState({ _sentinel: true }, '', '');
    history.pushState({ page: 'home' }, '', '');

    window.addEventListener('popstate', function (e) {
      var s = e.state || {};

      // ── L4 Lightbox open → close it, stay on PDP ──
      if (_isLightboxOpen()) {
        lbxClose();
        // Re-push lightbox state so next back still works from PDP
        history.pushState({ page: 'pdp', id: currentPDPKey }, '', '');
        return;
      }

      // ── L3 PDP open → close it, return to category ──
      if (_isPDPOpen()) {
        _suppressPush = true;
        closePDP();
        _suppressPush = false;
        // Re-push category so next back goes home
        history.pushState({ page: currentPDPCategory || 'home' }, '', '');
        return;
      }

      // ── L1 Hit sentinel (base of stack) → re-push and stay home ──
      if (s._sentinel || !s.page) {
        showPage('home');
        history.replaceState({ _sentinel: true }, '', '');
        history.pushState({ page: 'home' }, '', '');
        return;
      }

      // ── L2 Category/home page ──
      if (s.page === 'home' || s.page === undefined) {
        showPage('home');
        // Re-push sentinel below so next back stays in app
        history.replaceState({ _sentinel: true }, '', '');
        history.pushState({ page: 'home' }, '', '');
      } else {
        _suppressPush = true;
        showPage(s.page);
        _suppressPush = false;
        // Re-push so back from category → home stays in app
        history.pushState({ page: s.page }, '', '');
      }
    });

    // Mobile menu
    function openMobMenu() { document.getElementById('mob-menu-drawer').classList.add('open'); document.getElementById('mob-menu-overlay').classList.add('open'); document.body.style.overflow = 'hidden'; }
    function closeMobMenu() { document.getElementById('mob-menu-drawer').classList.remove('open'); document.getElementById('mob-menu-overlay').classList.remove('open'); document.body.style.overflow = ''; }

    // Toasts
    function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }
    function showShareToast(msg) { const t = document.getElementById('share-toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200); }

    // Category swipers
    function initCatSwipers() {
      const catImages = {
        boys: [], girls: [], babies: [], accessories: [], toys: [], twinning: [], kidscare: [], school: [], learning: [], celebration: []
      };
      allProducts.forEach(p => {
        if (catImages[p.category] !== undefined && p.images && p.images.length > 0 && !p.images[0].includes('YOUR_CLOUD_NAME')) {
          if (catImages[p.category].length < 4) catImages[p.category].push(p.images[0]);
        }
      });
      document.querySelectorAll('.cat-swiper').forEach(sw => {
        const card = sw.closest('.cat-card');
        const cat = Array.from(card.classList).find(c => ['boys', 'girls', 'babies', 'accessories', 'toys', 'twinning', 'kidscare', 'school', 'learning', 'celebration'].includes(c));
        if (!cat || !catImages[cat] || catImages[cat].length === 0) return;
        const wrapper = sw.querySelector('.swiper-wrapper');
        wrapper.innerHTML = catImages[cat].map(url => {
          const t = url.includes('res.cloudinary.com') ? url.replace('/upload/', '/upload/c_fill,w_300,h_220,g_north,q_auto,f_auto/') : url;
          return `<div class="swiper-slide"><img src="${t}" alt="${cat}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"></div>`;
        }).join('');
        new Swiper(sw, { loop: catImages[cat].length > 1, autoplay: { delay: 2200, disableOnInteraction: false }, pagination: { el: sw.querySelector('.swiper-pagination'), clickable: true }, speed: 600 });
      });
    }

    function initTestimonialSwiper() {
      new Swiper('.t-swiper', {
        slidesPerView: 1.1, spaceBetween: 16, centeredSlides: true,
        pagination: { el: '.t-swiper .swiper-pagination', clickable: true },
        navigation: { nextEl: '.t-swiper-outer .swiper-button-next', prevEl: '.t-swiper-outer .swiper-button-prev' },
        breakpoints: { 640: { slidesPerView: 1.5, spaceBetween: 20 }, 900: { slidesPerView: 2.2, spaceBetween: 24 }, 1200: { slidesPerView: 3, spaceBetween: 24 } },
        autoplay: { delay: 4500, disableOnInteraction: false }
      });
    }

    // Background animation canvas
    (function () {
      const canvas = document.getElementById('anim-canvas'); if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let W, H, particles = [];
      function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
      resize(); window.addEventListener('resize', resize);
      for (let i = 0; i < 18; i++) particles.push({ x: Math.random() * 1400, y: Math.random() * 900, r: Math.random() * 3 + 1, vx: (Math.random() - .5) * 0.3, vy: (Math.random() - .5) * 0.3, o: Math.random() * 0.12 + 0.04, c: ['#B71C1C', '#FFD54F', '#FFCDD2', '#E8F5E9'][Math.floor(Math.random() * 4)] });
      function draw() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p => {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = p.c; ctx.globalAlpha = p.o; ctx.fill();
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        });
        ctx.globalAlpha = 1; requestAnimationFrame(draw);
      }
      draw();
    })();

    // Fallback products
    function getFallbackProducts() {
      return [
        { id: 'b001', name: 'Cotton Kurta Set', category: 'boys', subcategory: 'traditional', collections: ['fresh_picks', 'birthday_looks'], price: 699, badge: 'Bestseller', featured: true, fabric: 'Cotton', description: 'Comfortable everyday kurta set with matching pyjama.', sizes: ['3-4Y', '5-6Y', '7-8Y', '9-10Y', '11-12Y'], colors: ['White', 'Blue', 'Cream'], images: ['https://res.cloudinary.com/tinythreads/image/upload/v1777128347/tinythreads/IMG-20250927-WA0043_ulau1j.jpg'] },
        { id: 'g001', name: 'Floral Frock', category: 'girls', subcategory: 'summer', collections: ['fresh_picks', 'daily_wear', 'birthday_looks'], price: 549, badge: 'New', featured: true, fabric: 'Cotton', description: 'Light and breezy floral frock for summer days.', sizes: ['3-4Y', '5-6Y', '7-8Y'], colors: ['Pink', 'Yellow', 'Lavender'], images: ['https://res.cloudinary.com/tinythreads/image/upload/v1777267316/tinythreads/1773835328475_e1a5lf.png'] },
        { id: 'bb001', name: 'Baby Onesie 3-Pack', category: 'babies', subcategory: 'summer', collections: ['baby_softwear', 'daily_wear'], price: 499, badge: 'Value Pack', featured: true, fabric: 'Soft Cotton', description: 'Ultra-soft onesies for your newborn. Gentle on delicate skin.', sizes: ['0-3M', '3-6M', '6-9M', '9-12M'], colors: ['White', 'Mint', 'Blush'], images: ['https://res.cloudinary.com/tinythreads/image/upload/v1777201920/tinythreads/IMG-20240409-WA0025_gaqztv.jpg'] },
        { id: 'g014', name: 'Sharara Set', category: 'girls', subcategory: 'traditional', collections: ['fresh_picks', 'birthday_looks'], price: 899, badge: 'Festive', featured: true, fabric: 'Georgette', description: 'Stunning sharara set for festive occasions.', sizes: ['4-5Y', '6-7Y', '8-9Y', '10-11Y'], colors: ['Red', 'Maroon', 'Gold'], images: ['https://res.cloudinary.com/tinythreads/image/upload/v1777272488/tinythreads/IMG-20260117-WA0008_ds6761.jpg'] }
      ];
    }

    // =============================================
    // SIZE GUIDE
    // =============================================
    var _sgActiveTab = 'sg-boys';
    function openSizeGuide(category) {
      var tabMap = { boys: 'sg-boys', girls: 'sg-girls', babies: 'sg-babies', baby: 'sg-babies' };
      var target = tabMap[category] || 'sg-boys';
      // activate correct tab
      document.querySelectorAll('.sg-tab').forEach(function (t, i) {
        var panels = ['sg-boys', 'sg-girls', 'sg-babies'];
        t.classList.toggle('active', panels[i] === target);
      });
      document.querySelectorAll('.sg-panel').forEach(function (p) {
        p.classList.toggle('active', p.id === target);
      });
      _sgActiveTab = target;
      document.getElementById('sg-overlay').classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeSizeGuide() {
      document.getElementById('sg-overlay').classList.remove('open');
      document.body.style.overflow = '';
    }
    function sgClickOutside(e) {
      if (e.target === document.getElementById('sg-overlay')) closeSizeGuide();
    }
    function sgTab(btn, panelId) {
      document.querySelectorAll('.sg-tab').forEach(function (t) { t.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.sg-panel').forEach(function (p) { p.classList.remove('active'); });
      document.getElementById(panelId).classList.add('active');
      _sgActiveTab = panelId;
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.getElementById('sg-overlay').classList.contains('open')) closeSizeGuide();
    });

    // =============================================
    // RECENTLY VIEWED
    // =============================================
    var MAX_RV = 8;
    var recentlyViewed = [];

    function trackRecentlyViewed(key) {
      var p = allProducts.find(function (p) { return p.id === key; });
      if (!p) return;
      recentlyViewed = recentlyViewed.filter(function (id) { return id !== key; });
      recentlyViewed.unshift(key);
      if (recentlyViewed.length > MAX_RV) recentlyViewed = recentlyViewed.slice(0, MAX_RV);
      renderRecentlyViewed();
    }

    function renderRecentlyViewed() {
      var section = document.getElementById('rv-section');
      var track = document.getElementById('rv-track');
      if (!section || !track) return;
      var items = recentlyViewed
        .map(function (id) { return allProducts.find(function (p) { return p.id === id; }); })
        .filter(Boolean);
      if (items.length < 2) { section.classList.remove('visible'); return; }
      section.classList.add('visible');
      var catIcons = { boys: '👦', girls: '👧', babies: '👶', footwear: '👟', accessories: '💎', toys: '🧸', twinning: '👨‍👧', kidscare: '🧴', school: '🎒', learning: '📚', celebration: '🎉' };
      track.innerHTML = items.map(function (p) {
        var hasImg = p.images && p.images.length > 0 && !p.images[0].includes('YOUR_CLOUD_NAME');
        var imgHtml = hasImg
          ? '<img src="' + p.images[0].replace('/upload/', '/upload/c_fill,w_220,h_293,g_north,q_auto,f_auto/') + '" alt="' + p.name + '" loading="lazy">'
          : '<div class="rv-ph">' + (catIcons[p.category] || '📦') + '</div>';
        var badgeHtml = p.badge ? '<span class="rv-badge">' + p.badge + '</span>' : '';
        return '<div class="rv-card" onclick="openPDP(\'' + p.id + '\')" title="' + p.name + '">'
          + '<div class="rv-img-wrap">' + imgHtml + badgeHtml + '</div>'
          + '<div class="rv-card-info">'
          + '<div class="rv-card-name">' + p.name + '</div>'
          + '<div class="rv-card-price">₹' + p.price.toLocaleString('en-IN') + '</div>'
          + '</div></div>';
      }).join('');

      // Move rv-section to just before testimonials on home page (only once)
      var testimonials = document.querySelector('.testimonials-section');
      var rvSection = document.getElementById('rv-section');
      if (testimonials && rvSection && testimonials.previousElementSibling !== rvSection) {
        testimonials.parentNode.insertBefore(rvSection, testimonials);
      }
    }

    function clearRecentlyViewed() {
      recentlyViewed = [];
      var section = document.getElementById('rv-section');
      if (section) section.classList.remove('visible');
    }

    // =============================================
    // IMAGE LIGHTBOX -- tap to open, pinch/scroll zoom, drag pan, swipe nav
    // =============================================
    (function () {
      var imgs = [], cur = 0, scale = 1, minScale = 1, maxScale = 5;
      var panX = 0, panY = 0, startPanX = 0, startPanY = 0;
      var isPanning = false, lastDist = 0, lastScale = 1;
      var touchStartX = 0, touchStartY = 0, touchStartTime = 0;
      var hintTimer = null;

      var overlay, viewport, imgWrap, img, counter, thumbsEl, hint, badge, resetBtn;

      function init() {
        overlay = document.getElementById('lbx-overlay');
        viewport = document.getElementById('lbx-viewport');
        imgWrap = document.getElementById('lbx-img-wrap');
        img = document.getElementById('lbx-img');
        counter = document.getElementById('lbx-counter');
        thumbsEl = document.getElementById('lbx-thumbs');
        hint = document.getElementById('lbx-hint');
        badge = document.getElementById('lbx-zoom-badge');
        resetBtn = document.getElementById('lbx-reset');
        if (!overlay) return;
        bindEvents();
      }

      function open(idx) {
        imgs = (window._lbxImages || []);
        if (!imgs.length) return;
        cur = Math.max(0, Math.min(idx, imgs.length - 1));
        loadImg(cur);
        buildThumbs();
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        // Push lightbox into history so back-swipe closes zoom instead of leaving the app
        history.pushState({ page: 'lightbox' }, '', '');
        // Show hint briefly
        hint.classList.remove('gone');
        clearTimeout(hintTimer);
        hintTimer = setTimeout(function () { hint.classList.add('gone'); }, 3000);
        // Hide arrows if only 1 image
        document.getElementById('lbx-prev').style.display = imgs.length > 1 ? '' : 'none';
        document.getElementById('lbx-next').style.display = imgs.length > 1 ? '' : 'none';
      }

      function loadImg(idx) {
        var rawUrl = imgs[idx];
        // Serve the full-res original -- remove any Cloudinary transforms so customer sees full detail
        var fullUrl = rawUrl.includes('res.cloudinary.com')
          ? rawUrl.replace(/\/upload\/[^/]+\//, '/upload/q_auto,f_auto/')
          : rawUrl;
        img.src = fullUrl;
        img.alt = 'Product image ' + (idx + 1);
        counter.textContent = (idx + 1) + ' / ' + imgs.length;
        resetZoom();
        updateThumbActive(idx);
      }

      function buildThumbs() {
        thumbsEl.innerHTML = imgs.map(function (url, i) {
          var t = url.includes('res.cloudinary.com')
            ? url.replace('/upload/', '/upload/c_fill,w_80,h_80,q_auto,f_auto/')
            : url;
          return '<div class="lbx-thumb' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '" onclick="lbxNav(' + i + '-window._lbxCur)">'
            + '<img src="' + t + '" alt="" loading="lazy"></div>';
        }).join('');
      }

      function updateThumbActive(idx) {
        if (!thumbsEl) return;
        thumbsEl.querySelectorAll('.lbx-thumb').forEach(function (t, i) {
          t.classList.toggle('active', i === idx);
        });
        // Scroll thumb into view
        var active = thumbsEl.querySelector('.lbx-thumb.active');
        if (active) active.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
        window._lbxCur = idx;
      }

      function nav(delta) {
        if (imgs.length <= 1) return;
        cur = (cur + delta + imgs.length) % imgs.length;
        loadImg(cur);
      }

      function close() {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        resetZoom();
      }

      function resetZoom() {
        scale = 1; panX = 0; panY = 0;
        applyTransform();
        badge.textContent = '100%';
        resetBtn.classList.remove('visible');
      }

      function applyTransform() {
        // imgWrap fills 100%x100% of viewport with flexbox centering the img.
        // We just scale from center and offset pan in screen pixels.
        var vw = viewport.offsetWidth, vh = viewport.offsetHeight;
        // Clamp pan: at current scale, how far can the image move before edge crosses center?
        var imgW = img.offsetWidth || vw * 0.9;
        var imgH = img.offsetHeight || vh * 0.9;
        var scaledW = imgW * scale;
        var scaledH = imgH * scale;
        var maxPanX = Math.max(0, (scaledW - vw) / 2);
        var maxPanY = Math.max(0, (scaledH - vh) / 2);
        panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
        panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
        // scale() from transform-origin:center keeps image centered; translate pans it
        imgWrap.style.transform = 'scale(' + scale + ') translate(' + panX / scale + 'px,' + panY / scale + 'px)';
        badge.textContent = Math.round(scale * 100) + '%';
        resetBtn.classList.toggle('visible', scale > 1.05);
      }

      function bindEvents() {
        // Keyboard
        document.addEventListener('keydown', function (e) {
          if (!overlay.classList.contains('open')) return;
          if (e.key === 'Escape') close();
          if (e.key === 'ArrowRight') nav(1);
          if (e.key === 'ArrowLeft') nav(-1);
        });

        // Mouse wheel zoom
        viewport.addEventListener('wheel', function (e) {
          e.preventDefault();
          var delta = e.deltaY < 0 ? 1.12 : 0.9;
          scale = Math.max(minScale, Math.min(maxScale, scale * delta));
          applyTransform();
        }, { passive: false });

        // Mouse drag pan
        viewport.addEventListener('mousedown', function (e) {
          if (scale <= 1) return;
          isPanning = true; startPanX = e.clientX - panX; startPanY = e.clientY - panY;
          viewport.classList.add('grabbing');
        });
        document.addEventListener('mousemove', function (e) {
          if (!isPanning) return;
          panX = e.clientX - startPanX; panY = e.clientY - startPanY;
          applyTransform();
        });
        document.addEventListener('mouseup', function () { isPanning = false; viewport.classList.remove('grabbing'); });

        // Touch -- pinch zoom + drag pan + swipe nav
        viewport.addEventListener('touchstart', function (e) {
          if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
            startPanX = e.touches[0].clientX - panX;
            startPanY = e.touches[0].clientY - panY;
            isPanning = true;
          } else if (e.touches.length === 2) {
            isPanning = false;
            lastDist = getTouchDist(e.touches);
            lastScale = scale;
          }
        }, { passive: true });

        viewport.addEventListener('touchmove', function (e) {
          e.preventDefault();
          if (e.touches.length === 2) {
            // Pinch zoom
            var dist = getTouchDist(e.touches);
            scale = Math.max(minScale, Math.min(maxScale, lastScale * (dist / lastDist)));
            applyTransform();
            hint.classList.add('gone');
          } else if (e.touches.length === 1 && isPanning && scale > 1) {
            // Drag pan (only when zoomed)
            panX = e.touches[0].clientX - startPanX;
            panY = e.touches[0].clientY - startPanY;
            applyTransform();
          }
        }, { passive: false });

        viewport.addEventListener('touchend', function (e) {
          isPanning = false;
          if (e.changedTouches.length === 1 && scale <= 1.05) {
            var dx = e.changedTouches[0].clientX - touchStartX;
            var dy = e.changedTouches[0].clientY - touchStartY;
            var dt = Date.now() - touchStartTime;
            // Swipe nav (fast, mostly horizontal)
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 350) {
              nav(dx < 0 ? 1 : -1);
            }
            // Double-tap zoom
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 250) {
              if (!viewport._lastTap || Date.now() - viewport._lastTap > 400) {
                viewport._lastTap = Date.now();
              } else {
                viewport._lastTap = 0;
                if (scale > 1.5) resetZoom();
                else { scale = 2.8; applyTransform(); }
              }
            }
          }
        }, { passive: true });

        // Close on overlay click (not on image)
        overlay.addEventListener('click', function (e) {
          if (e.target === overlay) close();
        });
      }

      function getTouchDist(touches) {
        var dx = touches[0].clientX - touches[1].clientX;
        var dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
      }

      // Expose globals
      window.lbxOpen = open;
      window.lbxClose = close;
      window.lbxNav = nav;
      window.lbxResetZoom = resetZoom;
      window._lbxCur = 0;

      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
      else init();
    })();

    // =============================================
    // SIMILAR ITEMS
    // =============================================
    function renderSimilarItems(currentId) {
      var section = document.getElementById('pdp-similar');
      var track = document.getElementById('sim-track');
      var countEl = document.getElementById('sim-count');
      if (!section || !track) return;

      var current = allProducts.find(function (p) { return p.id === currentId; });
      if (!current) { section.classList.remove('visible'); return; }

      // Priority 1: same category + same subcategory
      // Priority 2: same category only
      // Exclude current product, limit to 10
      var sameSubcat = allProducts.filter(function (p) {
        return p.id !== currentId && p.category === current.category && p.subcategory === current.subcategory;
      });
      var sameCatOnly = allProducts.filter(function (p) {
        return p.id !== currentId && p.category === current.category && p.subcategory !== current.subcategory;
      });

      // Merge: subcategory matches first, then rest of category
      var pool = sameSubcat.concat(sameCatOnly).slice(0, 12);

      if (pool.length === 0) { section.classList.remove('visible'); return; }

      if (window.TTProductCard && typeof window.TTProductCard.renderInto === 'function') {
        window.TTProductCard.renderInto(track, pool, { context: 'similar' });
      } else {
        track.innerHTML = '<div class="loading-grid">Products are loading...</div>';
      }

      countEl.textContent = pool.length + ' item' + (pool.length !== 1 ? 's' : '');
      section.classList.add('visible');

      // Scroll similar section into view gently after PDP loads
      setTimeout(function () {
        section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // scroll back up to top of page immediately -- just ensure section is rendered
        window.scrollTo(0, 0);
      }, 100);
    }

    // ── PROMO TICKER POPUP ──
    function openPromoPopup() {
      document.getElementById('promo-popup-overlay').classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closePromoPopup() {
      document.getElementById('promo-popup-overlay').classList.remove('open');
      document.body.style.overflow = '';
    }
    function closePromoOnOverlay(e) {
      if (e.target === document.getElementById('promo-popup-overlay')) closePromoPopup();
    }
    function copyPromoCodePopup() {
      var code = 'WELCOME10';
      var btn = document.getElementById('promo-copy-btn');
      var hint = document.getElementById('popup-code-hint');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(function () {
          _promoCodeCopied(btn, hint);
        }).catch(function () { _promoCodeFallback(code, btn, hint); });
      } else {
        _promoCodeFallback(code, btn, hint);
      }
    }
    function _promoCodeFallback(code, btn, hint) {
      var ta = document.createElement('textarea');
      ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { }
      document.body.removeChild(ta);
      _promoCodeCopied(btn, hint);
    }
    function _promoCodeCopied(btn, hint) {
      if (btn) { btn.textContent = '✅ Copied! Use at checkout'; btn.classList.add('copied'); }
      if (hint) { hint.textContent = '✅ Code copied!'; }
      showToast('✅ WELCOME10 copied! Use at checkout');
      setTimeout(function () {
        if (btn) { btn.textContent = '📋 Copy Code -- WELCOME10'; btn.classList.remove('copied'); }
        if (hint) { hint.textContent = 'Tap to copy 📋'; }
      }, 3000);
    }

    // Init
    (async () => {
      restoreBasketFromSession();
      syncCheckoutGlobals();
      updateBasketUI();
      await loadTinythreadsConfig();
      await loadProducts();
    })();
