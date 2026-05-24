# Tinythreads Catalogue — AI Agent Guide

A static e-commerce catalogue for kidswear built for mobile-first experience and WhatsApp social commerce. Deployed on Netlify with Cloudflare Workers edge deployment.

**Website**: https://mytinythreads.in | **Domain**: Indian kidswear market

---

## Quick Start for Agents

### Tech Stack
- **Frontend**: Vanilla JavaScript (single-page app in `index.html`)
- **Data**: `products.json` (~105 products, dynamically rendered)
- **Styling**: Inline CSS with Design System variables (color palette: `--red`, `--warm`, `--muted`, etc.)
- **Components**: Swiper.js (v11) carousels, Cloudinary image transforms
- **Deployment**: Netlify (recommended) + Cloudflare Workers (alternative)
- **Testing**: Playwright for automated E2E tests

### Key Build/Deploy
- **Deploy**: Git push → automatic Netlify rebuild (no build step required; see [netlify.toml](netlify.toml))
- **Add Products**: Update `products.json`, then run `node generate-product-pages.js` (script not in repo; auto-generates `/products/*.html`)
- **Test Views**: Playwright tests at 5"/6.5"/6.7" viewports
- **Config**: `tinythreads.properties` (carousel autoplay=3000ms, pagination dots enabled)

### Repository Structure
```
tinythreads-catalogue/
├── index.html                ← Main SPA (2500+ lines inline CSS+JS)
├── products.json             ← Central product database
├── products/                 ← Static OG preview pages (one per product)
├── netlify.toml              ← Netlify config (redirects, caching, headers)
├── wrangler.jsonc            ← Cloudflare Workers config
├── tinythreads.properties    ← App feature flags
├── DEPLOY.md                 ← Deployment & WhatsApp integration guide
├── OPTIMIZATION_REPORT.md    ← Mobile UX optimization details
└── package.json              ← Dev dependencies (Playwright)
```

---

## Architecture & Data Flow

### Product Catalog System
```
products.json  →  index.html renders dynamically  →  Category pages (boys/girls/babies/etc.)
                                               ↓
                                    Product Detail Page (PDP)
                                               ↓
                                    Lightbox (pinch-zoom, pan, drag)
```

**Product Data Schema**:
```json
{
  "id": "b001",                               // Prefix: b=boys, g=girls, bb=babies, acc=accessories
  "name": "Cotton Kurta Set",
  "category": "boys",
  "subcategory": "traditional",              // summer, winter, nightwear, traditional, undergarments
  "price": 899.0,
  "badge": "Bestseller",                     // New, Festive, Cosy, Warm, Bestseller, Soft
  "featured": true,
  "images": ["cloudinary_url_1", "..."],     // Cloudinary hosted, auto-transformed
  "sizes": ["3-4Y", "4-5Y", ...],            // Age ranges
  "colors": [{"name": "Blue", "hex": "#..."}, ...],
  "fabric": "100% Cotton",
  "description": "Product description"
}
```

### Pages & Routing
- **Home** (`#home`) — Hero, featured products, testimonials, newsletter
- **Categories** (`#boys`, `#girls`, `#babies`, etc.) — Grid of products with filters
- **Product Detail Page (PDP)** — Image carousel, specs, WhatsApp order button
- **Lightbox** — Full-screen image zoom with pinch/pan/drag (Canvas-based)
- **Basket** — Drawer showing selected items (WhatsApp checkout link)

### State Management
- **History Stack**: Sentinel → Page → PDP → Lightbox (4-level back navigation)
- **LocalStorage**: Recently viewed products, basket items
- **CSS Classes**: `.active`, `.open`, `.splash-exit` control visibility

---

## Key Conventions & Patterns

### Naming Conventions
| Convention | Example | Usage |
|-----------|---------|-------|
| **Product IDs** | `b001`, `g114`, `bb108`, `acc001` | Category prefix (b/g/bb/acc) + 3-digit number |
| **CSS Classes** | `.cat-card`, `.hero-blob1`, `.pdp-hero` | Kebab-case, semantic naming |
| **Color Vars** | `--red`, `--red-dark`, `--warm`, `--muted` | CSS custom properties in `:root` |
| **Breakpoints** | `@media (max-width: 700px)` | Single breakpoint for mobile optimization |
| **Page IDs** | `#page-home`, `#page-boys`, `#page-product` | Page divs with `id="page-{name}"` |

