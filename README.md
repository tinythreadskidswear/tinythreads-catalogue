# Tinythreads Kidswear Catalogue

A mobile-first, static e-commerce catalogue for kidswear with WhatsApp social commerce integration. Optimized for sharing product previews on WhatsApp, Instagram, and Facebook.

**Live Website**: https://mytinythreads.in | **Domain**: Indian kidswear market

## Quick Start

### For Users
- 🛍️ Browse kidswear by category: Boys, Girls, Babies, Accessories
- 📸 Tap product images to zoom in and explore details
- 💬 Order via WhatsApp directly from product pages
- 👀 View recently browsed products
- 🛒 Add items to basket and checkout on WhatsApp

### For Developers
- **No build step needed** — Static HTML + inline CSS + vanilla JavaScript
- **Deploy in seconds** — Git push → automatic Netlify deployment
- **Add products instantly** — Edit `products.json` and regenerate product pages
- **Fully responsive** — Mobile-first design, tested at 5", 6.5", 6.7" viewports

## Project Structure

```
tinythreads-catalogue/
├── index.html                    # Main SPA (2500+ lines, all CSS+JS inline)
├── products.json                 # Product database (105+ items)
├── products/                     # Static product pages for social previews
├── netlify.toml                  # Netlify config (routing, caching, redirects)
├── wrangler.jsonc                # Cloudflare Workers config (optional)
├── tinythreads.properties        # Feature flags & config
│
├── DEPLOY.md                     # Deployment guide & WhatsApp integration
├── OPTIMIZATION_REPORT.md        # Mobile UX improvements & testing results
├── AGENTS.md                     # AI Agent guide (for Copilot, Claude, etc.)
├── package.json                  # Dev dependencies (Playwright testing)
└── README.md                     # This file
```

## Features

✅ **Mobile-First Design**
- Optimized for 6.5" Android (412×915px) as primary target
- Tested and working on 5" and 6.7" viewports
- 43% height reduction on Instagram banner (mobile)
- Touch-friendly buttons (44px minimum height)

✅ **Social Commerce**
- Open Graph (OG) tags for rich WhatsApp/Facebook previews
- Static product pages (`/products/{id}.html`) for social bot scraping
- One-click WhatsApp order link (WhatsApp API integration)
- Share product links easily on Instagram, WhatsApp, Facebook

✅ **Performance**
- Aggressive caching: 1-year for static assets, 1-hour for product pages
- Image optimization via Cloudinary (auto quality/format selection)
- No external JavaScript frameworks (vanilla JS only)
- Preconnect to Google Fonts and Cloudinary

✅ **E-Commerce Features**
- Dynamic product filtering by category, season, fabric type
- Image carousel with zoom/pan/drag (Canvas-based lightbox)
- Size and color selection
- Recently viewed products (LocalStorage)
- Shopping basket with WhatsApp checkout

✅ **Admin-Friendly**
- Products stored in `products.json` (human-readable format)
- Automated page generation (`node generate-product-pages.js`)
- Feature flags in `tinythreads.properties` (no code changes needed)
- 1-step deployment (git push → auto-live)

## Getting Started

### Installation
No installation needed! Just clone and deploy.

```bash
# Clone the repository
git clone https://github.com/tinythreadskidswear/tinythreads-catalogue.git
cd tinythreads-catalogue

# Open in browser locally
# Option 1: Use VS Code Live Server extension (right-click index.html → Open with Live Server)
# Option 2: Run a local server
python3 -m http.server 8000
# Then open http://localhost:8000
```

### Add Products
1. Edit `products.json` — add new product object
2. Run: `node generate-product-pages.js`
3. Commit and push → Netlify auto-deploys

See [DEPLOY.md](DEPLOY.md) for detailed steps.

### Deploy
**Netlify (Recommended)**:
1. Push to GitHub: `git push origin main`
2. Netlify automatically rebuilds and deploys
3. Site goes live at https://mytinythreads.in in ~30 seconds

**Alternative: Cloudflare Workers**:
- Use `wrangler deploy` (see [wrangler.jsonc](wrangler.jsonc))

## Product Data Format

Products are stored in `products.json`. Example:

```json
{
  "id": "b001",                           // Product ID (b=boys, g=girls, bb=babies)
  "name": "Cotton Kurta Set",
  "category": "boys",
  "subcategory": "traditional",           // summer, winter, nightwear, traditional, undergarments
  "price": 899.0,
  "badge": "Bestseller",                  // Optional: New, Festive, Cosy, Warm, Bestseller, Soft
  "featured": true,
  "description": "Soft breathable cotton kurta...",
  "fabric": "100% Cotton",
  "images": [
    "https://res.cloudinary.com/.../IMG-20250927-WA0043_ulau1j.jpg",
    "https://res.cloudinary.com/.../IMG-20250927-WA0044_xyz123.jpg"
  ],
  "sizes": ["3-4Y", "4-5Y", "5-6Y", "6-8Y", "8-10Y", "10-12Y", "1-2Y"],
  "colors": [
    { "name": "Blue", "hex": "#0066CC" },
    { "name": "White", "hex": "#FFFFFF" }
  ]
}
```

