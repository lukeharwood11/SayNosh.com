<p align="center">
  <img src="web/public/favicon.svg" alt="nosh logo" width="120" height="120" />
</p>

# nosh

**Where your group finally agrees on dinner.**

Nosh helps a group pick somewhere to eat without the endless back-and-forth. Someone starts a session, others join, and everyone swipes on nearby restaurants (yes, no, or “meh”) until the app surfaces places everyone can live with. This repository contains the **Vite + React + TypeScript** web client, **Supabase** (Postgres, auth, and Edge Functions), and **Terraform** for hosting the static site.

Product behavior, screens, and database schema are defined in [`nosh_full_spec.html`](./nosh_full_spec.html).

## Layout

| Path | Purpose |
|------|---------|
| `web/` | Vite + React + TypeScript + Tailwind frontend |
| `terraform/` | Production hosting infra for `saynosh.com` (S3 + CloudFront + Route53) |
| `supabase/migrations/` | Postgres schema (sessions, members, restaurants, swipes, known users) |
| `supabase/functions/` | Edge Function stubs (`create-session`, `join-session`, …) |
| `TODO.md` | Step-by-step setup: Supabase CLI, Google Cloud / Places API (New), secrets |

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local DB and deploying functions)
- A Supabase project (hosted or local)

## Frontend

```bash
cd web
cp .env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
# Optional: VITE_PUBLIC_POSTHOG_PROJECT_TOKEN and VITE_PUBLIC_POSTHOG_HOST for PostHog analytics
npm install
npm run dev
```

Production builds run from `web/` and output to `web/dist/`. If you use PostHog, set `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` and `VITE_PUBLIC_POSTHOG_HOST` in `.env.production` (or the build environment) so events are sent from the built bundle. Omitted variables disable analytics in the client.

In PostHog project settings, enable **exception autocapture** (Error tracking) if you want unhandled JS errors reported as `$exception` events.

### E2E tests (Playwright)

From `web/` with `.env.local` (or `.env`) containing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`:

```bash
npx playwright install chromium
npm run test:e2e
```

For a **local Supabase** stack, create the standard test users with `./create_test_users.sh local` from the repo root, then run the full suite (including authenticated and multiplayer specs) with:

```bash
npm run test:e2e:local
```

That command sets the local `ta-1@saynosh.com` / `ta-2@saynosh.com` credentials (`TestAccount1234`) before invoking Playwright; it does not read passwords from `.env`.

Use `npm run test:e2e:ui` for the Playwright UI. The test runner starts the dev server on port `5173` with `--strictPort`, so nothing else should bind that port during the run.

Optional logged-in coverage without `test:e2e:local`: set `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` to an existing Supabase user that uses email/password sign-in. Add `E2E_TEST_EMAIL_B` and `E2E_TEST_PASSWORD_B` for multiplayer/realtime specs. If the primary pair is unset, only unauthenticated specs run.

The GitHub Actions workflow [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) needs repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. PostHog variables are not required for CI; the app skips PostHog when `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` is unset. Add `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` if you want the authenticated navigation tests in CI.

## Database

From the repo root (with CLI logged in and project linked — see `TODO.md`):

```bash
supabase db push
# or locally:
supabase start
supabase db reset
```

Migrations apply the tables described in the spec. **Row Level Security is not enabled yet**; add policies before production.

## Edge Functions

The frontend should use the Supabase **publishable** key. Functions that need a user must be called after sign-in so `supabase.functions.invoke(...)` can send the user's access token as the `Authorization` bearer token.

Stubs return JSON `{ stub: true, … }`. Serve locally:

```bash
supabase functions serve
```

Deploy when implementations exist:

```bash
supabase functions deploy create-session
# …repeat per function name under supabase/functions/
```

## Terraform deploy

This repo now mirrors the `../amia` Terraform deployment shape:

- `terraform-plan.yml` builds the frontend, runs `terraform plan`, and uploads both the Terraform plan and built site as artifacts.
- `terraform-apply.yml` downloads those artifacts, runs `terraform apply`, syncs `web/dist/` to S3, and invalidates CloudFront.
- Infra is intentionally minimal: **Route53 → CloudFront → private S3 bucket**. Supabase Edge Functions stay outside AWS.

Local Terraform workflow:

```bash
cd terraform
terraform init
terraform plan
```

Important copied defaults from `../amia` that you may want to confirm before first deploy:

- Terraform state bucket: `lukeharwood-dev-tfstate`
- Terraform lock table: `lukeharwood-dev-tf-lock`
- GitHub OIDC role: `arn:aws:iam::891612573605:role/github-oidc`
- Default AWS region for app infra: `us-east-1`
- Terraform backend region: `us-east-2`

The ACM lookup expects an **issued us-east-1 certificate** for `saynosh.com`, which matches the cert you already created.

## Documentation

- Setup checklist: [`TODO.md`](./TODO.md)
- Visual / product spec: [`nosh_full_spec.html`](./nosh_full_spec.html)
