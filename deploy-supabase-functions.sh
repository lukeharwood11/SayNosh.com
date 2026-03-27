#!/usr/bin/env bash
set -euo pipefail

show_help() {
  printf '%s\n' \
    "Usage: ./deploy-supabase-functions.sh [additional supabase functions deploy flags]" \
    "" \
    "Deploys every function under supabase/functions/* that has an index.ts." \
    "Uses --use-api by default so Docker is not required for bundling." \
    "Any additional arguments are forwarded to each 'supabase functions deploy' call."
}

if [[ "${1-}" == "--help" || "${1-}" == "-h" ]]; then
  show_help
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FUNCTIONS_DIR="$SCRIPT_DIR/supabase/functions"

if ! command -v supabase >/dev/null 2>&1; then
  printf '%s\n' "Supabase CLI is required but was not found on PATH." >&2
  exit 1
fi

if [[ ! -d "$FUNCTIONS_DIR" ]]; then
  printf '%s\n' "Could not find $FUNCTIONS_DIR." >&2
  exit 1
fi

shopt -s nullglob
function_dirs=("$FUNCTIONS_DIR"/*)

if [[ ${#function_dirs[@]} -eq 0 ]]; then
  printf '%s\n' "No function directories found under $FUNCTIONS_DIR." >&2
  exit 1
fi

deployed_any=false

for dir in "${function_dirs[@]}"; do
  [[ -d "$dir" ]] || continue
  name="$(basename "$dir")"

  if [[ ! -f "$dir/index.ts" ]]; then
    continue
  fi

  deployed_any=true
  printf '\n==> Deploying %s\n' "$name"
  supabase functions deploy "$name" --use-api --no-verify-jwt "$@"
done

if [[ "$deployed_any" == false ]]; then
  printf '%s\n' "No deployable functions with index.ts were found." >&2
  exit 1
fi

printf '\nAll deployable edge functions have been deployed.\n'
