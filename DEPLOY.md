# Tiny Threads Kidswear — Netlify Deployment Guide
## mytinythreads.in

---

## 📁 File Structure to Upload

```
your-repo/
├── index.html                  ← main catalogue (updated with OG tags)
├── products.json               ← product data
├── netlify.toml                ← Netlify config (headers, redirects, pretty URLs)
├── generate-product-pages.js   ← run this when products change
└── products/
    ├── b001.html               ← Cotton Kurta Set OG page
    ├── b002.html               ← Linen Shorts + Tee OG page
    ├── b003.html               ← Hooded Sweatshirt OG page
    ├── ...                     ← one file per product (25 total)
    └── bb006.html
```

---

## 🚀 First-Time Deploy to Netlify

### Option A — Drag & Drop (fastest)
1. Go to [app.netlify.com](https://app.netlify.com)
2. Drag your **entire project folder** onto the deploy area
3. Netlify will auto-detect `netlify.toml` and apply all settings
4. Set your custom domain to `mytinythreads.in` in Site Settings → Domain Management

### Option B — Git (recommended for ongoing updates)
1. Push your project to a GitHub / GitLab repo
2. In Netlify: **Add new site → Import from Git**
3. Select your repo — Netlify reads `netlify.toml` automatically
4. Every `git push` auto-deploys the site

---

## 🔗 How WhatsApp Previews Now Work

When you share a product link on WhatsApp:

```
https://mytinythreads.in/products/b001
```

WhatsApp's bot reads the static `/products/b001.html` file,
finds the Open Graph tags, and generates a rich preview:

```
┌─────────────────────────────────────┐
│  [Product Image — 1200×630]         │
│                                     │
│  Cotton Kurta Set – ₹899            │
│  Tiny Threads Kidswear              │
│  Soft breathable cotton kurta…      │
└─────────────────────────────────────┘
```

Real users clicking the link are **instantly redirected** to the
product detail page in the main catalogue — they never see the
intermediate OG page.

---

## 🛍️ Adding New Products

Whenever you add products to `products.json`:

```bash
node generate-product-pages.js
```

This regenerates all files in `/products/`. Then redeploy:
- **Drag & drop**: re-drag the folder to Netlify
- **Git**: `git add products/ && git commit -m "Add new products" && git push`

---

## 🧪 Testing Previews Before Sharing

Use Facebook's Sharing Debugger (works for WhatsApp too):

👉 https://developers.facebook.com/tools/debug/

Paste any product URL, e.g.:
```
https://mytinythreads.in/products/b003
```

Click **"Scrape Again"** to force a fresh preview fetch.

---

## ✅ What's Configured in netlify.toml

| Feature | Detail |
|---|---|
| Pretty URLs | `/products/b001` serves `b001.html` — no `.html` in links |
| Old link redirect | `/?product=b001` → `/products/b001` (301 permanent) |
| SPA fallback | All unknown paths → `index.html` (keeps navigation working) |
| Cache headers | Product pages: 1hr cache. `index.html`: no cache (always fresh). Assets: 1yr |
| Security headers | X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
