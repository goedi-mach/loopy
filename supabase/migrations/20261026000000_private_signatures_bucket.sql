-- Move the veterinarian signature out of the public "templates" bucket.
-- Signed-in users can read it (certificate generation); nobody else can.
-- Uploads happen from the Supabase dashboard / service role only (no insert policy on purpose).

insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do nothing;

create policy "Signed-in users can read signatures"
on storage.objects
for select
to authenticated
using (bucket_id = 'signatures');
