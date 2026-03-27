#!/usr/bin/env bash
# Recreate Supabase email/password test users (confirmed, no inbox).
#
# Usage:
#   ./create_test_users.sh           # remote (default): .env needs SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL or SUPABASE_URL
#   ./create_test_users.sh remote
#   ./create_test_users.sh local     # local stack: run `supabase start` first; keys come from `supabase status`
#
# Keep remote TA* passwords in sync with TA1_* / TA2_* in .env if you change them.
# Local stack uses TestAccount1234 for both (see ./create_test_users.sh local).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

TARGET="${1:-remote}"
case "$TARGET" in
  remote) ;;
  local) ;;
  -h | --help)
    sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
  *)
    echo "Usage: $0 [local|remote]   (default: remote)" >&2
    exit 1
    ;;
esac

TA1_EMAIL='ta-1@saynosh.com'
TA2_EMAIL='ta-2@saynosh.com'
if [[ "$TARGET" == "local" ]]; then
  TA1_PASSWORD='TestAccount1234'
  TA2_PASSWORD='TestAccount1234'
else
  TA1_PASSWORD='Ta1-Secure-9k!xQ'
  TA2_PASSWORD='Ta2-Secure-7m!zR'
fi

run_node() {
  node --env-file=.env scripts/create-supabase-user.mjs "$@"
}

if [[ "$TARGET" == "local" ]]; then
  if ! command -v supabase >/dev/null 2>&1; then
    echo "supabase CLI not found in PATH." >&2
    exit 1
  fi
  status_json="$(supabase status -o json 2>/dev/null)" || true
  if [[ -z "$status_json" ]] || ! node -e "JSON.parse(process.argv[1])" "$status_json" 2>/dev/null; then
    echo "Could not read local Supabase status. Start the stack from repo root: supabase start" >&2
    exit 1
  fi
  eval "$(
    printf '%s' "$status_json" | node -e "
      const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
      console.log('export SUPABASE_URL=' + JSON.stringify(d.API_URL));
      console.log('export SUPABASE_SERVICE_ROLE_KEY=' + JSON.stringify(d.SERVICE_ROLE_KEY));
    "
  )"
  run_node "$TA1_EMAIL" "$TA1_PASSWORD"
  run_node "$TA2_EMAIL" "$TA2_PASSWORD"
else
  run_node "$TA1_EMAIL" "$TA1_PASSWORD"
  run_node "$TA2_EMAIL" "$TA2_PASSWORD"
fi

echo "Done ($TARGET)."
