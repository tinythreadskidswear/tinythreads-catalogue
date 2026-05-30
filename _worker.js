/**
 * _worker.js — Tiny Threads Kidswear
 *
 * CF Worker with static assets.
 * Intercepts /products/:id requests from social crawlers (WhatsApp,
 * Facebook, Telegram etc.) and returns a dynamic HTML page with correct
 * OG meta tags so share previews show the product image + price.
 *
 * Regular browser visits fall through to static assets unchanged.
 * Everything else (index.html, JS, CSS) is served from static assets.
 */

// ── Social crawler user-agent patterns ────────────────────────────────────
const CRAWLER_PATTERNS = [
  'whatsapp',
  'facebookexternalhit',
  'facebookcatalog',
  'twitterbot',
  'telegrambot',
  'linkedinbot',
  'slackbot',
  'discordbot',
  'googlebot',
  'bingbot',
  'applebot',
  'pinterestbot',
  'ia_archiver',
  'developers.google.com/+/web/snippet',
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some(p => ua.includes(p));
}

// ── Cloudinary OG image URL builder ───────────────────────────────────────
// Identical transform chain to the original working generator.
// NEVER change this structure — it was confirmed working for WhatsApp.
const FALLBACK_OG =
  'https://res.cloudinary.com/tinythreads/image/upload/c_pad,w_1200,h_630,b_rgb:FFF8F5,q_auto,f_jpg/v1776510180/Firefly_GeminiFlash_ic3nbt.png';

function cloudinaryTextEncode(str) {
  return str
    .replace(/%/g,  '%25')
    .replace(/,/g,  '%2C')
    .replace(/\//g, '%2F')
    .replace(/\?/g, '%3F')
    .replace(/&/g,  '%26')
    .replace(/#/g,  '%23')
    .replace(/ /g,  '%20');
}

function buildOgImage(product, h = 630) {
  const url = product.images && product.images.length > 0 ? product.images[0] : '';
  if (!url || url.includes('YOUR_CLOUD_NAME')) return FALLBACK_OG;
  if (!url.includes('res.cloudinary.com'))     return url;

  const uploadIdx = url.indexOf('/upload/');
  if (uploadIdx === -1) return FALLBACK_OG;

  const base        = url.slice(0, uploadIdx + 8);
  const afterUpload = url.slice(uploadIdx + 8);
  const match       = afterUpload.match(/(v\d+\/.+)/);
  const assetPath   = match ? match[1] : afterUpload;

  const rawName  = (product.name || 'Kids Wear').substring(0, 38)
                   + (product.name && product.name.length > 38 ? '...' : '');
  const encName  = cloudinaryTextEncode(rawName);
  const price    = product.price
    ? `Rs.${Number(product.price).toLocaleString('en-IN')} - mytinythreads.in`
    : 'mytinythreads.in';
  const encPrice = cloudinaryTextEncode(price);
  const encBrand = cloudinaryTextEncode('TINY THREADS KIDSWEAR');

  const productH = h - 90; // 540 for h=630

  const transforms = [
    `c_limit,h_${productH},w_${productH},q_auto`,
    `c_pad,w_1200,h_${h},b_rgb:FFF8F5`,
    `l_text:DM+Sans_13_bold_letter_spacing_3:${encBrand},co_rgb:B71C1C,g_south_west,y_68,x_40`,
    `l_text:DM+Sans_22_semibold:${encName},co_rgb:2C1810,g_south_west,y_38,x_40`,
    `l_text:DM+Sans_15:${encPrice},co_rgb:B71C1C,g_south_west,y_14,x_40`,
    `f_jpg,q_85`,
  ].join('/');

  return `${base}${transforms}/${assetPath}`;
}

// ── Display image for the page card (full quality, no OG crop) ───────────
function buildDisplayImage(product) {
  const url = product.images && product.images.length > 0 ? product.images[0] : '';
  if (!url || !url.includes('res.cloudinary.com')) return url;
  return url.replace(/\/upload\/(?:[^v][^/]*\/)*?(v\d+\/)/, '/upload/q_auto,f_auto/$1');
}

// ── Label helpers ─────────────────────────────────────────────────────────
const CAT_LABELS = {
  boys: 'Boys 3–13 Years', girls: 'Girls 3–13 Years',
  babies: 'Babies 0–3 Years', accessories: 'Accessories',
  toys: 'Toys', twinning: 'Twinning Sets',
  kidscare: 'Kids Care', school: 'School', learning: 'Learning',
};
const SUBCAT_LABELS = {
  traditional: 'Traditional Wear', summer: 'Summer Wear',
  winter: 'Winter Wear', nightwear: 'Nightwear',
  undergarments: 'Undergarments',
};

// ── OG HTML builder ───────────────────────────────────────────────────────
function buildHTML(product) {
  const SITE     = 'https://mytinythreads.in';
  const SITE_NAME = 'Tiny Threads Kidswear';

  const catLabel    = CAT_LABELS[product.category]      || product.category      || '';
  const subcatLabel = SUBCAT_LABELS[product.subcategory] || product.subcategory   || '';
  const price       = `₹${Number(product.price).toLocaleString('en-IN')}`;
  const productURL  = `${SITE}/products/${product.id}`;
  const shopURL     = `${SITE}/?product=${product.id}`;

  const ogImg   = buildOgImage(product, 630);
  const ogImgTw = buildOgImage(product, 628);
  const dispImg = buildDisplayImage(product);

  const desc = [
    product.description || `Beautiful ${subcatLabel.toLowerCase()} for kids.`,
    catLabel ? `${catLabel}.` : '',
    product.fabric ? `Fabric: ${product.fabric}.` : '',
    product.sizes && product.sizes.length
      ? `Sizes: ${product.sizes.slice(0, 4).join(', ')}${product.sizes.length > 4 ? ' +more' : ''}.`
      : '',
    `Price: ${price}.`,
    'Shop at mytinythreads.in',
  ].filter(Boolean).join(' ').slice(0, 200);

  const sizesDisplay = product.sizes && product.sizes.length
    ? product.sizes.slice(0, 4).join(', ') + (product.sizes.length > 4 ? ` +${product.sizes.length - 4} more` : '')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${product.name} \u2013 ${price} \u00b7 ${SITE_NAME}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${productURL}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">

<meta property="og:type"         content="product">
<meta property="og:site_name"    content="${SITE_NAME}">
<meta property="og:url"          content="${productURL}">
<meta property="og:title"        content="${product.name} \u2013 ${price} \u00b7 ${SITE_NAME}">
<meta property="og:description"  content="${desc}">
<meta property="og:image"        content="${ogImg}">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt"    content="${product.name} \u2013 ${catLabel} by ${SITE_NAME}">
<meta property="og:image:type"   content="image/jpeg">
<meta property="og:locale"       content="en_IN">
<meta property="product:price:amount"   content="${product.price}">
<meta property="product:price:currency" content="INR">
<meta property="product:availability"   content="in stock">
<meta property="product:brand"          content="${SITE_NAME}">
<meta property="product:category"       content="${catLabel}">
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${product.name} \u2013 ${price} \u00b7 ${SITE_NAME}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image"       content="${ogImgTw}">
<meta name="twitter:image:alt"   content="${product.name} by ${SITE_NAME}">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "${product.name.replace(/"/g, '\\"')}",
  "description": "${desc.replace(/"/g, '\\"')}",
  "image": "${ogImg}",
  "url": "${productURL}",
  "brand": { "@type": "Brand", "name": "${SITE_NAME}" },
  "offers": {
    "@type": "Offer",
    "price": "${product.price}",
    "priceCurrency": "INR",
    "availability": "https://schema.org/InStock",
    "seller": { "@type": "Organization", "name": "${SITE_NAME}" }
  }${product.fabric ? `,\n  "material": "${product.fabric}"` : ''}
}
<\/script>