### Design System
```css
:root {
  --red: #B71C1C;           // Primary brand color
  --red-dark: #7F0000;      // Dark red for text
  --red-light: #FFEBEE;     // Light red for backgrounds
  --red-mid: #E53935;       // Hover state
  --warm: #FFF8F5;          // Warm background
  --text: #2C1810;          // Dark text
  --muted: #7A5C50;         // Secondary text
  --gold: #FFD54F;          // Accent (badges)
}
```

### Responsive Image Strategy
- **Cloudinary Transform URLs**: `https://res.cloudinary.com/tinythreads/image/upload/[transforms]/v[version]/path.jpg`
- **Product Grid**: `c_fill,w_400,h_400` (square thumbnails)
- **OG Preview**: `c_pad,w_1200,h_630,b_rgb:FFF8F5` (preserves entire product on warm background)
- **Lightbox**: Full-res original (remove Cloudinary transforms for detail)
- **Auto-quality**: `q_auto` (Cloudinary decides best quality per device)

### CSS Patterns
```css
/* Responsive grid — mobile-first */
.cat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

/* Mobile-first breakpoint */
@media (max-width: 700px) {
  .element { /* mobile styles */ }
}

/* Flex layout with gaps */
.nav-links {
  display: flex;
  gap: 0;  /* Tight spacing on desktop */
  list-style: none;
}

/* Smooth transitions (no jump animations) */
.button {
  transition: all .2s;
}

/* WhatsApp green button */
.wa-btn {
  background: #25D366;
  border: none;
  border-radius: 25px;
  color: white;
  font-weight: 500;
  cursor: pointer;
}
```

### JavaScript Patterns
```javascript
// Page routing with hash navigation
function showPage(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Show requested page
  const page = document.getElementById('page-' + pageName);
  if (page) page.classList.add('active');
}

// Product filtering with real-time search
function filterProducts(category, searchTerm) {
  return allProducts.filter(p =>
    (category === 'all' || p.category === category) &&
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
}

// WhatsApp order link builder
function getWhatsAppLink(productId, size) {
  const product = allProducts.find(p => p.id === productId);
  const message = `Hi! I'd like to order: ${product.name} (₹${product.price}) in size ${size}`;
  return `https://wa.me/917879976016?text=${encodeURIComponent(message)}`;
}

// Recently viewed tracking (LocalStorage)
function addToRecentlyViewed(productId) {
  recentlyViewed = [productId, ...recentlyViewed.filter(id => id !== productId)].slice(0, 10);
  localStorage.setItem('rv', JSON.stringify(recentlyViewed));
}
```

---

## Mobile-First UX Optimizations

### Documented Optimizations
- **Instagram Banner Mobile** (OPTIMIZATION_REPORT.md): 43% height reduction (81px → 46px) on 6.5" Android
- **Touch Targets**: Minimum 44px height for buttons (WhatsApp, basket, category buttons)
- **Viewport**: `max-width: 100vw` to prevent horizontal scroll on mobile
- **Splash Screen**: Full-bleed animation on first load (only on mobile)
- **Bottom Navigation**: Sticky mobile nav with category shortcuts

### Testing Viewports
```
5" iPhone SE:     375×667px
6.5" Android:     412×915px (primary target)
6.7" iPhone 14:   430×932px
```
*Test via Playwright at these breakpoints before major changes.*

---

## Deployment & Configuration

### Netlify Configuration (`netlify.toml`)
```toml
# Pretty URLs: /products/b001 serves b001.html
# Redirects: old query params /?product=b001 → /products/b001
# Cache: product pages 1hr + stale-while-revalidate 24hr
# index.html: no cache (must-revalidate)
# Static assets: 1 year immutable cache
# Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
```

### Feature Flags (`tinythreads.properties`)
```properties
autoPlayInterval=3000           # Carousel autoplay in milliseconds
enableDotPagination=true        # Show pagination dots on carousels
autoPlayInfiniteLoop=true       # Loop carousel infinitely
```

### WhatsApp Integration
- **Message Link**: `https://wa.me/917879976016?text={message}`
- **OG Tags**: Ensure `/products/*.html` has correct Open Graph metadata for social sharing
- **Test Preview**: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)

---

## Common Tasks & How to Implement

### ✅ Add a New Product
1. Edit `products.json` — add new product object with all required fields
2. Run `node generate-product-pages.js` (auto-generates `/products/{id}.html`)
3. Commit and push → Netlify auto-deploys

