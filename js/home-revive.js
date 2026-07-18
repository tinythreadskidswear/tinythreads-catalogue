(function () {
  const WA_NUMBER = '917879976016';
  const ASSET_BASE = './assets/home-revive/mockup/';
  let activeCollectionKey = null;
  let chapterObserver = null;

  const NEEDS = [
    { key: 'school_ready', title: 'School Ready', img: 'need-school-ready.png', fallback: p => p.category === 'school' },
    { key: 'monsoon_comfort', title: 'Monsoon Comfort', img: 'need-monsoon-comfort.png', fallback: p => /rain|winter|jacket|layer/i.test((p.subcategory || '') + ' ' + (p.name || '')) },
    { key: 'birthday_looks', title: 'Birthday Looks', img: 'need-birthday-looks.png', fallback: p => /party|festive|traditional|dress|frock/i.test((p.subcategory || '') + ' ' + (p.name || '')) },
    { key: 'daily_wear', title: 'Daily Wear', img: 'need-daily-wear.png', fallback: p => ['boys', 'girls', 'babies'].includes(p.category) },
    { key: 'night_suits', title: 'Night Suits', img: 'need-night-suits.png', fallback: p => p.category === 'nightwear' },
    { key: 'baby_softwear', title: 'Baby Softwear', img: 'need-baby-softwear.png', fallback: p => p.category === 'babies' }
  ];

  function products() {
    return Array.isArray(window.allProducts) ? window.allProducts : [];
  }

  function hasCollection(p, key) {
    return Array.isArray(p.collections) && p.collections.includes(key);
  }

  function byCollection(key, limit, fallback) {
    const list = products();
    let found = list.filter(p => hasCollection(p, key));
    if (!found.length && typeof fallback === 'function') found = list.filter(fallback);
    if (!found.length && key === 'fresh_picks') found = list.filter(p => p.featured);
    if (!found.length && key === 'clearance') found = list.filter(p => /clearance|sale|deal/i.test((p.badge || '') + ' ' + (p.name || '')));
    if (!found.length && key === 'daily_wear') found = list.filter(p => ['boys', 'girls', 'babies'].includes(p.category));
    if (!found.length) found = list.slice(0, limit || 8);
    return found.slice(0, limit || 8);
  }

  function money(value) {
    return '₹' + Number(value || 0).toLocaleString('en-IN');
  }

  function transformImage(url, width) {
    if (!url) return '';
    const targetWidth = Math.max(180, Math.round(width || 320));
    return url.includes('res.cloudinary.com')
      ? url.replace('/upload/', '/upload/c_fill,ar_3:4,g_north,w_' + targetWidth + ',q_auto,f_auto/')
      : url;
  }

  function productCard(p) {
    const renderWidth = window.matchMedia && window.matchMedia('(max-width: 700px)').matches ? 240 : 360;
    const img = p.images && p.images[0] ? transformImage(p.images[0], renderWidth) : '';
    const meta = [p.age, p.subcategory].filter(Boolean).join(' · ');
    const id = String(p.id || '').replace(/'/g, "\\'");
    const imageHtml = img
      ? '<img src="' + img + '" alt="' + p.name + '" loading="lazy">'
      : '<div class="slide-ph" style="height:100%;display:grid;place-items:center;">' + (p.name || 'Tinythreads') + '</div>';

    return '<article class="tt-home-mini-product">'
      + '<div class="tt-home-mini-img" onclick="openPDP(\'' + id + '\')">' + imageHtml + '</div>'
      + '<div class="tt-home-mini-body">'
      + '<h3 onclick="openPDP(\'' + id + '\')">' + (p.name || 'Tinythreads pick') + '</h3>'
      + '<div class="tt-home-mini-meta">' + meta + '</div>'
      + '<div class="tt-home-mini-foot">'
      + '<span class="tt-home-mini-price">' + money(p.price) + '</span>'
      + '</div>'
      + '<div class="tt-home-mini-actions">'
      + '<button type="button" class="tt-home-mini-add" onclick="addToBasket(\'' + id + '\')">Add to cart</button>'
      + '<button type="button" class="tt-home-mini-wa" onclick="ttHomeProductEnquiry(\'' + id + '\')" aria-label="Ask about this product on WhatsApp" title="Ask on WhatsApp">'
      + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.79a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26 9.9 9.9 0 0 1 9.89-9.88 9.82 9.82 0 0 1 6.99 2.9 9.83 9.83 0 0 1 2.89 6.99 9.9 9.9 0 0 1-9.89 9.88M20.46 3.49A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9a11.82 11.82 0 0 0-3.48-8.41z"/></svg>'
      + '</button>'
      + '</div></div></article>';
  }

  function productEnquiry(productId) {
    const product = products().find(item => String(item.id) === String(productId));
    if (!product) return;

    if (typeof window.waEnquire === 'function') {
      window.waEnquire(product.name || 'Tinythreads product', product.price || 0);
      return;
    }

    const msg = 'Hi Tiny Threads! I am interested in "' + (product.name || 'this product')
      + '" priced at ' + money(product.price) + '. Please share available sizes and colours.';
    window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg), '_blank');
  }

  function updateNeedOverflow(track) {
    if (!track) return;
    const carousel = track.closest('.tt-need-carousel');
    if (!carousel) return;

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    carousel.classList.toggle('has-left-overflow', track.scrollLeft > 4);
    carousel.classList.toggle('has-right-overflow', track.scrollLeft < maxScroll - 4);
  }

  function renderNeeds() {
    const track = document.getElementById('tt-need-track');
    if (!track) return;

    track.innerHTML = NEEDS.map(need => {
      const count = byCollection(need.key, 50, need.fallback).length;
      if (!count) return '';
      const selected = activeCollectionKey === need.key;
      return '<button type="button" class="tt-need-card" data-collection="' + need.key + '" aria-pressed="' + selected + '" onclick="ttOpenCollection(\'' + need.key + '\', this)">'
        + '<img src="' + ASSET_BASE + need.img + '" alt="' + need.title + '" loading="lazy">'
        + '<span class="tt-need-count">' + count + ' styles</span>'
        + '</button>';
    }).join('');

    track.onscroll = function () {
      updateNeedOverflow(track);
    };
    window.requestAnimationFrame(function () {
      updateNeedOverflow(track);
    });
  }

  function featuredProducts(limit) {
    let featured = products().filter(p => p.featured);
    featured.sort((a, b) => {
      const first = a.sort_order == null ? Infinity : Number(a.sort_order);
      const second = b.sort_order == null ? Infinity : Number(b.sort_order);
      return first - second;
    });
    if (!featured.length) featured = byCollection('fresh_picks', limit || 10);
    return featured.slice(0, limit || 10);
  }

  function setNeedSelection(key, selectedCard) {
    const track = document.getElementById('tt-need-track');
    if (!track) return;

    const cards = Array.from(track.querySelectorAll('.tt-need-card'));
    cards.forEach(card => card.setAttribute('aria-pressed', 'false'));
    const card = selectedCard || cards.find(item => item.dataset.collection === key);
    if (!card) return;

    card.setAttribute('aria-pressed', 'true');
    const targetLeft = card.offsetLeft - ((track.clientWidth - card.offsetWidth) / 2);
    track.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    window.setTimeout(function () {
      updateNeedOverflow(track);
    }, 350);
  }

  function showFeatured() {
    const section = document.getElementById('tt-home-collection-results');
    const title = document.getElementById('tt-home-collection-title');
    const sub = document.getElementById('tt-home-collection-sub');
    const grid = document.getElementById('tt-home-collection-products');
    const reset = document.getElementById('tt-home-collection-reset');
    if (!section || !title || !sub || !grid) return;

    activeCollectionKey = null;
    title.textContent = 'Featured This Season';
    sub.textContent = 'Our most-loved Tinythreads styles.';
    grid.innerHTML = featuredProducts(10).map(productCard).join('');
    section.hidden = false;
    if (reset) reset.hidden = true;
    setNeedSelection(null);
  }

  function collectionLabel(key) {
    const need = NEEDS.find(n => n.key === key);
    if (need) return need.title;
    if (key === 'clearance') return 'Stock Clearance';
    if (key === 'fresh_picks') return 'Fresh Picks';
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function focusDiscovery() {
    const discovery = document.getElementById('tt-home-discovery');
    if (!discovery) return;

    discovery.classList.add('is-engaged');
    const stickyOffset = window.matchMedia('(max-width: 700px)').matches ? 94 : 100;

    window.requestAnimationFrame(function () {
      let documentTop = 0;
      let element = discovery;
      while (element) {
        documentTop += element.offsetTop;
        element = element.offsetParent;
      }
      const top = documentTop - stickyOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  }

  function openCollection(key, selectedCard) {
    const section = document.getElementById('tt-home-collection-results');
    const title = document.getElementById('tt-home-collection-title');
    const sub = document.getElementById('tt-home-collection-sub');
    const grid = document.getElementById('tt-home-collection-products');
    const reset = document.getElementById('tt-home-collection-reset');
    if (!section || !title || !sub || !grid) return;

    activeCollectionKey = key;
    title.textContent = collectionLabel(key);
    sub.textContent = 'Curated Tinythreads styles matched to this need.';
    grid.innerHTML = byCollection(key, 10).map(productCard).join('');
    section.hidden = false;
    if (reset) reset.hidden = false;
    focusDiscovery();
    setNeedSelection(key, selectedCard);
  }

  function clearCollection() {
    showFeatured();
    focusDiscovery();
  }

  function homeSearch(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) {
      focusDiscovery();
      return;
    }
    const matches = products().filter(p => {
      return [p.name, p.description, p.category, p.subcategory, p.badge].join(' ').toLowerCase().includes(q);
    }).slice(0, 10);

    const section = document.getElementById('tt-home-collection-results');
    const title = document.getElementById('tt-home-collection-title');
    const sub = document.getElementById('tt-home-collection-sub');
    const grid = document.getElementById('tt-home-collection-products');
    const reset = document.getElementById('tt-home-collection-reset');
    if (!section || !title || !sub || !grid) return;

    activeCollectionKey = null;
    title.textContent = 'Search results';
    sub.textContent = matches.length ? 'Showing matches for "' + q + '".' : 'No matching products yet. Try girls, boys, school or nightwear.';
    grid.innerHTML = matches.length ? matches.map(productCard).join('') : '';
    section.hidden = false;
    if (reset) reset.hidden = false;
    setNeedSelection(null);
    focusDiscovery();
  }

  function homeTrialCTA() {
    const basketItems = typeof window.getBasketItems === 'function' ? window.getBasketItems() : [];
    if (basketItems.length && typeof window.openCheckoutImageOptions === 'function') {
      window.openCheckoutImageOptions();
      return;
    }
    const msg = 'Hi Tinythreads, I would like to know about Home Trial availability for kidswear.';
    window.open('https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg), '_blank');
  }

  function syncHomeSnapMode(pageId) {
    const home = document.getElementById('page-home');
    const homeActive = pageId ? pageId === 'home' : Boolean(home && home.classList.contains('active'));
    document.documentElement.classList.toggle('tt-home-snap', homeActive);
  }

  function initHomeChapters() {
    const chapters = Array.from(document.querySelectorAll('[data-home-chapter]'));
    if (!chapters.length) return;

    syncHomeSnapMode();
    chapters[0].classList.add('is-visible');

    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !('IntersectionObserver' in window)) {
      chapters.forEach(chapter => chapter.classList.add('is-visible'));
      return;
    }

    document.documentElement.classList.add('tt-home-motion');
    chapterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, {
      threshold: .16,
      rootMargin: '-94px 0px -18% 0px'
    });

    chapters.forEach(chapter => chapterObserver.observe(chapter));
  }

  function render() {
    if (!products().length) return;
    renderNeeds();
    if (activeCollectionKey) {
      openCollection(activeCollectionKey);
    } else {
      showFeatured();
    }
  }

  document.addEventListener('DOMContentLoaded', render);
  document.addEventListener('DOMContentLoaded', initHomeChapters);
  window.addEventListener('tt:productsloaded', render);
  window.addEventListener('tt:pageshown', function (event) {
    syncHomeSnapMode(event.detail && event.detail.id);
  });
  window.addEventListener('resize', function () {
    updateNeedOverflow(document.getElementById('tt-need-track'));
    syncHomeSnapMode();
  });

  window.ttOpenCollection = openCollection;
  window.ttClearHomeCollection = clearCollection;
  window.ttHomeSearch = homeSearch;
  window.ttHomeTrialCTA = homeTrialCTA;
  window.ttHomeProductEnquiry = productEnquiry;
})();
