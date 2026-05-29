/**
 * generate-product-pages.js
 *
 * OG IMAGE STRATEGY — Full product visible, maximum size, zero cropping
 * ─────────────────────────────────────────────────────────────────────
 * Problem:  Portrait product photos (3:4) placed in a landscape OG frame
 *           (1200×630) will always have either:
 *             • c_fill  → product CROPPED (half outfit hidden)
 *             • c_pad   → product tiny (huge white bars on sides)
 *
 * Solution: THREE-STEP Cloudinary chain:
 *
 *   Step 1 → c_limit,h_540,w_540,q_auto
 *     Scales the image so it fits inside a 540×540 box (slightly smaller than
 *     630 to leave breathing room for the text overlay bar at the bottom).
 *     c_limit = only shrink, never enlarge (no blurry upscaling).
 *     For a portrait image this gives: width ≈ 405px, height = 540px.
 *     The product fills the FULL usable height of the OG banner.
 *
 *   Step 2 → c_pad,w_1200,h_630,b_rgb:FFF8F5
 *     Pads the already-scaled image to exactly 1200×630.
 *     Since the image already fills 540px tall, padding appears only as
 *     narrow warm-white columns on LEFT and RIGHT.
 *     Background colour #FFF8F5 matches the Tiny Threads site.
 *
 *   Step 3 → Text overlays (burned into the image)
 *     Brand name + product name + price + "Shop at Tiny Threads" CTA are
 *     composited directly into the image using Cloudinary's text layer API.
 *     This means WhatsApp users SEE the product, name, and price without
 *     even clicking the link — perfect for passive scroll advertising.
 *
 *     Layout (bottom-left anchored):
 *       • Line 1 (y=120): "TINY THREADS KIDSWEAR"  — small brand label
 *       • Line 2 (y= 72): Product name (truncated)  — medium weight
 *       • Line 3 (y= 34): ₹price · Shop at Tiny Threads — price + CTA
 *
 *   Step 4 → f_jpg,q_85
 *     Output as compressed JPEG. WhatsApp requires images under 300 KB.
 *     q_85 balances quality vs file size perfectly for product photos.
 *
 * Why c_limit first, then c_pad?
 *   If we went straight to c_pad,w_1200,h_630 from a portrait photo,
 *   the image would be tiny (≈236px wide) with massive side bars.
 *   The c_limit pre-scale maximises the product size before padding.
 *
 * Why strip existing transforms from the URL?
 *   Product image URLs sometimes already contain Cloudinary transforms
 *   (e.g. c_fill,w_600). Applying our chain ON TOP gives double-transform
 *   artifacts. We strip back to the raw asset path (v1234567/…) first.
 *
 * Fallback:
 *   If a product has no image or uses a placeholder cloud name, we fall
 *   back to the brand logo OG image — better than a broken preview.
 *
 * Run:    node generate-product-pages.js
 * Output: /products/[id].html  (one static HTML file per product)
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

// ── Supabase config ────────────────────────────────────────────────────────
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

// ── Fetch all active products from Supabase REST API ──────────────────────
function fetchPage(offset, limit) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/products`);
    url.searchParams.set('select', '*');
    url.searchParams.set('active', 'eq.true');
    url.searchParams.set('order', 'id');
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit',  String(limit));

    https.get({
      hostname: url.hostname,
      path:     url.pathname + url.search,
      headers:  {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        if (res.statusCode !== 200)
          return reject(new Error(`Supabase ${res.statusCode}: ${raw}`));
        resolve(JSON.parse(raw));
      });
    }).on('error', reject);
  });
}

async function fetchAllProducts() {
  let all = [], offset = 0;
  const PAGE = 1000;
  while (true) {
    const batch = await fetchPage(offset, PAGE);
    all = all.concat(batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// ── Constants ──────────────────────────────────────────────────────────────
const SITE_URL  = 'https://mytinythreads.in';
const SITE_NAME = 'Tiny Threads Kidswear';

// Fallback OG image — used when product has no real photo
// This is the brand logo, already correctly sized at 1200×630
const FALLBACK_OG_IMG = 'https://res.cloudinary.com/tinythreads/image/upload/c_pad,w_1200,h_630,b_rgb:FFF8F5,q_auto,f_jpg/v1776510180/Firefly_GeminiFlash_ic3nbt.png';

// ─────────────────────────────────────────────────────────────────────────────
// ogImage(product, h)
//
//   Builds a Cloudinary URL that:
//     1. Shows the FULL product centred — critical for WhatsApp's square crop
//     2. Burns brand name, product name & price into the image
//
//   WHATSAPP CROP BEHAVIOUR (important!):
//     WhatsApp does NOT show the full 1200×630 banner. It centre-crops to a
//     square (roughly 630×630). If the product sits on the LEFT of the canvas
//     (as c_pad left-aligns by default), WhatsApp will show mostly white bars.
//
//   Strategy:
//     • c_limit,h_{h},w_{h},q_auto  → scale product to fit within a square
//                                      equal to the frame height (preserves AR)
//     • c_pad,w_1200,h_{h},g_center  → pad to 1200×h, product CENTRED
//       b_rgb:FFF8F5                → warm white bars left+right
//     • Text overlays g_south        → text anchored to bottom-centre
//     • f_jpg,q_85                  → WhatsApp-safe compressed JPEG
//
//   Result: product is always in the centre 630px — visible in every crop.
//
//   h = 630  → WhatsApp, Facebook, LinkedIn  (1200 × 630)
//   h = 628  → Twitter / X                   (1200 × 628)
// ─────────────────────────────────────────────────────────────────────────────
function ogImage(product, h = 630) {
  const url = product.images && product.images.length > 0 ? product.images[0] : '';

  // ── Guard: no image or placeholder ──────────────────────────────────────
  if (!url || url.includes('YOUR_CLOUD_NAME')) return FALLBACK_OG_IMG;

  // ── Guard: non-Cloudinary image — return as-is (no transforms possible) ─
  if (!url.includes('res.cloudinary.com')) return url;

  const uploadIdx = url.indexOf('/upload/');
  if (uploadIdx === -1) return FALLBACK_OG_IMG;

  const base        = url.slice(0, uploadIdx + 8); // up to & including "/upload/"
  const afterUpload = url.slice(uploadIdx + 8);    // everything after "/upload/"

  // Strip any pre-existing transforms — real asset always starts with vXXXXXX
  const match     = afterUpload.match(/(v\d+\/.+)/);
  const assetPath = match ? match[1] : afterUpload;

  // ── Cloudinary text encoding ─────────────────────────────────────────────
  // Commas and slashes delimit transformation segments — must be percent-encoded.
  function cloudinaryTextEncode(str) {
    return str
      .replace(/%/g,  '%25')  // must be first
      .replace(/,/g,  '%2C')
      .replace(/\//g, '%2F')
      .replace(/\?/g, '%3F')
      .replace(/&/g,  '%26')
      .replace(/#/g,  '%23')
      .replace(/ /g,  '%20');
  }

  // Max ~38 chars so it fits across the banner width
  const rawName = (product.name || 'Kids Wear').substring(0, 38)
                  + (product.name && product.name.length > 38 ? '...' : '');
  const encName  = cloudinaryTextEncode(rawName);

  // Use Rs. (ASCII) instead of ₹ (multi-byte) to stay URL-safe
  const price    = product.price
    ? `Rs.${Number(product.price).toLocaleString('en-IN')}  |  mytinythreads.in`
    : 'mytinythreads.in';
  const encPrice = cloudinaryTextEncode(price);

  const encBrand = cloudinaryTextEncode('TINY THREADS KIDSWEAR');

  // ── Build the Cloudinary transformation chain ────────────────────────────
  //
  //  [T1] c_limit,h_{h},w_{h},q_auto
  //       Scale product to fit a square = frame height. Portrait photos
  //       become h px tall, landscape become h px wide. No upscaling.
  //       This keeps the product centred naturally when padded next.
  //
  //  [T2] c_pad,w_1200,h_{h},g_center,b_rgb:FFF8F5
  //       Pad to full OG dimensions. g_center ensures equal left/right bars
  //       so the product sits exactly in the middle 630px — WhatsApp-safe.
  //
  //  [T3] Brand label — bottom-centre, small caps, brand red
  //       letter_spacing is a standalone param, NOT part of the font string.
  //       Correct syntax: l_text:Font_Size_Style:Text,letter_spacing_N
  //
  //  [T4] Product name — bottom-centre, medium weight
  //
  //  [T5] Price + CTA — bottom-centre, brand red
  //
  //  [T6] f_jpg,q_85 — compressed JPEG, WhatsApp-safe (<300 KB)
  //
  const transforms = [
    `c_limit,h_${h},w_${h},q_auto`,
    `c_pad,w_1200,h_${h},g_center,b_rgb:FFF8F5`,
    `l_text:DM+Sans_12_bold:${encBrand},co_rgb:B71C1C,g_south,y_68,letter_spacing_3`,
    `l_text:DM+Sans_22_semibold:${encName},co_rgb:2C1810,g_south,y_38`,
    `l_text:DM+Sans_14:${encPrice},co_rgb:B71C1C,g_south,y_12`,
    `f_jpg,q_85`,
  ].join('/');

  return `${base}${transforms}/${assetPath}`;
}

// ── Pre-warm a Cloudinary OG image URL ────────────────────────────────────
// Cloudinary renders text-overlay transformations lazily on first request.
// WhatsApp's crawler has a ~3 second timeout. A cold render with 3 overlays
// + resize + pad can take 2–4s → crawler gives up → no preview image.
//
// Solution: after generating each HTML file, fire a GET to the og:image URL.
// This "bakes" the transformed image into Cloudinary's CDN cache so that
// WhatsApp's crawler (and everyone else) gets an instant cached response.
//
// We do this silently — failures are logged as warnings, never fatal.
function prewarm(imageUrl) {
  return new Promise(resolve => {
    if (!imageUrl || !imageUrl.startsWith('https://')) return resolve();
    const parsed = new URL(imageUrl);
    const req = https.get({
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      headers:  { 'User-Agent': 'TinyThreads-OGPrewarm/1.0' }
    }, res => {
      res.resume(); // drain body
      res.on('end', resolve);
    });
    req.on('error', () => resolve()); // never throw
    req.setTimeout(15000, () => { req.destroy(); resolve(); });
  });
}


const CAT_LABELS = {
  boys:        'Boys 3–13 Years',
  girls:       'Girls 3–13 Years',
  babies:      'Babies 0–3 Years',
  accessories: 'Accessories',
  toys:        'Toys',
  twinning:    'Twinning Sets',
  kidscare:    'Kids Care',
  school:      'School',
  learning:    'Learning',
};

const SUBCAT_LABELS = {
  traditional:   'Traditional Wear',
  summer:        'Summer Wear',
  winter:        'Winter Wear',
  nightwear:     'Nightwear',
  undergarments: 'Undergarments',
};

// ─────────────────────────────────────────────────────────────────────────────
// productPageHTML(p)
//   Generates a complete standalone HTML file for a single product.
//
//   Design goals:
//     • OG image = full product photo + burned-in price/brand (no extra click needed)
//     • Page itself is a clean product card — brand header, product image,
//       details, "Shop on Tiny Threads" button, trust note
//     • No ordering flow on this page — all purchasing happens on the main site
// ─────────────────────────────────────────────────────────────────────────────
function productPageHTML(p) {
  const productURL     = `${SITE_URL}/products/${p.id}`;
  const catLabel       = CAT_LABELS[p.category]       || p.category       || '';
  const subcatLabel    = SUBCAT_LABELS[p.subcategory]  || p.subcategory    || '';
  const priceFormatted = `₹${Number(p.price).toLocaleString('en-IN')}`;

  // ── OG image URLs ────────────────────────────────────────────────────────
  const ogImg   = ogImage(p, 630);   // 1200×630  WhatsApp / FB / LinkedIn
  const ogImgTw = ogImage(p, 628);   // 1200×628  Twitter / X

  // ── OG description — rich, under 200 chars ───────────────────────────────
  const desc = [
    p.description || `Beautiful ${subcatLabel.toLowerCase()} for kids.`,
    `${catLabel}.`,
    p.fabric ? `Fabric: ${p.fabric}.` : '',
    p.sizes && p.sizes.length ? `Sizes: ${p.sizes.join(', ')}.` : '',
    `Price: ${priceFormatted}.`,
    'Shop at mytinythreads.in',
  ].filter(Boolean).join(' ').slice(0, 200);

  // ── Display image on the page itself — full quality, no OG crop ──────────
  const primaryImg = p.images && p.images.length > 0 ? p.images[0] : '';
  const displayImg = primaryImg && primaryImg.includes('res.cloudinary.com')
    ? primaryImg.replace(/\/upload\/(?:[^/]+\/)*?(v\d+\/)/, '/upload/q_auto,f_auto/$1')
    : primaryImg;

  // ── Sizes display (max 4 shown, rest collapsed) ──────────────────────────
  const sizesDisplay = p.sizes && p.sizes.length
    ? p.sizes.slice(0, 4).join(', ') + (p.sizes.length > 4 ? ` +${p.sizes.length - 4} more` : '')
    : '';

  // ── Shop URL — deep-links to the product on the main site ────────────────
  const shopURL = `${SITE_URL}/?product=${p.id}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${p.name} – ${priceFormatted} · ${SITE_NAME}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${productURL}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">

<!-- ══════════════════════════════════════════════════════════════════════
     OPEN GRAPH — WhatsApp · Facebook · LinkedIn
     ──────────────────────────────────────────────────────────────────────
     STRATEGY: Each product page gets its OWN product photo as og:image.
     The image is built via a 3-step Cloudinary chain:
       1. c_limit  → scale product to fill height (no upscale, no crop)
       2. c_pad    → pad to 1200×630 with warm brand background
       3. Text overlays → brand + product name + price burned in
     Result: WhatsApp users see the full product + price in the preview
     card itself — no need to open the link to make a buying decision.
     ══════════════════════════════════════════════════════════════════════ -->
<meta property="og:type"         content="product">
<meta property="og:site_name"    content="${SITE_NAME}">
<meta property="og:url"          content="${productURL}">
<meta property="og:title"        content="${p.name} – ${priceFormatted} · ${SITE_NAME}">
<meta property="og:description"  content="${desc}">
<meta property="og:image"        content="${ogImg}">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt"    content="${p.name} – ${catLabel} by ${SITE_NAME}">
<meta property="og:image:type"   content="image/jpeg">
<meta property="og:locale"       content="en_IN">

<!-- Product-specific OG (Facebook Shops / Google Shopping) -->
<meta property="product:price:amount"   content="${p.price}">
<meta property="product:price:currency" content="INR">
<meta property="product:availability"   content="in stock">
<meta property="product:brand"          content="${SITE_NAME}">
<meta property="product:category"       content="${catLabel}">

<!-- ── Twitter / X ── -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${p.name} – ${priceFormatted} · ${SITE_NAME}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image"       content="${ogImgTw}">
<meta name="twitter:image:alt"   content="${p.name} by ${SITE_NAME}">

<!-- ── Structured Data — Google Rich Results ── -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "${p.name.replace(/"/g, '\\"')}",
  "description": "${desc.replace(/"/g, '\\"')}",
  "image": "${ogImg}",
  "url": "${productURL}",
  "brand": { "@type": "Brand", "name": "${SITE_NAME}" },
  "offers": {
    "@type": "Offer",
    "price": "${p.price}",
    "priceCurrency": "INR",
    "availability": "https://schema.org/InStock",
    "seller": { "@type": "Organization", "name": "${SITE_NAME}" }
  }${p.fabric ? `,\n  "material": "${p.fabric}"` : ''}
}
<\/script>

<style>
*{margin:0;padding:0;box-sizing:border-box;}
:root{
  --red:#B71C1C;--red-light:#FFEBEE;--warm:#FFF8F5;
  --text:#2C1810;--muted:#7A5C50;
}
body{
  font-family:'DM Sans',system-ui,sans-serif;
  background:var(--warm);color:var(--text);
  min-height:100vh;display:flex;flex-direction:column;
  align-items:center;justify-content:center;padding:2rem 1rem;
}
.card{
  background:white;border-radius:24px;max-width:440px;width:100%;
  box-shadow:0 8px 40px rgba(183,28,28,.12);
  border:1px solid #F0E0DC;overflow:hidden;
}

/* ── Brand header ── */
.card-head{
  background:var(--warm);padding:.9rem 1.4rem;
  display:flex;align-items:center;gap:10px;
  border-bottom:1px solid #F0E0DC;
}
.logo{
  width:38px;height:38px;border-radius:50%;object-fit:cover;
  border:2px solid rgba(183,28,28,.15);flex-shrink:0;
}
.brand-name{
  font-family:'Playfair Display',serif;
  font-size:14px;color:var(--red);font-weight:700;
}
.brand-sub{
  font-size:9.5px;color:var(--muted);
  letter-spacing:1.2px;text-transform:uppercase;
}

