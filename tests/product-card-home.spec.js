const { test, expect } = require('@playwright/test');

test.describe('revived home product card', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('tt_partner_match', JSON.stringify({
        name: 'Test Partner',
        resellerId: 'test',
        societyName: 'Test Society'
      }));
    });
    await page.goto('http://127.0.0.1:5500/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Array.isArray(window.allProducts) && window.allProducts.length > 0);
    await expect(page.locator('#tt-home-collection-products .tt-product-card').first()).toBeVisible({ timeout: 15000 });
  });

  test('uses the shared card on home and category grids', async ({ page }) => {
    await expect(page.locator('#tt-home-collection-products .tt-product-card')).not.toHaveCount(0);
    await expect(page.locator('#boys-grid .tt-product-card')).not.toHaveCount(0);
    await expect(page.locator('#boys-grid .prod-card')).toHaveCount(0);

    const firstCard = page.locator('#tt-home-collection-products .tt-product-card').first();
    await expect(firstCard.locator('.tt-pc-title')).toBeVisible();
    await expect(firstCard.locator('.tt-pc-price')).toContainText('₹');
    await expect(firstCard.locator('.tt-pc-action')).toHaveCount(3);
  });

  test('renders every product image in a top-anchored cover swiper', async ({ page }) => {
    await page.evaluate(() => {
      const product = window.allProducts[0];
      const available = window.allProducts
        .flatMap(item => Array.isArray(item.images) ? item.images : [])
        .filter(Boolean);
      product.images = [available[0], available[1] || available[0], available[2] || available[0]];
      window.TTProductCard.renderInto(
        document.getElementById('tt-home-collection-products'),
        [product],
        { context: 'home' }
      );
    });

    const swiper = page.locator('#tt-home-collection-products .tt-pc-swiper');
    await expect(swiper.locator('.swiper-slide')).toHaveCount(3);
    await expect(swiper.locator('.swiper-pagination')).toHaveCount(1);

    const media = await swiper.locator('img').first().evaluate(image => ({
      fit: getComputedStyle(image).objectFit,
      position: getComputedStyle(image).objectPosition,
      optimized: image.dataset.optimized
    }));
    expect(media.fit).toBe('cover');
    expect(media.position).toBe('50% 0%');
    expect(media.optimized).toContain('c_fill,ar_4:5,g_north');
  });

  test('quick add selects a variant and uses the existing basket', async ({ page }) => {
    const count = page.locator('#nav-basket-count');
    await expect(count).toHaveText('0');

    await page.locator('#tt-home-collection-products .tt-pc-action--add').first().click();
    const overlay = page.locator('#tt-quick-add-overlay');
    await expect(overlay).toHaveClass(/is-open/);

    const sizeChoice = overlay.locator('[data-tt-qa-choice="size"]').first();
    if (await sizeChoice.count()) await sizeChoice.click();

    const addButton = overlay.locator('[data-tt-qa-action="add"]');
    await expect(addButton).toBeEnabled();
    await addButton.click();

    await expect(overlay).not.toHaveClass(/is-open/);
    await expect(count).toHaveText('1');
  });

  test('uses the shared card for similar products', async ({ page }) => {
    await page.evaluate(() => {
      const source = window.allProducts[0];
      window.allProducts.push({
        ...source,
        id: 'phase2-similar-product',
        name: 'Similar Tinythreads Style'
      });
      window.openPDP(source.id);
    });

    const similarCard = page.locator('#sim-track .tt-product-card').first();
    await expect(similarCard).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#sim-track .sim-card')).toHaveCount(0);
    await expect(similarCard.locator('.tt-pc-action')).toHaveCount(3);
  });

  test('keeps the wishlist badge, drawer and product hearts synchronized', async ({ page }) => {
    const firstCard = page.locator('#tt-home-collection-products .tt-product-card').first();
    const wishlistBadge = page.locator('#nav-wishlist-count');
    const drawer = page.locator('#wishlist-drawer');

    await firstCard.locator('.tt-pc-action--wish').click();
    await expect(wishlistBadge).toHaveText('1');

    await page.locator('.wishlist-nav-btn').click();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer.locator('.wishlist-item')).toHaveCount(1);

    await drawer.locator('.wishlist-add').click();
    await expect(drawer).not.toHaveClass(/open/);
    await expect(page.locator('#tt-quick-add-overlay')).toHaveClass(/is-open/);
    await page.locator('#tt-quick-add-overlay [data-tt-qa-action="close"]').click();

    await page.locator('.wishlist-nav-btn').click();
    await drawer.locator('.wishlist-delete').click();
    await expect(wishlistBadge).toHaveText('0');
    await expect(drawer.locator('.wishlist-item')).toHaveCount(0);
    await expect(firstCard.locator('.tt-pc-action--wish')).not.toHaveClass(/is-active/);
  });

  test('keeps the wishlist, basket and account actions visible at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });

    const actions = page.locator('.wishlist-nav-btn, .nav-right > .basket-nav-btn:not(.wishlist-nav-btn):not(.account-nav-btn), .account-nav-btn');
    await expect(actions).toHaveCount(3);
    await expect(actions.nth(0)).toBeVisible();
    await expect(actions.nth(1)).toBeVisible();
    await expect(actions.nth(2)).toBeVisible();

    const layout = await page.evaluate(() => {
      const selectors = [
        '.wishlist-nav-btn',
        '.nav-right > .basket-nav-btn:not(.wishlist-nav-btn):not(.account-nav-btn)',
        '.account-nav-btn'
      ];
      const rects = selectors.map(selector => document.querySelector(selector).getBoundingClientRect());
      return {
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        fits: rects.every(rect => rect.left >= 0 && rect.right <= window.innerWidth),
        separated: rects[0].right <= rects[1].left && rects[1].right <= rects[2].left
      };
    });

    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.fits).toBeTruthy();
    expect(layout.separated).toBeTruthy();
  });

  test('opens the partner campaign as a lazy-loaded bottom sheet', async ({ page }) => {
    const image = page.locator('#tt-partner-opportunity-image');
    const sheet = page.locator('#tt-partner-opportunity-sheet');

    await expect(image).not.toHaveAttribute('src', /.+/);
    await page.locator('.tt-about-action--partner').evaluate(button => button.click());

    await expect(sheet).toHaveClass(/open/);
    await expect(sheet).toHaveAttribute('aria-hidden', 'false');
    await expect(image).toHaveAttribute('src', './assets/tinythreads-partner-opportunity.png');
    await expect(sheet.locator('.tt-partner-opportunity-cta')).toHaveAttribute('href', /wa\.me\/917879976016/);

    await sheet.locator('.tt-partner-opportunity-close').click();
    await expect(sheet).not.toHaveClass(/open/);
    await expect(sheet).toHaveAttribute('aria-hidden', 'true');
  });

  test('auto-advances the Chapter Two collection carousel', async ({ page }) => {
    const rail = page.locator('.tt-home-collections');
    await rail.scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);

    const before = await rail.evaluate(element => element.scrollLeft);
    await page.waitForTimeout(3400);
    const after = await rail.evaluate(element => element.scrollLeft);

    expect(after).toBeGreaterThan(before + 20);
  });
});
