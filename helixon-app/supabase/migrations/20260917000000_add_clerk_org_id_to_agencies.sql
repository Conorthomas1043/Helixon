-- Links a Helixon agency to its Clerk Organization, used for Agency-plan
-- team membership/invites. Nullable: Individual-plan agencies, and Agency-
-- plan agencies created before this feature shipped, have no org until
-- lazily created on first use of the invite flow (see lib/clerk-org.js).
ALTER TABLE public.agencies ADD COLUMN clerk_org_id text UNIQUE;
COMMENT ON COLUMN public.agencies.clerk_org_id IS 'Clerk Organization id backing this agency''s team membership/invites (Agency plan only). Null until lazily created.';