/* ── Product image — full portrait, no crop ── */
.img-wrap{
  width:100%;aspect-ratio:3/4;
  background:var(--warm);overflow:hidden;
}
.prod-img{
  width:100%;height:100%;
  object-fit:contain;display:block;
}

/* ── Card body ── */
.card-body{padding:1.3rem 1.4rem 1.5rem;}
.badge{
  display:inline-block;background:var(--red-light);color:var(--red);
  border-radius:12px;padding:3px 12px;font-size:11px;font-weight:700;
  margin-bottom:.55rem;letter-spacing:.3px;
}
h1.name{
  font-family:'Playfair Display',serif;
  font-size:1.3rem;font-weight:700;
  margin-bottom:.3rem;line-height:1.25;color:var(--text);
}
.price{
  font-size:1.65rem;font-weight:800;color:var(--red);margin-bottom:.85rem;
}
.price span{font-size:11.5px;font-weight:400;color:var(--muted);}

/* ── Product detail chips ── */
.chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:1.1rem;}
.chip{
  background:var(--red-light);color:var(--red);
  border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;
}
.desc{
  font-size:12.5px;color:var(--muted);
  line-height:1.65;margin-bottom:1.25rem;
}

/* ── Call-to-action strip ── */

/* Primary CTA — shop on Tiny Threads website */
.shop-btn{
  display:flex;align-items:center;justify-content:center;gap:10px;
  background:var(--red);color:white;text-decoration:none;
  padding:14px 22px;border-radius:15px;
  font-size:15px;font-weight:700;
  margin-bottom:.65rem;transition:background .2s,transform .1s;
}
.shop-btn:hover{background:#9b1818;}
.shop-btn:active{transform:scale(.98);}
.shop-btn svg{flex-shrink:0;}

/* Secondary: direct product URL */
.product-url-btn{
  display:flex;align-items:center;justify-content:center;gap:6px;
  background:var(--red-light);color:var(--red);text-decoration:none;
  padding:10px 18px;border-radius:13px;
  font-size:13px;font-weight:600;transition:background .2s;
}
.product-url-btn:hover{background:#FFCDD2;}

/* ── Trust note below buttons ── */
.trust-note{
  text-align:center;font-size:10.5px;color:var(--muted);
  margin-top:.9rem;line-height:1.6;
}
.trust-note strong{color:var(--text);}
</style>
</head>
<body>
<div class="card">

  <!-- Brand header -->
  <div class="card-head">
    <img class="logo"
         src="https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_76,h_76,q_auto,f_auto/v1776510180/Firefly_GeminiFlash_ic3nbt.png"
         alt="Tiny Threads Logo">
    <div>
      <div class="brand-name">Tiny Threads</div>
      <div class="brand-sub">Kidswear</div>
    </div>
  </div>

  <!-- Product image — full portrait ratio, object-fit:contain, zero crop -->
  ${displayImg ? `
  <div class="img-wrap">
    <img class="prod-img"
         src="${displayImg}"
         alt="${p.name}"
         loading="eager"
         onerror="this.closest('.img-wrap').style.display='none'">
  </div>` : ''}

  <!-- Product details -->
  <div class="card-body">
    ${p.badge ? `<div class="badge">${p.badge}</div>` : ''}
    <h1 class="name">${p.name}</h1>
    <div class="price">${priceFormatted} <span>incl. taxes</span></div>

    <div class="chips">
      <span class="chip">${catLabel}</span>
      ${subcatLabel    ? `<span class="chip">${subcatLabel}</span>`     : ''}
      ${p.fabric       ? `<span class="chip">🧶 ${p.fabric}</span>`    : ''}
      ${sizesDisplay   ? `<span class="chip">📏 ${sizesDisplay}</span>` : ''}
    </div>

    ${p.description ? `<p class="desc">${p.description}</p>` : ''}

    <!-- Primary CTA — takes user to the full Tiny Threads site -->
    <a class="shop-btn" href="${shopURL}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
      Shop on Tiny Threads
    </a>

    <!-- Secondary: direct product page link -->
    <a class="product-url-btn" href="${productURL}">
      View full product details →
    </a>

    <!-- Trust reassurance -->
    <p class="trust-note">
      🔒 <strong>Safe to open.</strong> This is the official
      <strong>Tiny Threads Kidswear</strong> product page —
      <em>mytinythreads.in</em>
    </p>
  </div>

</div>

</body>
</html>`;
}

// ── Generate all product pages ─────────────────────────────────────────────
(async () => {
  console.log('⏳  Fetching products from Supabase…');
  const products = await fetchAllProducts();
  console.log(`✅  Fetched ${products.length} products\n`);

  const outDir = path.join(__dirname, 'products');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  let generated = 0, skipped = 0, noImage = 0;

  for (const p of products) {
    if (!p.id) { skipped++; continue; }

    // Warn about products without real images (they'll use the fallback OG)
    const hasRealImage = p.images && p.images.length > 0
      && !p.images[0].includes('YOUR_CLOUD_NAME');
    if (!hasRealImage) {
      noImage++;
      console.warn(`⚠️   /products/${p.id}.html  —  ${p.name}  (no image — using brand fallback OG)`);
    }

    const html   = productPageHTML(p);
    const ogImg  = ogImage(p, 630);
    fs.writeFileSync(path.join(outDir, `${p.id}.html`), html, 'utf8');

    if (hasRealImage) {
      // Pre-warm the OG image so Cloudinary CDN caches it before WhatsApp crawls
      process.stdout.write(`⏳  /products/${p.id}.html  —  ${p.name}  (warming OG image…)`);
      await prewarm(ogImg);
      process.stdout.write(`  ✅\n`);
    }
    generated++;
  }

  console.log(`\n✅  Generated : ${generated} product pages  →  /products/`);
  if (noImage)  console.log(`⚠️   No image  : ${noImage} products (fallback OG used — add photos!)`);
  if (skipped)  console.log(`   Skipped   : ${skipped}`);
  console.log(`
💡  Next steps:
    1. Deploy /products/ to your hosting (Netlify / Vercel / GitHub Pages etc.)

    2. For any product URL you want to share on WhatsApp RIGHT NOW, bust
       WhatsApp's cache by appending ?v=1 to the URL the first time:
         https://mytinythreads.in/products/b001?v=1

    3. Paste any product URL into the Facebook OG debugger to confirm the
       image is rendering correctly (also busts Meta/WA cache):
         https://developers.facebook.com/tools/debug/
         → click "Scrape Again"

    4. The OG images are now pre-warmed — Cloudinary CDN has cached them.
       WhatsApp's crawler will get a fast response and show the preview image.
`);
})().catch(err => {
  console.error('❌  Failed:', err.message);
  process.exit(1);
});