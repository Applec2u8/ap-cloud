-- Run once in Supabase SQL Editor. Existing releases remain private until explicitly published.
alter table public.releases
  add column if not exists is_public boolean not null default false;

alter table public.releases
  add column if not exists is_latest boolean not null default false;

-- Keep the newest existing row as the only Latest release before adding the constraint.
with ranked_latest as (
  select id, row_number() over (order by created_at desc, id desc) as row_number
  from public.releases
  where is_latest = true
)
update public.releases
set is_latest = false
where id in (select id from ranked_latest where row_number > 1);

create unique index if not exists releases_single_latest_idx
  on public.releases (is_latest)
  where is_latest = true;

create index if not exists releases_public_created_at_idx
  on public.releases (is_public, created_at desc);

-- Compatibility policy for the current client-side password gate.
-- IMPORTANT: a password checked in React is not a Supabase identity and can be
-- inspected by anyone who downloads the JavaScript bundle. Replace this policy
-- with an authenticated-admin policy after migrating the login to Supabase Auth.
drop policy if exists "Client admins can update release visibility" on public.releases;
create policy "Client admins can update release visibility"
  on public.releases for update to anon
  using (true)
  with check (true);

create or replace function public.set_latest_release(target_release_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.releases set is_latest = false where is_latest = true;
  update public.releases set is_latest = true where id = target_release_id;
  if not found then
    raise exception 'Release not found';
  end if;
end;
$$;

revoke all on function public.set_latest_release(uuid) from public;
grant execute on function public.set_latest_release(uuid) to anon;