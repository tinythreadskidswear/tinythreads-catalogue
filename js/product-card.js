(function () {
  'use strict';

  var WISHLIST_KEY = 'tt_wishlist_v1';
  var WA_NUMBER = '917879976016';
  var activeProduct = null;
  var selectedSize = '';
  var selectedColor = '';
  var previousBodyOverflow = '';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function products() {
    return Array.isArray(window.allProducts) ? window.allProducts : [];
  }

  function findProduct(id) {
    return products().find(function (product) {
      return String(product.id) === String(id);
    }) || null;
  }

  function money(value) {
    return '₹' + Number(value || 0).toLocaleString('en-IN');
  }

  function transformImage(url, width) {
    if (!url || url.indexOf('YOUR_CLOUD_NAME') !== -1) return '';
    if (url.indexOf('res.cloudinary.com') === -1) return url;
    return url.replace('/upload/', '/upload/c_fill,ar_4:5,g_north,w_' + width + ',q_auto,f_auto/');
  }

  function productImages(product) {
    return (Array.isArray(product.images) ? product.images : []).filter(function (url) {
      return typeof url === 'string' && url && url.indexOf('YOUR_CLOUD_NAME') === -1;
    });
  }

  function imageSlides(product, name) {
    return productImages(product).map(function (url) {
      var transformed = transformImage(url, 480);
      return '<div class="swiper-slide"><img src="' + escapeHtml(transformed) + '" data-optimized="' + escapeHtml(transformed) + '" data-fallback="' + escapeHtml(url) + '" alt="' + name + '" loading="lazy"></div>';
    }).join('');
  }

  function readableLabel(value) {
    return String(value || '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function descriptionFor(product) {
    var category = readableLabel(product.subcategory || product.category);
    var description = String(product.description || '').trim();
    return [category, description].filter(Boolean).join(' · ');
  }

  function sizeSummary(product) {
    var sizes = Array.isArray(product.sizes) ? product.sizes : [];
    if (!sizes.length) return 'Size confirmed before order';
    var visible = sizes.slice(0, 3).map(String);
    return 'Sizes: ' + visible.join(' · ') + (sizes.length > 3 ? ' +' + (sizes.length - 3) : '');
  }

  function getWishlist() {
    try {
      var stored = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
      return Array.isArray(stored) ? stored.map(String) : [];
    } catch (error) {
      return [];
    }
  }

  function saveWishlist(items) {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
    } catch (error) {
      // Wishlist remains available for this interaction even if storage is blocked.
    }
  }

  function isWishlisted(id) {
    return getWishlist().indexOf(String(id)) !== -1;
  }

  function heartIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.7 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>';
  }

  function plusIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  }

  function whatsappIcon() {
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26A9.89 9.89 0 0 1 12.05 2a9.88 9.88 0 0 1 9.88 9.9 9.89 9.89 0 0 1-9.88 9.89M20.46 3.49A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.23-6.16-3.48-8.41"/></svg>';
  }

  function renderCard(product, options) {
    var context = options && options.context ? String(options.context) : 'default';
    var id = escapeHtml(String(product.id));
    var name = escapeHtml(product.name || 'Tinythreads style');
    var images = productImages(product);
    var badge = product.badge ? '<span class="tt-pc-badge">' + escapeHtml(product.badge) + '</span>' : '';
    var wished = isWishlisted(product.id);
    var media = images.length
      ? '<div class="swiper tt-pc-swiper"><div class="swiper-wrapper">' + imageSlides(product, name) + '</div>'
        + (images.length > 1 ? '<div class="swiper-pagination"></div>' : '') + '</div>'
      : '';

    return '<article class="tt-product-card tt-product-card--' + escapeHtml(context) + '" data-tt-product-id="' + id + '">'
      + '<div class="tt-pc-media' + (images.length ? '' : ' is-missing') + '" data-tt-pc-action="pdp" role="button" tabindex="0" aria-label="View ' + name + '">'
      + badge + media + '<span class="tt-pc-placeholder">' + name + '</span></div>'
      + '<div class="tt-pc-body">'
      + '<button type="button" class="tt-pc-title" data-tt-pc-action="pdp">' + name + '</button>'
      + '<p class="tt-pc-description">' + escapeHtml(descriptionFor(product)) + '</p>'
      + '<div class="tt-pc-size-summary">' + escapeHtml(sizeSummary(product)) + '</div>'
      + '<div class="tt-pc-footer">'
      + '<strong class="tt-pc-price">' + money(product.price) + '</strong>'
      + '<button type="button" class="tt-pc-action tt-pc-action--add" data-tt-pc-action="quick-add" aria-label="Choose options and add ' + name + '">' + plusIcon() + '</button>'
      + '<button type="button" class="tt-pc-action tt-pc-action--wish' + (wished ? ' is-active' : '') + '" data-tt-pc-action="wishlist" aria-label="' + (wished ? 'Remove from' : 'Add to') + ' wishlist" aria-pressed="' + wished + '">' + heartIcon() + '</button>'
      + '<button type="button" class="tt-pc-action tt-pc-action--wa" data-tt-pc-action="whatsapp" aria-label="Ask about ' + name + ' on WhatsApp">' + whatsappIcon() + '</button>'
      + '</div></div></article>';
  }

  function destroyCardSwipers(target) {
    target.querySelectorAll('.tt-pc-swiper').forEach(function (element) {
      if (element.swiper && typeof element.swiper.destroy === 'function') {
        element.swiper.destroy(true, true);
      }
    });
  }

  function initCardSwipers(target) {
    if (typeof window.Swiper !== 'function') return;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.querySelectorAll('.tt-pc-swiper').forEach(function (element) {
      if (element.swiper) return;
      var count = element.querySelectorAll('.swiper-slide').length;
      if (count < 2) return;
      var canLoop = count >= 3;
      new window.Swiper(element, {
        loop: canLoop,
        rewind: !canLoop,
        autoplay: reduceMotion ? false : {
          delay: (window.tinythreadsConfig && window.tinythreadsConfig.autoPlayInterval) || 3000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true
        },
        pagination: {
          el: element.querySelector('.swiper-pagination'),
          clickable: true,
          type: 'bullets'
        },
        navigation: false,
        nested: true,
        simulateTouch: true,
        allowTouchMove: true,
        speed: 600
      });
    });
  }

  function renderInto(container, productList, options) {
    var target = typeof container === 'string' ? document.getElementById(container) : container;
    if (!target) return;
    var list = Array.isArray(productList) ? productList : [];
    destroyCardSwipers(target);
    target.innerHTML = list.length
      ? list.map(function (product) { return renderCard(product, options); }).join('')
      : '<div class="loading-grid">No matching products yet.</div>';
    initCardSwipers(target);
  }

  function updateWishlistButtons(id, wished) {
    document.querySelectorAll('.tt-product-card').forEach(function (card) {
      if (String(card.dataset.ttProductId) !== String(id)) return;
      var button = card.querySelector('[data-tt-pc-action="wishlist"]');
      if (!button) return;
      button.classList.toggle('is-active', wished);
      button.setAttribute('aria-pressed', String(wished));
      button.setAttribute('aria-label', (wished ? 'Remove from' : 'Add to') + ' wishlist');
    });
  }

  function syncWishlistButtons(items) {
    var selected = new Set((Array.isArray(items) ? items : getWishlist()).map(String));
    document.querySelectorAll('.tt-product-card').forEach(function (card) {
      var wished = selected.has(String(card.dataset.ttProductId));
      var button = card.querySelector('[data-tt-pc-action="wishlist"]');
      if (!button) return;
      button.classList.toggle('is-active', wished);
      button.setAttribute('aria-pressed', String(wished));
      button.setAttribute('aria-label', (wished ? 'Remove from' : 'Add to') + ' wishlist');
    });
  }

  function toggleWishlist(id) {
    var wishlist = getWishlist();
    var key = String(id);
    var index = wishlist.indexOf(key);
    var wished = index === -1;
    if (wished) wishlist.push(key);
    else wishlist.splice(index, 1);
    saveWishlist(wishlist);
    updateWishlistButtons(key, wished);
    window.dispatchEvent(new CustomEvent('tt:wishlistchanged', { detail: { ids: wishlist.slice() } }));
    if (typeof window.showToast === 'function') {
      window.showToast(wished ? 'Saved to your wishlist' : 'Removed from your wishlist');
    }
  }

  function colorInfo(entry) {
    var resolved = typeof window.resolveColor === 'function' ? window.resolveColor(entry) : null;
    var name = typeof entry === 'string' ? entry : ((entry && entry.name) || 'Color');
    var background = resolved && resolved.bg ? resolved.bg : ((entry && entry.hex) || '#d8cbd1');
    if (!/^#[0-9a-f]{3,8}$/i.test(background)) background = '#d8cbd1';
    return { name: String(resolved && resolved.name ? resolved.name : name), background: background };
  }

  function ensureQuickAdd() {
    var overlay = document.getElementById('tt-quick-add-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'tt-quick-add-overlay';
    overlay.className = 'tt-quick-add-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<section class="tt-quick-add" role="dialog" aria-modal="true" aria-labelledby="tt-qa-title">'
      + '<button type="button" class="tt-qa-close" data-tt-qa-action="close" aria-label="Close">×</button>'
      + '<div id="tt-qa-content"></div></section>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay || event.target.closest('[data-tt-qa-action="close"]')) {
        closeQuickAdd();
        return;
      }
      var choice = event.target.closest('[data-tt-qa-choice]');
      if (choice) {
        selectQuickAddChoice(choice);
        return;
      }
      var action = event.target.closest('[data-tt-qa-action]');
      if (!action) return;
      if (action.dataset.ttQaAction === 'add') addQuickSelection(action);
      if (action.dataset.ttQaAction === 'pdp') {
        var id = activeProduct && activeProduct.id;
        closeQuickAdd();
        if (id != null && typeof window.openPDP === 'function') window.openPDP(id);
      }
    });
    return overlay;
  }

  function renderChoices(items, type) {
    return items.map(function (item, index) {
      var info = type === 'color' ? colorInfo(item) : { name: String(item), background: '' };
      var selected = type === 'color' && info.name === selectedColor;
      return '<button type="button" class="tt-qa-choice' + (type === 'color' ? ' tt-qa-choice--color' : '') + (selected ? ' is-selected' : '') + '" data-tt-qa-choice="' + type + '" data-value="' + escapeHtml(info.name) + '" aria-pressed="' + selected + '">'
        + (type === 'color' ? '<span class="tt-qa-swatch" style="background:' + info.background + '"></span>' : '')
        + escapeHtml(info.name) + '</button>';
    }).join('');
  }

  function quickAddMarkup(product) {
    var sizes = Array.isArray(product.sizes) ? product.sizes : [];
    var colors = Array.isArray(product.colors) ? product.colors : [];
    var image = transformImage(product.images && product.images[0], 720);
    var imageHtml = '<div class="tt-qa-image-wrap' + (image ? '' : ' is-missing') + '">'
      + (image ? '<img class="tt-qa-image" src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.name) + '">' : '')
      + '<span class="tt-qa-image-placeholder">' + escapeHtml(product.name) + '</span></div>';
    var buttonText = sizes.length ? 'Choose a size' : 'Add to basket';

    return '<div class="tt-qa-product">' + imageHtml
      + '<div class="tt-qa-copy"><p class="tt-qa-eyebrow">Quick add</p><h3 id="tt-qa-title">' + escapeHtml(product.name) + '</h3>'
      + '<p class="tt-qa-description">' + escapeHtml(descriptionFor(product)) + '</p><div class="tt-qa-price">' + money(product.price) + '</div></div></div>'
      + '<div class="tt-qa-options">'
      + (sizes.length ? '<div class="tt-qa-group"><div class="tt-qa-label">Select size <span>Required</span></div><div class="tt-qa-choices">' + renderChoices(sizes, 'size') + '</div></div>' : '')
      + (colors.length ? '<div class="tt-qa-group"><div class="tt-qa-label">Select colour</div><div class="tt-qa-choices">' + renderChoices(colors, 'color') + '</div></div>' : '')
      + '<p class="tt-qa-status" id="tt-qa-status" aria-live="polite"></p></div>'
      + '<div class="tt-qa-footer"><button type="button" class="tt-qa-button" data-tt-qa-action="pdp">Full details</button>'
      + '<button type="button" class="tt-qa-button tt-qa-button--primary" data-tt-qa-action="add"' + (sizes.length ? ' disabled' : '') + '>' + buttonText + '</button></div>';
  }

  function openQuickAdd(id) {
    var product = findProduct(id);
    if (!product) return;
    activeProduct = product;
    selectedSize = '';
    var colors = Array.isArray(product.colors) ? product.colors : [];
    selectedColor = colors.length ? colorInfo(colors[0]).name : '';

    var overlay = ensureQuickAdd();
    var content = overlay.querySelector('#tt-qa-content');
    content.innerHTML = quickAddMarkup(product);
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    window.requestAnimationFrame(function () {
      var close = overlay.querySelector('.tt-qa-close');
      if (close) close.focus();
    });
  }

  function closeQuickAdd() {
    var overlay = document.getElementById('tt-quick-add-overlay');
    if (!overlay || !overlay.classList.contains('is-open')) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = previousBodyOverflow;
    activeProduct = null;
    selectedSize = '';
    selectedColor = '';
  }

  function selectQuickAddChoice(button) {
    var type = button.dataset.ttQaChoice;
    var value = button.dataset.value || '';
    var group = button.closest('.tt-qa-choices');
    if (group) {
      group.querySelectorAll('.tt-qa-choice').forEach(function (choice) {
        choice.classList.remove('is-selected');
        choice.setAttribute('aria-pressed', 'false');
      });
    }
    button.classList.add('is-selected');
    button.setAttribute('aria-pressed', 'true');
    if (type === 'size') selectedSize = value;
    if (type === 'color') selectedColor = value;

    var addButton = document.querySelector('#tt-quick-add-overlay [data-tt-qa-action="add"]');
    if (addButton && activeProduct) {
      var needsSize = Array.isArray(activeProduct.sizes) && activeProduct.sizes.length > 0;
      addButton.disabled = needsSize && !selectedSize;
      addButton.textContent = addButton.disabled ? 'Choose a size' : 'Add to basket';
    }
    var status = document.getElementById('tt-qa-status');
    if (status) status.textContent = '';
  }

  function addQuickSelection(button) {
    if (!activeProduct || typeof window.addToBasket !== 'function') return;
    var needsSize = Array.isArray(activeProduct.sizes) && activeProduct.sizes.length > 0;
    if (needsSize && !selectedSize) {
      var status = document.getElementById('tt-qa-status');
      if (status) status.textContent = 'Please choose a size first.';
      return;
    }

    var id = activeProduct.id;
    window.addToBasket(id, { size: selectedSize, color: selectedColor });
    closeQuickAdd();
    document.querySelectorAll('.tt-product-card').forEach(function (card) {
      if (String(card.dataset.ttProductId) !== String(id)) return;
      var add = card.querySelector('[data-tt-pc-action="quick-add"]');
      if (!add) return;
      add.classList.add('is-added');
      window.setTimeout(function () { add.classList.remove('is-added'); }, 1200);
    });
  }

  function openWhatsApp(product) {
    if (typeof window.waEnquire === 'function') {
      window.waEnquire(product.name, product.price);
      return;
    }
    var message = 'Hi Tinythreads! I am interested in ' + product.name + ' (' + money(product.price) + '). Please share available sizes and colours.';
    window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(message), '_blank');
  }

  document.addEventListener('click', function (event) {
    var action = event.target.closest('.tt-product-card [data-tt-pc-action]');
    if (!action) return;
    var card = action.closest('.tt-product-card');
    var product = card && findProduct(card.dataset.ttProductId);
    if (!product) return;

    var type = action.dataset.ttPcAction;
    if (type === 'pdp') {
      if (event.target.closest('.swiper-pagination')) return;
      var swiperElement = event.target.closest('.tt-pc-swiper');
      if (swiperElement && swiperElement.swiper && !swiperElement.swiper.allowClick) return;
      if (typeof window.openPDP === 'function') window.openPDP(product.id);
    }
    if (type === 'quick-add') openQuickAdd(product.id);
    if (type === 'wishlist') toggleWishlist(product.id);
    if (type === 'whatsapp') openWhatsApp(product);
  });

  document.addEventListener('error', function (event) {
    if (!event.target.matches) return;
    if (event.target.matches('.tt-pc-media img')) {
      var fallback = event.target.dataset.fallback;
      if (fallback && event.target.dataset.fallbackUsed !== 'true') {
        event.target.dataset.fallbackUsed = 'true';
        event.target.src = fallback;
        return;
      }
      var media = event.target.closest('.tt-pc-media');
      var usableImages = media && Array.from(media.querySelectorAll('img')).some(function (image) {
        return image !== event.target && image.complete && image.naturalWidth > 0;
      });
      if (media && !usableImages) media.classList.add('is-missing');
    }
    if (event.target.matches('.tt-qa-image')) {
      var imageWrap = event.target.closest('.tt-qa-image-wrap');
      if (imageWrap) imageWrap.classList.add('is-missing');
    }
  }, true);

  document.addEventListener('keydown', function (event) {
    var media = event.target.closest && event.target.closest('.tt-pc-media[data-tt-pc-action="pdp"]');
    if (media && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      var card = media.closest('.tt-product-card');
      var product = card && findProduct(card.dataset.ttProductId);
      if (product && typeof window.openPDP === 'function') window.openPDP(product.id);
      return;
    }
    if (event.key === 'Escape') closeQuickAdd();
  });

  window.addEventListener('tt:wishlistchanged', function (event) {
    syncWishlistButtons(event.detail && event.detail.ids);
  });

  window.TTProductCard = {
    renderInto: renderInto,
    openQuickAdd: openQuickAdd,
    closeQuickAdd: closeQuickAdd,
    toggleWishlist: toggleWishlist,
    getWishlist: getWishlist
  };
})();
