-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

GRANT ALL ON public.brochure_dumps TO anon;

GRANT ALL ON public.brochure_dumps TO authenticated;

GRANT ALL ON public.brochure_dumps TO service_role;

GRANT ALL ON public.brochure_stores TO anon;

GRANT ALL ON public.brochure_stores TO authenticated;

GRANT ALL ON public.brochure_stores TO service_role;

GRANT ALL ON public.favorite_brochure_stores TO anon;

GRANT ALL ON public.favorite_brochure_stores TO authenticated;

GRANT ALL ON public.favorite_brochure_stores TO service_role;