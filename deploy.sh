#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

red()   { printf '\033[1;31m%s\033[0m\n' "$*"; }
green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
step()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

for cmd in supabase npm terraform aws; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    red "Required tool '$cmd' not found on PATH."
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# 1. Database migrations
# ---------------------------------------------------------------------------
step "Pushing database migrations"
supabase db push --linked

# ---------------------------------------------------------------------------
# 2. Edge functions
# ---------------------------------------------------------------------------
step "Deploying edge functions"
bash "$SCRIPT_DIR/deploy-supabase-functions.sh"

# ---------------------------------------------------------------------------
# 3. Build web app
# ---------------------------------------------------------------------------
step "Installing dependencies"
npm --prefix "$SCRIPT_DIR/web" ci --silent

step "Building web app"
npm --prefix "$SCRIPT_DIR/web" run build

# ---------------------------------------------------------------------------
# 4. Terraform
# ---------------------------------------------------------------------------
step "Running terraform apply"
cd "$SCRIPT_DIR/terraform"
terraform init -input=false
terraform apply -auto-approve

green "Deploy complete."
