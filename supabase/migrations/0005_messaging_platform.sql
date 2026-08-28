-- 0005 — Messaging engine, notifications, audit, platform tables (§10, §11, §12)

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null,
  subject_id uuid,                              -- order id / p2p trade id / null for support
  segment public.support_segment,               -- support inbox segmentation (§10)
  status text not null default 'open' check (status in ('open','pending','resolved','archived')),
  assigned_to uuid references public.profiles (id),
  last_message_at timestamptz,
  sla_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id),
  user_id uuid not null references public.profiles (id),
  role text not null default 'member',
  last_read_at timestamptz,
  muted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (conversation_id, user_id)
);

-- Messages are immutable (§10): edits create a new revision row.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id),
  sender_id uuid references public.profiles (id),
  body text,
  attachments jsonb not null default '[]'::jsonb,
  is_internal_note boolean not null default false,   -- office notes, invisible to customers (§8.3)
  flags jsonb not null default '{}'::jsonb,          -- abuse / off-platform detection (§9)
  revision_of uuid references public.messages (id),
  created_at timestamptz not null default now()
);
create index messages_conversation on public.messages (conversation_id, created_at);
create trigger t_messages_append_only
  before update or delete on public.messages
  for each row execute function public.forbid_mutation();

-- ── Notifications (§12) ─────────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  channel public.notification_channel not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed','skipped')),
  sent_at timestamptz,
  error text,
  provider_msg_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  locale text not null,
  channel public.notification_channel not null,
  subject text,
  body text not null,
  variables jsonb not null default '[]'::jsonb,   -- declared schema, validated (§12)
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (key, locale, channel)
);

-- ── Audit log: append-only, no update/delete for anyone (§0.7, §15) ─────────
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  ip inet,
  created_at timestamptz not null default now()
);
create index audit_log_entity on public.audit_log (entity_type, entity_id, created_at desc);
create trigger t_audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.forbid_mutation();
revoke update, delete on public.audit_log from anon, authenticated;

-- ── Platform config (§11) ───────────────────────────────────────────────────
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  enabled boolean not null default false,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.business_calendar (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  date date not null,
  is_holiday boolean not null default true,
  half_day boolean not null default false,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (country, date)
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cms_content (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  locale text not null,
  type text not null check (type in ('page','faq','banner','announcement')),
  title text not null,
  body text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (key, locale)
);

create table public.job_queue (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  run_after timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  locked_by text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index job_queue_due on public.job_queue (run_after) where locked_at is null and deleted_at is null;

-- updated_at triggers
create trigger t_conversations_updated before update on public.conversations for each row execute function public.set_updated_at();
create trigger t_participants_updated before update on public.conversation_participants for each row execute function public.set_updated_at();
create trigger t_notifications_updated before update on public.notifications for each row execute function public.set_updated_at();
create trigger t_templates_updated before update on public.notification_templates for each row execute function public.set_updated_at();
create trigger t_flags_updated before update on public.feature_flags for each row execute function public.set_updated_at();
create trigger t_calendar_updated before update on public.business_calendar for each row execute function public.set_updated_at();
create trigger t_settings_updated before update on public.settings for each row execute function public.set_updated_at();
create trigger t_cms_updated before update on public.cms_content for each row execute function public.set_updated_at();
create trigger t_jobs_updated before update on public.job_queue for each row execute function public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_templates enable row level security;
alter table public.audit_log enable row level security;
alter table public.feature_flags enable row level security;
alter table public.business_calendar enable row level security;
alter table public.settings enable row level security;
alter table public.cms_content enable row level security;
alter table public.job_queue enable row level security;

create policy conversations_participant on public.conversations
  for select using (
    public.is_platform_staff()
    or exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = id and p.user_id = auth.uid() and p.deleted_at is null
    )
  );

create policy participants_self on public.conversation_participants
  for select using (user_id = auth.uid() or public.is_platform_staff());

-- Internal notes never reach non-staff participants (§8.3).
create policy messages_participant_read on public.messages
  for select using (
    (
      exists (
        select 1 from public.conversation_participants p
        where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()
      )
      and (not is_internal_note or public.is_platform_staff()
           or exists (
             select 1 from public.conversations c
             join public.orders o on o.id = c.subject_id
             where c.id = messages.conversation_id and c.kind = 'order'
               and o.office_id is not null and public.is_office_member(o.office_id)
           ))
    )
    or public.is_platform_staff()
  );
create policy messages_participant_write on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()
    )
  );

create policy notifications_own on public.notifications
  for select using (user_id = auth.uid() or public.is_platform_staff());

create policy templates_staff on public.notification_templates
  for select using (public.is_platform_staff());

-- Audit log: staff read; inserts come from security-definer functions / service role.
create policy audit_log_staff_read on public.audit_log
  for select using (
    public.has_role(array['platform_admin','platform_superadmin','platform_compliance']::public.app_role[])
  );

create policy feature_flags_public_read on public.feature_flags for select using (true);
create policy calendar_public_read on public.business_calendar for select using (true);
create policy settings_staff on public.settings
  for select using (public.is_platform_staff());
create policy cms_published_read on public.cms_content
  for select using (published_at is not null or public.is_platform_staff());
create policy job_queue_staff on public.job_queue
  for select using (public.is_platform_staff());
