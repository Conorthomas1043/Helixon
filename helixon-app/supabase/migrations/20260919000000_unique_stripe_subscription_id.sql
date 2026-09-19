-- A Stripe subscription may entitle exactly one profile. lib/create-profile.js
-- (linkSubscriptionFromStripeSession) already refuses to link a subscription
-- that another profile holds, but that check-then-write can race: two
-- simultaneous claims of the same paid Checkout Session could both pass the
-- check. This index makes the database the final arbiter - the second write
-- fails with unique_violation (23505), which the code turns into a clean
-- "already claimed" result.
--
-- Partial (WHERE ... IS NOT NULL) so rows without a Stripe subscription id
-- aren't forced to be unique against each other. IF NOT EXISTS keeps this
-- safe to re-run.
--
-- If this fails because duplicates exist, find them with:
--   select stripe_subscription_id, count(*) from public.subscriptions
--   where stripe_subscription_id is not null
--   group by 1 having count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_key
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
