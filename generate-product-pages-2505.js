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
 * Solution: TWO-STEP Cloudinary chain:
 *
 *   Step 1 → c_limit,h_630,w_630,q_auto
 *     Scales the image so it fits inside a 630×630 box, preserving aspect ratio.
 *     c_limit = only shrink, never enlarge (no blurry upscaling).
 *     For a portrait image this results in: width < 630, height = 630.
 *     The product now fills the FULL HEIGHT of the OG banner.
 *
 *   Step 2 → c_pad,w_1200,h_630,b_rgb:FFF8F5
 *     Takes the already-scaled image and pads it to 1200×630.
 *     Since the image already fills 630px tall, padding only appears
 *     on LEFT and RIGHT as narrow warm-white columns.
 *     Background colour #FFF8F5 matches the Tiny Threads site.
 *
 *   Step 3 → f_jpg,q_85
 *     Output as compressed JPEG. WhatsApp requires images under 300KB.
 *     q_85 balances quality vs file size perfectly for product photos.
 *
 * Result: Product is as LARGE as physically possible within the OG frame.
 *         Zero cropping. Full outfit/item visible. Brand-coloured padding only.
 *
 * Why strip existing transforms from the URL?
 *   Product image URLs in products.json sometimes already contain Cloudinary
 *   transforms (e.g. c_fill,w_600). Applying our chain ON TOP of those
 *   transforms gives double-transform artifacts. We strip to the original
 *   asset (version token v1234567/...) before applying our chain.
 *
 * Run:    node generate-product-pages.js
 * Output: /products/[id].html  (one static HTML file per product)
 */

const fs   = require('fs');
const path = require('path');

const { products } = JSON.parse(fs.readFileSync('products.json', 'utf8'));

const SITE_URL     = 'https://mytinythreads.in';
const SITE_NAME    = 'Tiny Threads Kidswear';
const WA_NUMBER    = '917879976016';
const FALLBACK_IMG = 'https://res.cloudinary.com/tinythreads/image/upload/c_limit,h_630,w_630,q_auto/c_pad,w_1200,h_630,b_rgb:FFF8F5/f_jpg,q_85/v1776510180/Firefly_GeminiFlash_ic3nbt.png';

// ─────────────────────────────────────────────────────────────────────────────
// ogImage(url, h)
//   Builds a Cloudinary URL that shows the FULL product at MAXIMUM SIZE
//   within the OG banner dimensions — no cropping, ever.
//
//   h = 630  → WhatsApp, Facebook, LinkedIn  (1200 × 630)
//   h = 628  → Twitter / X                   (1200 × 628)
// ─────────────────────────────────────────────────────────────────────────────
function ogImage(url, h = 630) {
  if (!url || url.includes('YOUR_CLOUD_NAME')) return FALLBACK_IMG;
  if (!url.includes('res.cloudinary.com')) return url;

  const uploadIdx = url.indexOf('/upload/');
  if (uploadIdx === -1) return url;

  const afterUpload = url.slice(uploadIdx + 8); // everything after "/upload/"
  const base        = url.slice(0, uploadIdx + 8); // up to and including "/upload/"

  // Strip old transforms: real asset always starts with version token vXXXXXX
  // e.g. "c_fill,w_900/v1234567/folder/img.jpg" → we want "v1234567/folder/img.jpg"
  const match     = afterUpload.match(/(v\d+\/.+)/);
  const assetPath = match ? match[1] : afterUpload; // fallback: use as-is if no version

  // Two-step chain: scale tall → pad wide
  return `${base}c_limit,h_${h},w_${h},q_auto/c_pad,w_1200,h_${h},b_rgb:FFF8F5/f_jpg,q_85/${assetPath}`;
}

