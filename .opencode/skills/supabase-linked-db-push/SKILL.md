---
name: supabase-linked-db-push
description: |
  Apply Supabase migrations normally by pushing pending local migrations to the linked database.

  Triggers when user mentions:
  - "apply migrations normally"
  - "push supabase migrations"
  - "deploy pending migrations"
---
# supabase-linked-db-push

This skill applies pending migrations without resetting the database first. It infers what it can do from your existing Supabase CLI state: if you're already logged in and the repo is linked, it can target the linked project; if you pass `--local`, it can push to your local stack instead.

`.env.example` defines the minimum config for this skill. In this case, no extra environment variables are required.

## Quick Usage (Already Configured)

### Push pending migrations to the linked database
```bash
./.opencode/skills/supabase-linked-db-push/scripts/push-linked-migrations.sh
```

### Preview pending migrations without applying them
```bash
./.opencode/skills/supabase-linked-db-push/scripts/push-linked-migrations.sh --dry-run
```

### Push to the local database instead
```bash
./.opencode/skills/supabase-linked-db-push/scripts/push-linked-migrations.sh --local
```

## Scripts

- `scripts/push-linked-migrations.sh` runs `supabase db push` from the repo root.
- By default it targets the linked project.
- Pass `--local` to target your local database.
- Pass flags like `--dry-run`, `--include-all`, or `--include-seed` as needed.

## Common Gotchas

- This skill only applies pending migrations; it does not delete existing data.
- The default target is `--linked`, so confirm the repo is linked to the correct Supabase project.
- If remote migration history drifted, you may need `--include-all` or a reset flow instead.
- If Supabase CLI is not installed or you are not logged in, the script will fail fast.

## First-Time Setup (If Not Configured)

1. Install the Supabase CLI.
2. From the repo root, run `supabase login`.
3. Link the repo with `supabase link --project-ref <YOUR_PROJECT_REF>`.
4. Review `.env.example`; it shows the minimum config for this skill and currently requires no variables.
5. Run the push script, optionally with `--dry-run` first.
