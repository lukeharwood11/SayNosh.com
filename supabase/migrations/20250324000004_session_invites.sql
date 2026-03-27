-- session_invites — in-app invitations sent between friends
create table public.session_invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  inviter_user_id uuid not null references auth.users (id) on delete cascade,
  invitee_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  constraint session_invites_no_self check (inviter_user_id <> invitee_user_id),
  constraint session_invites_unique unique (session_id, invitee_user_id)
);

create index session_invites_invitee_idx on public.session_invites (invitee_user_id, status);
create index session_invites_session_idx on public.session_invites (session_id);

alter table public.session_invites enable row level security;

-- Invitees can read their own invites
create policy "select: own invites"
  on public.session_invites for select
  to authenticated
  using ((select auth.uid()) = invitee_user_id);

-- Hosts can also see invites they sent
create policy "select: sent invites"
  on public.session_invites for select
  to authenticated
  using ((select auth.uid()) = inviter_user_id);

-- Invitees can update their own invites (accept / decline)
create policy "update: invitee response"
  on public.session_invites for update
  to authenticated
  using ((select auth.uid()) = invitee_user_id);

-- Enable realtime for invite notifications
alter publication supabase_realtime add table public.session_invites;
