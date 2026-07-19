(function () {
  'use strict';

  var STORAGE_KEY = 'tt_wishlist_v1';
  var previousBodyOverflow = '';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function wishlistIds() {
    try {
      var stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? stored.map(String) : [];
    } catch (error) {
      return [];
    }
  }

  function saveWishlist(ids) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch (error) { }
    window.dispatchEvent(new CustomEvent('tt:wishlistchanged', { detail: { ids: ids.slice() } }));
  }

  function products() { return Array.isArray(window.allProducts) ? window.allProducts : []; }

  function productById(id) {
    return products().find(function (product) { return String(product.id) === String(id); }) || null;
  }

  function money(value) { return '₹' + Number(value || 0).toLocaleString('en-IN'); }

  function imageURL(product) {
    var url = product && product.images && product.images[0];
    if (!url || url.indexOf('YOUR_CLOUD_NAME') !== -1) return '';
    return url.indexOf('res.cloudinary.com') !== -1
      ? url.replace('/upload/', '/upload/c_pad,ar_4:5,b_white,g_center,w_180,q_auto,f_auto/')
      : url;
  }

  function productMeta(product) {
    var sizes = Array.isArray(product.sizes) && product.sizes.length
      ? 'Sizes: ' + product.sizes.slice(0, 3).join(', ') + (product.sizes.length > 3 ? ' +' + (product.sizes.length - 3) : '')
      : 'Size confirmed before order';
    return [product.subcategory, sizes].filter(Boolean).join(' · ');
  }

  function deleteIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>';
  }

  function emptyMarkup() {
    return '<div class="wishlist-empty"><div>'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.7 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>'
      + '<h4>Your wishlist is ready</h4><p>Tap the heart on any style and it will appear here.</p>'
      + '</div></div>';
  }

  function itemMarkup(product) {
    var id = escapeHtml(String(product.id));
    var name = escapeHtml(product.name || 'Tinythreads style');
    var image = imageURL(product);
    var imageMarkup = image
      ? '<img src="' + escapeHtml(image) + '" alt="' + name + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '';

    return '<article class="wishlist-item" data-wishlist-id="' + id + '">'
      + '<button type="button" class="wishlist-item-media" data-wishlist-action="view" aria-label="View ' + name + '">' + imageMarkup + '</button>'
      + '<div class="wishlist-item-copy">'
      + '<button type="button" class="wishlist-item-name" data-wishlist-action="view">' + name + '</button>'
      + '<div class="wishlist-item-meta">' + escapeHtml(productMeta(product)) + '</div>'
      + '<div class="wishlist-item-price">' + money(product.price) + '</div>'
      + '<button type="button" class="wishlist-add" data-wishlist-action="add">Add to basket</button>'
      + '</div>'
      + '<button type="button" class="wishlist-delete" data-wishlist-action="delete" aria-label="Remove ' + name + ' from wishlist">' + deleteIcon() + '</button>'
      + '</article>';
  }

  function renderWishlist() {
    var ids = wishlistIds();
    var body = document.getElementById('wishlist-body');
    var summary = document.getElementById('wishlist-summary');
    var badge = document.getElementById('nav-wishlist-count');
    if (badge) badge.textContent = String(ids.length);
    if (summary) summary.textContent = ids.length + ' saved style' + (ids.length === 1 ? '' : 's');
    if (!body) return;
    var savedProducts = ids.map(productById).filter(Boolean);
    body.innerHTML = savedProducts.length ? savedProducts.map(itemMarkup).join('') : emptyMarkup();
  }

  function openWishlist() {
    var drawer = document.getElementById('wishlist-drawer');
    var overlay = document.getElementById('wishlist-overlay');
    if (!drawer || !overlay) return;
    if (typeof window.closeBasket === 'function') window.closeBasket();
    renderWishlist();
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer.classList.add('open');
    overlay.classList.add('open');
  }

  function closeWishlist() {
    var drawer = document.getElementById('wishlist-drawer');
    var overlay = document.getElementById('wishlist-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = previousBodyOverflow;
  }

  function wishlistOverlayClick(event) {
    if (event.target && event.target.id === 'wishlist-overlay') closeWishlist();
  }

  function removeWishlistItem(id) {
    var ids = wishlistIds().filter(function (savedId) { return savedId !== String(id); });
    saveWishlist(ids);
    renderWishlist();
    if (typeof window.showToast === 'function') window.showToast('Removed from your wishlist');
  }

  function openProduct(id) {
    var product = productById(id);
    closeWishlist();
    if (product && typeof window.openPDP === 'function') window.openPDP(product.id);
  }

  function addWishlistItem(id) {
    var product = productById(id);
    if (!product || !window.TTProductCard || typeof window.TTProductCard.openQuickAdd !== 'function') return;
    closeWishlist();
    window.setTimeout(function () { window.TTProductCard.openQuickAdd(product.id); }, 120);
  }

  document.addEventListener('click', function (event) {
    var action = event.target.closest('#wishlist-drawer [data-wishlist-action]');
    if (!action) return;
    var item = action.closest('.wishlist-item');
    if (!item) return;
    var id = item.dataset.wishlistId;
    if (action.dataset.wishlistAction === 'delete') removeWishlistItem(id);
    if (action.dataset.wishlistAction === 'view') openProduct(id);
    if (action.dataset.wishlistAction === 'add') addWishlistItem(id);
  });

  document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeWishlist(); });
  document.addEventListener('DOMContentLoaded', renderWishlist);
  window.addEventListener('tt:productsloaded', renderWishlist);
  window.addEventListener('tt:wishlistchanged', renderWishlist);

  window.openWishlist = openWishlist;
  window.closeWishlist = closeWishlist;
  window.wishlistOverlayClick = wishlistOverlayClick;
  window.removeWishlistItem = removeWishlistItem;
})();
