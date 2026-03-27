# nosh — setup checklist

Use this when wiring Supabase, Google Places, and the Vite app. The product and schema reference is **`nosh_full_spec.html`** at the repo root.

---

## 1. Supabase project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Install the CLI: [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started).
3. Log in: `supabase login`.
4. Link this repo to the project (from repo root):

   ```bash
   supabase link --project-ref <YOUR_PROJECT_REF>
   ```

   (`<YOUR_PROJECT_REF>` is the short id in the project URL.)

5. Push schema:

   ```bash
   supabase db push
   ```

   Or run locally: `supabase start` then `supabase db reset` (applies `supabase/migrations/`).

6. **Before production:** enable **Row Level Security** on `sessions`, `session_members`, `restaurants`, `swipes`, and `known_users`, and add policies (e.g. host + session members can read their session; writes via Edge Functions with the service role). The initial migration intentionally leaves RLS off for faster iteration.

7. **Types for the frontend:** after the schema is live:

   ```bash
    supabase gen types typescript --linked > web/src/types/database.ts
    ```

---

## 1b. AWS static hosting

Terraform now follows the same `plan -> artifact -> apply` pattern as `../amia`.

1. Confirm the backend values in `terraform/config.tf` are correct for this project:
   - state bucket: `lukeharwood-dev-tfstate`
   - lock table: `lukeharwood-dev-tf-lock`
   - state key: `prod/saynosh.com/terraform.tfstate`
   - backend region: `us-east-2`
2. Confirm the GitHub OIDC role in both workflow files is correct:

   ```text
   arn:aws:iam::891612573605:role/github-oidc
   ```

3. Confirm Route53 hosts `saynosh.com` and ACM has an **issued** cert in `us-east-1`.
4. App infra defaults to `us-east-1` (S3, ACM lookup, Route53-managed alias target wiring, and workflow AWS region).
5. First local smoke test:

   ```bash
   cd terraform
   terraform init
   terraform plan
   ```

6. In GitHub Actions, run:
   - **Terraform Plan**
   - then **Terraform Apply**

Terraform provisions only:

- an S3 bucket for the built frontend
- a CloudFront distribution in front of that bucket
- Route53 alias records for `saynosh.com`

The apply step also syncs `web/dist/` into S3 and invalidates CloudFront.

---

## 2. Supabase Auth

1. In the dashboard: **Authentication → Providers** — enable the methods you need (email, Google, etc.).
2. Set **Site URL** and **Redirect URLs** to match your Vite dev server (e.g. `http://localhost:5173`) and production origin.
3. Guests in the spec use `session_members.user_id = null`; decide how anonymous join works (e.g. temporary session token vs forcing sign-in) and implement in `join-session`.

### 2a. Google OAuth setup

#### Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and select (or create) the same project used for Places API.
2. **APIs & Services → OAuth consent screen:**
   - Choose **External** user type.
   - Fill in app name (e.g. "nosh"), user-support email, and developer contact email.
   - Add scopes: `openid`, `email`, `profile` (these are the defaults Supabase requests).
   - Add any test users while the app is in "Testing" status. Once ready for production, **publish** the consent screen.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID:**
   - Application type: **Web application**.
   - **Authorized JavaScript origins:**
     - `http://localhost:5173` (local dev)
     - Your production origin (e.g. `https://nosh.com`)
   - **Authorized redirect URIs** — Supabase handles the callback, so add:
     - `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`
     
     (Replace `<YOUR_PROJECT_REF>` with your Supabase project ref, e.g. `kbhdzqodthfarcqszzcc`.)
   - Click **Create** and copy the **Client ID** and **Client Secret**.

#### Supabase dashboard

4. Go to **Authentication → Providers → Google**.
5. Toggle Google **on**.
6. Paste the **Client ID** and **Client Secret** from the step above.
7. Leave the default scopes unless you need additional ones.
8. Save.

#### Redirect URLs

9. In **Authentication → URL Configuration:**
   - **Site URL:** your production origin (e.g. `https://nosh.com`).
   - **Redirect URLs (allow list):** add every origin that should be allowed post-login:
     - `http://localhost:5173` (local dev)
     - `http://localhost:5173/**` (catches deep-link paths)
     - Your production origin and wildcard (e.g. `https://nosh.com/**`)

#### Frontend usage

10. Sign in with Google from the client:

    ```ts
    import { supabase } from '@/lib/supabase'

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    })
    ```

