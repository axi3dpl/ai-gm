
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  world text check (world in ('fantasy','scifi','horror','cyberpunk')) not null,
  synopsis text,
  created_at timestamptz default now()
);
alter table public.campaigns enable row level security;
create policy if not exists campaigns_select_own on public.campaigns for select using (auth.uid() = owner_id);
create policy if not exists campaigns_insert_own on public.campaigns for insert with check (auth.uid() = owner_id);
create policy if not exists campaigns_update_own on public.campaigns for update using (auth.uid() = owner_id);
create policy if not exists campaigns_delete_own on public.campaigns for delete using (auth.uid() = owner_id);
