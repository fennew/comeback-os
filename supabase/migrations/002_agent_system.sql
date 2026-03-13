-- ============================================================
-- AGENT CONFIGS
-- ============================================================

create table public.agent_configs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug            text not null,
  name            text not null,
  description     text,
  system_prompt   text,
  model           text not null default 'claude-sonnet-4-20250514',
  temperature     numeric(3,2) not null default 0.7,
  max_tokens      integer not null default 4096,
  tools           jsonb not null default '[]',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(organization_id, slug)
);

alter table public.agent_configs enable row level security;

create policy "Members can read agent configs"
  on public.agent_configs for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Members can manage agent configs"
  on public.agent_configs for all
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

-- ============================================================
-- CONVERSATIONS
-- ============================================================

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  agent_slug      text not null,
  title           text,
  status          text not null default 'active',
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy "Members can read conversations"
  on public.conversations for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Members can create conversations"
  on public.conversations for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

create policy "Members can update conversations"
  on public.conversations for update
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

-- ============================================================
-- MESSAGES
-- ============================================================

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content         text,
  tool_calls      jsonb,
  tool_call_id    text,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

create index idx_messages_conversation on public.messages(conversation_id, created_at);

alter table public.messages enable row level security;

create policy "Members can read messages"
  on public.messages for select
  using (
    conversation_id in (
      select id from public.conversations
      where organization_id in (
        select organization_id from public.organization_members
        where user_id = auth.uid()
      )
    )
  );

create policy "Members can create messages"
  on public.messages for insert
  with check (
    conversation_id in (
      select id from public.conversations
      where organization_id in (
        select organization_id from public.organization_members
        where user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- TASKS
-- ============================================================

create table public.tasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  agent_slug      text not null,
  title           text not null,
  description     text,
  status          text not null default 'pending' check (status in ('pending', 'in_progress', 'review', 'completed', 'cancelled')),
  priority        text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  result          text,
  metadata        jsonb not null default '{}',
  due_date        timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_tasks_org_status on public.tasks(organization_id, status);

alter table public.tasks enable row level security;

create policy "Members can manage tasks"
  on public.tasks for all
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

-- ============================================================
-- AGENT HANDOFFS
-- ============================================================

create table public.agent_handoffs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  client_id         uuid references public.clients(id) on delete set null,
  from_agent_slug   text not null,
  to_agent_slug     text not null,
  task_id           uuid references public.tasks(id) on delete set null,
  context           text not null,
  instructions      text,
  status            text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  result            text,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

alter table public.agent_handoffs enable row level security;

create policy "Members can manage handoffs"
  on public.agent_handoffs for all
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

-- ============================================================
-- TIME ENTRIES (auto-tracked agent work)
-- ============================================================

create table public.time_entries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  agent_slug      text not null,
  task_id         uuid references public.tasks(id) on delete set null,
  description     text,
  duration_ms     integer not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.time_entries enable row level security;

create policy "Members can read time entries"
  on public.time_entries for all
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid()
    )
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  type            text not null,
  title           text not null,
  body            text,
  link            text,
  is_read         boolean not null default false,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "Users can update own notifications"
  on public.notifications for update
  using (user_id = auth.uid());

-- ============================================================
-- KLAVIYO METRICS CACHE
-- ============================================================

create table public.klaviyo_metrics_cache (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  metric_type     text not null,
  data            jsonb not null default '{}',
  period_start    date,
  period_end      date,
  fetched_at      timestamptz not null default now(),
  unique(client_id, metric_type, period_start, period_end)
);

alter table public.klaviyo_metrics_cache enable row level security;

create policy "Members can manage klaviyo metrics"
  on public.klaviyo_metrics_cache for all
  using (
    client_id in (
      select c.id from public.clients c
      join public.organization_members om on om.organization_id = c.organization_id
      where om.user_id = auth.uid()
    )
  );
