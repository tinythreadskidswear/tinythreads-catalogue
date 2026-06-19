# Claude.md – Tinythreads Kidswear Catalogue – Complete Codebase Review

**Last Updated**: June 14, 2026  
**Repository**: https://github.com/tinythreadskidswear/tinythreads-catalogue  
**Current Branch**: `promocode` (working branch)  
**Production**: `main`  
**Live Site**: https://mytinythreads.in  
**Deployment**: Cloudflare Workers (primary) | No Netlify dependency

---

## 1. Project Overview

**Tinythreads Kidswear** is a mobile-first, static e-commerce catalogue for kidswear built specifically for WhatsApp social commerce. The project features:

- **Single-page application (SPA)** built with vanilla JavaScript (no frameworks)
- **2500+ lines of inline CSS + JavaScript** in `index.html`
- **105+ products** sourced exclusively from **Supabase PostgreSQL database**
- **Social commerce integration** with dynamic Open Graph (OG) tags for WhatsApp/Facebook previews
- **Cloudflare Workers + Supabase** backend for dynamic product data & OG image generation
- **Edge deployment** via Cloudflare Workers (no Netlify)
- **Mobile-first design** optimized for 6.5" Android (412×915px viewport)
- **WhatsApp checkout** integration – direct messaging links to WhatsApp (+91 7879976016)

---

## 2. Tech Stack

### Core Technologies
| Component | Technology | Details |
|-----------|-----------|---------|
| **Frontend** | Vanilla JavaScript (ES6+) | No frameworks; direct DOM manipulation |
| **Styling** | Inline CSS + CSS Variables | All in `<style>` tag; Design System variables |
| **Layout** | CSS Grid + Flexbox | Mobile-first, single breakpoint (`max-width: 700px`) |
| **Data** | Supabase (PostgreSQL) | Central product database; 105+ kidswear items (primary source) |
| **Images** | Cloudinary (CDN) | Transform URLs for responsive images; auto-quality (`q_auto`) |
| **Carousels** | Swiper.js v11 | Hero carousel, category showcases, recently viewed |
| **Fonts** | Google Fonts | Playfair Display (display), DM Sans (body) |
| **Deployment** | Cloudflare Workers | Edge deployment; global CDN; dynamic OG generation |
| **Backend** | Supabase + Cloudflare Workers | Product data + Dynamic OG image generation + splash screen CMS |
| **Testing** | Playwright | E2E tests at 5", 6.5", 6.7" viewports |

### External Services
- **Cloudinary**: Image hosting & Cloudinary transforms (OG previews, responsive images)
- **Supabase**: PostgreSQL database (products, splash screens) — PRIMARY DATA SOURCE
- **Cloudflare Workers**: Edge deployment, dynamic OG generation, routing, caching
- **Google Fonts**: Font delivery network

---

## 3. Project Structure & Architecture

### Directory Structure
```
tinythreads-catalogue/
├── index.html                          # Main SPA – 2500+ lines (all CSS + JS inline)
│                                       # Loads products from Supabase (primary)
│
├── sql/                                # Supabase schema & seed data
│   ├── 01_create_splash_screens_table.sql
│   ├── 02_create_products_table.sql
│   └── 03_seed_products.sql
│
├── wrangler.jsonc                      # Cloudflare Workers config (PRIMARY DEPLOYMENT)
├── _worker.js                          # Cloudflare Worker (dynamic OG generation + routing)
│
├── tinythreads.properties              # Feature flags & app configuration
├── supabase-splash.js                  # Splash screen loader (Supabase integration)
│
├── package.json                        # Dev dependencies (Playwright)
├── test-supabase-load.spec.js          # Playwright E2E tests
│
├── products/                           # DEPRECATED – generated dynamically by Worker
│   └── .gitkeep
│
├── README.md                           # Quick start guide
├── DEPLOY.md                           # Deployment & Cloudflare Workers guide
├── OPTIMIZATION_REPORT.md              # Mobile UX optimizations & testing results
├── AGENTS.md                           # AI Agent guide (Copilot, Claude, etc.)
├── SUPABASE_SETUP_GUIDE.md             # Supabase database setup
├── TEST_GUIDE.md                       # Testing & QA guide
└── Claude.md                           # This file – complete codebase review
```

**Note**: `products.json` and `netlify.toml` are no longer required. All product data flows from Supabase.

### Page Architecture (HTML Structure)

The `index.html` contains a multi-page SPA with the following structure:

