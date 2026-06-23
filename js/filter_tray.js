(function () {
  const PRICE_MIN = 100;
  const PRICE_MAX = 3000;
  const SORT_OPTIONS = [
    { value: 'default', label: 'Featured' },
    { value: 'price-asc', label: 'Price: Low to High' },
    { value: 'price-desc', label: 'Price: High to Low' },
    { value: 'new', label: 'New Arrivals' },
    { value: 'az', label: 'Name A-Z' }
  ];

  const contexts = {};
  let overlay;
  let activeTray;
  let trayLayer;

  function labelize(value, labels) {
    if (!value) return '';
    const known = labels && labels[value];
    if (known) return stripEmoji(known);
    return String(value)
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, function (char) { return char.toUpperCase(); });
  }

  function stripEmoji(value) {
    return String(value).replace(/[^\w\s&/-]/g, '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function productAgeValues(product) {
    const source = product.age || product.ages || product.age_group || product.age_range || product.ageRange || [];
    const values = Array.isArray(source) ? source : String(source).split(',');
    if (values.filter(Boolean).length) return values.map(function (v) { return String(v).trim(); }).filter(Boolean);
    return Array.isArray(product.sizes) ? product.sizes.map(function (v) { return String(v).trim(); }).filter(Boolean) : [];
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort(function (a, b) {
      return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  function ensureState(state) {
    state.subcategories = Array.isArray(state.subcategories) ? state.subcategories : [];
    state.ages = Array.isArray(state.ages) ? state.ages : [];
    state.priceMin = Number.isFinite(state.priceMin) ? state.priceMin : PRICE_MIN;
    state.priceMax = Number.isFinite(state.priceMax) ? state.priceMax : PRICE_MAX;
    state.sort = state.sort || 'default';
    return state;
  }

  function hasActiveFilters(state) {
    return state.subcategories.length > 0 || state.ages.length > 0 || state.priceMin !== PRICE_MIN || state.priceMax !== PRICE_MAX;
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'tt-tray-overlay';
    overlay.addEventListener('click', closeTray);
    document.body.appendChild(overlay);
    return overlay;
  }

  function ensureTrayLayer() {
    if (trayLayer) return trayLayer;
    trayLayer = document.createElement('div');
    trayLayer.className = 'tt-tray-layer';
    document.body.appendChild(trayLayer);
    return trayLayer;
  }

  function openTray(cat, type) {
    closeTray();
    ensureOverlay().classList.add('open');
    activeTray = document.getElementById('tt-' + type + '-tray-' + cat);
    if (activeTray) {
      activeTray.classList.add('open');
      activeTray.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('tt-tray-lock');
  }

  function closeTray() {
    if (overlay) overlay.classList.remove('open');
    if (activeTray) {
      activeTray.classList.remove('open');
      activeTray.setAttribute('aria-hidden', 'true');
    }
    activeTray = null;
    document.body.classList.remove('tt-tray-lock');
  }

  function makeCheckbox(name, value, label, checked) {
    return '<label class="tt-check"><input type="checkbox" name="' + name + '" value="' + escapeHtml(value) + '"' + (checked ? ' checked' : '') + '><span>' + escapeHtml(label) + '</span></label>';
  }

  function renderOptions(values, name, selected, labels) {
    if (!values.length) return '<div class="tt-empty-options">No options available yet.</div>';
    return '<div class="tt-option-list">' + values.map(function (value) {
      return makeCheckbox(name, value, labelize(value, labels), selected.indexOf(value) !== -1);
    }).join('') + '</div>';
  }

  function renderFilterTray(ctx, subcategories, ages) {
    const state = ensureState(ctx.state);
    return [
      '<aside class="tt-tray tt-tray-left" id="tt-filter-tray-' + ctx.cat + '" aria-hidden="true">',
      '<div class="tt-tray-head"><h3 class="tt-tray-title">Filter</h3><button class="tt-tray-close" type="button" data-close-tray aria-label="Close filter">x</button></div>',
      '<div class="tt-tray-body">',
      '<section class="tt-filter-section"><h4 class="tt-filter-heading">Age</h4>' + renderOptions(ages, 'age', state.ages, ctx.labels) + '</section>',
      '<section class="tt-filter-section"><h4 class="tt-filter-heading">Subcategory</h4>' + renderOptions(subcategories, 'subcategory', state.subcategories, ctx.labels) + '</section>',
      '<section class="tt-filter-section"><h4 class="tt-filter-heading">Price Range</h4>',
      '<div class="tt-price-values"><span id="tt-price-min-' + ctx.cat + '">Rs ' + state.priceMin + '</span><span id="tt-price-max-' + ctx.cat + '">Rs ' + state.priceMax + '</span></div>',
      '<div class="tt-range-stack">',
      '<label class="tt-range-row"><span>Min</span><input type="range" min="' + PRICE_MIN + '" max="' + PRICE_MAX + '" step="50" value="' + state.priceMin + '" data-price-min></label>',
      '<label class="tt-range-row"><span>Max</span><input type="range" min="' + PRICE_MIN + '" max="' + PRICE_MAX + '" step="50" value="' + state.priceMax + '" data-price-max></label>',
      '</div></section>',
      '</div>',
      '<div class="tt-tray-foot"><button class="tt-clear-btn" type="button" data-clear-filters>Clear</button><button class="tt-apply-btn" type="button" data-apply-filters>Apply</button></div>',
      '</aside>'
    ].join('');
  }

  function renderSortTray(ctx) {
    const state = ensureState(ctx.state);
    return [
      '<aside class="tt-tray tt-tray-right" id="tt-sort-tray-' + ctx.cat + '" aria-hidden="true">',
      '<div class="tt-tray-head"><h3 class="tt-tray-title">Sort</h3><button class="tt-tray-close" type="button" data-close-tray aria-label="Close sort">x</button></div>',
      '<div class="tt-tray-body"><div class="tt-sort-list">',
      SORT_OPTIONS.map(function (option) {
        return '<button class="tt-sort-option' + (state.sort === option.value ? ' active' : '') + '" type="button" data-sort="' + option.value + '">' + option.label + '</button>';
      }).join(''),
      '</div></div>',
      '</aside>'
    ].join('');
  }

  function updatePriceLabels(cat, tray) {
    const minInput = tray.querySelector('[data-price-min]');
    const maxInput = tray.querySelector('[data-price-max]');
    let minValue = parseInt(minInput.value, 10);
    let maxValue = parseInt(maxInput.value, 10);
    if (minValue > maxValue) {
      const changedMin = document.activeElement === minInput;
      if (changedMin) maxValue = minValue;
      else minValue = maxValue;
      minInput.value = minValue;
      maxInput.value = maxValue;
    }
    const minLabel = document.getElementById('tt-price-min-' + cat);
    const maxLabel = document.getElementById('tt-price-max-' + cat);
    if (minLabel) minLabel.textContent = 'Rs ' + minValue;
    if (maxLabel) maxLabel.textContent = 'Rs ' + maxValue;
  }

  function syncBarState(ctx) {
    const bar = document.getElementById('filter-bar-' + ctx.cat);
    if (!bar) return;
    const state = ensureState(ctx.state);
    const filterButton = bar.querySelector('[data-open-filter]');
    const sortButton = bar.querySelector('[data-open-sort]');
    if (filterButton) filterButton.classList.toggle('has-active', hasActiveFilters(state));
    if (sortButton) sortButton.classList.toggle('has-active', state.sort !== 'default');
  }

  function wireFilterTray(ctx) {
    const tray = document.getElementById('tt-filter-tray-' + ctx.cat);
    if (!tray) return;
    tray.querySelectorAll('[data-close-tray]').forEach(function (btn) { btn.addEventListener('click', closeTray); });
    tray.querySelectorAll('input[type="range"]').forEach(function (input) {
      input.addEventListener('input', function () { updatePriceLabels(ctx.cat, tray); });
    });
    tray.querySelector('[data-clear-filters]').addEventListener('click', function () {
      const state = ensureState(ctx.state);
      state.subcategories = [];
      state.ages = [];
      state.priceMin = PRICE_MIN;
      state.priceMax = PRICE_MAX;
      ctx.state.filter = 'all';
      tray.querySelectorAll('input[type="checkbox"]').forEach(function (input) { input.checked = false; });
      tray.querySelector('[data-price-min]').value = PRICE_MIN;
      tray.querySelector('[data-price-max]').value = PRICE_MAX;
      updatePriceLabels(ctx.cat, tray);
      ctx.onApply(ctx.cat);
      syncBarState(ctx);
    });
    tray.querySelector('[data-apply-filters]').addEventListener('click', function () {
      const state = ensureState(ctx.state);
      state.subcategories = Array.from(tray.querySelectorAll('input[name="subcategory"]:checked')).map(function (input) { return input.value; });
      state.ages = Array.from(tray.querySelectorAll('input[name="age"]:checked')).map(function (input) { return input.value; });
      state.priceMin = parseInt(tray.querySelector('[data-price-min]').value, 10);
      state.priceMax = parseInt(tray.querySelector('[data-price-max]').value, 10);
      ctx.state.filter = state.subcategories.length === 1 ? state.subcategories[0] : 'all';
      ctx.onApply(ctx.cat);
      syncBarState(ctx);
      closeTray();
    });
  }

  function wireSortTray(ctx) {
    const tray = document.getElementById('tt-sort-tray-' + ctx.cat);
    if (!tray) return;
    tray.querySelectorAll('[data-close-tray]').forEach(function (btn) { btn.addEventListener('click', closeTray); });
    tray.querySelectorAll('[data-sort]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ctx.state.sort = btn.getAttribute('data-sort');
        tray.querySelectorAll('[data-sort]').forEach(function (option) { option.classList.remove('active'); });
        btn.classList.add('active');
        ctx.onApply(ctx.cat);
        syncBarState(ctx);
        closeTray();
      });
    });
  }

  function initCategory(nextCtx) {
    const ctx = Object.assign({}, nextCtx);
    ctx.state = ensureState(ctx.state || {});
    contexts[ctx.cat] = ctx;
    const bar = document.getElementById('filter-bar-' + ctx.cat);
    if (!bar) return;

    const products = ctx.products.filter(function (product) { return product.category === ctx.cat; });
    const subcategories = uniqueSorted(products.map(function (product) { return product.subcategory; }));
    const ages = uniqueSorted(products.flatMap(productAgeValues));

    bar.innerHTML = [
      '<div class="tt-filter-bar" role="group" aria-label="Filter and sort products">',
      '<button class="tt-filter-action" type="button" data-open-filter><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 5h16M7 12h10M10 19h4"/></svg><span>Filter</span></button>',
      '<span class="tt-filter-divider" aria-hidden="true"></span>',
      '<button class="tt-filter-action" type="button" data-open-sort><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M7 6h10M10 12h7M13 18h4"/><path d="M6 18V6"/></svg><span>Sort</span></button>',
      '</div>'
    ].join('');

    const layer = ensureTrayLayer();
    const existingFilterTray = document.getElementById('tt-filter-tray-' + ctx.cat);
    const existingSortTray = document.getElementById('tt-sort-tray-' + ctx.cat);
    if (existingFilterTray) existingFilterTray.remove();
    if (existingSortTray) existingSortTray.remove();
    layer.insertAdjacentHTML('beforeend', renderFilterTray(ctx, subcategories, ages) + renderSortTray(ctx));

    bar.querySelector('[data-open-filter]').addEventListener('click', function () { openTray(ctx.cat, 'filter'); });
    bar.querySelector('[data-open-sort]').addEventListener('click', function () { openTray(ctx.cat, 'sort'); });
    wireFilterTray(ctx);
    wireSortTray(ctx);
    syncBarState(ctx);
  }

  function productMatches(product, state) {
    ensureState(state);
    const price = Number(product.price) || 0;
    if (price < state.priceMin || price > state.priceMax) return false;
    if (state.subcategories.length && state.subcategories.indexOf(product.subcategory) === -1) return false;
    if (state.ages.length) {
      const ages = productAgeValues(product);
      if (!ages.some(function (age) { return state.ages.indexOf(age) !== -1; })) return false;
    }
    return true;
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeTray();
  });

  window.TTFilterTray = {
    initCategory: initCategory,
    productMatches: productMatches,
    close: closeTray
  };
})();
