// ════════════════════════════════════════════════════════════
// TINY THREADS — account.js
// Customer account: session management, login modal, OTP flow,
// order history, order detail. Pure plug-in — no existing JS touched.
// Load this AFTER app.js in index.html.
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
    updateNavAvatar();
  }

  // ── NAV AVATAR ────────────────────────────────────────────
  // Kids avatar SVG — cheerful child face
  function kidsAvatarSVG(size = 36) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Head -->
      <circle cx="32" cy="30" r="18" fill="#FFCC8A"/>
      <!-- Hair -->
      <path d="M14 24C14 24 16 10 32 10C48 10 50 24 50 24" fill="#5C3317"/>
      <ellipse cx="14" cy="26" rx="4" ry="6" fill="#5C3317"/>
      <ellipse cx="50" cy="26" rx="4" ry="6" fill="#5C3317"/>
      <!-- Eyes -->
      <circle cx="24" cy="28" r="3" fill="#3D2B1F"/>
      <circle cx="40" cy="28" r="3" fill="#3D2B1F"/>
      <circle cx="25" cy="27" r="1" fill="white"/>
      <circle cx="41" cy="27" r="1" fill="white"/>
      <!-- Cheeks -->
      <ellipse cx="20" cy="34" rx="4" ry="2.5" fill="#FFB3A0" opacity=".6"/>
      <ellipse cx="44" cy="34" rx="4" ry="2.5" fill="#FFB3A0" opacity=".6"/>
      <!-- Smile -->
      <path d="M24 37 Q32 44 40 37" stroke="#C0392B" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Body -->
      <path d="M16 54 Q20 46 32 46 Q44 46 48 54" fill="#C0392B"/>
      <!-- Collar dots -->
      <circle cx="29" cy="48" r="1.5" fill="white" opacity=".7"/>
      <circle cx="32" cy="47" r="1.5" fill="white" opacity=".7"/>
      <circle cx="35" cy="48" r="1.5" fill="white" opacity=".7"/>
    </svg>`;
  }

  function updateNavAvatar() {
    const btn = document.getElementById('mn-account');
    if (!btn) return;
    const icon = btn.querySelector('.mob-nav-icon');
    if (!icon) return;

    if (_session) {
      icon.innerHTML = `<div class="acc-nav-avatar logged-in">${kidsAvatarSVG(22)}</div>`;
      btn.classList.add('logged-in');
    } else {
      icon.innerHTML = `<div class="acc-nav-avatar">${kidsAvatarSVG(22)}</div>`;
      btn.classList.remove('logged-in');
    }
  }

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
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    clearMsg('acc-otp-msg');
    try {
      await sendOTP(_currentMobile);
      showMsg('acc-otp-msg', 'success', 'New OTP sent!');
      startResendTimer();
    } catch(e) {
      showMsg('acc-otp-msg', 'error', 'Could not resend. Please try again.');
      if (btn) { btn.disabled = false; btn.textContent = 'Resend OTP'; }
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
    document.getElementById('acc-menu-sheet').classList.remove('open');
    document.body.style.overflow = '';
  }

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
      return;
    }

    clearMsg('acc-mobile-msg');
    const btn = document.getElementById('acc-send-otp-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

    try {
      const result = await sendOTP(mobile);
      _currentMobile = mobile;

      // Update OTP step header
      const numDisplay = document.getElementById('acc-otp-number');
      if (numDisplay) numDisplay.textContent = formatMobile(mobile);

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
      if (btn) { btn.disabled = false; btn.textContent = 'Send OTP'; }
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
    if (btn) { btn.disabled = true; btn.textContent = 'Verifying...'; }

    try {
      const result = await verifyOTP(_currentMobile, code);

      if (!result.success) {
        showMsg('acc-otp-msg', 'error', result.reason || 'Verification failed.');
        // Shake OTP boxes
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
        openAccountMenu();
      }, 900);

    } catch(e) {
      showMsg('acc-otp-msg', 'error', 'Something went wrong. Please try again.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Verify & Login'; }
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

  // ── ACCOUNT MENU SHEET ────────────────────────────────────
  function openAccountMenu() {
    if (!_session) { openLoginSheet(); return; }

    // Populate profile info
    const nameEl   = document.getElementById('acc-menu-name');
    const mobileEl = document.getElementById('acc-menu-mobile-display');
    if (nameEl)   nameEl.textContent   = 'My Account';
    if (mobileEl) mobileEl.textContent = formatMobile(_session.mobile);

    openOverlay();
    document.getElementById('acc-menu-sheet').classList.add('open');
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
    if (typeof showToast === 'function') showToast('Logged out successfully');
  };

  // ── ORDER HISTORY PAGE ────────────────────────────────────
  window._accOpenOrders = async function () {
    closeOverlay();
    if (!_session) return;

    // Show orders page
    if (typeof showPage === 'function') showPage('orders');

    const body = document.getElementById('orders-body-content');
    if (body) body.innerHTML = '<div class="orders-loading"><div class="spinner"></div>Loading your orders...</div>';

    const orders = await fetchOrders(_session.mobile);
    _currentOrders = orders;
    renderOrderList(orders);
  };

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
          <div class="order-card-date">📅 ${formatDate(order.created_at)}</div>
          <div class="order-items-preview">${previewHTML}${moreHTML}</div>
          <div class="order-card-foot">
            <div class="order-card-total">₹${total.toLocaleString('en-IN')} <span>· ${items.length} item${items.length !== 1 ? 's' : ''}</span></div>
            <div class="order-card-arrow">View details ›</div>
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
    console.log('Opening order detail for ID:', orderId);
    const order = _currentOrders.find(function (o) { return String(o.id) === String(orderId); });
    if (!order) {
      console.error('Order not found:', orderId);
      return;
    }
    _currentOrder = order;
    console.log('Found order:', order);

    // Show the page
    showPage('order-detail');
    
    // Render the detail
    setTimeout(function () {
      renderOrderDetail(order);
      window.scrollTo(0, 0);
    }, 100);
  };

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
      return `<div class="order-detail-item">
        <div class="order-detail-item-num">${idx + 1}</div>
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
      </div>` : `<div class="order-detail-address"><p style="color:var(--muted);font-size:13px;">Address not provided at checkout.</p></div>`;

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
    loginSheet.innerHTML = `
      <div class="acc-sheet-handle"></div>
      <div class="acc-sheet-head">
        <div class="acc-sheet-title">Sign In</div>
        <button class="acc-sheet-close" onclick="document.getElementById('acc-overlay').click()" aria-label="Close">✕</button>
      </div>

      <div class="acc-login-avatar">
        ${kidsAvatarSVG(80)}
        <p class="acc-login-tagline">Sign in to track your orders and get a personalised shopping experience.</p>
      </div>

      <div class="acc-login-body">
        ${OTP_DEV_MODE ? '<div class="acc-dev-badge">🛠 Dev Mode — use code ' + DEV_OTP_CODE + '</div>' : ''}

        <!-- Step 1: Mobile number -->
        <div class="acc-step active" id="acc-step-mobile">
          <div id="acc-mobile-msg" class="acc-msg"></div>
          <label class="acc-field-label" for="acc-mobile-input">Mobile Number</label>
          <div class="acc-mobile-wrap">
            <span class="acc-mobile-prefix">🇮🇳 +91</span>
            <input class="acc-mobile-input" id="acc-mobile-input" type="tel"
              inputmode="numeric" maxlength="10" placeholder="10-digit number"
              autocomplete="tel"
              onkeydown="if(event.key==='Enter') window._accSendOTP()">
          </div>
          <button class="acc-primary-btn" id="acc-send-otp-btn" onclick="window._accSendOTP()">
            Send OTP via WhatsApp
          </button>
          <p style="font-size:11.5px;color:var(--muted);text-align:center;margin-top:8px;line-height:1.5;">
            We'll send a verification code to your WhatsApp
          </p>
        </div>

        <!-- Step 2: OTP entry -->
        <div class="acc-step" id="acc-step-otp">
          <div class="acc-change-num">
            Code sent to <strong id="acc-otp-number"></strong>
            <button onclick="window._accChangeNumber()">Change</button>
          </div>
          <div id="acc-otp-msg" class="acc-msg"></div>
          <label class="acc-field-label">Enter 4-digit OTP</label>
          <div class="acc-otp-wrap">
            <input class="acc-otp-box" type="tel" inputmode="numeric" maxlength="1" autocomplete="one-time-code">
            <input class="acc-otp-box" type="tel" inputmode="numeric" maxlength="1">
            <input class="acc-otp-box" type="tel" inputmode="numeric" maxlength="1">
            <input class="acc-otp-box" type="tel" inputmode="numeric" maxlength="1">
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

    // 3. Account menu sheet
    const menuSheet = document.createElement('div');
    menuSheet.id = 'acc-menu-sheet';
    menuSheet.className = 'acc-menu-sheet';
    menuSheet.innerHTML = `
      <div class="acc-sheet-handle"></div>
      <div class="acc-sheet-head" style="padding-bottom:0;">
        <div class="acc-sheet-title">My Account</div>
        <button class="acc-sheet-close" onclick="document.getElementById('acc-overlay').click()" aria-label="Close">✕</button>
      </div>
      <div class="acc-menu-profile">
        <div class="acc-menu-avatar">${kidsAvatarSVG(36)}</div>
        <div class="acc-menu-info">
          <div class="acc-menu-name" id="acc-menu-name">My Account</div>
          <div class="acc-menu-mobile">
            <span id="acc-menu-mobile-display"></span>
            <span class="acc-verified-chip">✓ Verified</span>
          </div>
        </div>
      </div>
      <ul class="acc-menu-list">
        <li class="acc-menu-item" onclick="window._accOpenOrders()">
          <div class="acc-menu-item-icon orders">📦</div>
          <div class="acc-menu-item-text">
            <div class="acc-menu-item-label">My Orders</div>
            <div class="acc-menu-item-sub">Track and view your past orders</div>
          </div>
          <span class="acc-menu-item-arrow">›</span>
        </li>
        <li class="acc-menu-item logout" onclick="window._accLogout()">
          <div class="acc-menu-item-icon logout">🚪</div>
          <div class="acc-menu-item-text">
            <div class="acc-menu-item-label">Logout</div>
            <div class="acc-menu-item-sub">Sign out of your account</div>
          </div>
        </li>
      </ul>`;
    document.body.appendChild(menuSheet);

    // 4. Orders page
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
          <div class="orders-loading"><div class="spinner"></div>Loading...</div>
        </div>
      </div>`;
    document.body.appendChild(ordersPage);

    // 5. Order detail page
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

  // ── INJECT ACCOUNT BUTTON INTO BOTTOM NAV ─────────────────
  function injectNavButton() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    const btn = document.createElement('button');
    btn.className = 'nav-account-btn';
    btn.id = 'mn-account';
    btn.setAttribute('aria-label', 'Account');
    btn.innerHTML = `
      <span class="mob-nav-icon">
        <div class="acc-nav-avatar">${kidsAvatarSVG(22)}</div>
      </span>
      <span class="nav-account-label">Account</span>`;
    btn.addEventListener('click', function () {
      if (_session) { openAccountMenu(); }
      else { openLoginSheet(); }
    });

    navRight.insertBefore(btn, navRight.firstChild);
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
    injectNavButton();

    // Restore session from localStorage
    _session = loadSession();
    updateNavAvatar();

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