// ─────────────────────────────────────────────────────────────────────────────
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
function productPageHTML(p) {
  const primaryImg  = p.images && p.images.length > 0 ? p.images[0] : '';
  const ogImg       = ogImage(primaryImg, 630);   // 1200×630  WhatsApp / FB / LinkedIn
  const ogImgTw     = ogImage(primaryImg, 628);   // 1200×628  Twitter / X
  const productURL  = `${SITE_URL}/products/${p.id}`;
  const catLabel    = CAT_LABELS[p.category]    || p.category    || '';
  const subcatLabel = SUBCAT_LABELS[p.subcategory] || p.subcategory || '';
  const priceFormatted = `₹${Number(p.price).toLocaleString('en-IN')}`;

  // OG description — rich, under 200 chars
  const desc = [
    p.description || `Beautiful ${subcatLabel.toLowerCase()} for kids.`,
    `${catLabel}.`,
    p.fabric ? `Fabric: ${p.fabric}.` : '',
    p.sizes && p.sizes.length ? `Sizes: ${p.sizes.join(', ')}.` : '',
    `Price: ${priceFormatted}.`,
    'Order via WhatsApp!',
  ].filter(Boolean).join(' ').slice(0, 200);

  // Pre-filled WhatsApp message
  const waMsg = encodeURIComponent(
    `Hi Tiny Threads! 👋 I'm interested in *${p.name}* (${priceFormatted}).\n\nProduct: ${productURL}\n\nPlease share availability and sizes.`
  );

  // Page display image — original quality, no OG crop
  const displayImg = primaryImg
    ? primaryImg.replace(/\/upload\/(?:[^/]+\/)*?(v\d+\/)/, '/upload/q_auto,f_auto/$1')
    : '';

  const sizesDisplay = p.sizes && p.sizes.length
    ? p.sizes.slice(0, 4).join(', ') + (p.sizes.length > 4 ? ` +${p.sizes.length - 4} more` : '')
    : '';

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

<!-- ══════════════════════════════════════════════════════════════
     OPEN GRAPH  —  WhatsApp · Facebook · LinkedIn
     Strategy: c_limit (scale to full height) + c_pad (add side bars)
     Product fills 630px tall. Only narrow padding on sides. No crop.
     ══════════════════════════════════════════════════════════════ -->
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
<!-- Product-specific (Facebook Shops / Google Shopping) -->
<meta property="product:price:amount"   content="${p.price}">
<meta property="product:price:currency" content="INR">
<meta property="product:availability"   content="in stock">
<meta property="product:brand"          content="${SITE_NAME}">
<meta property="product:category"       content="${catLabel}">

<!-- ══ Twitter / X ══ -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${p.name} – ${priceFormatted} · ${SITE_NAME}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image"       content="${ogImgTw}">
<meta name="twitter:image:alt"   content="${p.name} by ${SITE_NAME}">

<!-- ══ Structured Data — Google Rich Results ══ -->
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
:root{--red:#B71C1C;--red-light:#FFEBEE;--warm:#FFF8F5;--text:#2C1810;--muted:#7A5C50;}
body{font-family:'DM Sans',system-ui,sans-serif;background:var(--warm);color:var(--text);
     min-height:100vh;display:flex;flex-direction:column;align-items:center;
     justify-content:center;padding:2rem 1rem;}
.card{background:white;border-radius:24px;max-width:420px;width:100%;
      box-shadow:0 8px 40px rgba(183,28,28,.12);border:1px solid #F0E0DC;overflow:hidden;}
/* Header */
.card-head{background:var(--warm);padding:.9rem 1.4rem;display:flex;align-items:center;
           gap:10px;border-bottom:1px solid #F0E0DC;}
.logo{width:38px;height:38px;border-radius:50%;object-fit:cover;
      border:2px solid rgba(183,28,28,.15);flex-shrink:0;}
.brand-name{font-family:'Playfair Display',serif;font-size:14px;color:var(--red);font-weight:700;}
.brand-sub{font-size:9.5px;color:var(--muted);letter-spacing:1.2px;text-transform:uppercase;}
/* Product image — full portrait, no crop */
.img-wrap{width:100%;aspect-ratio:3/4;background:var(--warm);overflow:hidden;position:relative;}
.prod-img{width:100%;height:100%;object-fit:contain;display:block;}
/* Body */
.card-body{padding:1.3rem 1.4rem 1.5rem;}
.badge{display:inline-block;background:var(--red-light);color:var(--red);
       border-radius:12px;padding:3px 12px;font-size:11px;font-weight:700;
       margin-bottom:.55rem;letter-spacing:.3px;}
h1.name{font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:700;
        margin-bottom:.3rem;line-height:1.25;color:var(--text);}
.price{font-size:1.65rem;font-weight:800;color:var(--red);margin-bottom:.85rem;}
.price span{font-size:11.5px;font-weight:400;color:var(--muted);}
.chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:1.1rem;}
.chip{background:var(--red-light);color:var(--red);border-radius:20px;
      padding:4px 12px;font-size:11px;font-weight:600;}
.desc{font-size:12.5px;color:var(--muted);line-height:1.65;margin-bottom:1.25rem;}
/* Buttons */
.wa-btn{display:flex;align-items:center;justify-content:center;gap:9px;
        background:#25D366;color:white;text-decoration:none;
        padding:13px 22px;border-radius:15px;font-size:14.5px;font-weight:700;
        margin-bottom:.65rem;transition:background .2s;}
.wa-btn:hover{background:#20ba5c;}
.back-btn{display:flex;align-items:center;justify-content:center;gap:6px;
          background:var(--red-light);color:var(--red);text-decoration:none;
          padding:10px 18px;border-radius:13px;font-size:13px;font-weight:600;
          transition:background .2s;}
.back-btn:hover{background:#FFCDD2;}
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

  <!-- Product image — shown at full portrait ratio, object-fit:contain, no crop -->
  ${displayImg ? `
  <div class="img-wrap">
    <img class="prod-img"
         src="${displayImg}"
         alt="${p.name}"
         loading="eager"
         onerror="this.closest('.img-wrap').style.display='none'">
  </div>` : ''}

  <!-- Product info -->
  <div class="card-body">
    ${p.badge ? `<div class="badge">${p.badge}</div>` : ''}
    <h1 class="name">${p.name}</h1>
    <div class="price">${priceFormatted} <span>incl. taxes</span></div>

    <div class="chips">
      <span class="chip">${catLabel}</span>
      ${subcatLabel ? `<span class="chip">${subcatLabel}</span>` : ''}
      ${p.fabric  ? `<span class="chip">🧶 ${p.fabric}</span>` : ''}
      ${sizesDisplay ? `<span class="chip">📏 ${sizesDisplay}</span>` : ''}
    </div>

    ${p.description ? `<p class="desc">${p.description}</p>` : ''}

    <a class="wa-btn"
       href="https://wa.me/${WA_NUMBER}?text=${waMsg}"
       target="_blank" rel="noopener">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      Order on WhatsApp
    </a>

    <a class="back-btn" href="${SITE_URL}/?product=${p.id}">
      ← View full details on Tiny Threads
    </a>
  </div>

</div>
</body>
</html>`;
}

// ── Generate all product pages ─────────────────────────────────────────────
const outDir = path.join(__dirname, 'products');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let generated = 0, skipped = 0;

products.forEach(p => {
  if (!p.id) { skipped++; return; }
  const html = productPageHTML(p);
  fs.writeFileSync(path.join(outDir, `${p.id}.html`), html, 'utf8');
  console.log(`✅  /products/${p.id}.html  —  ${p.name}  (₹${p.price})`);
  generated++;
});

console.log(`\n✅  Generated : ${generated} product pages  →  /products/`);
console.log(`   Skipped   : ${skipped}`);
console.log(`\nOG IMAGE — c_limit + c_pad two-step chain:`);
console.log(`   Step 1  c_limit,h_630,w_630   → scales portrait to fill full 630px height`);
console.log(`   Step 2  c_pad,w_1200,h_630    → pads LEFT+RIGHT only (warm white #FFF8F5)`);
console.log(`   Step 3  f_jpg,q_85            → compressed JPEG, well under 300KB`);
console.log(`   Result  product is as large as possible, zero cropping, full outfit visible`);