```html
<body>
  <!-- SPLASH SCREEN (first load only) -->
  <div id="splash-container">...</div>

  <!-- MAIN NAV (sticky) -->
  <nav class="nav">...</nav>

  <!-- PAGE CONTAINER (swapped via JS) -->
  <main id="page-container">
    <div id="page-home" class="page active">...</div>           <!-- Home/Hero -->
    <div id="page-boys" class="page">...</div>                 <!-- Boys Category -->
    <div id="page-girls" class="page">...</div>                <!-- Girls Category -->
    <div id="page-babies" class="page">...</div>               <!-- Babies Category -->
    <div id="page-accessories" class="page">...</div>          <!-- Accessories -->
    <div id="page-product" class="page">...</div>              <!-- Product Detail Page (PDP) -->
    <!-- More pages... -->
  </main>

  <!-- LIGHTBOX (image zoom) -->
  <div id="lightbox">...</div>

  <!-- BASKET DRAWER -->
  <div id="basket-drawer">...</div>

  <!-- FLOATING WHATSAPP BUTTON -->
  <button class="float-wa">...</button>
</body>
```

### State Management & Navigation

```javascript
// History Stack (4-level back navigation)
Sentinel → Home
Home → Category (e.g., Boys)
Category → Product Detail Page (PDP)
PDP → Lightbox (image zoom)

// Page Routing via Hash
window.location.hash = 'boys'      // Shows #page-boys
window.location.hash = 'product'   // Shows #page-product (with productId in state)

// Data Storage
localStorage['rv']     // Recently viewed products (JSON array)
localStorage['basket'] // Basket items (JSON array)
window.productList     // All products (loaded from Supabase via API)
window.currentProduct  // Currently selected product (PDP)
```

---

## 4. Design System & CSS Patterns

### Color Palette (CSS Variables)

```css
:root {
  --red: #B71C1C;           /* Primary brand color (bold red) */
  --red-dark: #7F0000;      /* Dark red for text/shadows */
  --red-light: #FFEBEE;     /* Light pink for backgrounds */
  --red-mid: #E53935;       /* Medium red for hover states */
  --warm: #FFF8F5;          /* Warm off-white background */
  --text: #2C1810;          /* Dark brown for body text */
  --muted: #7A5C50;         /* Muted brown for secondary text */
  --gold: #FFD54F;          /* Gold accent (badges: "Bestseller", etc.) */
}
```

### Typography

```css
/* Headlines – Playfair Display (serif, elegant) */
font-family: 'Playfair Display', serif;
font-weight: 600 or 700;
font-size: 28px–48px (responsive)

/* Body Text – DM Sans (sans-serif, modern) */
font-family: 'DM Sans', sans-serif;
font-weight: 300, 400, or 500;
font-size: 14px–18px (responsive)
```

### Responsive Grid

```css
/* Product Cards – auto-fit grid */
.cat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

/* Mobile breakpoint (single column) */
@media (max-width: 700px) {
  .cat-cards {
    grid-template-columns: 1fr;  /* Single column on mobile */
  }
}
```

### Mobile-First Approach

- **Primary Viewport**: 6.5" Android (412×915px)
- **Test Viewports**: 5" iPhone SE (375×667px), 6.7" iPhone 14 (430×932px)
- **Single Breakpoint**: `@media (max-width: 700px)` for mobile adjustments
- **No Desktop Specific Features**: All features work on all screen sizes

### Key CSS Classes

