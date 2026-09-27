-- Customers sign in through Clerk, so a profile no longer has a matching
-- auth.users row: lib/create-profile.js and the Clerk webhook insert
-- profiles with a fresh random uuid and link them by clerk_user_id.
--
-- But profiles.id still carried the pre-migration FK to auth.users(id), so
-- every one of those inserts failed the FK - no Clerk account has ever got a
-- profile, and the admin "Set up agency" action 500s. Same story for
-- subscriptions.user_id, which the app treats as a FK to profiles.id
-- (lib/customer-auth.js) but the database still pointed at auth.users.
--
-- The two legacy profiles keep their ids (which are their auth.users ids),
-- so nothing existing changes meaning.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
