-- nosh — row level security policies
-- Principle: clients (anon key) get read access scoped to their sessions;
-- all mutations flow through Edge Functions using the service role key.

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.sessions        enable row level security;
alter table public.session_members enable row level security;
alter table public.restaurants     enable row level security;
alter table public.swipes          enable row level security;
alter table public.known_users     enable row level security;

-- ---------------------------------------------------------------------------
-- Composite index for the membership lookup used by every policy
-- ---------------------------------------------------------------------------
create index if not exists session_members_session_user_idx
  on public.session_members (session_id, user_id);

-- ---------------------------------------------------------------------------
-- Helper: is the authenticated user a host or member of the given session?
-- security definer so inner queries bypass RLS (avoids circular evaluation).
-- (select auth.uid()) ensures the function is called once per statement.
-- ---------------------------------------------------------------------------
create or replace function public.is_session_participant(p_session_id uuid)
returns boolean
language sql
stable
security definer
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

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
-- Any participant (host or member) can read the session.
create policy "select: participant"
  on public.sessions for select
  to authenticated
  using (public.is_session_participant(id));

-- Authenticated users can create sessions as host.
create policy "insert: authenticated host"
  on public.sessions for insert
  to authenticated
  with check ((select auth.uid()) = host_id);

-- Only the host can update their session (status transitions, winner, etc.).
create policy "update: host only"
  on public.sessions for update
  to authenticated
  using ((select auth.uid()) = host_id);

-- ---------------------------------------------------------------------------
-- session_members
-- ---------------------------------------------------------------------------
-- Participants can see all members of sessions they belong to.
create policy "select: session participants"
  on public.session_members for select
  to authenticated
  using (public.is_session_participant(session_id));

-- Users can add themselves as a member.
create policy "insert: self"
  on public.session_members for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Members can update their own record (e.g. has_submitted).
create policy "update: own record"
  on public.session_members for update
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------
-- Session participants can view the restaurant cards for their session.
create policy "select: session participants"
  on public.restaurants for select
  to authenticated
  using (public.is_session_participant(session_id));

-- ---------------------------------------------------------------------------
-- swipes
-- ---------------------------------------------------------------------------
-- Session participants can see all swipes (needed for results display).
create policy "select: session participants"
  on public.swipes for select
  to authenticated
  using (public.is_session_participant(session_id));

-- Members can insert swipes for their own member record.
create policy "insert: own member"
  on public.swipes for insert
  to authenticated
  with check (
    member_id in (
      select id from public.session_members
      where user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- known_users
-- ---------------------------------------------------------------------------
-- Users can see relationships where they appear on either side.
create policy "select: own relationships"
  on public.known_users for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = known_user_id
  );
