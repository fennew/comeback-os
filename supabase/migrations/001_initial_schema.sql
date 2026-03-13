-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  avatar_url    text,
  role          text not null default 'owner',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_id      uuid not null references public.profiles(id),
  settings      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- ============================================================
-- ORGANIZATION MEMBERS
-- ============================================================

create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text not null default 'member',
  created_at      timestamptz not null default now(),
  unique(organization_id, user_id)
);

alter table public.organization_members enable row level security;

-- ============================================================
-- RLS POLICIES (after both tables exist so they can cross-reference)
-- ============================================================

create policy "Members can read their organizations"
  on public.organizations for select
  using (
    id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Owners can update their organizations"
  on public.organizations for update
  using (owner_id = auth.uid());

create policy "Members can read their org members"
  on public.organization_members for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

-- ============================================================
-- CLIENTS
-- ============================================================

create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  logo_url        text,
  brand_colors    text,
  brand_voice     text,
  industry        text,
  website         text,
  notes           text,
  status          text not null default 'active',
  monthly_retainer numeric(10,2),
  contract_start  date,
  contract_end    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.clients enable row level security;

create policy "Members can read their org clients"
  on public.clients for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Members can insert clients"
  on public.clients for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Members can update clients"
  on public.clients for update
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Members can delete clients"
  on public.clients for delete
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

-- ============================================================
-- CLIENT INTEGRATIONS
-- ============================================================

create table public.client_integrations (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  provider        text not null,
  credentials     jsonb not null default '{}',
  config          jsonb not null default '{}',
  status          text not null default 'connected',
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(client_id, provider)
);

alter table public.client_integrations enable row level security;

create policy "Members can manage client integrations"
  on public.client_integrations for all
  using (
    client_id in (
      select c.id from public.clients c
      join public.organization_members om on om.organization_id = c.organization_id
      where om.user_id = auth.uid()
    )
  );

-- ============================================================
-- AUTO-CREATE PROFILE + ORG ON SIGNUP
-- (placed AFTER all tables exist)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );

  -- Auto-create organization for new user
  insert into public.organizations (name, owner_id)
  values (
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email) || '''s Agency',
    new.id
  );

  -- Add user as org member
  insert into public.organization_members (organization_id, user_id, role)
  select id, new.id, 'owner'
  from public.organizations
  where owner_id = new.id
  limit 1;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
