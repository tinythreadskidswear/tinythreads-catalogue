// ════════════════════════════════════════════════════════════
// TINY THREADS — features.js
// Self-contained feature widgets, each independently IIFE-scoped
// (no shared state with app.js):
//   1. Category banner carousel (Supabase-driven hero swiper)
//   2. Promo code popup / ticker (origin-based offer codes)
//   3. Partner store finder (PIN → area → reseller lookup)
//   4. Hero logo surprise gift popup
// Can load in any order relative to each other; load after
// supabase-js and swiper-bundle since the carousel needs both.
// ════════════════════════════════════════════════════════════

          (function () {
            var SB_URL = 'https://gtszuhmfpywqwdetoqqo.supabase.co';
            var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c3p1aG1mcHl3cXdkZXRvcXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzU5ODcsImV4cCI6MjA5NTIxMTk4N30.-LVroO9ReQEjlLO1XQ3pTrijydMBNH739k05ixo3ZE0';
	
            var LABELS = {
              boys: { title: 'Boys Collection', sub: 'Ages 3-13 Years · Bold, playful & built for every adventure' },
              girls: { title: 'Girls Collection', sub: 'Ages 3-13 Years · Sweet, vibrant & effortlessly cute' },
              babies: { title: 'Baby Collection', sub: 'Ages 0-3 Years · Impossibly soft, gentle & adorable' },
              nightwear: { title: 'Nightwear', sub: 'Cozy sleepwear & pyjamas for all ages' },
              footwear: { title: 'Footwear', sub: 'Sneakers, sandals, Clog & shoes for every step' },
              accessories: { title: 'Accessories', sub: 'Hairbands, clips, belts & more' },
              toys: { title: 'Toys', sub: 'Fun, educational & imaginative play' },
              twinning: { title: 'Twinning Sets', sub: 'Matching parent-child outfits' },
              kidscare: { title: 'Kids Care', sub: 'Gentle skincare & grooming' },
              school: { title: 'School', sub: 'Bags, stationery & essentials' },
              learning: { title: 'Learning', sub: 'Books, puzzles & educational tools' }
            };

            // Store Swiper instances so they can be destroyed before recreating
            var bannerSwipers = {};

            function bannerUrl(raw, mobile) {
              if (!raw || !raw.includes('res.cloudinary.com')) return raw;
              var w = mobile ? '800' : '1400';
              return raw.replace('/upload/', '/upload/c_fill,w_' + w + ',h_420,g_auto,q_auto,f_auto/');
            }

            function buildCarousel(cat, urls) {
              var inner = document.getElementById('cat-banner-inner-' + cat);
              if (!inner) return;

              // Destroy old Swiper instance if it exists
              if (bannerSwipers[cat]) {
                bannerSwipers[cat].destroy(true, true);
                delete bannerSwipers[cat];
              }
			  
			  inner.innerHTML = '';  // flush cloned slides from previous loop instance

              var L = LABELS[cat] || { title: cat, sub: '' };
              var multi = urls.length > 1;

              var slides = urls.map(function (u) {
                return '<div class="swiper-slide">'
                  + '<picture>'
                  + '<source media="(min-width:701px)" srcset="' + bannerUrl(u, false) + '">'
                  + '<img src="' + bannerUrl(u, true) + '" alt="' + L.title + '" loading="eager" decoding="async">'
                  + '</picture>'
                  + '</div>';
              }).join('');

              inner.innerHTML =
                '<div class="cat-banner-swiper swiper" id="cbsw-' + cat + '">'
                + '<div class="swiper-wrapper">' + slides + '</div>'
                + (multi ? '<div class="swiper-pagination"></div>'
                  + '<div class="swiper-button-prev"></div>'
                  + '<div class="swiper-button-next"></div>' : '')
                + '</div>'
                + '<div class="cat-banner-overlay"></div>'
                + '<div class="cat-banner-caption">'
                + '<h1>' + L.title + '</h1>'
                + '<p>' + L.sub + '</p>'
                + '</div>';

              // Wait for DOM to be painted AND images to start loading
              setTimeout(function () {
                var el = document.getElementById('cbsw-' + cat);
                if (!el || !window.Swiper) return;

                try {
                  bannerSwipers[cat] = new Swiper(el, {
                    loop: multi,
					rewind: multi,

                    speed: 700,
                    effect: 'fade',
                    fadeEffect: { crossFade: true },
                    autoplay: multi ? { delay: 3000, disableOnInteraction: false } : false,
                    pagination: multi ? { el: el.querySelector('.swiper-pagination'), clickable: true } : false,
                    navigation: multi ? {
                      nextEl: el.querySelector('.swiper-button-next'),
                      prevEl: el.querySelector('.swiper-button-prev')
                    } : false
                  });
                } catch (err) {
                  console.error('[BannerCarousel] Swiper init error for ' + cat + ':', err);
                }
              }, 300);
            }

            async function loadBanners() {
              try {
                var res = await fetch(
                  SB_URL + '/rest/v1/banners?select=category,urls',
                  { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY } }
                );
                if (!res.ok) throw new Error('HTTP ' + res.status);
                var rows = await res.json();
                if (!Array.isArray(rows) || !rows.length) return;
                rows.forEach(function (row) {
                  var cat = (row.category || '').toLowerCase().trim();
                  var urls = row.urls;
                  if (typeof urls === 'string') { try { urls = JSON.parse(urls); } catch (e) { urls = [urls]; } }
                  if (!Array.isArray(urls)) urls = [];
                  urls = urls.map(function (u) { return (u || '').trim(); }).filter(Boolean);
                  if (urls.length) buildCarousel(cat, urls);
                });
              } catch (e) {
                console.warn('[BannerCarousel] Using static fallback:', e.message);
              }
            }

            if (document.readyState === 'loading')
              document.addEventListener('DOMContentLoaded', loadBanners);
            else
              loadBanners();

            // The Swiper instance for a category was created while its
            // page may have been display:none (0 width/height), so it
            // never sized itself correctly and can show up blacked-out.
            // When app.js's showPage() reveals that category again,
            // force this banner's Swiper to re-measure now that it has
            // real dimensions.
            window.addEventListener('tt:pageshown', function (e) {
              var cat = e.detail && e.detail.id;
              var sw = cat && bannerSwipers[cat];
              if (!sw) return;
              requestAnimationFrame(function () { sw.update(); });
            });
          }());
          (function () {
            var SB_URL = 'https://gtszuhmfpywqwdetoqqo.supabase.co';
            var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c3p1aG1mcHl3cXdkZXRvcXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzU5ODcsImV4cCI6MjA5NTIxMTk4N30.-LVroO9ReQEjlLO1XQ3pTrijydMBNH739k05ixo3ZE0';

            // Emoji map by origin for ticker + popup flavour
            var ORIGIN_EMOJI = {
              'tinythreads': '🎉',
              'instagram':   '📸',
              'referee':     '🤝',
              'reseller':    '🏪'
            };
            var ORIGIN_LABEL = {
              'tinythreads': 'Exclusive Offer',
              'instagram':   'Instagram Offer',
              'referee':     'Referral Offer',
              'reseller':    'Partner Offer'
            };

            function esc(s) {
              return String(s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            }

            // Build a human-readable description line for a promo row
            function promoDesc(p) {
              var pct  = Math.round(p.discount * 100);
              var line = pct + '% off';
              if (p.max_upto)   line += ' (up to ₹' + p.max_upto + ')';
              if (p.min_order)  line += ' · Min order ₹' + p.min_order;
              return line;
            }

            function renderTicker(codes) {
              var track = document.getElementById('promo-ticker-track');
              if (!track) return;
              if (!codes.length) return; // keep static fallback item

              var items = [];
              codes.forEach(function (p) {
                var pct = Math.round(p.discount * 100);
                var emoji = ORIGIN_EMOJI[p.origin] || '✨';
                items.push(
                  '<span class="promo-ticker-item">'
                  + emoji + ' Use code <span class="tk-code">' + esc(p.code) + '</span>'
                  + ' for ' + pct + '% off!'
                  + (p.min_order ? ' · Min ₹' + p.min_order : '')
                  + ' <span class="tk-tap">· Tap to copy 📋</span></span>'
                );
                items.push(
                  '<span class="promo-ticker-item">✨ '
                  + promoDesc(p) + ' · Apply code <span class="tk-code">' + esc(p.code)
                  + '</span> at checkout</span>'
                );
              });
              // Always include a brand filler item
              items.push('<span class="promo-ticker-item">👶 Joyful kidswear from ₹199 &nbsp;·&nbsp; Checkout via WhatsApp</span>');

              // Duplicate for seamless infinite scroll
              track.innerHTML = items.join('') + items.join('');

              // Update strip aria-label with first code for accessibility
              var strip = track.closest('.promo-ticker-strip');
              if (strip && codes[0]) {
                strip.setAttribute('aria-label',
                  'Tap to see discount code ' + codes[0].code
                  + ' — ' + Math.round(codes[0].discount * 100) + '% off');
              }
            }

            function renderPopup(codes) {
              // Show the first tinythreads-origin code in the popup; fall back to first available
              var p = codes.find(function (c) { return c.origin === 'tinythreads'; }) || codes[0];
              if (!p) return;

              var pct   = Math.round(p.discount * 100);
              var emoji = ORIGIN_EMOJI[p.origin] || '🎉';
              var tag   = '✨ ' + (ORIGIN_LABEL[p.origin] || 'Special Offer');

              var heading = 'Get <em>' + pct + '% off</em>';
              if (p.max_upto) heading += ' (up to ₹' + p.max_upto + ')';
              heading += '!';

              var subParts = ['Apply at checkout', 'Valid on all products'];
              if (p.min_order) subParts.push('Min order ₹' + p.min_order);
              else             subParts.push('No minimum order');

              var tagEl     = document.getElementById('popup-tag');
              var headEl    = document.getElementById('popup-heading');
              var subEl     = document.getElementById('popup-subtext');
              var codeValEl = document.getElementById('popup-code-val');
              var copyBtn   = document.getElementById('promo-copy-btn');

              var emojiEl = tagEl && tagEl.previousElementSibling;
              if (emojiEl && emojiEl.classList.contains('promo-popup-emoji')) emojiEl.textContent = emoji;
              if (tagEl)     tagEl.textContent   = tag;
              if (headEl)    headEl.innerHTML     = heading;
              if (subEl)     subEl.textContent    = subParts.join(' · ');
              if (codeValEl) codeValEl.textContent = p.code;
              if (copyBtn)   copyBtn.textContent   = '📋 Copy Code – ' + p.code;
            }

            async function loadPromoCodes() {
              var now = new Date().toISOString();
              var url = SB_URL + '/rest/v1/promocodes'
                + '?active=eq.true'
                + '&select=code,label,discount,origin,is_public,min_order,max_upto,valid_from,valid_until'
                + '&order=id.asc';
              try {
                var res = await fetch(url, {
                  headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                var rows = await res.json();
                if (!Array.isArray(rows) || !rows.length) return;

                // Filter out time-expired codes client-side
                var valid = rows.filter(function (p) {
                  if (p.valid_from  && now < p.valid_from)  return false;
                  if (p.valid_until && now > p.valid_until) return false;
                  return true;
                });

                // Populate the global PROMO_CODES map with ALL valid codes (public + private)
                // Private codes (is_public=false) are never shown on site but validate fine at checkout
                if (typeof PROMO_CODES !== 'undefined') {
                  valid.forEach(function (p) {
                    PROMO_CODES[p.code.toUpperCase()] = {
                      code:      p.code.toUpperCase(),
                      label:     p.label,
                      discount:  parseFloat(p.discount),
                      origin:    p.origin,
                      min_order: parseFloat(p.min_order) || 0,
                      max_upto:  p.max_upto ? parseFloat(p.max_upto) : null
                    };
                  });
                }

                // Ticker + popup only see is_public=true codes
                var publicCodes = valid.filter(function (p) { return p.is_public === true; });
                renderTicker(publicCodes);
                renderPopup(publicCodes);

              } catch (err) {
                console.warn('[PromoCodes] Using static fallback:', err.message);
              }
            }

            if (document.readyState === 'loading')
              document.addEventListener('DOMContentLoaded', loadPromoCodes);
            else
              loadPromoCodes();
          }());
// ═══════════════════════════════════════════════════════════
// PARTNER STORE FINDER  v2
// Flow: PIN → area (from pincodes table)
//            → society (from resellers table)
//            → show reseller card + WA button
// Fallback: any error or no match → silent open main WA
// ═══════════════════════════════════════════════════════════
(function () {
  'use strict';

  var SB_URL   = 'https://gtszuhmfpywqwdetoqqo.supabase.co';
  var SB_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c3p1aG1mcHl3cXdkZXRvcXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzU5ODcsImV4cCI6MjA5NTIxMTk4N30.-LVroO9ReQEjlLO1XQ3pTrijydMBNH739k05ixo3ZE0';
  var MAIN_WA  = '917879976016';
  var SESS_KEY = 'tt_partner';

  var _currentReseller = null;
  var _pinLookupTimer  = null;

  // ── Session helpers ──────────────────────────────────────
  function saveSession(d) {
    try { sessionStorage.setItem(SESS_KEY, JSON.stringify(d)); } catch(e) {}
  }
  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(SESS_KEY) || 'null'); } catch(e) { return null; }
  }

  // ── Helpers ──────────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function pinSt(cls, msg) {
    var el = document.getElementById('partner-pin-st');
    if (!el) return;
    el.className = 'partner-pin-st' + (cls ? ' ' + cls : '');
    el.textContent = msg;
  }
  function setFieldError(id, on) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('has-error', on);
  }
  function clearFieldError(id) { setFieldError(id, false); }
  function openMainWA(area, society) {
    var loc = society || area || 'your area';
    var msg = 'Hi Tiny Threads! I am from ' + loc + '. I would love to browse your kids\' collection!';
    window.open('https://wa.me/' + MAIN_WA + '?text=' + encodeURIComponent(msg), '_blank');
  }

  // ── Open popup ───────────────────────────────────────────
  window.openPartnerPopup = function () {
    document.getElementById('partner-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';

    // Restore from session
    var sess = loadSession();

    // Cross-fill PIN from checkout session if available
    var checkoutPin = '';
    try {
      var cs = JSON.parse(sessionStorage.getItem('tt_ship') || 'null');
      if (cs && cs.pin) checkoutPin = cs.pin;
    } catch(e) {}

    var pin = (sess && sess.pin) || checkoutPin || '';

    // If we have a saved reseller, go straight to result state
    if (sess && sess.reseller) {
      _currentReseller = sess.reseller;
      _showResult(sess.reseller);
      return;
    }

    // Pre-fill PIN and trigger lookup chain
    if (pin) {
      document.getElementById('pinp-pin').value = pin;
      _lookupPin(pin, (sess && sess.area) || '', (sess && sess.society) || '');
    }
  };

  window.closePartnerPopup = function () {
    document.getElementById('partner-overlay').classList.remove('open');
    document.body.style.overflow = '';
  };

  window.partnerOverlayClick = function (e) {
    if (e.target === document.getElementById('partner-overlay')) closePartnerPopup();
  };

  window.partnerReset = function () {
    _currentReseller = null;
    saveSession(null);
    sessionStorage.removeItem(SESS_KEY);
    document.getElementById('partner-body-result').style.display = 'none';
    document.getElementById('partner-body-pin').style.display = 'block';
    // Reset all dropdowns
    document.getElementById('pinp-pin').value = '';
    document.getElementById('pinp-area').innerHTML = '<option value="">Enter PIN to load areas...</option>';
    document.getElementById('pinp-society').innerHTML = '<option value="">Select area first...</option>';
    document.getElementById('pf-society').style.display = 'none';
    pinSt('', '');
  };

  // ── Escape key ───────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('partner-overlay').classList.contains('open'))
      closePartnerPopup();
  });

  // ── Wire up PIN input ────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var pinInp = document.getElementById('pinp-pin');
    if (pinInp) {
      pinInp.addEventListener('input', function () {
        clearTimeout(_pinLookupTimer);
        var v = this.value.replace(/\D/g, '');
        this.value = v;
        clearFieldError('pf-pin');
        pinSt('', '');
        // Reset downstream dropdowns whenever PIN changes
        document.getElementById('pinp-area').innerHTML    = '<option value="">Enter PIN to load areas...</option>';
        document.getElementById('pinp-society').innerHTML = '<option value="">Select area first...</option>';
        document.getElementById('pf-society').style.display = 'none';
        if (v.length === 6) {
          _pinLookupTimer = setTimeout(function () { _lookupPin(v, '', ''); }, 420);
        }
      });
    }

    // Wire area change → load societies
    var areaEl = document.getElementById('pinp-area');
    if (areaEl) {
      areaEl.addEventListener('change', function () {
        clearFieldError('pf-area');
        var pin  = (document.getElementById('pinp-pin').value || '').trim();
        var area = this.value;
        document.getElementById('pinp-society').innerHTML = '<option value="">Select your society...</option>';
        document.getElementById('pf-society').style.display = 'none';
        if (pin.length === 6 && area) _loadSocieties(pin, area, '');
      });
    }

    // Wire society change → fetch reseller immediately
    var socEl = document.getElementById('pinp-society');
    if (socEl) {
      socEl.addEventListener('change', function () {
        clearFieldError('pf-society');
        var society = this.value;
        if (society) _fetchAndShowReseller(society);
      });
    }
  });

  // ── Step 1: PIN → areas (from pincodes table) ────────────
  async function _lookupPin(pin, preferArea, preferSociety) {
    pinSt('loading', 'Looking up PIN...');
    var areaEl = document.getElementById('pinp-area');
    areaEl.innerHTML = '<option value="">Loading areas...</option>';
    document.getElementById('pinp-society').innerHTML = '<option value="">Select area first...</option>';
    document.getElementById('pf-society').style.display = 'none';

    try {
      var res = await fetch(
        SB_URL + '/rest/v1/pincodes?pin=eq.' + pin + '&select=offices',
        { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY } }
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var rows = await res.json();

      if (!rows || !rows.length || !rows[0].offices || !rows[0].offices.length) {
        pinSt('fail', 'PIN not found — try a different one');
        areaEl.innerHTML = '<option value="">PIN not found</option>';
        return;
      }

      var offices = rows[0].offices;
      var city    = offices[0].District || offices[0].Division || '';
      var state   = offices[0].State || '';
      pinSt('ok', city ? city + ', ' + state : 'PIN found');

      // Build area dropdown
      areaEl.innerHTML = '<option value="">Select your area...</option>';
      var seen = new Set();
      offices.forEach(function (o) {
        if (o.Name && !seen.has(o.Name)) {
          seen.add(o.Name);
          var opt = document.createElement('option');
          opt.value = o.Name;
          opt.textContent = o.Name;
          if (preferArea && o.Name === preferArea) opt.selected = true;
          areaEl.appendChild(opt);
        }
      });
      var other = document.createElement('option');
      other.value = 'Other'; other.textContent = 'Other / Not listed';
      areaEl.appendChild(other);

      clearFieldError('pf-area');

      // If we have a preferred area, auto-trigger society load
      if (preferArea && seen.has(preferArea)) {
        _loadSocieties(pin, preferArea, preferSociety);
      }

    } catch (err) {
      pinSt('fail', 'Could not look up PIN');
      areaEl.innerHTML = '<option value="">Error — try again</option>';
    }
  }

  // ── Step 2: area → societies (from resellers table) ──────
  async function _loadSocieties(pin, area, preferSociety) {
    var socEl = document.getElementById('pinp-society');
    var socField = document.getElementById('pf-society');
    socEl.innerHTML = '<option value="">Loading societies...</option>';
    socField.style.display = 'block';

    try {
      // Fetch distinct society_name values for this PIN+area from resellers table
      var url = SB_URL + '/rest/v1/resellers'
              + '?active=eq.true'
              + '&pincode=eq.' + encodeURIComponent(pin)
              + '&area=ilike.' + encodeURIComponent(area)
              + '&select=society_name'
              + '&order=society_name.asc';

      var res = await fetch(url, {
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var rows = await res.json();

      if (!rows || !rows.length) {
        // No resellers in this area at all — hide society field, 
        // "Find" button will trigger fallback
        socEl.innerHTML = '<option value="">No partner stores in this area yet</option>';
        socEl.value = '__none__';
        return;
      }

      // Deduplicate societies
      var societies = [...new Set(rows.map(function (r) { return r.society_name; }).filter(Boolean))];

      socEl.innerHTML = '<option value="">Select your society...</option>';
      societies.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (preferSociety && s === preferSociety) opt.selected = true;
        socEl.appendChild(opt);
      });

      // If we have a preferred society pre-selected, load reseller immediately
      if (preferSociety && societies.includes(preferSociety)) {
        _fetchAndShowReseller(preferSociety);
      }

    } catch (err) {
      socEl.innerHTML = '<option value="">Could not load — try again</option>';
    }
  }

  // ── Step 3: society → fetch reseller row ─────────────────
  async function _fetchAndShowReseller(society) {
    var pin  = (document.getElementById('pinp-pin').value || '').trim();
    var area = (document.getElementById('pinp-area').value || '').trim();

    var btn = document.getElementById('partner-find-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Finding...'; }

    try {
      var url = SB_URL + '/rest/v1/resellers'
              + '?active=eq.true'
              + '&pincode=eq.' + encodeURIComponent(pin)
              + '&society_name=eq.' + encodeURIComponent(society)
              + '&select=reseller_name,partner_name,whatsapp_number,society_name,area,pincode'
              + '&limit=1';

      var res = await fetch(url, {
        headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var rows = await res.json();

      if (rows && rows.length) {
        _currentReseller = rows[0];
        saveSession({ pin: pin, area: area, society: society, reseller: rows[0] });
        _showResult(rows[0]);
      } else {
        // Society in dropdown but row gone (race condition / deleted) → fallback
        openMainWA(area, society);
        closePartnerPopup();
      }

    } catch (err) {
      openMainWA(area, society);
      closePartnerPopup();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🏪 Find My Partner Store'; }
    }
  }

  // ── Manual Find button (validates + triggers fetch) ──────
  window.findPartnerStore = function () {
    var pin     = (document.getElementById('pinp-pin').value || '').trim();
    var area    = (document.getElementById('pinp-area').value || '').trim();
    var society = (document.getElementById('pinp-society').value || '').trim();

    var pinOk     = /^\d{6}$/.test(pin);
    var areaOk    = area.length > 0;
    var societyOk = society.length > 0 && society !== '__none__';

    setFieldError('pf-pin',     !pinOk);
    setFieldError('pf-area',    !areaOk);

    // If society field is visible, validate it
    var socField = document.getElementById('pf-society');
    var socVisible = socField && socField.style.display !== 'none';
    if (socVisible) setFieldError('pf-society', !societyOk);

    if (!pinOk || !areaOk) return;

    // No societies found in this area → silent fallback
    if (socVisible && !societyOk) {
      openMainWA(area, '');
      closePartnerPopup();
      return;
    }

    if (societyOk) {
      _fetchAndShowReseller(society);
    }
  };

  // ── Show result card ─────────────────────────────────────
  function _showResult(r) {
    var card = document.getElementById('partner-result-card');
    card.innerHTML =
      '<div class="partner-store-name">'  + esc(r.reseller_name) + '</div>'
    + (r.partner_name
        ? '<div class="partner-person-name">Partner: ' + esc(r.partner_name) + '</div>'
        : '')
    + '<div class="partner-location-row">📍 ' + esc(r.society_name) + (r.area ? ', ' + esc(r.area) : '') + '</div>'
    + '<div class="partner-verified-badge">✅ Authorised Partner</div>';

    document.getElementById('partner-body-pin').style.display    = 'none';
    document.getElementById('partner-body-result').style.display = 'block';
  }

  // ── Open partner WhatsApp ────────────────────────────────
  window.openPartnerWhatsApp = function () {
    if (!_currentReseller) { openMainWA('', ''); return; }
    var r   = _currentReseller;
    var msg = 'Hi! I am from *' + esc(r.society_name) + '*. '
            + 'I found you through Tiny Threads and would love to browse your kids\' collection. '
            + 'Could you please share what\'s available?';
    var num = (r.whatsapp_number || '').replace(/\D/g, '') || MAIN_WA;
    window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(msg), '_blank');
  };

}());
  // ── HERO LOGO SURPRISE GIFT POPUP ──
  function openGiftPopup() {
    document.getElementById('gift-popup-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeGiftPopup() {
    document.getElementById('gift-popup-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }
  function closeGiftOnOverlay(e) {
    if (e.target === document.getElementById('gift-popup-overlay')) closeGiftPopup();
  }
  function copyGiftCode() {
    var code = 'JOY155';
    var btn  = document.getElementById('gift-copy-btn');
    var hint = document.getElementById('gift-code-hint');
 
    function done() {
      if (btn)  { btn.textContent = '✅ Copied! Use at checkout'; btn.classList.add('copied'); }
      if (hint) { hint.textContent = '✅ Code copied!'; }
      if (typeof showToast === 'function') showToast('✅ JOY155 copied! Use at checkout');
      setTimeout(function () {
        if (btn)  { btn.textContent = '📋 Copy Code -- JOY155'; btn.classList.remove('copied'); }
        if (hint) { hint.textContent = 'Tap to copy 📋'; }
      }, 3000);
    }
 
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(done).catch(function () { _giftCopyFallback(code, done); });
    } else {
      _giftCopyFallback(code, done);
    }
  }
  function _giftCopyFallback(code, done) {
    var ta = document.createElement('textarea');
    ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    done();
  }
  // Escape key closes the popup
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('gift-popup-overlay');
      if (ov && ov.classList.contains('open')) closeGiftPopup();
    }
  });