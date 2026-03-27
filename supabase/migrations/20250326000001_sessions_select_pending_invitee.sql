-- Invitees need invite_code before they join; participant-only SELECT blocked them.
-- Allow read access to a session row when this user has a pending in-app invite.
create policy "select: pending session invite"
  on public.sessions for select
  to authenticated
  using (
    exists (
      select 1
      from public.session_invites si
      where si.session_id = sessions.id
        and si.invitee_user_id = (select auth.uid())
        and si.status = 'pending'
    )
  );
