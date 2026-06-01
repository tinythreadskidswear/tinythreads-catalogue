-- ═══════════════════════════════════════════════════════════════
-- SPLASH SCREENS TABLE
-- ═══════════════════════════════════════════════════════════════
-- Create splash_screens table for dynamic splash screen management
-- Supports desktop, mobile, and device-specific images

CREATE TABLE IF NOT EXISTS public.splash_screens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_order integer NOT NULL UNIQUE CHECK (sequence_order > 0),
  channel varchar(20) NOT NULL CHECK (channel IN ('desktop', 'mobile', 'both')),
  mobile_image_url text NOT NULL,
  desktop_image_url text NOT NULL,
  alt_text text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════
-- Speed up queries for active slides ordered by sequence
CREATE INDEX IF NOT EXISTS idx_splash_active_order 
  ON public.splash_screens(is_active, sequence_order);

CREATE INDEX IF NOT EXISTS idx_splash_sequence 
  ON public.splash_screens(sequence_order);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════
-- Allow public read access to splash screens
ALTER TABLE public.splash_screens ENABLE ROW LEVEL SECURITY;

-- Public can read all active splash screens
CREATE POLICY "Allow public read active splash screens"
  ON public.splash_screens
  FOR SELECT
  USING (is_active = true);

-- Only authenticated admins can manage (update, insert, delete)
CREATE POLICY "Allow admins to manage splash screens"
  ON public.splash_screens
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════
-- COMMENTS (Documentation)
-- ═══════════════════════════════════════════════════════════════
COMMENT ON TABLE public.splash_screens IS 
  'Dynamic splash screen carousel images. Admin can update without code deployment.';

COMMENT ON COLUMN public.splash_screens.sequence_order IS 
  'Display order in carousel (1=first, 2=second, etc.)';

COMMENT ON COLUMN public.splash_screens.channel IS 
  'Device targeting: desktop (701px+), mobile (<700px), or both';

COMMENT ON COLUMN public.splash_screens.mobile_image_url IS 
  'Portrait image URL (600x900px recommended for Cloudinary)';

COMMENT ON COLUMN public.splash_screens.desktop_image_url IS 
  'Landscape image URL (900x580px recommended for Cloudinary)';

COMMENT ON COLUMN public.splash_screens.alt_text IS 
  'Accessibility alt text for images (screen readers, SEO)';

COMMENT ON COLUMN public.splash_screens.is_active IS 
  'Enable/disable slide without deleting. Archived slides set to false.';

-- ═══════════════════════════════════════════════════════════════
-- USAGE
-- ═══════════════════════════════════════════════════════════════
-- SELECT * FROM public.splash_screens 
--   WHERE is_active = true 
--   ORDER BY sequence_order;
-- ═══════════════════════════════════════════════════════════════
