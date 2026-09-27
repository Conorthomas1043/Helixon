-- The app stores the signed-in person's Clerk user id ("user_2abc...") in
-- these columns - app/api/run writes candidates.user_id/recruiter_id,
-- jobs.user_id and scores.user_id; app/api/candidates/[id]/notes writes
-- candidate_notes.author_id; lib/recruiter-directory.js and app/api/team
-- read recruiter_id back as a Clerk id. But the columns were still the
-- pre-Clerk uuid FKs to auth.users (and recruiters), so every one of those
-- writes failed with "invalid input syntax for type uuid" - Clerk users
-- could not run an analysis, create a job or add a note.
--
-- Convert them to text and drop the stale FKs. Existing values (old
-- auth.users uuids) are kept as their text form.

ALTER TABLE public.candidates
  DROP CONSTRAINT IF EXISTS candidates_user_id_fkey,
  DROP CONSTRAINT IF EXISTS candidates_recruiter_id_fkey,
  ALTER COLUMN user_id TYPE text USING user_id::text,
  ALTER COLUMN recruiter_id TYPE text USING recruiter_id::text;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_user_id_fkey,
  ALTER COLUMN user_id TYPE text USING user_id::text;

ALTER TABLE public.scores
  DROP CONSTRAINT IF EXISTS scores_user_id_fkey,
  ALTER COLUMN user_id TYPE text USING user_id::text;

ALTER TABLE public.candidate_notes
  DROP CONSTRAINT IF EXISTS candidate_notes_author_id_fkey,
  ALTER COLUMN author_id TYPE text USING author_id::text;
