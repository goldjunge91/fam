-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

ALTER TABLE public.household_members
  ADD COLUMN updated_at timestamp with time zone DEFAULT now() NOT NULL;

CREATE TRIGGER household_members_set_updated_at
  BEFORE UPDATE ON public.household_members
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE INDEX products_updated_idx ON public.products (updated_at, id);

ALTER TABLE public.storage_locations
  ADD COLUMN deleted_at timestamp with time zone;

CREATE INDEX storage_locations_household_updated_idx ON public.storage_locations (household_id, updated_at);