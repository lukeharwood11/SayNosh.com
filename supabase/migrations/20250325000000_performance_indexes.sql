-- Performance indexes for RLS and common query patterns

-- Swipes: member_id used in INSERT RLS policy subquery
create index if not exists swipes_member_id_idx
  on public.swipes (member_id);

-- Swipes: composite index for calculate-results queries
create index if not exists swipes_session_round_member_idx
  on public.swipes (session_id, round, member_id);

-- Sessions: composite index for history page ordering
create index if not exists sessions_host_created_idx
  on public.sessions (host_id, created_at desc);

-- Restaurants: composite covering index for result queries
create index if not exists restaurants_session_round_id_idx
  on public.restaurants (session_id, round, id);

-- Mark is_session_participant as stable + parallel safe for planner hints
create or replace function public.is_session_participant(p_session_id uuid)
returns boolean
language sql
stable
security definer
parallel safe
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions
    where id = p_session_id and host_id = (select auth.uid())
  )
  or exists (
    select 1 from public.session_members
    where session_id = p_session_id and user_id = (select auth.uid())
  );
$$;
