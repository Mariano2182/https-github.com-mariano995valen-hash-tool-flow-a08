-- Supabase schema + RLS for project versioning (free tier compatible)

-- EXTENSION (para gen_random_uuid si hace falta)
-- create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade
);

alter table public.organizations enable row level security;

create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',  -- owner/member
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
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

-- -------------------------------
-- POLICIES: ORGANIZATIONS
-- -------------------------------

-- Select: solo miembros
create policy "organizations_select_member"
  on public.organizations
  for select
  using (
    exists (
      select 1
      from public.org_memberships m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
    )
  );

-- Insert: cualquier usuario autenticado puede crear org, pero debe setear created_by = auth.uid()
create policy "organizations_insert_auth"
  on public.organizations
  for insert
  with check (auth.uid() = created_by);

-- Update: solo owner de esa org
create policy "organizations_update_owner"
  on public.organizations
  for update
  using (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
        and m.role = 'owner'
        and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
        and m.role = 'owner'
        and m.status = 'active'
    )
  );

-- -------------------------------
-- POLICIES: MEMBERSHIPS
-- -------------------------------

-- Select: el usuario ve sus memberships
create policy "org_memberships_select_own"
  on public.org_memberships
  for select
  using (auth.uid() = user_id);

-- Insert: el usuario puede crearse membership a sí mismo
-- (ej: cuando crea la org y luego se agrega como owner)
create policy "org_memberships_insert_self"
  on public.org_memberships
  for insert
  with check (auth.uid() = user_id);

-- Update: solo owner puede actualizar memberships dentro de su org
create policy "org_memberships_update_owner"
  on public.org_memberships
  for update
  using (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = org_memberships.org_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
        and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = org_memberships.org_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
        and m.status = 'active'
    )
  );

-- -------------------------------
-- POLICIES: PROJECTS
-- -------------------------------

-- Select: miembros de la org
create policy "projects_select_member"
  on public.projects
  for select
  using (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = projects.org_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- Insert: solo miembros activos pueden crear proyectos
create policy "projects_insert_member"
  on public.projects
  for insert
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.org_memberships m
      where m.org_id = projects.org_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- Update/Delete: solo owner
create policy "projects_update_owner"
  on public.projects
  for update
  using (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = projects.org_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
        and m.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = projects.org_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
        and m.status = 'active'
    )
  );

create policy "projects_delete_owner"
  on public.projects
  for delete
  using (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = projects.org_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
        and m.status = 'active'
    )
  );

-- -------------------------------
-- POLICIES: PROJECT VERSIONS
-- -------------------------------

create policy "project_versions_select_own_or_member"
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

create policy "project_versions_insert_own_or_member"
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

create policy "project_versions_update_own_or_member"
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

create policy "project_versions_delete_own_or_member"
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

-- -------------------------------
-- POLICIES: CATALOG VERSIONS
-- -------------------------------

create policy "catalog_versions_select_own_or_member"
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

create policy "catalog_versions_insert_own_or_member"
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

create policy "catalog_versions_update_own_or_member"
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

create policy "catalog_versions_delete_own_or_member"
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
