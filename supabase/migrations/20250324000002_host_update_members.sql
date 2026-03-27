-- Allow the session host to update any member in their session
-- (e.g. setting is_skipped = true).
create policy "update: host can manage members"
  on public.session_members for update
  to authenticated
  using (
    exists (
      select 1 from public.sessions
      where id = session_id and host_id = (select auth.uid())
    )
  );
