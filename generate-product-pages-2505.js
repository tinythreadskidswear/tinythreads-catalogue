/**
 * generate-product-pages.js
 *
 * BUG-000 FIX: Product image sharing on WhatsApp/Instagram/Twitter
 *
 * ROOT CAUSE of broken previews:
 *   OLD: c_pad,w_1200,h_630,b_rgb:FFF8F5,g_north → PADS with background (product appears small)
 *   FIX: c_fill,w_1200,h_630,g_north → FILLS the frame so product is large and prominent
 *        anchored at top so face/head is always visible
 *
 * Platform requirements:
 *   WhatsApp  → og:image 1200×630 (landscape), min 200×200, under 300KB
 *   Facebook  → og:image 1200×630, summary_large_image
 *   Twitter/X → twitter:card summary_large_image, 1200×628
 *   Instagram → does not scrape URLs (shares via native app)
 *   LinkedIn  → og:image 1200×627
 *
 * Run: node generate-product-pages.js
 * Output: /products/[id].html  (one per product)
 */

const fs   = require('fs');
const path = require('path');

// ── Load products ──────────────────────────────────────────────────────────
const { products } = JSON.parse(fs.readFileSync('products.json', 'utf8'));

const SITE_URL   = 'https://mytinythreads.in';
const SITE_NAME  = 'Tiny Threads Kidswear';
const WA_NUMBER  = '917879976016';
const FALLBACK_IMG = 'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_1200,h_630,q_auto,f_jpg/v1776510180/Firefly_GeminiFlash_ic3nbt.png';

// ── Cloudinary transform helpers ──────────────────────────────────────────
/**
 * Use c_fill (not c_pad) so product fills the full preview frame on WhatsApp.
 * g_north = anchor at top so head/face is always visible.
 */
function ogImage(url, w = 1200, h = 630) {
  if (!url || url.includes('YOUR_CLOUD_NAME')) return FALLBACK_IMG;
  if (!url.includes('res.cloudinary.com')) return url;
  return url.replace(
    '/upload/',
    `/upload/c_fill,w_${w},h_${h},g_north,q_auto,f_jpg/`
  );
}

// ── Category labels ────────────────────────────────────────────────────────
const CAT_LABELS = {
  boys: 'Boys 3–13 Years', girls: 'Girls 3–13 Years',
  babies: 'Babies 0–3 Years', accessories: 'Accessories',
  toys: 'Toys', twinning: 'Twinning Sets',
  kidscare: 'Kids Care', school: 'School',
  learning: 'Learning',
};

const SUBCAT_LABELS = {
  traditional: 'Traditional Wear', summer: 'Summer Wear',
  winter: 'Winter Wear', nightwear: 'Nightwear',
  undergarments: 'Undergarments',
};

// ── Per-product HTML template ──────────────────────────────────────────────
function productPageHTML(p) {
  const primaryImg    = p.images && p.images.length > 0 ? p.images[0] : '';
  const ogImg1200x630 = ogImage(primaryImg, 1200, 630);   // WhatsApp / FB / LinkedIn
  const ogImg1200x628 = ogImage(primaryImg, 1200, 628);   // Twitter
  const ogImgSquare   = ogImage(primaryImg, 1200, 1200);  // General square fallback
  const productURL    = `${SITE_URL}/products/${p.id}`;
  const catLabel      = CAT_LABELS[p.category] || p.category;
  const subcatLabel   = SUBCAT_LABELS[p.subcategory] || p.subcategory || '';
  const priceFormatted = `₹${Number(p.price).toLocaleString('en-IN')}`;

  // Rich description for OG
  const desc = [
    p.description || `Beautiful ${subcatLabel.toLowerCase()} for kids.`,
    `${catLabel}.`,
    p.fabric ? `Fabric: ${p.fabric}.` : '',
    p.sizes && p.sizes.length ? `Sizes: ${p.sizes.join(', ')}.` : '',
    `Price: ${priceFormatted}.`,
    'Order via WhatsApp!',
  ].filter(Boolean).join(' ').slice(0, 200);

  // WhatsApp enquiry message pre-filled
  const waMsg = encodeURIComponent(
    `Hi Tiny Threads! 👋 I'm interested in *${p.name}* (${priceFormatted}).\n\nProduct: ${productURL}\n\nPlease share availability and sizes.`
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${p.name} – ${priceFormatted} · ${SITE_NAME}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${productURL}">

<!-- ── Preconnect for performance ── -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- ══════════════════════════════════════════════════════
     Open Graph — product image fills preview frame (c_fill, g_north)
     ══════════════════════════════════════════════════════ -->
<!-- Primary OG (WhatsApp, Facebook, LinkedIn) -->
<meta property="og:type"         content="product">
<meta property="og:site_name"    content="${SITE_NAME}">
<meta property="og:url"          content="${productURL}">
<meta property="og:title"        content="${p.name} – ${priceFormatted} · ${SITE_NAME}">
<meta property="og:description"  content="${desc}">
<meta property="og:image"        content="${ogImg1200x630}">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt"    content="${p.name} – ${catLabel} by Tiny Threads Kidswear">
<meta property="og:image:type"   content="image/jpeg">
<meta property="og:locale"       content="en_IN">
<!-- Product-specific OG (Facebook Shops, Google Shopping) -->
<meta property="product:price:amount"   content="${p.price}">
<meta property="product:price:currency" content="INR">
<meta property="product:availability"   content="in stock">
<meta property="product:brand"          content="${SITE_NAME}">
<meta property="product:category"       content="${catLabel}">

<!-- ── Twitter / X Card ── -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${p.name} – ${priceFormatted} · ${SITE_NAME}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image"       content="${ogImg1200x628}">
<meta name="twitter:image:alt"   content="${p.name} by ${SITE_NAME}">

<!-- ── Structured Data (Google Rich Results) ── -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "${p.name.replace(/"/g, '\\"')}",
  "description": "${desc.replace(/"/g, '\\"')}",
  "image": "${ogImg1200x630}",
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
</script>

