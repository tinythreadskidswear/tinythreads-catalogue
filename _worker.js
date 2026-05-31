/**
 * _worker.js — Tiny Threads Kidswear
 * ─────────────────────────────────────────────────────────────────────────
 * CF Worker with static assets.
 *
 * HOW IT WORKS:
 *   wrangler.jsonc sets "run_worker_first": ["/products/*"]
 *   So ONLY /products/:id requests hit this worker.
 *   Everything else (index.html, JS, CSS, images) is served directly
 *   from static assets — this worker is never called for them.
 *
 * FOR /products/:id:
 *   • Social crawlers (WhatsApp, Facebook, Telegram etc.)
 *     → fetch product from Supabase → return full OG HTML page
 *   • Regular browsers
 *     → pass through to static assets (existing products/*.html if present)
 *
 * CACHING:
 *   CF edge caches the OG HTML per product for 1 hour.
 *   WhatsApp re-crawls hit the cache instantly — no Supabase call needed.
 */

// ── Supabase config (anon key — same as index.html, read-only, safe here) ─
const SUPABASE_URL = 'https://gtszuhmfpywqwdetoqqo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c3p1aG1mcHl3cXdkZXRvcXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzU5ODcsImV4cCI6MjA5NTIxMTk4N30.-LVroO9ReQEjlLO1XQ3pTrijydMBNH739k05ixo3ZE0';

// ── Site constants ─────────────────────────────────────────────────────────
const SITE_URL    = 'https://mytinythreads.in';
const SITE_NAME   = 'Tiny Threads Kidswear';
const LOGO_URL    = 'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_76,h_76,q_auto,f_auto/v1776510180/Firefly_GeminiFlash_ic3nbt.png';
const FALLBACK_OG = 'https://res.cloudinary.com/tinythreads/image/upload/c_pad,w_1200,h_630,b_rgb:FFF8F5,q_auto,f_jpg/v1776510180/Firefly_GeminiFlash_ic3nbt.png';

// ── Social crawler detection ───────────────────────────────────────────────
const CRAWLER_UA = [
  'whatsapp', 'facebookexternalhit', 'facebookcatalog',
  'twitterbot', 'telegrambot', 'linkedinbot', 'slackbot',
  'discordbot', 'googlebot', 'bingbot', 'applebot',
  'pinterestbot', 'ia_archiver', 'preview',
];

function isCrawler(ua) {
  if (!ua) return false;
  const u = ua.toLowerCase();
  return CRAWLER_UA.some(p => u.includes(p));
}

// ── Label maps ─────────────────────────────────────────────────────────────
const CAT_LABELS = {
  boys: 'Boys 3\u201313 Years', girls: 'Girls 3\u201313 Years',
  babies: 'Babies 0\u20133 Years', accessories: 'Accessories',
  toys: 'Toys', twinning: 'Twinning Sets',
  kidscare: 'Kids Care', school: 'School', learning: 'Learning',
};
const SUBCAT_LABELS = {
  traditional: 'Traditional Wear', summer: 'Summer Wear',
  winter: 'Winter Wear', nightwear: 'Nightwear',
  undergarments: 'Undergarments',
};

