(function () {
  const WA_NUMBER = '917879976016';
  const ASSET_BASE = './assets/home-revive/mockup/';
  let activeCollectionKey = null;

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
      + '<button type="button" onclick="addToBasket(\'' + id + '\')">Add</button>'
      + '</div></div></article>';
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
  window.addEventListener('tt:productsloaded', render);

  window.ttOpenCollection = openCollection;
  window.ttClearHomeCollection = clearCollection;
  window.ttHomeSearch = homeSearch;
  window.ttHomeTrialCTA = homeTrialCTA;
})();
