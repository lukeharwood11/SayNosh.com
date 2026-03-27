-- Friends list is derived from session_members only; known_users is redundant.

drop policy if exists "select: own relationships" on public.known_users;

drop table if exists public.known_users;
