-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER PUBLICATION supabase_realtime ADD TABLE public.fridge_items, TABLE public.shopping_list_items;

ALTER TABLE public.fridge_items
  REPLICA IDENTITY FULL;

ALTER TABLE public.shopping_list_items
  REPLICA IDENTITY FULL;