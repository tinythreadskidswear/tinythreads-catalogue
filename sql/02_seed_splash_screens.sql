-- ═══════════════════════════════════════════════════════════════
-- SEED DATA FOR SPLASH SCREENS
-- ═══════════════════════════════════════════════════════════════
-- Initial 6 splash screen slides (same as hardcoded in index.html)
-- After running: verify with SELECT * FROM public.splash_screens;

-- Clear existing data (optional - uncomment to reset)
-- DELETE FROM public.splash_screens;

-- Insert initial 6 splash screens
INSERT INTO public.splash_screens 
  (sequence_order, channel, mobile_image_url, desktop_image_url, alt_text, is_active)
VALUES

-- Slide 1: Festive Girls
(1, 'both',
  'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_600,h_900,g_north,q_auto,f_auto/v1777272488/tinythreads/IMG-20260117-WA0008_ds6761.jpg',
  'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_900,h_580,g_north,q_auto,f_auto/v1777272488/tinythreads/IMG-20260117-WA0008_ds6761.jpg',
  'Festive Girls Collection',
  true
),

-- Slide 2: Boys Kurta
(2, 'both',
  'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_600,h_900,g_north,q_auto,f_auto/v1777128347/tinythreads/IMG-20250927-WA0043_ulau1j.jpg',
  'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_900,h_580,g_north,q_auto,f_auto/v1777128347/tinythreads/IMG-20250927-WA0043_ulau1j.jpg',
  'Boys Kurta Set',
  true
),

-- Slide 3: Baby Set
(3, 'both',
  'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_600,h_900,g_north,q_auto,f_auto/v1777201920/tinythreads/IMG-20240409-WA0025_gaqztv.jpg',
  'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_900,h_580,g_north,q_auto,f_auto/v1777201920/tinythreads/IMG-20240409-WA0025_gaqztv.jpg',
  'Baby Set Collection',
  true
),

-- Slide 4: Lehenga Choli
(4, 'both',
  'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_600,h_900,g_north,q_auto,f_auto/v1777199204/tinythreads/IMG-20250905-WA0049_wtizuu.jpg',
  'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_900,h_580,g_north,q_auto,f_auto/v1777199204/tinythreads/IMG-20250905-WA0049_wtizuu.jpg',
  'Lehenga Choli for Girls',
  true
),

-- Slide 5: Active Wear Boys
(5, 'both',
  'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_600,h_900,g_north,q_auto,f_auto/v1777267700/tinythreads/IMG-20260405-WA0051_kehitm.jpg',
  'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_900,h_580,g_north,q_auto,f_auto/v1777267700/tinythreads/IMG-20260405-WA0051_kehitm.jpg',
  'Active Wear for Boys',
  true
),

-- Slide 6: Party Wear Girls
(6, 'both',
  'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_600,h_900,g_north,q_auto,f_auto/v1777267316/tinythreads/1773835328475_e1a5lf.png',
  'https://res.cloudinary.com/tinythreads/image/upload/c_fill,w_900,h_580,g_north,q_auto,f_auto/v1777267316/tinythreads/1773835328475_e1a5lf.png',
  'Party Wear for Girls',
  true
);

-- ═══════════════════════════════════════════════════════════════
-- VERIFY INSERTION
-- ═══════════════════════════════════════════════════════════════
-- Run this query to verify:
-- SELECT id, sequence_order, channel, alt_text, is_active 
--   FROM public.splash_screens 
--   ORDER BY sequence_order;
-- 
-- Expected: 6 rows, all active, ordered 1-6
-- ═══════════════════════════════════════════════════════════════
