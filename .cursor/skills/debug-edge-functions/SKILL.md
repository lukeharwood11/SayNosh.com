---
name: debug-edge-functions
description: Debug Supabase Edge Functions locally and remotely. Use when investigating non-200 responses, 401/500 errors from edge functions, reading function logs, diagnosing deployed function failures, or when the user mentions edge function errors.
---

# Debug Supabase Edge Functions

## Architecture Overview

Requests to Edge Functions pass through two layers:

1. **Supabase Edge Runtime relay** — validates the request before your code runs (JWT check, routing)
2. **Your function code** — `Deno.serve(...)` handler in `index.ts`

A 401/500 can come from either layer. Identifying which layer responded is the first debugging step.

## Distinguishing Relay vs Function Errors

| Signal | Relay error | Function error |
|--------|------------|----------------|
| `execution_id` in log metadata | `null` | A UUID |
| CORS headers in response | Absent | Present (`Access-Control-Allow-Origin: *`) |
| Error format | Varies | `{"error":"..."}` from `json()` helper |
| Terminal message (local) | `Error: Missing authorization header` from `sb-compile-edge-runtime` | `console.error(...)` output |

## Local Debugging

### Viewing logs

`supabase functions serve` prints all output to the terminal:
- `console.log()` / `console.error()` from function code
- Relay-level errors (e.g., `Missing authorization header`, `Legacy token type detected`)

### Common local issues

- **`Missing authorization header`** from the relay: The Edge Runtime relay requires an `Authorization` header. Ensure the client calls `functions.setAuth(accessToken)` before invoking.
- **`Legacy token type detected`**: The relay received a non-JWT key (e.g., publishable key) instead of a user access token.

## Remote Debugging

### CLI logs

```bash
# Fetch recent logs
supabase functions logs <function-name> --project-ref <ref>

# Real-time tail
supabase functions logs <function-name> --project-ref <ref> --scroll

# Time-scoped
supabase functions logs <function-name> --project-ref <ref> --since 1h
```

### Dashboard

**Supabase Dashboard > Edge Functions > (select function) > Logs**

Shows HTTP status, execution time, and all `console.log` / `console.error` output.

### Reading log metadata

Key fields in remote log entries:

- **`execution_id`**: `null` means the relay rejected the request before your code ran
- **`execution_time_ms`**: How long the function took (if it ran)
- **`response.status_code`**: The HTTP status returned
- **`sb.jwt`**: Shows parsed JWT details — check `expires_at`, `role`, `invalid` fields
- **`sb.apikey`**: Shows which key was sent

## Diagnosing 401 Errors

### Step 1: Did the function code execute?

Check `execution_id` in the log metadata. If `null`, the relay rejected the request.

### Step 2: Relay-level 401

Common causes:
- **`--no-verify-jwt` not applied**: This flag is per-deployment. Re-deploying without it resets to JWT verification enabled. Redeploy with:
  ```bash
  supabase functions deploy <name> --no-verify-jwt
  ```
  Or redeploy all functions using the project script:
  ```bash
  ./deploy-supabase-functions.sh
  ```
- **Transient auth service issue**: The relay validates JWT signatures against the Auth service. Momentary unavailability causes sporadic 401s.
- **Key rotation / cold start**: A stale signing key cache on a cold-started runtime instance.

### Step 3: Function-level 401

The `requireAuth` function in `supabase/functions/_shared/auth.ts` returns 401 when:
- No `Authorization: Bearer <token>` header is present
- `admin.auth.getUser(token)` fails (expired token, revoked session, invalid signature)

## Diagnosing 500 Errors

Check for:
- **Missing env vars**: `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` not set in the deployed environment
- **Database insert failures**: RLS policies, constraint violations, or schema mismatches
- **Unhandled exceptions**: Caught by the top-level `try/catch` and logged via `console.error`

## Auth Flow Reference

### Server side

`supabase/functions/_shared/auth.ts` — `requireAuth(req)`:
- Extracts `Bearer` token from `Authorization` header
- Creates a service-role admin client
- Calls `admin.auth.getUser(token)` to validate
- Returns `{ user, admin }` or a 401/500 Response

### Client side

`web/src/lib/supabase-functions.ts` — `invokeAuthenticatedFunction(name, options)`:
- Gets a fresh session via `supabase.auth.getSession()`
- Proactively refreshes if token expires within 60 seconds
- Sets `functions.setAuth(accessToken)` before invoking
- On gateway 401, retries once with a refreshed session

## Deploy Script

`deploy-supabase-functions.sh` deploys all functions with `--no-verify-jwt --use-api`. Always use this script to ensure consistent deployment settings.
