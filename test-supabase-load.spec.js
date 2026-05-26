const { test, expect } = require('@playwright/test');

test('Test if products are loaded from Supabase or products.json', async ({ page }) => {
  // Collect all network requests
  const networkRequests = [];
  page.on('request', request => {
    networkRequests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType()
    });
  });

  // Navigate to the app
  console.log('📱 Navigating to index.html...');
  await page.goto('file:///c:/Users/admin/Documents/GitHub/Tinythreads_Catalogue/tinythreads-catalogue/index.html', {
    waitUntil: 'networkidle'
  });

  // Wait for products to load
  console.log('⏳ Waiting for products to load...');
  await page.waitForTimeout(3000);

  // Check if products were loaded
  const productInfo = await page.evaluate(() => {
    return {
      allProductsLength: window.allProducts ? window.allProducts.length : 0,
      allProductsType: typeof window.allProducts,
      firstProductSample: window.allProducts && window.allProducts.length > 0 ? {
        id: window.allProducts[0].id,
        name: window.allProducts[0].name,
        price: window.allProducts[0].price,
        category: window.allProducts[0].category,
        badge: window.allProducts[0].badge
      } : null,
      globalKeys: Object.keys(window).filter(k => k.includes('product') || k.includes('supabase') || k.includes('db')).slice(0, 20)
    };
  });

  console.log(`\n✅ Products Loaded: ${productInfo.allProductsLength} items`);
  if (productInfo.firstProductSample) {
    console.log('   First product:', productInfo.firstProductSample);
  }

  // Check network requests with details
  const supabaseRequests = networkRequests.filter(r => r.url.includes('supabase'));
  const productsJsonRequests = networkRequests.filter(r => r.url.includes('products.json'));
  const apiRequests = networkRequests.filter(r => r.url.includes('api') || r.url.includes('/rest/'));

  console.log(`\n📊 Network Activity:`);
  console.log(`   - Total requests: ${networkRequests.length}`);
  console.log(`   - Supabase requests: ${supabaseRequests.length}`);
  console.log(`   - products.json requests: ${productsJsonRequests.length}`);
  console.log(`   - API requests: ${apiRequests.length}`);

  if (apiRequests.length > 0) {
    console.log(`\n🔗 All API/Fetch requests:`);
    apiRequests.forEach(r => console.log(`   [${r.resourceType}] ${r.method}: ${r.url.substring(0, 120)}...`));
  }

  // Log ALL requests that aren't HTML/CSS/image/font
  const otherRequests = networkRequests.filter(r => 
    !['document', 'stylesheet', 'font', 'image', 'media'].includes(r.resourceType) &&
    !r.url.includes('tinythreads-load.spec.js')
  );

  if (otherRequests.length > 0) {
    console.log(`\n🔍 All other requests (JS, XHR, fetch):`);
    otherRequests.forEach(r => console.log(`   [${r.resourceType}] ${r.method}: ${r.url.substring(0, 120)}`));
  }

  // Check page content
  const gridItems = await page.locator('.prod-card').count();
  const featuredGrid = await page.locator('#featured-grid .prod-card').count();
  
  console.log(`\n🎨 Page Rendering:`);
  console.log(`   - Total product cards: ${gridItems}`);
  console.log(`   - Featured products: ${featuredGrid}`);

  // Take screenshot
  await page.screenshot({ path: 'test-results/products-loaded.png', fullPage: true });
  console.log(`\n✓ Screenshot saved`);

  // VERDICT
  console.log(`\n${'='.repeat(70)}`);
  if (supabaseRequests.length > 0) {
    console.log(`✅ VERDICT: Products ARE being loaded from SUPABASE`);
  } else if (productsJsonRequests.length > 0) {
    console.log(`✅ VERDICT: Products are being loaded from products.json`);
  } else if (productInfo.allProductsLength > 0) {
    console.log(`✅ VERDICT: Products are loaded in allProducts array (source: unknown)`);
  } else if (gridItems > 0) {
    console.log(`⚠️ VERDICT: Products rendering but NOT in allProducts`);
    console.log(`           Source: EMBEDDED FALLBACK DATA (hard-coded in HTML)`);
  } else {
    console.log(`❌ VERDICT: No products found anywhere`);
  }
  console.log(`${'='.repeat(70)}\n`);
});