| Class | Purpose |
|-------|---------|
| `.page` | Container for each SPA page; `.active` = visible |
| `.cat-card` | Product card in category grid |
| `.pdp-hero` | Product detail page hero image section |
| `.swiper-container` | Carousel wrapper (Swiper.js) |
| `.button` | Generic button styling |
| `.wa-btn` | WhatsApp button (green #25D366) |
| `.badge` | Product badge ("Bestseller", "New", "Soft") |
| `.hero-blob` | Decorative blob shapes on home page |

---

## 5. Product Data Model

### Schema (products.json)

```json
{
  "products": [
    {
      "id": "b001",                              // Format: [category_prefix][3-digit]
                                                 // b=boys, g=girls, bb=babies, acc=accessories
      "name": "Cotton Kurta Set",
      "category": "boys",
      "subcategory": "traditional",              // traditional, summer, winter, nightwear, undergarments
      "price": 899.0,                            // Indian Rupees (₹)
      "badge": "Bestseller",                     // Bestseller, New, Festive, Cosy, Warm, Soft
      "featured": true,                          // Show in hero carousel / featured section
      "active": true,                            // Enabled in products.json; false = hidden
      "colors": [
        {
          "name": "Blue",
          "hex": "#003DA5"
        },
        {
          "name": "Crimson",
          "hex": "#DC143C"
        }
      ],
      "sizes": [
        "3-4Y",                                  // Age range format
        "4-5Y",
        "5-6Y",
        "6-8Y"
      ],
      "fabric": "100% Cotton",                   // Material / fabric type
      "description": "Soft breathable cotton kurta...",
      "images": [
        "https://res.cloudinary.com/tinythreads/image/upload/v1780250258/...",
        "https://res.cloudinary.com/tinythreads/image/upload/v1780250259/..."
      ]
    }
  ]
}
```

### Category Prefixes

- `b` – Boys (3–13 years)
- `g` – Girls (3–13 years)
- `bb` – Babies (0–3 years)
- `acc` – Accessories

### Product Categories

- **Boys**: Cotton Kurta Sets, Linen Shorts, Hooded Sweatshirts, Undergarments, etc.
- **Girls**: Embroidered Sets, Summer Co-ords, Traditional Wear, Nightwear, etc.
- **Babies**: Khadi Sets, Soft Cotton Wear, Onesies, Bodysuits, etc.
- **Accessories**: Caps, Socks, Hair accessories, etc.

---

## 6. Core JavaScript Features

### 6.1 Page Routing & Navigation

```javascript
// Show page by name
function showPage(pageName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + pageName);
  if (page) page.classList.add('active');
}

// Hash-based routing
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.slice(1) || 'home';
  showPage(hash);
});

// Sentinel back navigation (prevents infinite back loops)
history.pushState(null, '', '#sentinel');
```

### 6.2 Product Filtering & Search

```javascript
// Filter products by category and search term
function filterProducts(category, searchTerm = '') {
  return window.productList.filter(p =>
    (category === 'all' || p.category === category) &&
    (!searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );
}

// Real-time search box listener
document.getElementById('search-box').addEventListener('input', (e) => {
  const results = filterProducts('all', e.target.value);
  renderProductGrid(results);
});
```

### 6.3 Product Detail Page (PDP)

```javascript
// Load product details on PDP
function showProductDetail(productId) {
  const product = window.productList.find(p => p.id === productId);
  if (!product) return;

  window.currentProduct = product;
  
  // Update PDP content
  document.getElementById('pdp-name').textContent = product.name;
  document.getElementById('pdp-price').textContent = '₹' + product.price;
  document.getElementById('pdp-fabric').textContent = product.fabric;
  document.getElementById('pdp-description').textContent = product.description;
  
  // Render carousel with product images
  renderImageCarousel(product.images);
  
  // Render size & color options
  renderSizeOptions(product.sizes);
  renderColorOptions(product.colors);
  
  showPage('product');
  addToRecentlyViewed(productId);
}
```

### 6.4 Image Carousel (Swiper.js v11)

```javascript
// Initialize carousel with Swiper.js v11
const swiper = new Swiper('.swiper-container', {
  loop: true,
  autoplay: {
    delay: 3000,  // From tinythreads.properties
    disableOnInteraction: false
  },
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
    dynamicBullets: true  // From enableDotPagination property
  },
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev'
  },
  touchEventsTarget: 'container',
  simulateTouch: true
});
```

### 6.5 Image Lightbox (Pinch-Zoom, Pan, Drag)

```javascript
// Full-screen image viewer with touch gestures
// Features:
//   • Pinch-zoom (two-finger zoom on mobile)
//   • Pan & drag (swipe to move zoomed image)
//   • Click to close
//   • Canvas-based rendering for performance

function openLightbox(imageUrl) {
  const lightbox = document.getElementById('lightbox');
  const img = new Image();
  
  img.onload = () => {
    // Render on Canvas for pinch/zoom/pan support
    renderImageOnCanvas(img);
    lightbox.classList.add('open');
  };
  
  img.src = imageUrl;
}
```

### 6.6 Recently Viewed Products

```javascript
// Track recently viewed products in LocalStorage
function addToRecentlyViewed(productId) {
  let rv = JSON.parse(localStorage.getItem('rv') || '[]');
  rv = [productId, ...rv.filter(id => id !== productId)].slice(0, 10);
  localStorage.setItem('rv', JSON.stringify(rv));
}

// Load recently viewed on home page
function renderRecentlyViewed() {
  const rv = JSON.parse(localStorage.getItem('rv') || '[]');
  const recentProducts = rv
    .map(id => window.productList.find(p => p.id === id))
    .filter(Boolean);
  
  renderProductCarousel(recentProducts);
}
```

### 6.7 Basket & Checkout

```javascript
// Add item to basket
function addToBasket(productId, selectedSize, selectedColor) {
  const product = window.productList.find(p => p.id === productId);
  const basketItem = {
    productId,
    name: product.name,
    price: product.price,
    size: selectedSize,
    color: selectedColor,
    quantity: 1
  };
  
  let basket = JSON.parse(localStorage.getItem('basket') || '[]');
  const existing = basket.find(item => 
    item.productId === productId && 
    item.size === selectedSize && 
    item.color === selectedColor
  );
  
  if (existing) {
    existing.quantity++;
  } else {
    basket.push(basketItem);
  }
  
  localStorage.setItem('basket', JSON.stringify(basket));
}

// Generate WhatsApp checkout link
function getWhatsAppCheckoutLink() {
  const basket = JSON.parse(localStorage.getItem('basket') || '[]');
  const total = basket.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const items = basket
    .map(item => `${item.name} (₹${item.price}) × ${item.quantity} – ${item.size}, ${item.color}`)
    .join('\n');
  
  const message = `Hi Tiny Threads!\n\nI'd like to order:\n\n${items}\n\nTotal: ₹${total.toLocaleString('en-IN')}`;
  return `https://wa.me/917879976016?text=${encodeURIComponent(message)}`;
}
```

### 6.8 WhatsApp Order Button

```javascript
// WhatsApp button on PDP
function renderWhatsAppButton() {
  const selectedSize = document.querySelector('input[name="size"]:checked')?.value;
  const selectedColor = document.querySelector('input[name="color"]:checked')?.value;
  
  if (!selectedSize || !selectedColor) {
    alert('Please select size and color');
    return;
  }
  
  const product = window.currentProduct;
  const message = `Hi! I'd like to order: ${product.name} (₹${product.price}) in size ${selectedSize}, color ${selectedColor}`;
  window.location.href = `https://wa.me/917879976016?text=${encodeURIComponent(message)}`;
}
```

---

## 7. Open Graph (OG) System – Social Commerce Integration

### OG Page Generation Flow

**Architecture**: Cloudflare Workers dynamically generate OG pages on-demand

1. **Social Bot Request Flow**
   - WhatsApp/Facebook bot fetches: `https://mytinythreads.in/products/b001`
   - Cloudflare Worker (`_worker.js`) intercepts request
   - Detects crawler user-agent (WhatsApp, Facebook, etc.)
   - Queries Supabase for product data
   - Generates OG HTML page with product details + Cloudinary OG image
   - Returns fully-rendered page to crawler (1-hour edge cache)

