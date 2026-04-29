-- Run once against the Neon database before the app goes live.
-- psql $DATABASE_URL -f db/schema.sql
-- or paste into the Neon SQL console.

create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id text unique not null,
  to_number text not null,
  phnum_id text not null,
  status text not null default 'active',
  fired_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text,
  estimated_hold_minutes int,
  hold_minutes_reported_at timestamptz
);

create index if not exists calls_fired_at_desc_idx on calls (fired_at desc);
create index if not exists calls_status_idx on calls (status);
