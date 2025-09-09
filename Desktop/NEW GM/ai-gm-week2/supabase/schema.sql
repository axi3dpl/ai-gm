
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

-- Memory tables -------------------------------------------------------------

create extension if not exists vector;

-- Canonical world state per campaign
create table if not exists public.canon (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.canon enable row level security;
create policy if not exists canon_select_own on public.canon for select using (
  auth.uid() = (select owner_id from public.campaigns c where c.id = campaign_id)
);
create policy if not exists canon_upsert_own on public.canon for all using (
  auth.uid() = (select owner_id from public.campaigns c where c.id = campaign_id)
) with check (
  auth.uid() = (select owner_id from public.campaigns c where c.id = campaign_id)
);

-- Episodic memory: short summaries of each scene
create table if not exists public.scene_summaries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  summary text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);
alter table public.scene_summaries enable row level security;
create policy if not exists scene_summaries_select_own on public.scene_summaries for select using (
  auth.uid() = (select owner_id from public.campaigns c where c.id = campaign_id)
);
create policy if not exists scene_summaries_insert_own on public.scene_summaries for insert with check (
  auth.uid() = (select owner_id from public.campaigns c where c.id = campaign_id)
);
create policy if not exists scene_summaries_delete_own on public.scene_summaries for delete using (
  auth.uid() = (select owner_id from public.campaigns c where c.id = campaign_id)
);

-- Semantic memory: long term facts
create table if not exists public.facts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  fact text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);
alter table public.facts enable row level security;
create policy if not exists facts_select_own on public.facts for select using (
  auth.uid() = (select owner_id from public.campaigns c where c.id = campaign_id)
);
create policy if not exists facts_insert_own on public.facts for insert with check (
  auth.uid() = (select owner_id from public.campaigns c where c.id = campaign_id)
);
create policy if not exists facts_delete_own on public.facts for delete using (
  auth.uid() = (select owner_id from public.campaigns c where c.id = campaign_id)
);

-- Helper functions for pgvector similarity search
create or replace function public.match_scene_summaries(
  campaign_id uuid,
  query_embedding vector(1536),
  match_count int default 5
) returns table(id uuid, summary text, similarity float)
language plpgsql
as $$
begin
  return query
  select s.id, s.summary, 1 - (s.embedding <#> query_embedding) as similarity
  from public.scene_summaries s
  where s.campaign_id = match_scene_summaries.campaign_id
  order by s.embedding <#> query_embedding
  limit match_count;
end;
$$;

create or replace function public.match_facts(
  campaign_id uuid,
  query_embedding vector(1536),
  match_count int default 5
) returns table(id uuid, fact text, similarity float)
language plpgsql
as $$
begin
  return query
  select f.id, f.fact, 1 - (f.embedding <#> query_embedding) as similarity
  from public.facts f
  where f.campaign_id = match_facts.campaign_id
  order by f.embedding <#> query_embedding
  limit match_count;
end;
$$;
