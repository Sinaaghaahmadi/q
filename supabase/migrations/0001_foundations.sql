-- 0001 — Foundations: extensions, enums, helper functions (§11)
-- Conventions: every table gets id/created_at/updated_at/deleted_at (+created_by
-- where relevant); money is BIGINT minor units + currency code; rates are
-- NUMERIC(28,10); nothing is deleted, everything is audited (§0.6, §0.7).

create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────────────
create type public.app_role as enum (
  'customer',
  'office_viewer', 'office_operator', 'office_finance', 'office_owner',
  'platform_support', 'platform_compliance', 'platform_admin', 'platform_superadmin'
);

create type public.kyc_status as enum ('unverified', 'pending', 'approved', 'rejected', 'more_info_needed');

create type public.order_state as enum (
  'draft', 'submitted', 'matching', 'office_review', 'accepted',
  'awaiting_irt_funding', 'irt_funded', 'foreign_leg_pending', 'foreign_leg_sent',
  'recipient_confirmed', 'irt_released', 'completed',
  'on_hold', 'info_needed', 'disputed', 'cancelled', 'refunded', 'expired', 'sla_breached'
);

create type public.ledger_direction as enum ('debit', 'credit');
create type public.conversation_kind as enum ('order', 'p2p', 'support');
create type public.support_segment as enum ('customer', 'p2p', 'office');
create type public.notification_channel as enum ('inapp', 'push', 'sms', 'email');

-- ── Helpers ──────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Membership check used by nearly every RLS policy.
create or replace function public.has_role(roles public.app_role[], scope_kind text default null, scope uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.deleted_at is null
      and m.role = any (roles)
      and (scope_kind is null or m.scope_type = scope_kind)
      and (scope is null or m.scope_id = scope)
  );
$$;

create or replace function public.is_platform_staff()
returns boolean language sql stable as $$
  select public.has_role(array['platform_support','platform_compliance','platform_admin','platform_superadmin']::public.app_role[]);
$$;

create or replace function public.is_office_member(office uuid)
returns boolean language sql stable as $$
  select public.has_role(array['office_viewer','office_operator','office_finance','office_owner']::public.app_role[], 'office', office);
$$;

-- Append-only guard: attach as BEFORE UPDATE OR DELETE trigger.
create or replace function public.forbid_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'table % is append-only', tg_table_name;
end $$;