### ✅ Update Product Image
1. Upload new image to Cloudinary
2. Update `images` array in `products.json`
3. Clear browser cache or append `?v=timestamp` to force refresh

### ✅ Modify Category Layout
1. Edit `.cat-cards` or `.cat-grid` CSS in `index.html` `<style>` tag
2. Adjust breakpoints in `@media (max-width: 700px)` if needed
3. Test on phone (375px width) before committing

### ✅ Add New Navigation Item
1. Add `<li>` to `.nav-links` (desktop) and mobile menu
2. Add corresponding category in `validPages` array in JavaScript
3. Create new category container (e.g., `<div id="page-newcat" class="page">`)

### ✅ Test Mobile Responsiveness
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test at: 375px, 412px, 430px widths
4. Verify: buttons clickable, text readable, images load

### ✅ Deploy to Production
```bash
git add .
git commit -m "Update products / fix bug / add feature"
git push origin main
# Netlify auto-deploys, visible at https://mytinythreads.in in ~30 seconds
```

---

## Performance & SEO

### Performance Best Practices
- ✅ **Preconnect to external domains**: Google Fonts, Cloudinary
- ✅ **Lazy load images**: Carousel thumbnails use `loading="lazy"`
- ✅ **Cache aggressive**: 1-year immutable for static assets
- ✅ **Compress images**: Cloudinary `q_auto` decides best format per device
- ✅ **Inline critical CSS**: All styles in `<style>` tag (no external stylesheet block)
- ✅ **Minimize JavaScript**: Vanilla JS, no jQuery or heavy frameworks

### SEO & Social
- ✅ **Canonical URLs**: `<link rel="canonical" href="https://mytinythreads.in/">`
- ✅ **Open Graph Tags**: `og:title`, `og:description`, `og:image` (1200×630px)
- ✅ **Twitter Card**: `twitter:card: summary_large_image`
- ✅ **Structured Data**: JSON-LD for breadcrumbs and products
- ✅ **Meta Description**: Present on all pages, includes target keywords

---

## Troubleshooting Common Issues

| Issue | Solution |
|-------|----------|
| Product doesn't appear on site | Run `node generate-product-pages.js` after updating `products.json` |
| Images not loading | Check Cloudinary URL format; verify `res.cloudinary.com` domain is accessible |
| WhatsApp link not working | Ensure phone number in `tinythreads.properties` is correct (with country code) |
| Mobile layout broken | Check breakpoint: `@media (max-width: 700px)` — adjust if narrower needed |
| Carousel not autoplaying | Check `tinythreads.properties` `autoPlayInterval` value; restart browser |
| Recently viewed showing stale data | Clear LocalStorage: DevTools → Application → Local Storage → delete `rv` |
| Old product URLs broken | Netlify 301 redirect in `netlify.toml` should auto-forward; check redirect rules |

---

## Files to Reference

- **Deployment**: [DEPLOY.md](DEPLOY.md) — Step-by-step Netlify setup, WhatsApp integration, product generation
- **Optimizations**: [OPTIMIZATION_REPORT.md](OPTIMIZATION_REPORT.md) — Mobile UX improvements, Playwright testing results
- **Configuration**: [netlify.toml](netlify.toml) — Routing, caching, security headers
- **Feature Flags**: [tinythreads.properties](tinythreads.properties) — App configuration
- **Dependencies**: [package.json](package.json) — Playwright test framework

---

## Development Environment Tips

- **Local Testing**: Open `index.html` in browser → all functionality works offline (products.json loads locally)
- **Live Reload**: Use VS Code Live Server extension for instant refresh
- **Mobile Testing**: Use DevTools device emulation or physical device with `localhost:5500`
- **Debugging**: Open DevTools Console → check for fetch errors, LocalStorage content
- **Git Workflow**: Create feature branch → test locally → push → auto-deploy on Netlify

---

## When to Involve Humans

- 🔴 Major design overhaul or brand refresh
- 🔴 Significant performance regression (Web Vitals)
- 🔴 Integration with third-party payment systems
- 🔴 SEO issues or search ranking concerns
- 🔴 Accessibility audit or WCAG compliance review
- 🟡 Product catalog exceeds 500+ items (consider pagination/search optimization)
- 🟡 New deployment environment (AWS, Vercel, etc.)

---

**Last Updated**: May 2026 | **Status**: Production-ready
