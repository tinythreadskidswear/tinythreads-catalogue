// ════════════════════════════════════════════════════════════
// TINY THREADS — account.js (Account V2)
// Customer account: session management, login modal, OTP flow,
// account dashboard, order history, order detail.
// Pure plug-in — no existing JS touched.
// Load this AFTER app.js in index.html.
//
// NOTE: All Supabase calls, session logic, OTP logic, order
// fetching, and public function names are UNCHANGED from the
// previous version. Only rendering / UI layer was modernized.
// ════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── CONFIG ────────────────────────────────────────────────
  const OTP_DEV_MODE     = true;   // ← set false when Meta WhatsApp API is ready
  const DEV_OTP_CODE     = '5678'; // ← any 4-digit code works in dev mode
  const SESSION_DAYS     = 30;
  const OTP_EXPIRY_MINS  = 5;
  const SESS_KEY         = 'tt_session';  // localStorage key

  const SB_URL = 'https://gtszuhmfpywqwdetoqqo.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c3p1aG1mcHl3cXdkZXRvcXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzU5ODcsImV4cCI6MjA5NTIxMTk4N30.-LVroO9ReQEjlLO1XQ3pTrijydMBNH739k05ixo3ZE0';

  // ── STATE ─────────────────────────────────────────────────
  let _session       = null;   // { mobile, token, expires_at }
  let _currentMobile = '';     // mobile being verified right now
  let _resendTimer   = null;
  let _resendSeconds = 0;
  let _currentOrders = [];     // cached order list
  let _currentOrder  = null;   // order being viewed in detail
  let _customerName  = '';     // best-known display name, derived from latest order

  // ── SUPABASE HELPERS ──────────────────────────────────────
  async function sbFetch(path, opts = {}) {
    const res = await fetch(SB_URL + path, {
      ...opts,
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(opts.headers || {})
      }
    });
    if (!res.ok) throw new Error('Supabase ' + res.status);
    return res.json();
  }

  // ── TOKEN GENERATOR ───────────────────────────────────────
  function generateToken() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function generateOTP() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  // ── SESSION STORAGE ───────────────────────────────────────
  function saveSession(sess) {
    try { localStorage.setItem(SESS_KEY, JSON.stringify(sess)); } catch(e) {}
    _session = sess;
    updateNavAvatar();
  }

  function loadSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESS_KEY) || 'null');
      if (!s) return null;
      if (new Date(s.expires_at) < new Date()) {
        localStorage.removeItem(SESS_KEY);
        return null;
      }
      return s;
    } catch(e) { return null; }
  }

  function clearSession() {
    localStorage.removeItem(SESS_KEY);
    _session = null;
    _customerName = '';
    updateNavAvatar();
  }

  // ── AVATAR (initials, gradient generated from mobile number) ──
  // Per design spec: no SVG avatar — initials in a gradient circle,
  // with the gradient derived deterministically from the phone number
  // so the same customer always sees the same colours.
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function avatarGradient(mobile) {
    const h = hashString(mobile || '0000000000');
    const hue1 = h % 360;
    const hue2 = (hue1 + 46) % 360;
    return `linear-gradient(135deg, hsl(${hue1} 78% 60%), hsl(${hue2} 82% 52%))`;
  }

  function getInitials(name, mobile) {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    }
    if (mobile) return mobile.slice(-2);
    return 'TT';
  }

  // size: pixel size of the circle. extraClass: additional class names.
  function avatarHTML(mobile, name, size, extraClass) {
    const initials = getInitials(name, mobile);
    const gradient = avatarGradient(mobile || '');
    const fontSize = Math.round(size * 0.4);
    return `<div class="acc-avatar-initials ${extraClass || ''}" style="width:${size}px;height:${size}px;font-size:${fontSize}px;background:${gradient};">${initials}</div>`;
  }

  // ── NAV AVATAR ────────────────────────────────────────────
  // Account access lives only inside the mob-menu drawer (mmh-account-row),
  // not the top nav bar. This keeps the guest/logged-in card in sync with _session.
  function updateNavAvatar() {
    const guestEl  = document.getElementById('mmh-guest');
    const userEl   = document.getElementById('mmh-user');
    const avatarEl = document.getElementById('mmh-user-avatar');
    const mobileEl = document.getElementById('mmh-user-mobile');
    if (!guestEl || !userEl) return;

    if (_session) {
      guestEl.style.display = 'none';
      userEl.style.display  = 'flex';
      if (avatarEl) avatarEl.innerHTML = avatarHTML(_session.mobile, _customerName, 30);
      if (mobileEl) mobileEl.textContent = formatMobile(_session.mobile);
    } else {
      guestEl.style.display = 'flex';
      userEl.style.display  = 'none';
    }
  }

  // Tap target for the logged-in card in the drawer — closes the drawer
  // then opens the account menu sheet.
  window._mmhOpenAccount = function () {
    if (typeof closeMobMenu === 'function') closeMobMenu();
    setTimeout(openAccountMenu, 200);
  };

  // ── OTP OPERATIONS ────────────────────────────────────────
  async function sendOTP(mobile) {
    if (OTP_DEV_MODE) {
      // Dev mode — store a fake OTP in Supabase so verify flow works
      const expires = new Date(Date.now() + OTP_EXPIRY_MINS * 60000).toISOString();
      try {
        // Delete any existing OTP for this mobile first
        await sbFetch('/rest/v1/otp_codes?mobile=eq.' + mobile, { method: 'DELETE' });
        // Insert new
        await sbFetch('/rest/v1/otp_codes', {
          method: 'POST',
          body: JSON.stringify({ mobile, code: DEV_OTP_CODE, expires_at: expires, verified: false })
        });
      } catch(e) { console.warn('OTP store:', e.message); }
      return { success: true, dev: true };
    }

    // ── PRODUCTION: call your Edge Function ──
    // Replace this with your actual Edge Function URL when Meta is ready
    // const res = await fetch(SB_URL + '/functions/v1/send-otp', {
    //   method: 'POST',
    //   headers: { 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ mobile })
    // });
    // if (!res.ok) throw new Error('Send OTP failed');
    // return res.json();

    throw new Error('WhatsApp API not configured yet');
  }

  async function verifyOTP(mobile, code) {
    try {
      const rows = await sbFetch(
        '/rest/v1/otp_codes?mobile=eq.' + mobile + '&select=code,expires_at,verified'
      );

      if (!rows || !rows.length) return { success: false, reason: 'No OTP found. Please request a new one.' };

      const record = rows[0];

      if (new Date(record.expires_at) < new Date()) {
        return { success: false, reason: 'OTP has expired. Please request a new one.' };
      }

      if (record.verified) {
        return { success: false, reason: 'OTP already used. Please request a new one.' };
      }

      if (record.code !== code) {
        return { success: false, reason: 'Incorrect code. Please try again.' };
      }

      // Mark as verified
      await sbFetch('/rest/v1/otp_codes?mobile=eq.' + mobile, {
        method: 'PATCH',
        body: JSON.stringify({ verified: true })
      });

      // Create session
      const token      = generateToken();
      const expires_at = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();

      // Delete old sessions for this mobile
      await sbFetch('/rest/v1/customer_sessions?mobile=eq.' + mobile, { method: 'DELETE' });

      // Insert new session
      await sbFetch('/rest/v1/customer_sessions', {
        method: 'POST',
        body: JSON.stringify({ mobile, session_token: token, expires_at })
      });

      return { success: true, token, mobile, expires_at };

    } catch(e) {
      console.error('Verify OTP:', e);
      return { success: false, reason: 'Something went wrong. Please try again.' };
    }
  }

  // ── ORDER FETCHING ────────────────────────────────────────
  async function fetchOrders(mobile) {
    try {
      const rows = await sbFetch(
        '/rest/v1/orders?mobile=eq.' + encodeURIComponent(mobile) +
        '&select=id,created_at,status,total,subtotal,promocode,cart_detail,customer_name,address_line1,address_line2,area,city,pincode,state' +
        '&order=created_at.desc'
      );
      return Array.isArray(rows) ? rows : [];
    } catch(e) {
      console.error('Fetch orders:', e);
      return [];
    }
  }

  // ── UI HELPERS ────────────────────────────────────────────
  function showMsg(id, type, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'acc-msg ' + type;
    el.textContent = text;
  }

  function clearMsg(id) {
    const el = document.getElementById(id);
    if (el) { el.className = 'acc-msg'; el.textContent = ''; }
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDateShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function formatMobile(m) {
    return '+91 ' + m.replace(/(\d{5})(\d{5})/, '$1 $2');
  }

  function statusLabel(s) {
    return { pending: 'Order Placed', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' }[s] || s;
  }

  function statusIcon(s) {
    return { pending: '🕐', confirmed: '✅', shipped: '🚚', delivered: '🎉', cancelled: '❌' }[s] || '📦';
  }

  function statusDesc(s) {
    return {
      pending:   'We have received your order and will confirm it shortly.',
      confirmed: 'Your order has been confirmed and is being prepared.',
      shipped:   'Your order is on its way to you!',
      delivered: 'Your order has been delivered. Hope you love it! 💖',
      cancelled: 'This order was cancelled per your request.'
    }[s] || '';
  }

  function greetingText() {
    const h = new Date().getHours();
    if (h < 5)  return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  }

  function itemThumbURL(item) {
    return item && (item.image || item.image_url || item.img || item.thumbnail || item.photo) || '';
  }

  // ── SIMPLE TOAST (used only if app.js's own showToast is unavailable) ──
  function toast(msg) {
    if (typeof showToast === 'function') { showToast(msg); return; }
    const t = document.createElement('div');
    t.className = 'acc-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
  }

  window._accComingSoon = function (label) {
    toast((label || 'This feature') + ' is coming soon ✨');
  };

  // ── RESEND TIMER ──────────────────────────────────────────
  function startResendTimer() {
    _resendSeconds = 30;
    const btn     = document.getElementById('acc-resend-btn');
    const counter = document.getElementById('acc-resend-counter');
    if (btn) btn.disabled = true;

    _resendTimer = setInterval(function () {
      _resendSeconds--;
      if (counter) counter.textContent = _resendSeconds + 's';
      if (_resendSeconds <= 0) {
        clearInterval(_resendTimer);
        if (btn) { btn.disabled = false; }
        if (counter) counter.textContent = '';
        const row = document.getElementById('acc-resend-row');
        if (row) row.innerHTML = '<button class="acc-resend-btn" id="acc-resend-btn" onclick="window._accResend()">Resend OTP</button>';
      }
    }, 1000);
  }

  window._accResend = async function () {
    if (!_currentMobile) return;
    const btn = document.getElementById('acc-resend-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; btn.classList.add('acc-btn-sending'); }
    clearMsg('acc-otp-msg');
    try {
      await sendOTP(_currentMobile);
      showMsg('acc-otp-msg', 'success', 'New OTP sent!');
      startResendTimer();
    } catch(e) {
      showMsg('acc-otp-msg', 'error', 'Could not resend. Please try again.');
      if (btn) { btn.disabled = false; btn.textContent = 'Resend OTP'; btn.classList.remove('acc-btn-sending'); }
    }
  };

  // ── OVERLAY MANAGEMENT ────────────────────────────────────
  function openOverlay() {
    document.getElementById('acc-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeOverlay() {
    document.getElementById('acc-overlay').classList.remove('open');
    document.getElementById('acc-login-sheet').classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── KEYBOARD / FOCUS ACCESSIBILITY ────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    const overlay = document.getElementById('acc-overlay');
    if (overlay && overlay.classList.contains('open')) closeOverlay();
  });

  // ── LOGIN SHEET ───────────────────────────────────────────
  function openLoginSheet() {
    showStep('acc-step-mobile');
    clearMsg('acc-mobile-msg');
    clearMsg('acc-otp-msg');
    const inp = document.getElementById('acc-mobile-input');
    if (inp) inp.value = '';
    openOverlay();
    document.getElementById('acc-login-sheet').classList.add('open');
    setTimeout(function () { if (inp) inp.focus(); }, 400);
  }

  function showStep(stepId) {
    document.querySelectorAll('.acc-step').forEach(function (s) { s.classList.remove('active'); });
    const el = document.getElementById(stepId);
    if (el) el.classList.add('active');
  }

  // Send OTP handler
  window._accSendOTP = async function () {
    const inp    = document.getElementById('acc-mobile-input');
    const mobile = (inp ? inp.value : '').replace(/\D/g, '').trim();

    if (!/^\d{10}$/.test(mobile)) {
      showMsg('acc-mobile-msg', 'error', 'Please enter a valid 10-digit mobile number.');
      inp && inp.focus();
      inp && inp.classList.add('acc-shake');
      setTimeout(() => inp && inp.classList.remove('acc-shake'), 500);
      return;
    }

    clearMsg('acc-mobile-msg');
    const btn = document.getElementById('acc-send-otp-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; btn.classList.add('acc-btn-sending'); }

    try {
      const result = await sendOTP(mobile);
      _currentMobile = mobile;

      // Update OTP step header
      const numDisplay = document.getElementById('acc-otp-number');
      if (numDisplay) numDisplay.textContent = formatMobile(mobile);

      // Clear any stale OTP box values from a previous attempt
      document.querySelectorAll('.acc-otp-box').forEach(function (b) {
        b.value = ''; b.classList.remove('filled');
      });

      showStep('acc-step-otp');
      startResendTimer();

      if (result.dev) {
        showMsg('acc-otp-msg', 'info', '🛠 Beta Version : Please use code ' + DEV_OTP_CODE + ' to verify.');
      } else {
        showMsg('acc-otp-msg', 'success', 'OTP sent to your WhatsApp!');
      }

      // Focus first OTP box
      setTimeout(function () {
        const first = document.querySelector('.acc-otp-box');
        if (first) first.focus();
      }, 300);

    } catch(e) {
      showMsg('acc-mobile-msg', 'error', 'Could not send OTP. Please try again.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Send OTP via WhatsApp'; btn.classList.remove('acc-btn-sending'); }
    }
  };

  // Change number
  window._accChangeNumber = function () {
    if (_resendTimer) clearInterval(_resendTimer);
    _currentMobile = '';
    showStep('acc-step-mobile');
    clearMsg('acc-mobile-msg');
    clearMsg('acc-otp-msg');
    // Clear OTP boxes
    document.querySelectorAll('.acc-otp-box').forEach(function (b) {
      b.value = ''; b.classList.remove('filled');
    });
  };

  // Verify OTP handler
  window._accVerifyOTP = async function () {
    const boxes = document.querySelectorAll('.acc-otp-box');
    const code  = Array.from(boxes).map(function (b) { return b.value; }).join('');

    if (code.length !== 4) {
      showMsg('acc-otp-msg', 'error', 'Please enter the complete 4-digit code.');
      return;
    }

    clearMsg('acc-otp-msg');
    const btn = document.getElementById('acc-verify-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Verifying...'; btn.classList.add('acc-btn-sending'); }

    try {
      const result = await verifyOTP(_currentMobile, code);

      if (!result.success) {
        showMsg('acc-otp-msg', 'error', result.reason || 'Verification failed.');
        // Shake OTP boxes
        const wrap = document.querySelector('.acc-otp-wrap');
        if (wrap) {
          wrap.classList.add('acc-shake');
          setTimeout(function () { wrap.classList.remove('acc-shake'); }, 500);
        }
        boxes.forEach(function (b) {
          b.style.borderColor = '#E53935';
          setTimeout(function () { b.style.borderColor = ''; }, 1200);
        });
        return;
      }

      // Save session
      saveSession({ mobile: result.mobile, token: result.token, expires_at: result.expires_at });

      // Clear OTP timer
      if (_resendTimer) clearInterval(_resendTimer);

      showMsg('acc-otp-msg', 'success', '✓ Verified! Welcome to Tiny Threads 🎉');

      setTimeout(function () {
        closeOverlay();
        showWelcomeBack(result.mobile);
      }, 700);

    } catch(e) {
      showMsg('acc-otp-msg', 'error', 'Something went wrong. Please try again.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Verify & Login'; btn.classList.remove('acc-btn-sending'); }
    }
  };

  // ── OTP BOX KEYBOARD BEHAVIOR ─────────────────────────────
  function wireOTPBoxes() {
    const boxes = document.querySelectorAll('.acc-otp-box');
    boxes.forEach(function (box, idx) {
      box.addEventListener('input', function () {
        // Only keep last digit
        this.value = this.value.replace(/\D/g, '').slice(-1);
        this.classList.toggle('filled', this.value.length > 0);
        if (this.value && idx < boxes.length - 1) boxes[idx + 1].focus();
        // Auto-verify when all 4 filled
        const code = Array.from(boxes).map(function (b) { return b.value; }).join('');
        if (code.length === 4) window._accVerifyOTP();
      });

      box.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !this.value && idx > 0) {
          boxes[idx - 1].focus();
          boxes[idx - 1].value = '';
          boxes[idx - 1].classList.remove('filled');
        }
      });

      box.addEventListener('paste', function (e) {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 4);
        pasted.split('').forEach(function (ch, i) {
          if (boxes[i]) { boxes[i].value = ch; boxes[i].classList.add('filled'); }
        });
        if (pasted.length === 4) window._accVerifyOTP();
        else if (boxes[pasted.length]) boxes[pasted.length].focus();
      });
    });
  }

  // ── WELCOME BACK TRANSITION ───────────────────────────────
  function showWelcomeBack(mobile) {
    const el = document.getElementById('acc-welcome-screen');
    if (!el) { openAccountMenu(); return; }

    el.querySelector('.acc-welcome-avatar').innerHTML = avatarHTML(mobile, _customerName, 84);
    el.classList.add('open');

    setTimeout(function () {
      el.classList.remove('open');
      openAccountMenu();
    }, 1400);
  }

  // ── ACCOUNT DASHBOARD (formerly a small menu sheet — now a full page) ──
  function openAccountMenu() {
    if (!_session) { openLoginSheet(); return; }

    if (typeof showPage === 'function') showPage('account');
    renderDashboardSkeleton();
    loadDashboard();
  }

  function renderDashboardSkeleton() {
    const el = document.getElementById('acc-dashboard-content');
    if (!el) return;
    el.innerHTML = `
      <div class="acc-profile-hero">
        <div class="acc-skel acc-skel-avatar"></div>
        <div class="acc-skel acc-skel-line" style="width:60%;margin-top:18px;"></div>
        <div class="acc-skel acc-skel-line" style="width:40%;margin-top:10px;height:26px;"></div>
      </div>
      <div class="acc-stats">
        <div class="acc-skel acc-skel-card"></div>
        <div class="acc-skel acc-skel-card"></div>
        <div class="acc-skel acc-skel-card"></div>
      </div>
      <div class="acc-skel acc-skel-block" style="margin:20px;"></div>`;
  }

  async function loadDashboard() {
    const orders = await fetchOrders(_session.mobile);
    _currentOrders = orders;

    // Derive best-known display name from most recent order that has one
    const named = orders.find(function (o) { return o.customer_name && o.customer_name.trim(); });
    _customerName = named ? named.customer_name.trim() : '';
    updateNavAvatar();

    renderDashboard(orders);
  }

  function renderDashboard(orders) {
    const el = document.getElementById('acc-dashboard-content');
    if (!el) return;

    const memberSince = orders.length
      ? formatDate(orders[orders.length - 1].created_at)
      : null;

    el.innerHTML =
      renderHero() +
      renderStats(orders, memberSince) +
      renderRecentOrder(orders[0]) +
      renderQuickActions() +
      `<div class="acc-logout" onclick="window._accLogout()">Logout</div>`;
  }

  function renderHero() {
    return `
      <div class="acc-profile-hero">
        ${avatarHTML(_session.mobile, _customerName, 82)}
        <div class="acc-greeting">${greetingText()}${_customerName ? ',' : ''}</div>
        <div class="acc-name">${_customerName || 'My Account'}</div>
        <div class="acc-mobile">📱 ${formatMobile(_session.mobile)}</div>
        <div class="acc-verified">✓ Verified Customer</div>
      </div>`;
  }

  function renderStats(orders, memberSince) {
    return `
      <div class="acc-stats">
        <div class="acc-stat">
          <div class="acc-stat-value">${orders.length}</div>
          <div class="acc-stat-label">Orders</div>
        </div>
        <div class="acc-stat">
          <div class="acc-stat-value">${orders.length ? '🎉' : '👋'}</div>
          <div class="acc-stat-label">${memberSince ? 'Since ' + memberSince : 'New Member'}</div>
        </div>
        <div class="acc-stat">
          <div class="acc-stat-value">24/7</div>
          <div class="acc-stat-label">Support</div>
        </div>
      </div>`;
  }

  function renderRecentOrder(order) {
    if (!order) {
      return `
        <div class="acc-last-order acc-empty-inline">
          <span class="acc-empty-inline-icon">🛍️</span>
          <div class="acc-empty-inline-text">
            <div class="acc-empty-inline-title">No orders yet</div>
            <div class="acc-empty-inline-sub">Your first order will show up here.</div>
          </div>
        </div>`;
    }

    const items  = Array.isArray(order.cart_detail) ? order.cart_detail : [];
    const status = (order.status || 'pending').toLowerCase();
    const total  = parseFloat(order.total || order.subtotal || 0);
    const thumb  = itemThumbURL(items[0]);
    const shortId = order.id ? String(order.id).slice(0, 8).toUpperCase() : 'ORDER';

    return `
      <div class="acc-section-title">Recent Order</div>
      <div class="acc-last-order" onclick="window._accOpenOrderDetail('${order.id}')">
        <div class="acc-last-order-row">
          <div class="acc-last-order-thumb">${thumb ? `<img src="${thumb}" alt="" loading="lazy">` : '👕'}</div>
          <div class="acc-last-order-info">
            <div class="acc-last-order-top">
              <span class="order-status ${status}">${statusLabel(status)}</span>
              <span class="acc-last-order-date">${formatDateShort(order.created_at)}</span>
            </div>
            <div class="acc-last-order-id">#${shortId} · ${items.length} item${items.length !== 1 ? 's' : ''}</div>
            <div class="acc-last-order-price">₹${total.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <button class="acc-secondary-btn" onclick="event.stopPropagation(); window._accOpenOrderDetail('${order.id}')">View Order</button>
      </div>`;
  }

  function renderQuickActions() {
    const actions = [
      { icon: '📦', title: 'Orders',    sub: 'Track and view your orders',   onclick: "window._accOpenOrders()" },
      { icon: '💛', title: 'Wishlist',  sub: 'Coming Soon',                  onclick: "window._accComingSoon('Wishlist')", soon: true },
      { icon: '📍', title: 'Addresses', sub: 'Coming Soon',                  onclick: "window._accComingSoon('Addresses')", soon: true },
      { icon: '🎁', title: 'Offers',    sub: 'Season caps & deals',          onclick: "window._accComingSoon('Offers')", soon: true },
      { icon: '💬', title: 'Support',   sub: 'Chat with us on WhatsApp',     onclick: "window.open('https://wa.me/917879976016?text=Hi%20Tiny%20Threads!','_blank')" },
      { icon: '⚙️', title: 'Settings',  sub: 'Coming Soon',                  onclick: "window._accComingSoon('Settings')", soon: true }
    ];

    return `
      <div class="acc-section-title">Quick Actions</div>
      <div class="acc-menu-grid">
        ${actions.map(function (a) {
          return `<div class="acc-menu-card" onclick="${a.onclick}">
            <div class="acc-icon">${a.icon}</div>
            <div class="acc-menu-title">${a.title}${a.soon ? ' <span class=\"acc-soon-badge\">Soon</span>' : ''}</div>
            <div class="acc-menu-sub">${a.sub}</div>
          </div>`;
        }).join('')}
      </div>`;
  }

  // ── LOGOUT ────────────────────────────────────────────────
  window._accLogout = async function () {
    if (_session) {
      try {
        await sbFetch('/rest/v1/customer_sessions?mobile=eq.' + _session.mobile, { method: 'DELETE' });
      } catch(e) { /* silent */ }
    }
    clearSession();
    closeOverlay();
    if (typeof showPage === 'function') showPage('home');
    toast('Logged out successfully');
  };

  // ── ORDER HISTORY PAGE ────────────────────────────────────
  window._accOpenOrders = async function () {
    closeOverlay();
    if (!_session) return;

    // Show orders page
    if (typeof showPage === 'function') showPage('orders');

    const body = document.getElementById('orders-body-content');
    if (body) body.innerHTML = ordersSkeletonHTML();

    // Reuse cached orders if we already have them from the dashboard load,
    // otherwise fetch fresh.
    const orders = _currentOrders.length ? _currentOrders : await fetchOrders(_session.mobile);
    _currentOrders = orders;
    renderOrderList(orders);
  };

  function ordersSkeletonHTML() {
    return `
      <div class="acc-skel acc-skel-block" style="margin-bottom:14px;"></div>
      <div class="acc-skel acc-skel-block" style="margin-bottom:14px;"></div>
      <div class="acc-skel acc-skel-block"></div>`;
  }

  function renderOrderList(orders) {
    const body = document.getElementById('orders-body-content');
    if (!body) return;

    if (!orders || orders.length === 0) {
      body.innerHTML = `
        <div class="orders-empty">
          <span class="orders-empty-icon">🛍️</span>
          <h3>No orders yet</h3>
          <p>Your orders will appear here once you shop with us.</p>
          <button class="orders-shop-btn" onclick="window._accCloseOrders()">
            Browse Collection
          </button>
        </div>`;
      return;
    }

    body.innerHTML = orders.map(function (order, idx) {
      const items    = Array.isArray(order.cart_detail) ? order.cart_detail : [];
      const preview  = items.slice(0, 2);
      const moreCount = items.length - 2;
      const status   = (order.status || 'pending').toLowerCase();
      const total    = parseFloat(order.total || order.subtotal || 0);
      const thumb    = itemThumbURL(items[0]);

      const previewHTML = preview.map(function (item) {
        return `<div class="order-item-preview-row">
          <span class="order-item-preview-name">${item.product_name || item.name || 'Item'}</span>
          <span class="order-item-preview-qty">× ${item.quantity || 1} · ₹${(parseFloat(item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}</span>
        </div>`;
      }).join('');

      const moreHTML = moreCount > 0
        ? `<div class="order-items-more">+${moreCount} more item${moreCount > 1 ? 's' : ''}</div>`
        : '';

      const shortId = order.id ? String(order.id).slice(0, 8).toUpperCase() : 'ORD' + (idx + 1);

      return `<div class="order-card" data-order-id="${order.id}" style="cursor:pointer;">
        <div class="order-card-head">
          <span class="order-card-id">#${shortId}</span>
          <span class="order-status ${status}">${statusLabel(status)}</span>
        </div>
        <div class="order-card-body">
          ${thumb ? `<div class="order-card-thumb"><img src="${thumb}" alt="" loading="lazy"></div>` : ''}
          <div class="order-card-date">📅 ${formatDate(order.created_at)}</div>
          <div class="order-items-preview">${previewHTML}${moreHTML}</div>
          <div class="order-card-foot">
            <div class="order-card-total">₹${total.toLocaleString('en-IN')} <span>· ${items.length} item${items.length !== 1 ? 's' : ''}</span></div>
            <div class="order-card-actions">
              <button class="acc-secondary-btn acc-buy-again-btn" onclick="event.stopPropagation(); window._accComingSoon('Buy Again')">Buy Again</button>
              <div class="order-card-arrow">View details ›</div>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');

    // Attach click handlers to all order cards
    setTimeout(function () {
      const cards = body.querySelectorAll('.order-card');
      cards.forEach(function (card) {
        card.addEventListener('click', function () {
          const orderId = this.getAttribute('data-order-id');
          if (orderId) window._accOpenOrderDetail(orderId);
        });
      });
    }, 0);
  }

  window._accCloseOrders = function () {
    if (typeof showPage === 'function') showPage('home');
  };

  // ── ORDER DETAIL ──────────────────────────────────────────
  window._accOpenOrderDetail = function (orderId) {
    const order = _currentOrders.find(function (o) { return String(o.id) === String(orderId); });
    if (!order) {
      console.error('Order not found:', orderId);
      return;
    }
    _currentOrder = order;

    // Show the page
    showPage('order-detail');

    // Render the detail
    setTimeout(function () {
      renderOrderDetail(order);
      window.scrollTo(0, 0);
    }, 100);
  };

  const TIMELINE_STEPS = ['pending', 'confirmed', 'shipped', 'delivered'];
  const TIMELINE_LABELS = { pending: 'Placed', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered' };

  function renderTimeline(status) {
    if (status === 'cancelled') return '';
    const currentIdx = TIMELINE_STEPS.indexOf(status);
    return `
      <div class="order-timeline">
        ${TIMELINE_STEPS.map(function (step, idx) {
          const state = idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'upcoming';
          return `<div class="order-timeline-step ${state}">
            <div class="order-timeline-dot"></div>
            <div class="order-timeline-label">${TIMELINE_LABELS[step]}</div>
          </div>`;
        }).join('<div class="order-timeline-connector"></div>')}
      </div>`;
  }

  function renderOrderDetail(order) {
    const body   = document.getElementById('order-detail-body-content');
    if (!body) return;

    const items   = Array.isArray(order.cart_detail) ? order.cart_detail : [];
    const status  = (order.status || 'pending').toLowerCase();
    const subtotal = parseFloat(order.subtotal || order.total || 0);
    const total    = parseFloat(order.total || order.subtotal || 0);
    const discount = subtotal - total;
    const shortId  = order.id ? String(order.id).slice(0, 8).toUpperCase() : 'ORDER';

    // Update page title
    const titleEl = document.getElementById('order-detail-title');
    if (titleEl) titleEl.textContent = 'Order #' + shortId;

    // Items HTML
    const itemsHTML = items.map(function (item, idx) {
      const itemTotal = parseFloat(item.price || 0) * (parseInt(item.quantity) || 1);
      const thumb = itemThumbURL(item);
      return `<div class="order-detail-item">
        ${thumb ? `<div class="order-detail-item-thumb"><img src="${thumb}" alt="" loading="lazy"></div>` : `<div class="order-detail-item-num">${idx + 1}</div>`}
        <div class="order-detail-item-info">
          <div class="order-detail-item-name">${item.product_name || item.name || 'Item'}</div>
          <div class="order-detail-item-meta">
            ${item.size ? '<span>📏 ' + item.size + '</span>' : ''}
            <span>🔢 Qty: ${item.quantity || 1}</span>
            <span>₹${parseFloat(item.price || 0).toLocaleString('en-IN')} each</span>
          </div>
        </div>
        <div class="order-detail-item-price">₹${itemTotal.toLocaleString('en-IN')}</div>
      </div>`;
    }).join('');

    // Address HTML
    const hasAddress = order.address_line1 && order.address_line1 !== 'Not provided';
    const addressHTML = hasAddress ? `
      <div class="order-detail-address">
        <p>
          <strong>${order.customer_name || 'Customer'}</strong><br>
          ${order.address_line1}${order.address_line2 ? ', ' + order.address_line2 : ''}<br>
          ${order.area ? order.area + ', ' : ''}${order.city || ''} — ${order.pincode || ''}<br>
          ${order.state || ''}
        </p>
      </div>` : `<div class="order-detail-address"><p style="color:var(--acc-muted);font-size:13px;">Address not provided at checkout.</p></div>`;

    // WA help message
    const waMsg = encodeURIComponent(
      'Hi Tiny Threads! I need help with my order #' + shortId + '.\n'
      + 'Order date: ' + formatDate(order.created_at) + '\n'
      + 'Status: ' + statusLabel(status)
    );

    body.innerHTML = `
      <!-- Status banner -->
      <div class="order-detail-status-banner ${status}">
        <div class="order-status-icon">${statusIcon(status)}</div>
        <div class="order-status-text">
          <div class="order-status-label ${status}">${statusLabel(status)}</div>
          <div class="order-status-desc">${statusDesc(status)}</div>
        </div>
      </div>

      ${renderTimeline(status)}

      <!-- Order meta -->
      <div class="order-detail-section">
        <div class="order-detail-section-title">Order Info</div>
        <div class="order-detail-meta">
          <div class="order-meta-row">
            <span>Order ID</span>
            <span>#${shortId}</span>
          </div>
          <div class="order-meta-row">
            <span>Date</span>
            <span>${formatDate(order.created_at)}</span>
          </div>
          <div class="order-meta-row">
            <span>Status</span>
            <span><span class="order-status ${status}">${statusLabel(status)}</span></span>
          </div>
          ${order.promocode ? `<div class="order-meta-row"><span>Promo Code</span><span>${order.promocode}</span></div>` : ''}
        </div>
      </div>

      <!-- Items -->
      <div class="order-detail-section">
        <div class="order-detail-section-title">Items (${items.length})</div>
        <div class="order-detail-items">${itemsHTML}</div>
      </div>

      <!-- Price summary -->
      <div class="order-detail-section">
        <div class="order-detail-section-title">Price Summary</div>
        <div class="order-detail-summary">
          <div class="order-summary-row">
            <span>Subtotal (${items.length} item${items.length !== 1 ? 's' : ''})</span>
            <span>₹${subtotal.toLocaleString('en-IN')}</span>
          </div>
          ${discount > 0 ? `
          <div class="order-summary-row discount">
            <span>Discount ${order.promocode ? '(' + order.promocode + ')' : ''}</span>
            <span>−₹${discount.toLocaleString('en-IN')}</span>
          </div>` : ''}
          <div class="order-summary-row total">
            <span>Total</span>
            <span>₹${total.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <!-- Shipping address -->
      <div class="order-detail-section">
        <div class="order-detail-section-title">Delivery Address</div>
        ${addressHTML}
      </div>

      <!-- Actions -->
      <div class="order-detail-actions">
        <a class="order-wa-help-btn"
           href="https://wa.me/917879976016?text=${waMsg}"
           target="_blank" rel="noopener">
          <svg style="width:18px;height:18px;fill:currentColor;" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Need help with this order?
        </a>
        <button class="acc-secondary-btn acc-invoice-btn" onclick="window._accComingSoon('Invoice download')">
          🧾 Download Invoice
        </button>
      </div>`;
  }

  window._accCloseOrderDetail = function () {
    if (typeof showPage === 'function') showPage('orders');
    // Re-render order list (it's already in _currentOrders)
    renderOrderList(_currentOrders);
    window.scrollTo(0, 0);
  };

  // ── BUILD DOM ─────────────────────────────────────────────
  function buildDOM() {
    // 1. Shared overlay
    const overlay = document.createElement('div');
    overlay.id = 'acc-overlay';
    overlay.className = 'acc-overlay';
    overlay.addEventListener('click', closeOverlay);
    document.body.appendChild(overlay);

    // 2. Login sheet
    const loginSheet = document.createElement('div');
    loginSheet.id = 'acc-login-sheet';
    loginSheet.className = 'acc-login-sheet';
    loginSheet.setAttribute('role', 'dialog');
    loginSheet.setAttribute('aria-modal', 'true');
    loginSheet.setAttribute('aria-label', 'Sign in to Tiny Threads');
    loginSheet.innerHTML = `
      <div class="acc-sheet-handle"></div>
      <div class="acc-sheet-head">
        <div class="acc-sheet-title">Sign In</div>
        <button class="acc-sheet-close" onclick="document.getElementById('acc-overlay').click()" aria-label="Close">✕</button>
      </div>

      <div class="acc-login-avatar">
        ${avatarHTML('0000000000', '', 80, 'acc-login-illustration')}
        <p class="acc-login-tagline">Sign in to track your orders and get a personalised shopping experience.</p>
      </div>

      <ul class="acc-login-benefits">
        <li><span class="acc-benefit-icon">📦</span> Track every order in real time</li>
        <li><span class="acc-benefit-icon">⚡</span> Faster checkout next time</li>
        <li><span class="acc-benefit-icon">🎁</span> Early access to offers &amp; drops</li>
      </ul>

      <div class="acc-login-body">
       <!-- ${OTP_DEV_MODE ? '<div class="acc-dev-badge">🛠 Dev Mode — use code ' + DEV_OTP_CODE + '</div>' : ''} -->

        <!-- Step 1: Mobile number -->
        <div class="acc-step active" id="acc-step-mobile">
          <div id="acc-mobile-msg" class="acc-msg" aria-live="polite"></div>
          <label class="acc-field-label" for="acc-mobile-input">Mobile Number</label>
          <div class="acc-mobile-wrap">
            <span class="acc-mobile-prefix">🇮🇳 +91</span>
            <input class="acc-mobile-input" id="acc-mobile-input" type="tel"
              inputmode="numeric" maxlength="10" placeholder="10-digit number"
              autocomplete="tel" aria-label="Mobile number"
              onkeydown="if(event.key==='Enter') window._accSendOTP()">
          </div>
          <button class="acc-primary-btn" id="acc-send-otp-btn" onclick="window._accSendOTP()">
            Send OTP via WhatsApp
          </button>
          <p style="font-size:11.5px;color:var(--acc-muted);text-align:center;margin-top:8px;line-height:1.5;">
            We'll send a verification code to your WhatsApp
          </p>
        </div>

        <!-- Step 2: OTP entry -->
        <div class="acc-step" id="acc-step-otp">
          <div class="acc-change-num">
            Code sent to <strong id="acc-otp-number"></strong>
            <button onclick="window._accChangeNumber()">Change</button>
          </div>
          <div id="acc-otp-msg" class="acc-msg" aria-live="polite"></div>
          <label class="acc-field-label">Enter 4-digit OTP</label>
          <div class="acc-otp-wrap">
            <input class="acc-otp-box" type="tel" inputmode="numeric" maxlength="1" autocomplete="one-time-code" aria-label="OTP digit 1">
            <input class="acc-otp-box" type="tel" inputmode="numeric" maxlength="1" aria-label="OTP digit 2">
            <input class="acc-otp-box" type="tel" inputmode="numeric" maxlength="1" aria-label="OTP digit 3">
            <input class="acc-otp-box" type="tel" inputmode="numeric" maxlength="1" aria-label="OTP digit 4">
          </div>
          <button class="acc-primary-btn" id="acc-verify-btn" onclick="window._accVerifyOTP()">
            Verify & Login
          </button>
          <div class="acc-resend-row" id="acc-resend-row">
            Resend in <span id="acc-resend-counter">30s</span>
          </div>
        </div>
      </div>`;
    document.body.appendChild(loginSheet);

    // 3. Welcome-back transition screen
    const welcome = document.createElement('div');
    welcome.id = 'acc-welcome-screen';
    welcome.className = 'acc-welcome-screen';
    welcome.innerHTML = `
      <div class="acc-welcome-avatar"></div>
      <div class="acc-welcome-title">Welcome Back!</div>
      <div class="acc-welcome-sub">Taking you to your account…</div>`;
    document.body.appendChild(welcome);

    // 4. Account dashboard page
    const accountPage = document.createElement('div');
    accountPage.id = 'page-account';
    accountPage.className = 'page';
    accountPage.innerHTML = `
      <div class="orders-header">
        <button class="orders-back-btn" onclick="if(typeof showPage==='function')showPage('home')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <div class="orders-title">My Account</div>
      </div>
      <div class="orders-body">
        <div id="acc-dashboard-content"></div>
      </div>`;
    document.body.appendChild(accountPage);

    // 5. Orders page
    const ordersPage = document.createElement('div');
    ordersPage.id = 'page-orders';
    ordersPage.className = 'page';
    ordersPage.innerHTML = `
      <div class="orders-header">
        <button class="orders-back-btn" onclick="window._accCloseOrders()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <div class="orders-title">My Orders</div>
      </div>
      <div class="orders-body">
        <div id="orders-body-content">
          <div class="acc-skel acc-skel-block" style="margin-bottom:14px;"></div>
          <div class="acc-skel acc-skel-block"></div>
        </div>
      </div>`;
    document.body.appendChild(ordersPage);

    // 6. Order detail page
    const detailPage = document.createElement('div');
    detailPage.id = 'page-order-detail';
    detailPage.className = 'page';
    detailPage.innerHTML = `
      <div class="order-detail-header">
        <button class="orders-back-btn" onclick="window._accCloseOrderDetail()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Orders
        </button>
        <div class="order-detail-title" id="order-detail-title">Order Detail</div>
      </div>
      <div class="order-detail-body">
        <div id="order-detail-body-content"></div>
      </div>`;
    document.body.appendChild(detailPage);

    // Wire OTP box keyboard behaviour
    wireOTPBoxes();
  }

  // ── SUPABASE TABLE SETUP CHECK ────────────────────────────
  // Creates the required tables if they don't exist yet
  // (Supabase doesn't support CREATE TABLE via REST, so we just
  //  attempt an insert and catch the error gracefully — tables
  //  must be created in the Supabase dashboard. SQL provided below.)
  function logTableSQL() {
    console.info(`
-- Run this SQL in your Supabase SQL Editor (one time setup):

CREATE TABLE IF NOT EXISTS otp_codes (
  id         bigserial PRIMARY KEY,
  mobile     text NOT NULL,
  code       text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified   boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_codes_mobile_idx ON otp_codes(mobile);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id            bigserial PRIMARY KEY,
  mobile        text NOT NULL,
  session_token text NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_mobile_idx ON customer_sessions(mobile);
CREATE INDEX IF NOT EXISTS sessions_token_idx  ON customer_sessions(session_token);

-- Enable RLS
ALTER TABLE otp_codes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anon key full access (Edge Function handles security)
CREATE POLICY "anon all otp_codes"         ON otp_codes         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all customer_sessions" ON customer_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
    `);
  }

  // ── INIT ──────────────────────────────────────────────────
  function init() {
    buildDOM();

    // Restore session from localStorage
    _session = loadSession();
    updateNavAvatar();

    // If we already have a session, warm the customer name in the background
    // so the nav avatar shows real initials without waiting for a dashboard visit.
    if (_session) {
      fetchOrders(_session.mobile).then(function (orders) {
        _currentOrders = orders;
        const named = orders.find(function (o) { return o.customer_name && o.customer_name.trim(); });
        if (named) { _customerName = named.customer_name.trim(); updateNavAvatar(); }
      }).catch(function () {});
    }

    // Print SQL reminder in console (dev only)
    if (OTP_DEV_MODE) logTableSQL();

    // Expose openAccountMenu globally (e.g. for future use)
    window.openAccountMenu = openAccountMenu;
    window.openLoginSheet  = openLoginSheet;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();