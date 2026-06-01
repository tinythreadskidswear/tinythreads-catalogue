/**
 * ═══════════════════════════════════════════════════════════════
 * SUPABASE CONFIGURATION & SPLASH SCREEN UTILITIES
 * ═══════════════════════════════════════════════════════════════
 * Handles:
 * - Supabase client initialization
 * - Fetching splash images with caching
 * - Responsive image rendering
 * - Graceful fallback to hardcoded images
 * 
 * Architecture: Instant display + background refresh (zero lag)
 */

// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════

// Replace these with your Supabase project credentials
const SUPABASE_CONFIG = {
  URL: 'https://your-project.supabase.co',      // Replace with your Supabase URL
  ANON_KEY: 'your-anon-public-key'               // Replace with your public key
};

// Initialize Supabase client (lazy loaded)
let supabaseClient = null;

function initSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  
  if (typeof supabase === 'undefined') {
    console.warn('Supabase JS library not loaded. Add to <head>:\n<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    return null;
  }
  
  supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
  return supabaseClient;
}

// ═══════════════════════════════════════════════════════════════
// CACHE MANAGEMENT (localStorage)
// ═══════════════════════════════════════════════════════════════

const CACHE_KEY = 'splash_images_cache';
const CACHE_TIMESTAMP_KEY = 'splash_images_cache_time';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function getCachedSplashImages() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    
    if (!cached || !timestamp) return null;
    
    // Check if cache is expired
    if (Date.now() - parseInt(timestamp) > CACHE_TTL) {
      clearSplashCache();
      return null;
    }
    
    return JSON.parse(cached);
  } catch (err) {
    console.error('Cache read error:', err);
    return null;
  }
}

function setSplashCache(images) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(images));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (err) {
    console.error('Cache write error:', err);
    // Fail silently - not critical
  }
}

function clearSplashCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  } catch (err) {
    console.error('Cache clear error:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// FETCH SPLASH IMAGES (with timeout & error handling)
// ═══════════════════════════════════════════════════════════════

async function fetchSplashImagesFromSupabase() {
  try {
    const client = initSupabaseClient();
    if (!client) {
      console.warn('Supabase client not initialized. Using hardcoded images.');
      return null;
    }
    
    // Fetch active splash screens ordered by sequence
    const { data, error } = await client
      .from('splash_screens')
      .select('*')
      .eq('is_active', true)
      .order('sequence_order', { ascending: true })
      .timeout(3000); // 3 second timeout
    
    if (error) {
      console.warn('Supabase fetch error:', error.message);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.warn('No active splash screens in database.');
      return null;
    }
    
    return data;
  } catch (err) {
    console.error('Splash image fetch error:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN API: Fetch Splash Images with Smart Caching
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch splash images with caching strategy
 * Priority:
 * 1. localStorage cache (instant, <5ms)
 * 2. Supabase API (fresh, 200-500ms)
 * 3. Hardcoded fallback (if both fail)
 * 
 * Non-blocking: Returns cached immediately, fetches fresh in background
 */
async function fetchSplashImages() {
  // 1. Check cache first (instant return for repeat visitors)
  const cached = getCachedSplashImages();
  if (cached) {
    console.log('Using cached splash images');
    
    // Fetch fresh in background (silently update if available)
    fetchSplashImagesFromSupabase().then(fresh => {
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(cached)) {
        console.log('Fresh splash images available, updating...');
        setSplashCache(fresh);
        updateSplashSlides(fresh); // Silent update while carousel plays
      }
    });
    
    return cached;
  }
  
  // 2. First visit: fetch from Supabase (with timeout)
  console.log('Fetching splash images from Supabase...');
  const fresh = await fetchSplashImagesFromSupabase();
  
  if (fresh) {
    setSplashCache(fresh);
    return fresh;
  }
  
  // 3. Fallback: return null (use hardcoded images)
  console.log('Using hardcoded splash images (API unavailable)');
  return null;
}

// ═══════════════════════════════════════════════════════════════
// DOM MANIPULATION: Update Splash Slides Dynamically
// ═══════════════════════════════════════════════════════════════

function updateSplashSlides(images) {
  try {
    const splashSlides = document.querySelector('.splash-slides');
    if (!splashSlides) {
      console.error('splash-slides container not found');
      return;
    }
    
    // Clear existing slides
    splashSlides.innerHTML = '';
    
    // Create new slides from database images
    images.forEach((image, index) => {
      const slide = createSplashSlideElement(image, index === 0);
      splashSlides.appendChild(slide);
    });
    
    console.log(`Updated ${images.length} splash slides from Supabase`);
    
    // Reinitialize carousel if it was already running
    if (window.splashCarousel) {
      window.splashCarousel.update();
    }
  } catch (err) {
    console.error('Error updating splash slides:', err);
  }
}

/**
 * Create HTML element for a single splash slide
 * Uses responsive <picture> element for device-specific images
 */
function createSplashSlideElement(imageData, isFirstSlide) {
  const div = document.createElement('div');
  div.className = `splash-slide ${isFirstSlide ? 'active' : ''}`;
  
  const picture = document.createElement('picture');
  
  // Desktop source (min-width: 701px)
  const source = document.createElement('source');
  source.media = '(min-width:701px)';
  source.srcset = imageData.desktop_image_url;
  picture.appendChild(source);
  
  // Mobile image (fallback)
  const img = document.createElement('img');
  img.src = imageData.mobile_image_url;
  img.alt = imageData.alt_text || 'Splash screen image';
  img.loading = isFirstSlide ? 'eager' : 'lazy';
  if (isFirstSlide) {
    img.fetchpriority = 'high';
  }
  picture.appendChild(img);
  
  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'slide-overlay';
  
  div.appendChild(picture);
  div.appendChild(overlay);
  
  return div;
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION: Call on page load (non-blocking)
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize splash screen images on page load
 * Runs asynchronously - doesn't block page render
 * 
 * Usage: Call in <script> section after splash-slides HTML is loaded
 */
async function initSplashScreenImages() {
  console.log('[Splash] Initializing splash screen images...');
  
  try {
    // Fetch splash images (with caching)
    // This is non-blocking - carousel starts immediately with hardcoded images
    const splashImages = await fetchSplashImages();
    
    if (splashImages && splashImages.length > 0) {
      // Update only if we have fresh data
      updateSplashSlides(splashImages);
    }
    // If null, carousel continues with hardcoded images (no lag)
    
  } catch (err) {
    console.error('[Splash] Initialization error:', err);
    // Continue with hardcoded images - no user-facing error
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS (for testing & manual calls)
// ═══════════════════════════════════════════════════════════════

// Make functions available globally if needed
if (typeof window !== 'undefined') {
  window.splashUtils = {
    fetchSplashImages,
    initSplashScreenImages,
    clearSplashCache,
    getCachedSplashImages,
    updateSplashSlides,
    fetchSplashImagesFromSupabase
  };
}