<style>
*{margin:0;padding:0;box-sizing:border-box;}
:root{--red:#B71C1C;--red-light:#FFEBEE;--warm:#FFF8F5;--text:#2C1810;--muted:#7A5C50;}
body{font-family:'DM Sans',system-ui,sans-serif;background:var(--warm);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem 1rem;}
.card{background:white;border-radius:24px;max-width:440px;width:100%;box-shadow:0 8px 40px rgba(183,28,28,.12);border:1px solid #F0E0DC;overflow:hidden;}
.card-head{background:var(--warm);padding:.9rem 1.4rem;display:flex;align-items:center;gap:10px;border-bottom:1px solid #F0E0DC;}
.logo{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid rgba(183,28,28,.15);flex-shrink:0;}
.brand-name{font-family:'Playfair Display',serif;font-size:14px;color:var(--red);font-weight:700;}
.brand-sub{font-size:9.5px;color:var(--muted);letter-spacing:1.2px;text-transform:uppercase;}
.img-wrap{width:100%;aspect-ratio:3/4;background:var(--warm);overflow:hidden;}
.prod-img{width:100%;height:100%;object-fit:contain;display:block;}
.card-body{padding:1.3rem 1.4rem 1.5rem;}
.badge{display:inline-block;background:var(--red-light);color:var(--red);border-radius:12px;padding:3px 12px;font-size:11px;font-weight:700;margin-bottom:.55rem;}
h1.name{font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:700;margin-bottom:.3rem;line-height:1.25;}
.price{font-size:1.65rem;font-weight:800;color:var(--red);margin-bottom:.85rem;}
.price span{font-size:11.5px;font-weight:400;color:var(--muted);}
.chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:1.1rem;}
.chip{background:var(--red-light);color:var(--red);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;}
.desc{font-size:12.5px;color:var(--muted);line-height:1.65;margin-bottom:1.25rem;}
.shop-btn{display:flex;align-items:center;justify-content:center;gap:10px;background:var(--red);color:white;text-decoration:none;padding:14px 22px;border-radius:15px;font-size:15px;font-weight:700;margin-bottom:.65rem;transition:background .2s;}
.shop-btn:hover{background:#9b1818;}
.product-url-btn{display:flex;align-items:center;justify-content:center;gap:6px;background:var(--red-light);color:var(--red);text-decoration:none;padding:10px 18px;border-radius:13px;font-size:13px;font-weight:600;}
.trust-note{text-align:center;font-size:10.5px;color:var(--muted);margin-top:.9rem;line-height:1.6;}
.trust-note strong{color:var(--text);}
</style>
</head>
<body>
<div class="card">
  <div class="card-head">
    <img class="logo" src="https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_76,h_76,q_auto,f_auto/v1776510180/Firefly_GeminiFlash_ic3nbt.png" alt="Tiny Threads Logo">
    <div>
      <div class="brand-name">Tiny Threads</div>
      <div class="brand-sub">Kidswear</div>
    </div>
  </div>
  ${dispImg ? `<div class="img-wrap"><img class="prod-img" src="${dispImg}" alt="${product.name}" loading="eager" onerror="this.closest('.img-wrap').style.display='none'"></div>` : ''}
  <div class="card-body">
    ${product.badge ? `<div class="badge">${product.badge}</div>` : ''}
    <h1 class="name">${product.name}</h1>
    <div class="price">${price} <span>incl. taxes</span></div>
    <div class="chips">
      <span class="chip">${catLabel}</span>
      ${subcatLabel  ? `<span class="chip">${subcatLabel}</span>`     : ''}
      ${product.fabric     ? `<span class="chip">\uD83E\uDDF6 ${product.fabric}</span>`  : ''}
      ${sizesDisplay ? `<span class="chip">\uD83D\uDCCF ${sizesDisplay}</span>` : ''}
    </div>
    ${product.description ? `<p class="desc">${product.description}</p>` : ''}
    <a class="shop-btn" href="${shopURL}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
      Shop on Tiny Threads
    </a>
    <a class="product-url-btn" href="${productURL}">View full product details \u2192</a>
    <p class="trust-note">\uD83D\uDD12 <strong>Safe to open.</strong> Official <strong>Tiny Threads Kidswear</strong> page \u2014 <em>mytinythreads.in</em></p>
  </div>
</div>
</body>
</html>`;
}

// ── Supabase fetch ────────────────────────────────────────────────────────
async function fetchProduct(id, env) {
  const url = `https://gtszuhmfpywqwdetoqqo.supabase.co/rest/v1/products/rest/v1/products`
    + `?id=eq.${encodeURIComponent(id)}&active=eq.true`
    + `&select=id,name,description,price,badge,fabric,category,subcategory,images,sizes,colors`
    + `&limit=1`;

  const res = await fetch(url, {
    headers: {
      'apikey':        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c3p1aG1mcHl3cXdkZXRvcXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzU5ODcsImV4cCI6MjA5NTIxMTk4N30.-LVroO9ReQEjlLO1XQ3pTrijydMBNH739k05ixo3ZE0',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0c3p1aG1mcHl3cXdkZXRvcXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MzU5ODcsImV4cCI6MjA5NTIxMTk4N30.-LVroO9ReQEjlLO1XQ3pTrijydMBNH739k05ixo3ZE0',
      'Accept':        'application/json',
    },
  });

  if (!res.ok) return null;
  const rows = await res.json();
  return rows && rows.length > 0 ? rows[0] : null;
}

// ── Main worker handler ───────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ua  = request.headers.get('User-Agent') || '';

    // Only intercept /products/:id paths for crawlers
    const match = url.pathname.match(/^\/products\/([^/]+?)(?:\.html)?$/);

    if (match && isCrawler(ua)) {
      const id = match[1];

      // Check CF cache first
      const cache    = caches.default;
      const cacheKey = new Request(`${url.origin}/products/${id}/__og__`, request);
      const cached   = await cache.match(cacheKey);
      if (cached) return cached;

      // Fetch from Supabase
      const product = await fetchProduct(id, env);

      if (!product) {
        // Product not found — fall through to static assets
        return env.ASSETS.fetch(request);
      }

      const html = buildHTML(product);

      const response = new Response(html, {
        headers: {
          'Content-Type':  'text/html;charset=UTF-8',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          'X-Robots-Tag':  'index, follow',
        },
      });

      // Store in CF cache for 1 hour
      env.waitUntil && env.waitUntil(cache.put(cacheKey, response.clone()));

      return response;
    }

    // Everything else — static assets (index.html, JS, CSS, products/*.html etc.)
    return env.ASSETS.fetch(request);
  },
};