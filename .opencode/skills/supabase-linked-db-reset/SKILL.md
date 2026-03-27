---
name: supabase-linked-db-reset
description: |
  Reset a linked Supabase database by deleting existing objects and reapplying local migrations.

  Triggers when user mentions:
  - "delete everything and reapply migrations"
  - "reset the linked supabase database"
  - "drop and rerun migrations"
---
# supabase-linked-db-reset

This skill resets a Supabase database and reapplies the migrations in `supabase/migrations/`. It infers what it can do from your existing Supabase CLI state: if you're already logged in and the repo is linked, it can target the linked project; if you pass `--local`, it can target your local stack instead.

`.env.example` defines the minimum config for this skill. In this case, no extra environment variables are required.

## Quick Usage (Already Configured)

### Reset the linked database and reapply migrations
```bash
./.opencode/skills/supabase-linked-db-reset/scripts/reset-linked-db.sh
```

### Reset the local database instead
```bash
./.opencode/skills/supabase-linked-db-reset/scripts/reset-linked-db.sh --local
```

## Scripts

- `scripts/reset-linked-db.sh` runs `supabase db reset` from the repo root.
- By default it targets the linked project.
- Pass `--local` to reset the local database instead.
- Any extra Supabase CLI flags are forwarded to `supabase db reset`.

## Common Gotchas

- This is destructive. Existing tables, data, and migration history in the chosen target are removed before migrations are reapplied.
- The default target is `--linked`, so make sure the repo is linked to the intended Supabase project.
- If you want a non-destructive migration deploy, use `supabase-linked-db-push` instead.
- If Supabase CLI is not installed or you are not logged in, the script will fail fast.

## First-Time Setup (If Not Configured)

1. Install the Supabase CLI.
2. From the repo root, run `supabase login`.
3. Link the repo with `supabase link --project-ref <YOUR_PROJECT_REF>`.
4. Review `.env.example`; it shows the minimum config for this skill and currently requires no variables.
5. Run the reset script and confirm the destructive prompt from the CLI.
