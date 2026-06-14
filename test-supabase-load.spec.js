const { test, expect } = require('@playwright/test');

test('Verify products load from Supabase', async ({ page }) => {
  console.log('📱 Testing Supabase product integration...\n');
  
  // Collect network requests
  const networkRequests = [];
  page.on('request', request => {
    networkRequests.push({
      url: request.url(),
      resourceType: request.resourceType()
    });
  });

  // Navigate to the app
  await page.goto('file:///c:/Users/admin/Documents/GitHub/tinythreads-catalogue/index.html', {
    waitUntil: 'networkidle'
  });

  // Wait for products to load
  await page.waitForTimeout(3000);

  // Check product data
  const productInfo = await page.evaluate(() => {
    return {
      allProductsLength: window.allProducts ? window.allProducts.length : 0,
      firstProduct: window.allProducts && window.allProducts.length > 0 ? {
        id: window.allProducts[0].id,
        name: window.allProducts[0].name,
        price: window.allProducts[0].price,
        category: window.allProducts[0].category
      } : null
    };
  });

  // Check Supabase API calls
  const supabaseRequests = networkRequests.filter(r => r.url.includes('supabase'));
  const gridItems = await page.locator('.prod-card').count();

  console.log(`✅ Products loaded: ${productInfo.allProductsLength} items`);
  if (productInfo.firstProduct) {
    console.log(`   First product: "${productInfo.firstProduct.name}" (${productInfo.firstProduct.category})`);
  }
  console.log(`📊 Supabase API calls: ${supabaseRequests.length}`);
  console.log(`🎨 Product cards rendered: ${gridItems}`);

  // Assertions
  expect(productInfo.allProductsLength).toBeGreaterThan(0);
  expect(gridItems).toBeGreaterThan(0);
  expect(productInfo.firstProduct).toBeTruthy();

  // Take screenshot
  await page.screenshot({ path: 'test-results/products-loaded.png', fullPage: true });
  console.log(`\n✓ Screenshot saved to test-results/products-loaded.png\n`);
});