See `products.json` for 100+ real examples.

## Customization

### Change Colors
Edit CSS variables in `index.html` `<style>` tag:

```css
:root {
  --red: #B71C1C;           // Primary brand
  --red-dark: #7F0000;      // Dark text
  --red-light: #FFEBEE;     // Light background
  --warm: #FFF8F5;          // Page background
  --muted: #7A5C50;         // Secondary text
  --gold: #FFD54F;          // Accent
}
```

### Configure App
Edit `tinythreads.properties`:

```properties
autoPlayInterval=3000           # Carousel autoplay (milliseconds)
enableDotPagination=true        # Show pagination dots
autoPlayInfiniteLoop=true       # Loop carousels infinitely
```

### Update WhatsApp Number
In `index.html`, find `whatsapp` and update the phone number:

```javascript
const store = {
  whatsapp: "917879976016"      // Change to your WhatsApp Business number
};
```

## Testing

### Manual Testing
1. Open site in browser
2. Navigate categories, open products, try zoom/pan on images
3. Test on mobile devices at different viewport sizes

### Automated Testing (Playwright)
```bash
npm install
npm test  # Runs Playwright tests at 5", 6.5", 6.7" viewports
```

See [OPTIMIZATION_REPORT.md](OPTIMIZATION_REPORT.md) for test results.

### Test Social Previews
Use [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) to preview WhatsApp/Facebook link cards:
1. Paste a product URL: `https://mytinythreads.in/products/b001`
2. Click "Scrape Again" to refresh preview
3. Verify image, title, description appear correctly

## Deployment

### Netlify (Recommended)
**Option A: Drag & Drop**
1. Go to [app.netlify.com](https://app.netlify.com)
2. Drag project folder to deploy area
3. Set custom domain to `mytinythreads.in` in Site Settings

**Option B: Git (Recommended)**
1. Push to GitHub
2. In Netlify: "Add new site → Import from Git"
3. Select your repo
4. Every `git push` auto-deploys!

See [DEPLOY.md](DEPLOY.md) for complete setup guide.

### Cloudflare Workers
```bash
npm install -g @cloudflare/wrangler
wrangler deploy
```

## Performance Optimizations

- ✅ **Image Optimization**: Cloudinary auto-quality + format selection
- ✅ **Caching Strategy**: 1-year for static assets, 1-hour for product pages
- ✅ **Mobile CSS**: Reduced padding/margins on small screens (43% banner height reduction)
- ✅ **No JavaScript Frameworks**: Vanilla JS only (faster load)
- ✅ **Preconnect to Fonts**: Google Fonts preconnected for faster rendering

See [OPTIMIZATION_REPORT.md](OPTIMIZATION_REPORT.md) for detailed metrics.

## SEO & Social Sharing

- ✅ Open Graph tags for rich social previews
- ✅ Canonical URLs for all pages
- ✅ Structured data (JSON-LD) for Google rich snippets
- ✅ Meta descriptions on all pages
- ✅ Mobile-friendly design (Google PageSpeed Insights ready)

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Products not showing | Check Supabase `products` table; verify `active: true` |
| Images broken | Check Cloudinary URL; verify domain accessibility |
| WhatsApp link errors | Verify phone number in `tinythreads.properties` includes country code |
| Mobile layout broken | Check breakpoint `@media (max-width: 700px)` in CSS |
| Carousel not autoplaying | Restart browser; check `autoPlayInterval` in `tinythreads.properties` |

## Documentation

- **[DEPLOY.md](DEPLOY.md)** — Netlify deployment, WhatsApp integration, product generation
- **[OPTIMIZATION_REPORT.md](OPTIMIZATION_REPORT.md)** — Performance testing & mobile UX improvements
- **[AGENTS.md](AGENTS.md)** — AI agent guide for developers using Copilot, Claude, etc.

## Development Tips

- **Local Testing**: Use VS Code Live Server (right-click index.html → "Open with Live Server")
- **Mobile Preview**: Use DevTools device emulation or connect physical device
- **Debug Console**: Open DevTools (F12) to see logs and LocalStorage content
- **Performance**: Check Lighthouse scores in DevTools → Performance tab

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JavaScript (no frameworks) |
| Styling | CSS3 (custom properties, Grid, Flexbox) |
| Data | JSON (products.json) |
| Carousel | Swiper.js v11 |
| Images | Cloudinary (CDN with transforms) |
| Fonts | Google Fonts (Playfair Display, DM Sans) |
| Deployment | Netlify (primary) + Cloudflare Workers (optional) |
| Testing | Playwright |

## License

© 2026 Tinythreads Kidswear. All rights reserved.

## Support

For questions or issues:
1. Check [DEPLOY.md](DEPLOY.md) and [AGENTS.md](AGENTS.md)
2. Review [OPTIMIZATION_REPORT.md](OPTIMIZATION_REPORT.md)
3. Open an issue on GitHub
4. Contact via WhatsApp: +91 78799 76016

---

**Status**: ✅ Production-ready | **Last Updated**: May 2026