2. **Regular User Request Flow**
   - Browser fetches: `https://mytinythreads.in/products/b001`
   - Cloudflare Worker detects regular browser user-agent
   - Redirects to main SPA: `https://mytinythreads.in/#product=b001`
   - Browser renders single-page app with interactive features

**Benefits**: No static files to generate; always fresh product data from Supabase

### Cloudinary OG Image Transform Chain

```
Base URL: https://res.cloudinary.com/tinythreads/image/upload/

TRANSFORMS (in order):
  1. c_limit,h_540,w_540,q_auto
     → Scale to fit in 540×540 box (keeps aspect ratio, no crop)
     → For portrait products: ≈405px wide, 540px tall

  2. c_pad,w_1200,h_630,b_rgb:FFF8F5
     → Pad to 1200×630 (OG image standard size)
     → Padding appears as warm-white columns on left/right
     → Background color #FFF8F5 matches Tiny Threads brand

  3. Text overlays (burnt into image)
     → Line 1: "TINY THREADS KIDSWEAR" (brand label)
     → Line 2: Product name (truncated to 38 chars)
     → Line 3: "Rs.899 - mytinythreads.in" (price + CTA)

  4. f_jpg,q_85
     → JPEG format, quality 85 (balances file size < 300KB for WhatsApp)

RESULT: Full product visible + zero cropping + brand branding
```

### Dynamic OG Page Example (generated by Cloudflare Worker at request time)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Cotton Kurta Set – ₹899 – Tiny Threads</title>
  
  <!-- OG Tags for WhatsApp/Facebook (generated from Supabase data) -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="Cotton Kurta Set">
  <meta property="og:description" content="Soft breathable cotton kurta...">
  <meta property="og:image" content="https://res.cloudinary.com/.../c_limit,h_540,w_540/...c_pad,w_1200,h_630/...">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="https://mytinythreads.in/products/b001">
  <meta name="robots" content="noindex, follow">
  
  <!-- Redirect to main app -->
  <script>
    if (!/bot|crawler|spider|scraper|whatsapp|facebook/i.test(navigator.userAgent)) {
      window.location = 'https://mytinythreads.in/#product=b001';
    }
  </script>
</head>
<body>Generated by Cloudflare Worker from Supabase product data</body>
</html>
```

### Cloudflare Worker (`_worker.js`)

**Purpose**: PRIMARY request handler for the entire application:
- Detects crawler vs browser user-agents
- Fetches product data from Supabase REST API
- Generates dynamic OG HTML for social crawlers
- Serves static assets (index.html, CSS, JS) to browsers
- Implements edge caching (1-hour TTL for OG pages)

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ua = request.headers.get('user-agent') || '';
    const isCrawler = isCrawlerUA(ua);
    
    // Route: /products/:id → Dynamic OG page or redirect
    if (url.pathname.startsWith('/products/')) {
      const productId = url.pathname.split('/').pop().replace(/\.html$/, '');
      
      if (isCrawler) {
        // Crawler: fetch from Supabase, generate OG HTML
        const product = await fetchFromSupabase(productId);
        const ogHtml = generateOgHtml(product);
        return new Response(ogHtml, {
          headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=3600, s-maxage=3600'
          }
        });
      } else {
        // Browser: redirect to SPA
        return Response.redirect(`${url.origin}/#product=${productId}`, 302);
      }
    }
    
    // Everything else: serve static assets
    return env.ASSETS.fetch(request);
  }
};
```

### Testing OG Previews

Use **Facebook Sharing Debugger** (works for WhatsApp too):
- https://developers.facebook.com/tools/debug/
- Paste product URL: `https://mytinythreads.in/products/b001`
- Click "Scrape Again" to force fresh preview