<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:system-ui,sans-serif;background:#FFF8F5;color:#2C1810;
       display:flex;flex-direction:column;min-height:100vh;align-items:center;
       justify-content:center;padding:2rem 1rem;text-align:center;}
  .card{background:white;border-radius:20px;padding:2rem;max-width:480px;width:100%;
        box-shadow:0 8px 40px rgba(183,28,28,.1);border:1px solid #F0E0DC;}
  .logo{width:56px;height:56px;border-radius:50%;margin:0 auto 1rem;display:block;
        object-fit:cover;border:2px solid rgba(183,28,28,.15);}
  .brand{font-size:12px;color:#7A5C50;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:1.5rem;}
  .prod-img{width:100%;height:auto;object-fit:contain;border-radius:12px;
            background:#FFF8F5;margin-bottom:1.2rem;display:block;}
  .name{font-size:1.4rem;font-weight:700;margin-bottom:.4rem;line-height:1.25;}
  .price{font-size:1.8rem;font-weight:800;color:#B71C1C;margin-bottom:.6rem;}
  .desc{font-size:13px;color:#7A5C50;line-height:1.65;margin-bottom:1.4rem;}
  .wa-btn{display:inline-flex;align-items:center;gap:10px;background:#25D366;color:white;
          text-decoration:none;padding:14px 28px;border-radius:30px;font-size:15px;
          font-weight:600;width:100%;justify-content:center;margin-bottom:.8rem;}
  .back-btn{display:inline-flex;align-items:center;gap:6px;background:#FFEBEE;color:#B71C1C;
            text-decoration:none;padding:11px 22px;border-radius:25px;font-size:13px;
            font-weight:600;width:100%;justify-content:center;}
  .chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:1.2rem;}
  .chip{background:#FFEBEE;color:#B71C1C;border-radius:20px;padding:4px 12px;
        font-size:11px;font-weight:600;}
</style>
</head>
<body>
<div class="card">
  <img class="logo"
       src="https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_112,h_112,q_auto,f_auto/v1776510180/Firefly_GeminiFlash_ic3nbt.png"
       alt="Tiny Threads Logo">
  <div class="brand">Tiny Threads Kidswear</div>

  ${primaryImg ? `<img class="prod-img"
       src="https://res.cloudinary.com/tinythreads/image/upload/q_auto,f_auto/${primaryImg.split('/upload/').pop()}"
       alt="${p.name}" onerror="this.style.display='none'">` : ''}

  <h1 class="name">${p.name}</h1>
  <div class="price">${priceFormatted} <span style="font-size:13px;font-weight:400;color:#7A5C50;">incl. taxes</span></div>

  <div class="chips">
    <span class="chip">${catLabel}</span>
    ${subcatLabel ? `<span class="chip">${subcatLabel}</span>` : ''}
    ${p.fabric ? `<span class="chip">🧶 ${p.fabric}</span>` : ''}
  </div>

  ${p.description ? `<p class="desc">${p.description}</p>` : ''}

  <a class="wa-btn"
     href="https://wa.me/${WA_NUMBER}?text=${waMsg}"
     target="_blank" rel="noopener">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    Order on WhatsApp
  </a>
  <a class="back-btn" href="${SITE_URL}/?product=${p.id}">
    ← View on Tiny Threads
  </a>
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
  const file = path.join(outDir, `${p.id}.html`);
  fs.writeFileSync(file, html, 'utf8');
  generated++;
  console.log(`✅  /products/${p.id}.html  (${p.name}, ₹${p.price})`);
});

console.log(`\n✅  Generated ${generated} product pages → /products/`);
console.log(`   Skipped: ${skipped}`);
console.log(`\nBUG-000 FIX APPLIED:`);
console.log(`   og:image now uses c_fill,g_north (product fills preview frame, head always visible)`);
console.log(`   Background: b_rgb:FFF8F5 (warm white matching site)`);
console.log(`   Anchor: g_north (head/face always visible)`);
console.log(`   Sizes: 1200×630 (WhatsApp/FB), 1200×628 (Twitter)`);
console.log(`   Added product:price, product:availability OG tags`);
console.log(`   Added JSON-LD structured data for Google Rich Results`);