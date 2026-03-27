#!/usr/bin/env node
/**
 * Create or update a confirmed email/password user via GoTrue Admin API.
 *
 * From repo root (add SUPABASE_SERVICE_ROLE_KEY to .env — Dashboard → Settings → API):
 *
 *   node --env-file=.env scripts/create-supabase-user.mjs <email> <password>
 *
 * URL is read from SUPABASE_URL or VITE_SUPABASE_URL.
 */

const baseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
  /\/$/,
  '',
)
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

const email = process.argv[2]
const password = process.argv[3]

const missing = []
if (!baseUrl) missing.push('SUPABASE_URL or VITE_SUPABASE_URL')
if (!serviceRole) missing.push('SUPABASE_SERVICE_ROLE_KEY')
if (missing.length) {
  console.error(`Missing: ${missing.join(', ')}`)
  console.error(
    'Add SUPABASE_SERVICE_ROLE_KEY to .env (Dashboard → Project Settings → API → service_role secret). Never use a VITE_* prefix for that key.',
  )
  process.exit(1)
}

if (!email || !password) {
  console.error('Usage: node --env-file=.env scripts/create-supabase-user.mjs <email> <password>')
  process.exit(1)
}

const adminHeaders = {
  'Content-Type': 'application/json',
  apikey: serviceRole,
  Authorization: `Bearer ${serviceRole}`,
}

async function findUserIdByEmail(targetEmail) {
  const normalized = targetEmail.trim().toLowerCase()
  let page = 1
  const perPage = 200
  while (true) {
    const res = await fetch(
      `${baseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      { headers: adminHeaders },
    )
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('list users failed', res.status, body)
      process.exit(1)
    }
    const users = body.users ?? []
    const u = users.find((x) => (x.email || '').toLowerCase() === normalized)
    if (u) return u.id
    if (users.length < perPage) return null
    page += 1
  }
}

async function updateUser(userId) {
  const res = await fetch(`${baseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      password,
      email_confirm: true,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(res.status, body)
    process.exit(1)
  }
  console.log('Updated user:', { id: body.id ?? userId, email: body.user?.email ?? body.email ?? email })
}

const res = await fetch(`${baseUrl}/auth/v1/admin/users`, {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
  }),
})

const body = await res.json().catch(() => ({}))

if (res.ok) {
  console.log('Created user:', { id: body.id, email: body.email })
  process.exit(0)
}

const alreadyExists =
  res.status === 422 ||
  body.error_code === 'email_exists' ||
  body.error_code === 'user_already_exists' ||
  (typeof body.msg === 'string' && /already (registered|exists)/i.test(body.msg))

if (!alreadyExists) {
  console.error(res.status, body)
  process.exit(1)
}

const id = await findUserIdByEmail(email)
if (!id) {
  console.error('User exists but could not be found in admin list:', email)
  process.exit(1)
}
await updateUser(id)
