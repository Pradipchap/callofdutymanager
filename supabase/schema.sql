-- Run this script in Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_select_registered_users"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create table if not exists public.combatants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  combatant_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.combatants
  add column if not exists combatant_user_id uuid references public.profiles(id) on delete cascade;

create index if not exists combatants_user_id_idx on public.combatants (user_id);
create index if not exists combatants_combatant_user_id_idx on public.combatants (combatant_user_id);
create unique index if not exists combatants_owner_target_uniq on public.combatants (user_id, combatant_user_id);

alter table public.combatants enable row level security;

create policy "combatants_select_own"
  on public.combatants
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "combatants_insert_own"
  on public.combatants
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "combatants_update_own"
  on public.combatants
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "combatants_delete_own"
  on public.combatants
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  mode text not null check (mode in ('knockout', 'league')),
  status text not null default 'active' check (status in ('active', 'completed')),
  players jsonb not null default '[]'::jsonb,
  state jsonb,
  results jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tournaments_user_id_idx on public.tournaments (user_id);
create index if not exists tournaments_created_at_idx on public.tournaments (created_at desc);

alter table public.tournaments enable row level security;

create policy "tournaments_select_own"
  on public.tournaments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "tournaments_insert_own"
  on public.tournaments
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "tournaments_update_own"
  on public.tournaments
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tournaments_delete_own"
  on public.tournaments
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_upload" on storage.objects;
create policy "avatars_owner_upload"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
