#!/usr/bin/env bash
set -euo pipefail

show_help() {
  printf '%s\n' \
    "Usage: reset-linked-db.sh [--linked|--local] [additional supabase db reset flags]" \
    "" \
    "Defaults to --linked so it uses the project configured by 'supabase link'." \
    "Pass --local to reset the local Supabase database instead." \
    "All remaining arguments are forwarded to 'supabase db reset'."
}

if [[ "${1-}" == "--help" || "${1-}" == "-h" ]]; then
  show_help
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

if ! command -v supabase >/dev/null 2>&1; then
  printf '%s\n' "Supabase CLI is required but was not found on PATH." >&2
  exit 1
fi

if [[ ! -f "$REPO_ROOT/supabase/config.toml" ]]; then
  printf '%s\n' "Could not find supabase/config.toml under $REPO_ROOT." >&2
  exit 1
fi

target_flag="--linked"

if [[ "${1-}" == "--linked" || "${1-}" == "--local" ]]; then
  target_flag="$1"
  shift
fi

if [[ "$target_flag" == "--linked" && ! -f "$REPO_ROOT/supabase/.temp/project-ref" ]]; then
  printf '%s\n' "Warning: supabase/.temp/project-ref was not found. If this repo is not linked, run 'supabase link --project-ref <YOUR_PROJECT_REF>' first." >&2
fi

printf '%s\n' "Running: supabase db reset $target_flag $*"

cd "$REPO_ROOT"
supabase db reset "$target_flag" "$@"
