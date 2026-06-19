// ════════════════════════════════════════════════════════════
// TINY THREADS — splash-init.js
// Bootstraps the splash screen images once supabase-splash.js
// (external file, unchanged) has loaded. Load this AFTER
// supabase-splash.js.
// ════════════════════════════════════════════════════════════

    // Initialize splash screen images on page load (non-blocking)
    // Waits for supabase-splash.js to load before calling function
    function initSplash() {
      if (typeof initSplashScreenImages === 'function') {
        initSplashScreenImages();
      } else {
        // If script not loaded yet, retry after 100ms
        setTimeout(initSplash, 100);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initSplash);
    } else {
      initSplash();
    }
