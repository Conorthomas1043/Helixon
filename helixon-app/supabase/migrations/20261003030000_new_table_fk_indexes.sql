-- Covering indexes for the foreign keys added on 2026-10-03 (flagged by the
-- Supabase performance advisor). Without them, deleting a client, contact,
-- job, interview, placement or agency scans these tables.

create index if not exists candidate_portal_links_agency_idx on public.candidate_portal_links (agency_id);
create index if not exists client_opportunities_contact_idx on public.client_opportunities (contact_id);
create index if not exists client_opportunities_job_idx on public.client_opportunities (job_id);
create index if not exists clients_terms_signature_idx on public.clients (terms_signature_id);
create index if not exists interview_booking_links_agency_idx on public.interview_booking_links (agency_id);
create index if not exists interview_booking_links_contact_idx on public.interview_booking_links (contact_id);
create index if not exists interview_booking_links_interview_idx on public.interview_booking_links (interview_id);
create index if not exists interview_booking_links_job_idx on public.interview_booking_links (job_id);
create index if not exists signature_requests_placement_idx on public.signature_requests (placement_id);
