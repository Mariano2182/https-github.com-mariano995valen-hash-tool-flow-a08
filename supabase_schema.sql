-- RMM STRUCTURES — Supabase schema + RLS (MVP avanzado)
-- Free tier compatible

create extension if not exists pgcrypto;

-- =========================
-- CORE TABLES
-- =========================

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member', -- member | admin
  status text not null default 'active', -- active | invited | disabled
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- =========================
-- VERSIONING TABLES
-- =========================

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

-- =========================
-- RLS ENABLE
-- =========================

alter table public.organizations enable row level security;
alter table public.org_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.project_versions enable row level security;
alter table public.catalog_versions enable row level security;

-- =========================
-- HELPERS (inline checks)
-- =========================

-- "Is active member of org"
-- Used as EXISTS subquery in policies.

-- =========================
-- POLICIES: organizations
-- =========================

-- Select: only members can read
create policy "organizations_select_member"
  on public.organizations
  for select
  using (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- Insert: any authenticated user can create an org
create policy "organizations_insert_auth"
  on public.organizations
  for insert
  with check (auth.uid() is not null);

-- Update/Delete: only org admins
create policy "organizations_update_admin"
  on public.organizations
  for update
  using (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  );

create policy "organizations_delete_admin"
  on public.organizations
  for delete
  using (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  );

-- =========================
-- POLICIES: org_memberships
-- =========================

-- Select: any active member can see members of their org
create policy "org_memberships_select_org"
  on public.org_memberships
  for select
  using (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = org_memberships.org_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- Insert: allow user to self-join (MVP) OR admin can invite others
create policy "org_memberships_insert_self"
  on public.org_memberships
  for insert
  with check (user_id = auth.uid());

create policy "org_memberships_insert_admin"
  on public.org_memberships
  for insert
  with check (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = org_memberships.org_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  );

-- Update/Delete: only org admins
create policy "org_memberships_update_admin"
  on public.org_memberships
  for update
  using (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = org_memberships.org_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = org_memberships.org_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  );

create policy "org_memberships_delete_admin"
  on public.org_memberships
  for delete
  using (
    exists (
      select 1 from public.org_memberships m
      where m.org_id = org_memberships.org_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  );

-- =========================
-- POLICIES: projects
-- =========================

-- Select: members of org can read
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

-- Insert: members can create (created_by must be current user)
create policy "projects_insert_member"
  on public.projects
  for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.org_memberships m
      where m.org_id = projects.org_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- Update/Delete: creator or org admin
create policy "projects_update_creator_or_admin"
  on public.projects
  for update
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.org_memberships m
      where m.org_id = projects.org_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from public.org_memberships m
      where m.org_id = projects.org_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  );

create policy "projects_delete_creator_or_admin"
  on public.projects
  for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.org_memberships m
      where m.org_id = projects.org_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  );

-- =========================
-- POLICIES: project_versions
-- =========================

create policy "project_versions_select"
  on public.project_versions
  for select
  using (
    auth.uid() = owner_id
    or (
      project_id is not null
      and exists (
        select 1
        from public.org_memberships m
        join public.projects p on p.org_id = m.org_id
        where p.id = project_versions.project_id
          and m.user_id = auth.uid()
          and m.status = 'active'
      )
    )
  );

create policy "project_versions_insert"
  on public.project_versions
  for insert
  with check (
    auth.uid() = owner_id
    or (
      project_id is not null
      and exists (
        select 1
        from public.org_memberships m
        join public.projects p on p.org_id = m.org_id
        where p.id = project_versions.project_id
          and m.user_id = auth.uid()
          and m.status = 'active'
      )
    )
  );

create policy "project_versions_update"
  on public.project_versions
  for update
  using (
    auth.uid() = owner_id
    or (
      project_id is not null
      and exists (
        select 1
        from public.org_memberships m
        join public.projects p on p.org_id = m.org_id
        where p.id = project_versions.project_id
          and m.user_id = auth.uid()
          and m.status = 'active'
      )
    )
  )
  with check (
    auth.uid() = owner_id
    or (
      project_id is not null
      and exists (
        select 1
        from public.org_memberships m
        join public.projects p on p.org_id = m.org_id
        where p.id = project_versions.project_id
          and m.user_id = auth.uid()
          and m.status = 'active'
      )
    )
  );

create policy "project_versions_delete"
  on public.project_versions
  for delete
  using (
    auth.uid() = owner_id
    or (
      project_id is not null
      and exists (
        select 1
        from public.org_memberships m
        join public.projects p on p.org_id = m.org_id
        where p.id = project_versions.project_id
          and m.user_id = auth.uid()
          and m.status = 'active'
      )
    )
  );

-- =========================
-- POLICIES: catalog_versions
-- =========================

create policy "catalog_versions_select"
  on public.catalog_versions
  for select
  using (
    auth.uid() = owner_id
    or (
      project_id is not null
      and exists (
        select 1
        from public.org_memberships m
        join public.projects p on p.org_id = m.org_id
        where p.id = catalog_versions.project_id
          and m.user_id = auth.uid()
          and m.status = 'active'
      )
    )
  );

create policy "catalog_versions_insert"
  on public.catalog_versions
  for insert
  with check (
    auth.uid() = owner_id
    or (
      project_id is not null
      and exists (
        select 1
        from public.org_memberships m
        join public.projects p on p.org_id = m.org_id
        where p.id = catalog_versions.project_id
          and m.user_id = auth.uid()
          and m.status = 'active'
      )
    )
  );

create policy "catalog_versions_update"
  on public.catalog_versions
  for update
  using (
    auth.uid() = owner_id
    or (
      project_id is not null
      and exists (
        select 1
        from public.org_memberships m
        join public.projects p on p.org_id = m.org_id
        where p.id = catalog_versions.project_id
          and m.user_id = auth.uid()
          and m.status = 'active'
      )
    )
  )
  with check (
    auth.uid() = owner_id
    or (
      project_id is not null
      and exists (
        select 1
        from public.org_memberships m
        join public.projects p on p.org_id = m.org_id
        where p.id = catalog_versions.project_id
          and m.user_id = auth.uid()
          and m.status = 'active'
      )
    )
  );

create policy "catalog_versions_delete"
  on public.catalog_versions
  for delete
  using (
    auth.uid() = owner_id
    or (
      project_id is not null
      and exists (
        select 1
        from public.org_memberships m
        join public.projects p on p.org_id = m.org_id
        where p.id = catalog_versions.project_id
          and m.user_id = auth.uid()
          and m.status = 'active'
      )
    )
  );

-- =========================
-- INDEXES (performance)
-- =========================

create index if not exists idx_org_memberships_org_user
  on public.org_memberships (org_id, user_id);

create index if not exists idx_projects_org
  on public.projects (org_id);

create index if not exists idx_project_versions_owner_created
  on public.project_versions (owner_id, created_at desc);

create index if not exists idx_project_versions_project_created
  on public.project_versions (project_id, created_at desc);

create index if not exists idx_catalog_versions_owner_created
  on public.catalog_versions (owner_id, created_at desc);

create index if not exists idx_catalog_versions_project_created
  on public.catalog_versions (project_id, created_at desc);
