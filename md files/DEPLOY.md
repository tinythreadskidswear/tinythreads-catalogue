# Tiny Threads Kidswear — Cloudflare Workers Deployment Guide
## mytinythreads.in

---

## 🚀 Deployment Setup

### Prerequisites

1. **Cloudflare Account** with domain `mytinythreads.in` configured
2. **Wrangler CLI** installed: `npm install -g wrangler`
3. **Supabase Project** with products table populated
4. **GitHub Repository** with this code

### One-Time Setup

1. **Configure Wrangler**:
   ```bash
   npx wrangler login
   ```
   This authenticates your Cloudflare account.

2. **Set Supabase Credentials**:
   ```bash
   npx wrangler secret put SUPABASE_URL
   # Paste: https://gtszuhmfpywqwdetoqqo.supabase.co
   
   npx wrangler secret put SUPABASE_SERVICE_KEY
   # Paste your Supabase service key
   ```

3. **Deploy Worker**:
   ```bash
   npx wrangler deploy
   ```
   Worker is now live at your Cloudflare domain!

### Ongoing Deployments

```bash
git add .
git commit -m "Update products / fix bug"
git push origin main
npx wrangler deploy
```

---

## 🔗 How WhatsApp Previews Work

When you share a product link on WhatsApp:

```
https://mytinythreads.in/products/b001
```

**Request Flow**:
1. WhatsApp bot requests: `/products/b001`
2. Cloudflare Worker intercepts request
3. Detects crawler user-agent
4. Fetches product data from Supabase
5. Generates OG HTML with Cloudinary preview image
6. Returns to WhatsApp bot (cached for 1 hour)

**Result**: Rich preview appears instantly on WhatsApp

```
┌─────────────────────────────────────┐
│  [Product Image — 1200×630]         │
│                                     │
│  Cotton Kurta Set – ₹899            │
│  Tiny Threads Kidswear              │
│  Soft breathable cotton kurta…      │
└─────────────────────────────────────┘
```

**Regular Users**: Clicking the link redirects to the main SPA (`/#product=b001`) for full interactivity.

---

## 🛍️ Adding New Products

1. **Add to Supabase `products` table**:
   ```sql
   INSERT INTO products (id, name, category, price, images, ...) 
   VALUES ('b050', 'New Product', 'boys', 599, [...], ...);
   ```

2. **Deploy** (if you changed Worker code):
   ```bash
   npx wrangler deploy
   ```

3. **Product appears immediately** — Cloudflare Worker fetches fresh data on every request

---

## 🧪 Testing OG Previews

Use Facebook's Sharing Debugger (works for WhatsApp too):

👉 https://developers.facebook.com/tools/debug/

Paste any product URL, e.g.:
```
https://mytinythreads.in/products/b003
```

Click **"Scrape Again"** to force a fresh preview fetch.

---

## ✅ Performance & Caching

| Asset | Cache Location | TTL |
|---|---|
| Pretty URLs | `/products/b001` serves `b001.html` — no `.html` in links |
| Old link redirect | `/?product=b001` → `/products/b001` (301 permanent) |
| SPA fallback | All unknown paths → `index.html` (keeps navigation working) |
| Cache headers | Product pages: 1hr cache. `index.html`: no cache (always fresh). Assets: 1yr |
| Security headers | X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
