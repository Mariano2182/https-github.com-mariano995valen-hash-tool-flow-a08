-- Supabase schema + RLS for project versioning (free tier compatible)

create table if not exists public.project_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid,
  project_id uuid,
  project_name text not null,
  client_name text,
  bim_json jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.project_versions enable row level security;

create policy "project_versions_select_own"
  on public.project_versions
  for select
  using (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.org_memberships m
      join public.projects p on p.org_id = m.org_id
      where p.id = project_versions.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "project_versions_insert_own"
  on public.project_versions
  for insert
  with check (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.org_memberships m
      join public.projects p on p.org_id = m.org_id
      where p.id = project_versions.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "project_versions_update_own"
  on public.project_versions
  for update
  using (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.org_memberships m
      join public.projects p on p.org_id = m.org_id
      where p.id = project_versions.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  )
  with check (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.org_memberships m
      join public.projects p on p.org_id = m.org_id
      where p.id = project_versions.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "project_versions_delete_own"
  on public.project_versions
  for delete
  using (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.org_memberships m
      join public.projects p on p.org_id = m.org_id
      where p.id = project_versions.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.org_memberships enable row level security;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "organizations_select_member"
  on public.organizations
  for select
  using (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = organizations.id and m.user_id = auth.uid()
    )
  );

create policy "org_memberships_select_own"
  on public.org_memberships
  for select
  using (auth.uid() = user_id);

create policy "projects_select_member"
  on public.projects
  for select
  using (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = projects.org_id and m.user_id = auth.uid()
    )
  );

create table if not exists public.catalog_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid,
  project_id uuid,
  project_name text not null,
  company_name text,
  catalog_json jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.catalog_versions enable row level security;

create policy "catalog_versions_select_own"
  on public.catalog_versions
  for select
  using (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.org_memberships m
      join public.projects p on p.org_id = m.org_id
      where p.id = catalog_versions.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "catalog_versions_insert_own"
  on public.catalog_versions
  for insert
  with check (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.org_memberships m
      join public.projects p on p.org_id = m.org_id
      where p.id = catalog_versions.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "catalog_versions_update_own"
  on public.catalog_versions
  for update
  using (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.org_memberships m
      join public.projects p on p.org_id = m.org_id
      where p.id = catalog_versions.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  )
  with check (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.org_memberships m
      join public.projects p on p.org_id = m.org_id
      where p.id = catalog_versions.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

create policy "catalog_versions_delete_own"
  on public.catalog_versions
  for delete
  using (
    auth.uid() = owner_id
    or exists (
      select 1
      from public.org_memberships m
      join public.projects p on p.org_id = m.org_id
      where p.id = catalog_versions.project_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );
