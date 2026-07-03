# AGENTS

This repository is a static, mobile-first e-commerce catalogue for kidswear.
The main app is built with vanilla JavaScript and inline HTML/CSS in `index.html`.

## Key facts
- Main entry point: `index.html` (SPA with inline scripts and styling)
- App logic lives in `js/*.js` files
- UI styling is in `css/*.css`
- Account and order flow are implemented in `js/account.js`
- Product preview pages are under `products/`
- Cloudflare Workers config is in `wrangler.jsonc` and `_worker.js`
- No modern JS framework is used
- No build step is required for the main site; serve the files via a static webserver
- Test command: `npm test` (Playwright)

## Important docs
- `README.md` — project overview, features, and deploy instructions
- `DEPLOY.md` — deployment and WhatsApp integration guide
- `OPTIMIZATION_REPORT.md` — mobile UX and performance notes
- `TEST_GUIDE.md` — testing guidance
- `md files/AGENTS.md` — more detailed agent guidance for this repo

## Agent guidance
- Prefer modifying `index.html` and `js/*.js` directly
- Verify any product data or OG page logic before changing `products/` or worker config
- Treat `wrangler.jsonc` as optional edge deployment config rather than required for local development
- Use `npm test` to validate browser-level behavior
- If additional context is needed, consult `md files/AGENTS.md`