---

## 8. Supabase Integration

### Purpose

Supabase (PostgreSQL database) is the **PRIMARY data source**:
1. **Product Data** (required – ALL products sourced from Supabase)
2. **Splash Screen Images** (first-load branding carousel)
3. **Analytics** (optional – not fully implemented)

### Credentials

```javascript
SUPABASE_URL = 'https://gtszuhmfpywqwdetoqqo.supabase.co'
SUPABASE_KEY = 'sb_publishable_8Sxqgnn-VQJrVnpRy2WqUQ_g23PLPvk'
```

**Note**: Anon key is public and safe (read-only, scoped by RLS policies).

### Database Schema

#### `products` Table (PRIMARY DATA SOURCE)

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,                 -- b001, g114, bb119, etc.
  name TEXT NOT NULL,
  category TEXT NOT NULL,              -- boys, girls, babies, accessories
  subcategory TEXT,                    -- traditional, summer, winter, nightwear, etc.
  price NUMERIC,
  badge TEXT,                          -- Bestseller, New, Soft, etc.
  featured BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  sort_order INT,                      -- For featured products ordering
  description TEXT,
  fabric TEXT,
  colors JSONB,                        -- Array of {name, hex}
  sizes JSONB,                         -- Array of size strings
  images JSONB,                        -- Array of Cloudinary URLs
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_featured ON products(featured);
```

**Access Method**: Supabase REST API or JavaScript client
- Index.html fetches via `supabase.from('products').select('*')`
- Cloudflare Worker fetches via HTTPS REST API with service key

#### `splash_screens` Table

```sql
CREATE TABLE splash_screens (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,             -- Cloudinary URL
  title TEXT,
  subtitle TEXT,
  cta_text TEXT,
  cta_link TEXT,
  display_order INT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Splash Screen Loader (`supabase-splash.js`)

```javascript
// Fetch splash screens from Supabase
async function initSplashScreens() {
  try {
    const data = await supabase
      .from('splash_screens')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });
    
    if (data.error) throw data.error;
    
    // Store in sessionStorage for this session
    sessionStorage.setItem('splashImages', JSON.stringify(data.data));
    
    // Initialize Swiper carousel with splash slides
    initSplashCarousel(data.data);
  } catch (err) {
    console.warn('Splash load failed, using fallback:', err);
    // Fallback to hardcoded splash images
    initSplashCarousel(FALLBACK_SPLASH_IMAGES);
  }
}
```

---

## 9. Deployment & Hosting

### Cloudflare Workers Deployment (Primary)

**Configuration**: `wrangler.jsonc`

```json
{
  "name": "tinythreads-catalogue",
  "main": "_worker.js",
  "compatibility_date": "2026-04-26",
  "assets": {
    "directory": ".",
    "binding": "ASSETS",
    "run_worker_first": ["/products/*"]
  },
  "env": {
    "production": {
      "routes": [
        { "pattern": "mytinythreads.in/*", "zone_name": "mytinythreads.in" }
      ]
    }
  }
}
```

**Deployment Flow**:
1. Push to `main` branch (optional Git integration)
2. Run: `npx wrangler deploy`
3. Worker publishes to Cloudflare edge (instant, worldwide)
4. Live at: https://mytinythreads.in (via Cloudflare routing)

### Supabase Credentials & Environment

Cloudflare Worker requires Supabase credentials:

```bash
# Set environment variables for Worker
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_KEY
```

These credentials are used by the Worker to:
- Fetch product data on every `/products/*` request (for crawlers)
- Generate OG HTML pages dynamically
- Cache responses at Cloudflare edge for 1 hour

### Performance & Caching Strategy

| Asset Type | Cache Duration | Strategy |
|-----------|---------------|---------
| `index.html` | 0s (must-revalidate) | Always fresh, detect changes |
| `/products/*.html` | 1 hour (with stale-while-revalidate 24h) | Cache for social crawlers |
| Static CSS/JS/images | 1 year (immutable) | Long cache, fingerprinted |
| Cloudinary images | Infinite (versioned URLs) | Versioned URLs = auto-cache bust |

---

## 10. Configuration Files

### `tinythreads.properties` – Feature Flags

```properties
# Carousel autoplay interval (milliseconds)
autoPlayInterval=3000

# Show pagination dots on carousels
enableDotPagination=true

# Infinite loop carousel
autoPlayInfiniteLoop=true

# Supabase credentials
SUPABASE_URL=https://gtszuhmfpywqwdetoqqo.supabase.co
SUPABASE_KEY=sb_publishable_8Sxqgnn-VQJrVnpRy2WqUQ_g23PLPvk
```

### `package.json` – Dependencies

```json
{
  "scripts": {
    "test": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.60.0",
    "playwright": "^1.60.0"
  }
}
```

---

## 11. Testing

### Playwright E2E Tests (`test-supabase-load.spec.js`)

```javascript
import { test, expect } from '@playwright/test';

test.describe('Tiny Threads – Mobile Responsive Tests', () => {
  // Set viewports
  const viewports = [
    { name: '5" iPhone SE', width: 375, height: 667 },
    { name: '6.5" Android', width: 412, height: 915 },
    { name: '6.7" iPhone 14', width: 430, height: 932 }
  ];

  test('Home page loads and renders hero', async ({ page }) => {
    await page.goto('https://mytinythreads.in');
    await expect(page.locator('.hero-section')).toBeVisible();
  });

  test('Product filtering works by category', async ({ page }) => {
    await page.goto('https://mytinythreads.in/#boys');
    const products = await page.locator('.cat-card');
    await expect(products).toHaveCount(/>0/);
  });

  test('PDP shows product details', async ({ page }) => {
    await page.goto('https://mytinythreads.in');
    await page.click('.cat-card:first-child');
    await expect(page.locator('#pdp-name')).toBeVisible();
  });

  test('WhatsApp button generates correct link', async ({ page }) => {
    await page.goto('https://mytinythreads.in/#boys');
    await page.click('.cat-card:first-child');
    const waLink = await page.getAttribute('.wa-btn', 'href');
    expect(waLink).toContain('wa.me/917879976016');
  });
});
```

**Run Tests**:
```bash
npm test
```

---

## 12. Common Tasks & Implementation Patterns

### ✅ Add a New Product

1. **Add to Supabase `products` table**:
   ```sql
   INSERT INTO products (
     id, name, category, subcategory, price, badge, featured, active,
     fabric, description, sizes, colors, images
   ) VALUES (
     'b050', 'New Summer Shirt', 'boys', 'summer', 599.0, 'New', true, true,
     'Linen', 'Comfortable linen...', 
     '["3-4Y", "4-5Y", "5-6Y"]',
     '[{"name": "Blue", "hex": "#003DA5"}]',
     '["https://res.cloudinary.com/...v1234/product.jpg"]'
   );
   ```

2. **Verify via API** (optional):
   ```bash
   curl 'https://gtszuhmfpywqwdetoqqo.supabase.co/rest/v1/products?id=eq.b050' \
     -H 'apikey: YOUR_ANON_KEY'
   ```

3. **Product appears immediately** on https://mytinythreads.in
   - No build step needed
   - Cloudflare Worker fetches fresh data on each request
   - OG preview auto-generated when shared on WhatsApp

### ✅ Update Product Image

1. Upload new image to Cloudinary
2. Update `images` array in Supabase `products` table:
   ```sql
   UPDATE products 
   SET images = '["https://res.cloudinary.com/.../v1234567/newimage.jpg"]'
   WHERE id = 'b050';
   ```
3. **Changes live immediately** – no regeneration needed
   - OG preview updates on next WhatsApp share
   - Cloudflare cache expires in 1 hour

### ✅ Modify Carousel Autoplay Speed

1. Edit `tinythreads.properties`:
   ```properties
   autoPlayInterval=5000  # Changed from 3000
   ```

2. Restart browser or reload page

### ✅ Change Color Palette

1. Edit CSS variables in `<style>` tag of `index.html`:
   ```css
   :root {
     --red: #C0392B;      /* New primary color */
     --warm: #FEFDFB;     /* New warm background */
   }
   ```

2. Test on multiple viewports (DevTools)
3. Commit & push

### ✅ Add New Category Page

1. Add new `<div id="page-newcat" class="page">` to `index.html`
2. Add category to `validPages` array in JavaScript
3. Insert products with new category into Supabase `products` table:
   ```sql
   INSERT INTO products (..., category, ...) 
   VALUES (..., 'newcategory', ...);
   ```
4. Update navigation menu to link to new category
5. Deploy to Cloudflare: `npx wrangler deploy`
6. Changes live instantly

### ✅ Test Mobile Responsiveness

1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test at: 375px, 412px, 430px widths
4. Verify touch targets (44px minimum height)
5. Check image loading & layout shifts

---

## 13. Performance Optimizations

### Implemented Optimizations

✅ **Image Optimization**
- Cloudinary transforms reduce file size by 60–80%
- `q_auto` selects best format per device (WebP on Chrome, JPEG on Safari)
- Lazy loading on thumbnail carousels
- Responsive images with multiple sizes

✅ **CSS Optimization**
- All CSS inline (no render-blocking stylesheet)
- Critical CSS above fold
- CSS variables for theming (zero JavaScript overhead)
- No unused styles (inline only what's needed)

✅ **JavaScript Optimization**
- Vanilla JavaScript (no jQuery, React, Vue overhead)
- Event delegation for dynamic content
- LocalStorage caching for recently viewed products
- Debounced search/filter functions

✅ **Caching Strategy**
- 1-year immutable cache for static assets
- 1-hour cache for product OG pages
- Edge caching via Cloudflare Workers (1-hour TTL)
- Browser cache-busting via versioned URLs

✅ **Mobile UX Optimizations**
- 43% height reduction on Instagram banner (81px → 46px on 6.5" Android)
- Sticky navigation (62px) – quick access to categories
- Touch-friendly buttons (44px minimum height)
- Smooth scroll-to-top animation
- Zero layout shift on dynamic content

### Lighthouse Metrics (Production)

- **Performance**: 85+ (images: good, CLS: good)
- **Accessibility**: 90+ (semantic HTML, WCAG compliant)
- **Best Practices**: 95+ (HTTPS, CSP headers, no deprecated APIs)
- **SEO**: 95+ (meta tags, structured data, mobile-friendly)

---

## 14. Troubleshooting Guide

| Issue | Cause | Solution |
|-------|-------|----------|
| Product doesn't appear | `active: false` in Supabase table | Update Supabase: `UPDATE products SET active=true WHERE id='...'` |
| OG preview incomplete | Supabase connection failed in Worker | Check Cloudflare Worker logs: `wrangler tail` |
| Images not loading | Cloudinary URL invalid | Verify URL format in Supabase `images` field |
| WhatsApp link broken | Wrong phone number in message | Verify `717879976016` has WhatsApp account |
| Carousel not autoplaying | `autoPlayInterval` set to 0 | Check `tinythreads.properties` value |
| OG preview shows wrong image | Stale Cloudflare edge cache | Force refresh: manually delete cache or wait 1 hour |
| Mobile layout broken | Viewport too narrow | Check breakpoint threshold (`max-width: 700px`) |
| Recently viewed stale | LocalStorage corruption | Clear DevTools → Application → Local Storage → delete `rv` key |
| Splashscreen not loading | Supabase connection error | Check Supabase credentials in `supabase-splash.js` |
| Worker returning 500 error | Missing Supabase service key | Run: `npx wrangler secret put SUPABASE_SERVICE_KEY` |

---

## 15. File-by-File Breakdown

### `index.html` (2500+ lines)

**What it contains**:
- HTML structure (semantic, single-page app markup)
- All CSS (inline `<style>` tag)
- All JavaScript (vanilla, no frameworks)
- Meta tags (OG, Twitter Card, SEO)
- Font preloads & external script loads (Swiper, Supabase)

**Key Sections**:
- Lines 1–50: Head (metadata, fonts, preconnects)
- Lines 50–200: CSS variables & global styles
- Lines 200–800: Component CSS (navbar, cards, buttons, modals)
- Lines 800–1500: Layout CSS (grid, flexbox, responsive)
- Lines 1500–2000: Interactive CSS (animations, hover states)
- Lines 2000–2500+: JavaScript (routing, product filtering, cart, OG)

### `_worker.js` (Cloudflare Worker)

**What it does**:
- Intercepts `/products/*` requests on Cloudflare edge
- Detects social crawlers (WhatsApp, Facebook, etc.)
- For crawlers: generates dynamic OG HTML from Supabase
- For users: passes through to static assets
- Caches OG pages for 1 hour

**Key Functions**:
- `isCrawler(ua)` – Detect social bot user agents
- `buildOgImage(product)` – Generate Cloudinary OG image URL
- `fetch(request)` – Main request handler

### `supabase-splash.js` (Runtime – Client-Side)

**What it does**:
- Fetches splash screen images from Supabase
- Falls back to hardcoded images if Supabase unavailable
- Initializes Swiper carousel for splash screens
- Caches result in sessionStorage

**Loaded by**: `index.html` (`<script src="supabase-splash.js"></script>`)

### `wrangler.jsonc` (Cloudflare Workers Config)

**What it contains**:
- Worker name: `tinythreads-catalogue`
- Main entry: `_worker.js`
- Assets directory: `.` (root)
- Route rules: only `/products/*` hits the worker

### `tinythreads.properties` (Feature Flags)

**What it contains**:
- Carousel autoplay interval (milliseconds)
- Pagination dots toggle
- Infinite loop toggle
- Supabase credentials (URL, API key)

---

## 16. Git Workflow & Branching Strategy

### Current State

- **Main Branch** (`main`): Production-ready code (Cloudflare Workers)
- **Working Branch** (`promocode`): Feature development
- **New Branch** (`MODULAR`): Code refactoring (modular architecture)
- **Deployment**: All branches deploy via Cloudflare Workers (no Netlify)

### Recommended Workflow

```bash
# Start new feature
git checkout -b feature/add-new-category

# Make changes to index.html, supabase-splash.js, _worker.js, etc.
git add .
git commit -m "Add new category: Twinning Sets"

# Push to origin
git push origin feature/add-new-category

# Open Pull Request on GitHub
# Review → Merge to main

# Deploy to Cloudflare
git checkout main
git pull origin main
npx wrangler deploy
```

### Branch Protection Rules (Recommended)

- `main` branch requires PR reviews
- GitHub Actions test suite on all PRs
- Tests must pass before merging
- Deploy to Cloudflare via GitHub Actions or manual `wrangler deploy`

---

## 17. Security Considerations

### API Keys & Credentials

- **Supabase Anon Key**: Public (safe – read-only, scoped by RLS)
- **Supabase Service Key**: Private (never commit to repo)
- **Cloudflare API Token**: Private (use environment variables)
- **WhatsApp Phone Number**: Public (intentional – for ordering)

### Content Security Policy (CSP)

Recommended headers in `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    "X-Content-Type-Options" = "nosniff"
    "X-Frame-Options" = "DENY"
    "X-XSS-Protection" = "1; mode=block"
    "Referrer-Policy" = "strict-origin-when-cross-origin"
```

### Third-Party Services

- **Cloudinary**: CDN, no authentication needed (public links)
- **Supabase**: PostgreSQL database with RLS (row-level security) — PRIMARY DATA SOURCE
- **Cloudflare Workers**: Global edge deployment & routing (replaces Netlify)
- **Cloudflare**: Edge caching, dynamic page generation, DDoS protection

---

## 18. Future Roadmap & Extensibility

### Potential Enhancements

1. **Payment Integration**
   - Razorpay / CCAvenue / PayU
   - Direct checkout without WhatsApp intermediary

2. **Inventory Management**
   - Real-time stock tracking in Supabase
   - Out-of-stock indicators on PDP

3. **User Accounts**
   - Supabase Auth (email/phone login)
   - Order history, wishlist, saved preferences

4. **Analytics**
   - Supabase Analytics or Google Analytics
   - Track popular products, conversion rates, user journey

5. **Admin Dashboard**
   - Supabase Studio (built-in admin UI)
   - Upload products, manage inventory, view analytics

6. **Localization**
   - Multi-language support (Hindi, English, regional languages)
   - Currency conversion for international shipping

7. **Subscription Model**
   - Monthly subscription box / recurring purchases
   - Loyalty program, referral rewards

### Code Modularization Opportunity

Current state: All JavaScript in one `index.html` file (2500+ lines)

**Proposed refactoring**:
- Split into modules: `router.js`, `products.js`, `cart.js`, `ui.js`
- Use ES6 imports/exports
- Maintain single-file deployment via bundler (Vite, esbuild)
- Keep zero build step for developers (optional build for production)

---

## 19. Resources & References

### Documentation
- [DEPLOY.md](DEPLOY.md) – Deployment & WhatsApp integration guide
- [OPTIMIZATION_REPORT.md](OPTIMIZATION_REPORT.md) – Mobile UX improvements
- [AGENTS.md](AGENTS.md) – AI Agent guide (Copilot, Claude, etc.)
- [TEST_GUIDE.md](TEST_GUIDE.md) – Testing & QA procedures
- [SUPABASE_SETUP_GUIDE.md](SUPABASE_SETUP_GUIDE.md) – Database setup

### External References
- **Swiper.js**: https://swiperjs.com/
- **Cloudinary**: https://cloudinary.com/
- **Supabase**: https://supabase.com/
- **Netlify**: https://netlify.com/
- **Cloudflare Workers**: https://workers.cloudflare.com/
- **WhatsApp Business API**: https://www.whatsapp.com/business/

### Tools & Services
- **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
- **Lighthouse**: Chrome DevTools → Lighthouse tab
- **Playwright**: https://playwright.dev/
- **VS Code**: https://code.visualstudio.com/

---

## 20. Conclusion

**Tinythreads Kidswear** is a modern, scalable e-commerce catalogue optimized for mobile-first WhatsApp social commerce. Its architecture balances:

- **Simplicity**: Vanilla JavaScript, no frameworks, zero build step
- **Performance**: Cloudflare edge deployment, 1-hour cache, Supabase REST API
- **Scalability**: Supabase backend ready for 10,000+ products, dynamic OG generation
- **SEO & Social**: Dynamic OG previews (generated per product), structured data, mobile-friendly
- **Developer Experience**: Single-source truth (Supabase), no static file generation, instant deployments
- **Infrastructure**: Fully decoupled from Netlify; Cloudflare Workers as single deployment platform

The codebase is **production-ready** and suitable for rapid iteration. All product data flows through Supabase; all deployment through Cloudflare Workers.

---

**Last Reviewed**: June 14, 2026 | **Updated**: Cloudflare Workers + Supabase (no Netlify/products.json)  
**Repository**: tinythreadskidswear/tinythreads-catalogue  
**Status**: Production ✅ | Actively Maintained  
**Architecture**: Cloudflare Workers (primary) | Supabase (data) | No Netlify/products.json dependency