11. Handle the redirect callback — `supabase.auth.onAuthStateChange` (already wired if you use the `useAuth` hook) picks up the session automatically from the URL hash after Google redirects back.

#### Troubleshooting

- **"redirect_uri_mismatch":** the redirect URI in Google Console must exactly match `https://<ref>.supabase.co/auth/v1/callback`. Check for trailing slashes.
- **Consent screen stuck in "Testing":** only emails listed as test users can log in. Publish the consent screen when ready.
- **CORS errors on localhost:** make sure `http://localhost:5173` is in the authorized JavaScript origins in Google Console *and* in Supabase's redirect allow list.

---

## 3. Supabase secrets (Edge Functions)

Functions that call Google or use privileged DB access need secrets (dashboard **Project Settings → Edge Functions → Secrets**, or CLI):

| Secret (example name) | Used for |
|------------------------|----------|
| `GOOGLE_PLACES_API_KEY` | Server-side calls to **Places API (New)** — Nearby Search |
| `SUPABASE_URL` | Often injected automatically in hosted functions; confirm in your template |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for bypassing RLS inside functions (keep server-only) |

**CLI example:**

```bash
supabase secrets set GOOGLE_PLACES_API_KEY=your_key_here
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Never put the service role key or Places key in `VITE_*` env vars.

---

## 4. Google Cloud Console — Places API (New)

The spec uses **Places API (New)** — `POST https://places.googleapis.com/v1/places:searchNearby`.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project.
2. **Billing:** attach a billing account (Places usage is billed; see Google’s pricing).
3. **Enable APIs:**
   - Open **APIs & Services → Library**.
   - Enable **Places API (New)** (name may appear as “Places API” with the new product; ensure you are not using only the legacy “Places API” if Google has split them — follow Google’s current doc for “Places API (New)” / Nearby Search).
4. **Credentials → Create credentials → API key.**
5. **Restrict the key (recommended):**
   - Application restriction: for Edge Functions, use **IP** restrictions if Google supports your deployment egress IPs, or use a **server-only** pattern and restrict by **API** to Places API (New) only.
   - Do **not** expose this key in the browser for production; `create-session` should run on the server.
6. **Field mask:** Nearby Search requires an `X-Goog-FieldMask` header listing returned fields. The spec suggests fields such as: `places.displayName`, `places.rating`, `places.priceLevel`, `places.primaryTypeDisplayName`, `places.photos`, `places.formattedAddress`, `places.location`, `places.regularOpeningHours.openNow` (confirm exact names in [Google’s Places API (New) docs](https://developers.google.com/maps/documentation/places/web-service/op-overview)).
7. Map the JSON response into `restaurants` rows (`external_id` = Place resource name or place id string, depending on API version).

---

## 5. Realtime

The migration adds `session_members` to the `supabase_realtime` publication so clients can subscribe to `has_submitted` / membership changes. In the client, subscribe with the Supabase Realtime API and respect RLS once enabled.

---

## 6. Frontend env (`web/`)

1. Copy `web/.env.example` to `web/.env`.
2. Set **Project Settings → API** in Supabase:
   - `VITE_SUPABASE_URL` = Project URL  
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = publishable key (`sb_publishable_...`)  

3. For auth-required Edge Functions, call `supabase.functions.invoke('create-session', { body })` only after the user is signed in, so the request carries the user JWT instead of falling back to the publishable key.

---

## 7. Edge Function implementations (order suggested)

1. **`create-session`** — validate host, call Nearby Search once, insert `sessions` + `restaurants`, set `invite_code`, `filters`, `expires_at`.
2. **`join-session`** — validate code and `sessions.status === 'waiting'` (late join after swiping: block per spec).
3. **`submit-swipes`** — write `swipes`, set `has_submitted`.
4. **`calculate-results`** — matching rules in the spec (strong / soft match, Round 2, fallbacks).
5. **`skip-member`**, **`start-round-two`**, **`save-known-users`**, **`get-known-users`**.

---

## 8. Optional: local Edge Function testing

```bash
supabase start
supabase functions serve --env-file supabase/.env.local
```

Create `supabase/.env.local` for local secrets (do not commit; add to `.gitignore` if you use this path).

---

## 9. PWA (if enabled in `vite.config`)

If you add `vite-plugin-pwa`, configure icons and manifest, and test installability in Chrome. Service worker caching should not cache authenticated API responses incorrectly.

---

## 10. Quota and caching

Spec: **Places quota → cache results** in Postgres for the session lifetime; do not re-fetch Nearby Search for the same session.
