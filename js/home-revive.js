(function () {
  const WA_NUMBER = '917879976016';
  const ASSET_BASE = './assets/home-revive/mockup/';
  let activeCollectionKey = null;
  let chapterObserver = null;
  let productRailChapterLock = false;
  let collectionCarouselTimer = null;
  let collectionCarouselResumeTimer = null;
  let collectionCarouselVisible = false;

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

  function renderHomeProducts(grid, items) {
    if (!grid) return;
    if (window.TTProductCard && typeof window.TTProductCard.renderInto === 'function') {
      window.TTProductCard.renderInto(grid, items, { context: 'home' });
      return;
    }
    grid.innerHTML = '<div class="loading-grid">Products are loading...</div>';
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
    renderHomeProducts(grid, featuredProducts(10));
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
    const stickyOffset = window.matchMedia('(max-width: 700px)').matches ? 88 : 94;

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
    renderHomeProducts(grid, byCollection(key, 10));
    section.hidden = false;
    if (reset) reset.hidden = false;
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
    if (matches.length) renderHomeProducts(grid, matches);
    else grid.innerHTML = '';
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

  function moveFromProductRail(direction) {
    if (productRailChapterLock) return;

    const strip = document.getElementById('tt-home-collection-products');
    const chapter = strip && strip.closest('[data-home-chapter]');
    if (!chapter) return;

    const mobileHeaderOffset = 88;
    const chapterTop = chapter.getBoundingClientRect().top;
    const chapterIsAligned = Math.abs(chapterTop - mobileHeaderOffset) < 12;
    const target = direction > 0 && !chapterIsAligned
      ? chapter
      : direction > 0
        ? chapter.nextElementSibling
        : document.querySelector('.tt-home-hero');
    if (!target) return;

    productRailChapterLock = true;
    if (target === chapter) {
      const targetTop = window.scrollY + chapterTop - mobileHeaderOffset + 2;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.setTimeout(function () {
      productRailChapterLock = false;
    }, 650);
  }

  function bindProductRailNavigation() {
    const strip = document.getElementById('tt-home-collection-products');
    if (!strip || strip.dataset.chapterSwipeBound === 'true') return;

    strip.dataset.chapterSwipeBound = 'true';
    let touchStartX = 0;
    let touchStartY = 0;
    let touchHandled = false;

    strip.addEventListener('touchstart', function (event) {
      if (event.touches.length !== 1) return;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      touchHandled = false;
    }, { passive: true });

    strip.addEventListener('touchmove', function (event) {
      if (touchHandled || event.touches.length !== 1) return;
      const deltaX = touchStartX - event.touches[0].clientX;
      const deltaY = touchStartY - event.touches[0].clientY;

      if (Math.abs(deltaY) < 36 || Math.abs(deltaY) <= Math.abs(deltaX) * 1.15) return;
      event.preventDefault();
      touchHandled = true;
      moveFromProductRail(deltaY > 0 ? 1 : -1);
    }, { passive: false });

    strip.addEventListener('touchend', function () {
      touchHandled = false;
    }, { passive: true });

    strip.addEventListener('touchcancel', function () {
      touchHandled = false;
    }, { passive: true });

    strip.addEventListener('wheel', function (event) {
      if (Math.abs(event.deltaY) < 8 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      moveFromProductRail(event.deltaY > 0 ? 1 : -1);
    }, { passive: false });
  }

  function stopCollectionCarousel() {
    if (collectionCarouselTimer) window.clearInterval(collectionCarouselTimer);
    collectionCarouselTimer = null;
  }

  function chapterTwoCarouselCanRun() {
    const rail = document.querySelector('.tt-home-collections');
    const home = document.getElementById('page-home');
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return Boolean(
      rail &&
      collectionCarouselVisible &&
      !reducedMotion &&
      document.visibilityState === 'visible' &&
      (!home || home.classList.contains('active')) &&
      rail.scrollWidth > rail.clientWidth + 4
    );
  }

  function advanceCollectionCarousel() {
    const rail = document.querySelector('.tt-home-collections');
    if (!rail) return;
    const cards = Array.from(rail.querySelectorAll('.tt-image-card'));
    if (cards.length < 2) return;

    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    if (rail.scrollLeft >= maxScroll - 6) {
      rail.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    const firstLeft = cards[0].offsetLeft;
    const next = cards.find(function (card) {
      return card.offsetLeft - firstLeft > rail.scrollLeft + 6;
    });
    rail.scrollTo({
      left: next ? next.offsetLeft - firstLeft : 0,
      behavior: 'smooth'
    });
  }

  function startCollectionCarousel() {
    stopCollectionCarousel();
    if (!chapterTwoCarouselCanRun()) return;
    const delay = (window.tinythreadsConfig && window.tinythreadsConfig.autoPlayInterval) || 3000;
    collectionCarouselTimer = window.setInterval(advanceCollectionCarousel, delay);
  }

  function resumeCollectionCarouselSoon() {
    if (collectionCarouselResumeTimer) window.clearTimeout(collectionCarouselResumeTimer);
    collectionCarouselResumeTimer = window.setTimeout(startCollectionCarousel, 1800);
  }

  function bindChapterTwoCarousel() {
    const rail = document.querySelector('.tt-home-collections');
    if (!rail || rail.dataset.autoplayBound === 'true') return;
    rail.dataset.autoplayBound = 'true';

    ['pointerdown', 'mouseenter', 'focusin'].forEach(function (eventName) {
      rail.addEventListener(eventName, stopCollectionCarousel, { passive: true });
    });
    ['pointerup', 'pointercancel', 'mouseleave', 'focusout'].forEach(function (eventName) {
      rail.addEventListener(eventName, resumeCollectionCarouselSoon, { passive: true });
    });
    rail.addEventListener('wheel', function () {
      stopCollectionCarousel();
      resumeCollectionCarouselSoon();
    }, { passive: true });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(function (entries) {
        collectionCarouselVisible = entries.some(function (entry) {
          return entry.isIntersecting && entry.intersectionRatio >= .35;
        });
        if (collectionCarouselVisible) startCollectionCarousel();
        else stopCollectionCarousel();
      }, { threshold: [.35] });
      observer.observe(rail);
    } else {
      collectionCarouselVisible = true;
      startCollectionCarousel();
    }
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
      rootMargin: '-88px 0px -18% 0px'
    });

    chapters.forEach(chapter => chapterObserver.observe(chapter));
  }

  function render() {
    if (!products().length) return;
    bindProductRailNavigation();
    renderNeeds();
    if (activeCollectionKey) {
      openCollection(activeCollectionKey);
    } else {
      showFeatured();
    }
  }

  document.addEventListener('DOMContentLoaded', render);
  document.addEventListener('DOMContentLoaded', bindProductRailNavigation);
  document.addEventListener('DOMContentLoaded', bindChapterTwoCarousel);
  document.addEventListener('DOMContentLoaded', initHomeChapters);
  window.addEventListener('tt:productsloaded', render);
  window.addEventListener('tt:pageshown', function (event) {
    syncHomeSnapMode(event.detail && event.detail.id);
    if (event.detail && event.detail.id === 'home') startCollectionCarousel();
    else stopCollectionCarousel();
  });
  window.addEventListener('resize', function () {
    updateNeedOverflow(document.getElementById('tt-need-track'));
    syncHomeSnapMode();
    startCollectionCarousel();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') startCollectionCarousel();
    else stopCollectionCarousel();
  });

  window.ttOpenCollection = openCollection;
  window.ttClearHomeCollection = clearCollection;
  window.ttHomeSearch = homeSearch;
  window.ttHomeTrialCTA = homeTrialCTA;
})();