// ── Cloudinary OG image builder ────────────────────────────────────────────
// IDENTICAL transform chain to the original working generator.
// Confirmed working for WhatsApp previews — do not change the structure.
function cloudinaryEncode(str) {
  return str
    .replace(/%/g, '%25').replace(/,/g, '%2C').replace(/\//g, '%2F')
    .replace(/\?/g, '%3F').replace(/&/g, '%26')
    .replace(/#/g, '%23').replace(/ /g, '%20');
}

function buildOgImage(product, h) {
  h = h || 630;
  var raw = product.images && product.images.length > 0 ? product.images[0] : '';
  if (!raw || raw.includes('YOUR_CLOUD_NAME') || !raw.includes('res.cloudinary.com')) {
    return FALLBACK_OG;
  }
  var uploadIdx = raw.indexOf('/upload/');
  if (uploadIdx === -1) return FALLBACK_OG;

  var base      = raw.slice(0, uploadIdx + 8);
  var after     = raw.slice(uploadIdx + 8);
  var match     = after.match(/(v\d+\/.+)/);
  var assetPath = match ? match[1] : after;

  var name  = (product.name || 'Kids Wear').substring(0, 38)
              + (product.name && product.name.length > 38 ? '...' : '');
  var price = product.price
    ? 'Rs.' + Number(product.price).toLocaleString('en-IN') + ' - mytinythreads.in'
    : 'mytinythreads.in';

  var transforms = [
    'c_limit,h_' + (h - 90) + ',w_' + (h - 90) + ',q_auto',
    'c_pad,w_1200,h_' + h + ',b_rgb:FFF8F5',
    'l_text:DM+Sans_13_bold_letter_spacing_3:' + cloudinaryEncode('TINY THREADS KIDSWEAR') + ',co_rgb:B71C1C,g_south_west,y_68,x_40',
    'l_text:DM+Sans_22_semibold:' + cloudinaryEncode(name) + ',co_rgb:2C1810,g_south_west,y_38,x_40',
    'l_text:DM+Sans_15:' + cloudinaryEncode(price) + ',co_rgb:B71C1C,g_south_west,y_14,x_40',
    'f_jpg,q_85',
  ].join('/');

  return base + transforms + '/' + assetPath;
}

// ── Display image for the product card (full quality, no OG crop) ─────────
function buildDisplayImg(product) {
  var raw = product.images && product.images.length > 0 ? product.images[0] : '';
  if (!raw || !raw.includes('res.cloudinary.com')) return raw;
  return raw.replace(/\/upload\/(?:[^v][^/]*\/)*?(v\d+\/)/, '/upload/q_auto,f_auto/$1');
}

// ── Supabase product fetch ─────────────────────────────────────────────────
async function fetchProduct(id) {
  var url = SUPABASE_URL + '/rest/v1/products'
    + '?id=eq.' + encodeURIComponent(id)
    + '&active=eq.true'
    + '&select=id,name,description,price,badge,fabric,category,subcategory,images,sizes,colors'
    + '&limit=1';

  var res = await fetch(url, {
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Accept':        'application/json',
    },
  });

  if (!res.ok) return null;
  var rows = await res.json();
  return rows && rows.length > 0 ? rows[0] : null;
}

// ── OG HTML page builder ───────────────────────────────────────────────────
function buildHTML(product) {
  var catLabel    = CAT_LABELS[product.category]      || product.category      || '';
  var subcatLabel = SUBCAT_LABELS[product.subcategory] || product.subcategory   || '';
  var price       = '\u20B9' + Number(product.price).toLocaleString('en-IN');
  var productURL  = SITE_URL + '/products/' + product.id;
  var shopURL     = SITE_URL + '/?product=' + product.id;
  var ogImg       = buildOgImage(product, 630);
  var ogImgTw     = buildOgImage(product, 628);
  var dispImg     = buildDisplayImg(product);

  var sizesDisplay = product.sizes && product.sizes.length
    ? product.sizes.slice(0, 4).join(', ') + (product.sizes.length > 4 ? ' +' + (product.sizes.length - 4) + ' more' : '')
    : '';

  var descParts = [
    product.description || ('Beautiful ' + subcatLabel.toLowerCase() + ' for kids.'),
    catLabel ? catLabel + '.' : '',
    product.fabric ? 'Fabric: ' + product.fabric + '.' : '',
    product.sizes && product.sizes.length
      ? 'Sizes: ' + product.sizes.slice(0, 4).join(', ') + (product.sizes.length > 4 ? ' +more.' : '.')
      : '',
    'Price: ' + price + '.',
    'Shop at mytinythreads.in',
  ].filter(Boolean).join(' ').slice(0, 200);

  var jsonName = product.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  var jsonDesc = descParts.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  return '<!DOCTYPE html>\n'
  + '<html lang="en">\n'
  + '<head>\n'
  + '<meta charset="UTF-8">\n'
  + '<meta name="viewport" content="width=device-width,initial-scale=1.0">\n'
  + '<title>' + product.name + ' \u2013 ' + price + ' \u00b7 ' + SITE_NAME + '</title>\n'
  + '<meta name="description" content="' + descParts + '">\n'
  + '<link rel="canonical" href="' + productURL + '">\n'
  + '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
  + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
  + '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">\n'
  + '<meta property="og:type" content="product">\n'
  + '<meta property="og:site_name" content="' + SITE_NAME + '">\n'
  + '<meta property="og:url" content="' + productURL + '">\n'
  + '<meta property="og:title" content="' + product.name + ' \u2013 ' + price + ' \u00b7 ' + SITE_NAME + '">\n'
  + '<meta property="og:description" content="' + descParts + '">\n'
  + '<meta property="og:image" content="' + ogImg + '">\n'
  + '<meta property="og:image:width" content="1200">\n'
  + '<meta property="og:image:height" content="630">\n'
  + '<meta property="og:image:type" content="image/jpeg">\n'
  + '<meta property="og:image:alt" content="' + product.name + ' by ' + SITE_NAME + '">\n'
  + '<meta property="og:locale" content="en_IN">\n'
  + '<meta property="product:price:amount" content="' + product.price + '">\n'
  + '<meta property="product:price:currency" content="INR">\n'
  + '<meta property="product:availability" content="in stock">\n'
  + '<meta property="product:brand" content="' + SITE_NAME + '">\n'
  + '<meta property="product:category" content="' + catLabel + '">\n'
  + '<meta name="twitter:card" content="summary_large_image">\n'
  + '<meta name="twitter:title" content="' + product.name + ' \u2013 ' + price + ' \u00b7 ' + SITE_NAME + '">\n'
  + '<meta name="twitter:description" content="' + descParts + '">\n'
  + '<meta name="twitter:image" content="' + ogImgTw + '">\n'
  + '<script type="application/ld+json">\n'
  + '{"@context":"https://schema.org","@type":"Product","name":"' + jsonName + '","description":"' + jsonDesc + '","image":"' + ogImg + '","url":"' + productURL + '","brand":{"@type":"Brand","name":"' + SITE_NAME + '"},"offers":{"@type":"Offer","price":"' + product.price + '","priceCurrency":"INR","availability":"https://schema.org/InStock","seller":{"@type":"Organization","name":"' + SITE_NAME + '"}}' + (product.fabric ? ',"material":"' + product.fabric + '"' : '') + '}\n'
  + '<\/script>\n'
  + '<style>\n'
  + '*{margin:0;padding:0;box-sizing:border-box;}\n'
  + ':root{--red:#B71C1C;--red-light:#FFEBEE;--warm:#FFF8F5;--text:#2C1810;--muted:#7A5C50;}\n'
  + 'body{font-family:\'DM Sans\',system-ui,sans-serif;background:var(--warm);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1rem;}\n'
  + '.card{background:white;border-radius:24px;max-width:440px;width:100%;box-shadow:0 8px 40px rgba(183,28,28,.12);border:1px solid #F0E0DC;overflow:hidden;}\n'
  + '.card-head{background:var(--warm);padding:.9rem 1.4rem;display:flex;align-items:center;gap:10px;border-bottom:1px solid #F0E0DC;}\n'
  + '.logo{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid rgba(183,28,28,.15);flex-shrink:0;}\n'
  + '.brand-name{font-family:\'Playfair Display\',serif;font-size:14px;color:var(--red);font-weight:700;}\n'
  + '.brand-sub{font-size:9.5px;color:var(--muted);letter-spacing:1.2px;text-transform:uppercase;}\n'
  + '.img-wrap{width:100%;aspect-ratio:3/4;background:var(--warm);overflow:hidden;}\n'
  + '.prod-img{width:100%;height:100%;object-fit:contain;display:block;}\n'
  + '.card-body{padding:1.3rem 1.4rem 1.5rem;}\n'
  + '.badge{display:inline-block;background:var(--red-light);color:var(--red);border-radius:12px;padding:3px 12px;font-size:11px;font-weight:700;margin-bottom:.55rem;}\n'
  + 'h1.name{font-family:\'Playfair Display\',serif;font-size:1.3rem;font-weight:700;margin-bottom:.3rem;line-height:1.25;}\n'
  + '.price{font-size:1.65rem;font-weight:800;color:var(--red);margin-bottom:.85rem;}\n'
  + '.price span{font-size:11.5px;font-weight:400;color:var(--muted);}\n'
  + '.chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:1.1rem;}\n'
  + '.chip{background:var(--red-light);color:var(--red);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;}\n'
  + '.desc{font-size:12.5px;color:var(--muted);line-height:1.65;margin-bottom:1.25rem;}\n'
  + '.shop-btn{display:flex;align-items:center;justify-content:center;gap:10px;background:var(--red);color:white;text-decoration:none;padding:14px 22px;border-radius:15px;font-size:15px;font-weight:700;margin-bottom:.65rem;transition:background .2s;}\n'
  + '.shop-btn:hover{background:#9b1818;}\n'
  + '.product-url-btn{display:flex;align-items:center;justify-content:center;background:var(--red-light);color:var(--red);text-decoration:none;padding:10px 18px;border-radius:13px;font-size:13px;font-weight:600;}\n'
  + '.trust-note{text-align:center;font-size:10.5px;color:var(--muted);margin-top:.9rem;line-height:1.6;}\n'
  + '.trust-note strong{color:var(--text);}\n'
  + '</style>\n'
  + '</head>\n'
  + '<body>\n'
  + '<div class="card">\n'
  + '  <div class="card-head">\n'
  + '    <img class="logo" src="' + LOGO_URL + '" alt="Tiny Threads Logo">\n'
  + '    <div><div class="brand-name">Tiny Threads</div><div class="brand-sub">Kidswear</div></div>\n'
  + '  </div>\n'
  + (dispImg ? '  <div class="img-wrap"><img class="prod-img" src="' + dispImg + '" alt="' + product.name + '" loading="eager" onerror="this.closest(\'.img-wrap\').style.display=\'none\'"></div>\n' : '')
  + '  <div class="card-body">\n'
  + (product.badge ? '    <div class="badge">' + product.badge + '</div>\n' : '')
  + '    <h1 class="name">' + product.name + '</h1>\n'
  + '    <div class="price">' + price + ' <span>incl. taxes</span></div>\n'
  + '    <div class="chips">\n'
  + (catLabel    ? '      <span class="chip">' + catLabel + '</span>\n'    : '')
  + (subcatLabel ? '      <span class="chip">' + subcatLabel + '</span>\n' : '')
  + (product.fabric      ? '      <span class="chip">\uD83E\uDDF6 ' + product.fabric + '</span>\n' : '')
  + (sizesDisplay ? '      <span class="chip">\uD83D\uDCCF ' + sizesDisplay + '</span>\n' : '')
  + '    </div>\n'
  + (product.description ? '    <p class="desc">' + product.description + '</p>\n' : '')
  + '    <a class="shop-btn" href="' + shopURL + '">\n'
  + '      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>\n'
  + '      Shop on Tiny Threads\n'
  + '    </a>\n'
  + '    <a class="product-url-btn" href="' + productURL + '">View full product details \u2192</a>\n'
  + '    <p class="trust-note">\uD83D\uDD12 <strong>Safe to open.</strong> Official <strong>' + SITE_NAME + '</strong> page \u2014 <em>mytinythreads.in</em></p>\n'
  + '  </div>\n'
  + '</div>\n'
  + '</body>\n'
  + '</html>';
}

// ── Main Worker handler ────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    var url = new URL(request.url);
    var ua  = request.headers.get('User-Agent') || '';

    // Match /products/:id  (with or without .html extension)
    var match = url.pathname.match(/^\/products\/([^/.]+?)(?:\.html)?$/);

    if (!match) {
      return env.ASSETS.fetch(request);
    }

    var id = match[1];

    // Regular browser — serve index.html (SPA handles product display via ?product=id)
    // We no longer have static product HTML files — the SPA handles all browser visits
    if (!isCrawler(ua)) {
      var indexReq = new Request(url.origin + '/?product=' + id, request);
      return env.ASSETS.fetch(indexReq);
    }

    // Social crawler — serve dynamic OG HTML

    // 1. Check CF edge cache
    var cache    = caches.default;
    var cacheKey = new Request(url.origin + '/__og_cache__/' + id, { method: 'GET' });
    var cached   = await cache.match(cacheKey);
    if (cached) return cached;

    // 2. Fetch from Supabase
    var product;
    try {
      product = await fetchProduct(id);
    } catch (e) {
      // Supabase error — serve index.html as fallback
      var indexReq = new Request(url.origin + '/?product=' + id, request);
      return env.ASSETS.fetch(indexReq);
    }

    // 3. Not found in Supabase — serve index.html as fallback
    if (!product) {
      var indexReq = new Request(url.origin + '/?product=' + id, request);
      return env.ASSETS.fetch(indexReq);
    }

    // 4. Return OG HTML
    var html = buildHTML(product);
    var response = new Response(html, {
      status: 200,
      headers: {
        'Content-Type':  'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Robots-Tag':  'index, follow',
        'X-OG-Source':   'worker',
      },
    });

    // 5. Cache it (non-blocking)
    if (env.waitUntil) {
      env.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  },
};