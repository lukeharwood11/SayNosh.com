-- nosh — initial schema (see nosh_full_spec.html)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  host_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'swiping', 'round_two', 'completed')),
  invite_code text not null,
  filters jsonb not null default '{}'::jsonb,
  winner_restaurant_id uuid,
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create unique index sessions_invite_code_key on public.sessions (invite_code);
create index sessions_host_id_idx on public.sessions (host_id);
create index sessions_status_idx on public.sessions (status);

-- ---------------------------------------------------------------------------
-- session_members
-- ---------------------------------------------------------------------------
create table public.session_members (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  has_submitted boolean not null default false,
  is_skipped boolean not null default false
);

create index session_members_session_id_idx on public.session_members (session_id);
create index session_members_user_id_idx on public.session_members (user_id);

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  external_id text not null,
  name text not null,
  address text,
  image_url text,
  rating numeric,
  price_level int,
  is_open_now boolean,
  round int not null default 1 check (round in (1, 2))
);

create index restaurants_session_id_idx on public.restaurants (session_id);
create index restaurants_session_round_idx on public.restaurants (session_id, round);

alter table public.sessions
  add constraint sessions_winner_restaurant_id_fkey
  foreign key (winner_restaurant_id) references public.restaurants (id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- swipes
-- ---------------------------------------------------------------------------
create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  member_id uuid not null references public.session_members (id) on delete cascade,
  vote text not null check (vote in ('yes', 'no', 'neutral')),
  round int not null default 1 check (round in (1, 2)),
  unique (member_id, restaurant_id, round)
);

create index swipes_session_id_idx on public.swipes (session_id);

-- ---------------------------------------------------------------------------
-- known_users
-- ---------------------------------------------------------------------------
create table public.known_users (
  user_id uuid not null references auth.users (id) on delete cascade,
  known_user_id uuid not null references auth.users (id) on delete cascade,
  first_met_session_id uuid references public.sessions (id) on delete set null,
  last_session_id uuid references public.sessions (id) on delete set null,
  session_count int not null default 1,
  primary key (user_id, known_user_id),
  constraint known_users_not_self check (user_id <> known_user_id)
);

create index known_users_known_user_id_idx on public.known_users (known_user_id);

-- ---------------------------------------------------------------------------
-- Realtime (optional): subscribe to member progress / session updates
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.session_members;

comment on table public.sessions is 'Group dining sessions; product spec: nosh_full_spec.html';
comment on table public.session_members is 'Participants; user_id null for guests';
comment on column public.swipes.vote is 'yes | no | neutral (neutral = meh in UI)';
-- RLS policies are in the next migration (20250324000001_enable_rls.sql).
