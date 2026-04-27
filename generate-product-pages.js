/**
 * Tiny Threads — Product OG Page Generator
 * ─────────────────────────────────────────
 * Run: node generate-product-pages.js
 *
 * Reads products.json and writes one static HTML file per product
 * into the /products/ folder. Each file has full Open Graph meta tags
 * so WhatsApp, Facebook etc. show a proper preview when the link is shared.
 *
 * After running, upload the entire /products/ folder to your hosting
 * alongside index.html.
 */

const fs   = require('fs');
const path = require('path');

const SITE    = 'https://mytinythreads.in';
const LOGO_OG = 'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_1200,h_630,g_center,q_auto,f_jpg/v1776510180/Firefly_GeminiFlash_ic3nbt.png';

// ── Load products ──────────────────────────────────────────────────────────
const data     = JSON.parse(fs.readFileSync('products.json', 'utf8'));
const products = data.products;

// ── Output directory ────────────────────────────────────────────────────────
const outDir = path.join(__dirname, 'products');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

// ── Helpers ─────────────────────────────────────────────────────────────────
function ogImage(p) {
  const img = (p.images && p.images.length > 0) ? p.images[0] : LOGO_OG;
  if (img.includes('res.cloudinary.com')) {
    return img.replace('/upload/', '/upload/c_fill,w_1200,h_630,g_north,q_auto,f_jpg/');
  }
  return img;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const CAT_LABELS = { boys: 'Boys', girls: 'Girls', babies: 'Babies',
  accessories: 'Accessories', toys: 'Toys', twinning: 'Twinning',
  kidscare: 'Kids Care', school: 'School', learning: 'Learning' };

function makePage(p) {
  const pid     = p.id;
  const name    = esc(p.name);
  const desc    = esc(p.description || 'Beautiful kidswear from Tiny Threads.');
  const price   = p.price;
  const cat     = CAT_LABELS[p.category] || 'Kids';
  const img     = ogImage(p);
  const pageUrl = `${SITE}/products/${pid}`;       // clean URL — Netlify Pretty URLs serves .html
  const destUrl = `${SITE}/index.html?product=${pid}`;
  const title   = esc(`${p.name} – ₹${price} | Tiny Threads Kidswear`);
  const ogDesc  = esc(`${p.description || ''} ${cat}'s ${p.subcategory} wear. Only ₹${price}. Order via WhatsApp!`);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${ogDesc}">

<!-- Open Graph – WhatsApp / Facebook / LinkedIn -->
<meta property="og:type"        content="product">
<meta property="og:site_name"   content="Tiny Threads Kidswear">
<meta property="og:url"         content="${pageUrl}">
<meta property="og:title"       content="${title}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:image"       content="${img}">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt"   content="${name} – Tiny Threads Kidswear">
<meta property="og:locale"      content="en_IN">
<meta property="product:price:amount"   content="${price}">
<meta property="product:price:currency" content="INR">

<!-- Twitter / X Card -->
<meta name="twitter:card"        content="summary_large_image">
<meta name="twitter:title"       content="${title}">
<meta name="twitter:description" content="${ogDesc}">
<meta name="twitter:image"       content="${img}">

<!-- Instant redirect – bots read meta above, humans go straight to the product -->
<meta http-equiv="refresh" content="0; url=${destUrl}">
<link rel="canonical" href="${pageUrl}">
<script>window.location.replace("${destUrl}");</script>
</head>
<body style="font-family:sans-serif;text-align:center;padding:60px 20px;background:#FFF8F5;color:#2C1810;">
  <img src="https://res.cloudinary.com/tinythreads/image/upload/v1776510180/Firefly_GeminiFlash_ic3nbt.png"
       alt="Tiny Threads" style="width:72px;height:72px;border-radius:50%;margin-bottom:16px;display:block;margin-left:auto;margin-right:auto;">
  <h1 style="font-size:1.3rem;color:#B71C1C;margin-bottom:6px;">${name}</h1>
  <p style="color:#7A5C50;margin:0 0 4px;">&#8377;${price} &middot; Tiny Threads Kidswear</p>
  <p style="color:#aaa;font-size:12px;">Redirecting to product page&hellip;</p>
  <a href="${destUrl}"
     style="display:inline-block;margin-top:22px;background:#B71C1C;color:white;padding:12px 28px;border-radius:25px;text-decoration:none;font-weight:600;font-size:14px;">
    View Product &rarr;
  </a>
</body>
</html>`;
}

// ── Generate ────────────────────────────────────────────────────────────────
let count = 0;
for (const p of products) {
  const filePath = path.join(outDir, `${p.id}.html`);
  fs.writeFileSync(filePath, makePage(p), 'utf8');
  console.log(`  ✓ products/${p.id}.html  →  ${p.name} (₹${p.price})`);
  count++;
}

console.log(`\n✅ Generated ${count} product pages in /products/`);
console.log(`\n📤 Upload steps:`);
console.log(`   1. Upload the /products/ folder to your hosting root`);
console.log(`   2. Upload index.html (updated with new OG tags)`);
console.log(`   3. Test with: https://developers.facebook.com/tools/debug/`);
console.log(`      Paste: https://mytinythreads.in/products/b001.html`);