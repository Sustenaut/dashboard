#!/usr/bin/env bash
# Takes dashboard.sustenaut.eu live: makes the GitHub App "Sustenaut reader (test)", keeps its
# keys in Bitwarden (project Sustenaut, dashboard-* secrets), then runs the deploy walk, which
# makes the session secret, the Secret dashboard-secrets in namespace dashboard, turns
# DEPLOY_DASHBOARD on and waits for the rollout. Run it from this repository's root on an
# up-to-date main (git latest), signed in to gh and to Sustenaut's tailnet, with
# Sustenaut/shared-infra checked out beside this one and its dashboard site applied:
#
#   scripts/go-live.sh
#
# Each step says what it does and asks first; a step already done is skipped, and the first
# error stops it. It prints no secret: tokens and keys are asked for at hidden prompts and stay
# in the process that writes them. Run it again to go on where it stopped.
set -euo pipefail
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
manifest=github-app/reader-test.json

step() { printf '\n== %s\n' "$*"; }
skip() { echo "   already done: $*"; }
ask() {
  local answer
  read -r -p "   $1 [y/N] " answer </dev/tty
  [[ $answer =~ ^[Yy] ]] || { echo "Stopped; run scripts/go-live.sh again to go on."; exit 1; }
}
# Whether ./with-secrets exports the Bitwarden secret $1 (by name; the value is not printed).
in_bitwarden() { ./with-secrets sh -c "test -n \"\${$(tr 'a-z-' 'A-Z_' <<<"$1"):-}\""; }

step "0. This checkout is main"
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "   HEAD is not origin/main: run git latest first."; exit 1; }
[ -f ../shared-infra/pubkit.json ] || { echo "   ../shared-infra is missing: the walk reads its hosting block."; exit 1; }
grep -q '"dashboard"' ../shared-infra/pubkit.json || { echo "   ../shared-infra has no dashboard site yet: merge and apply its DNS PR, then git latest there."; exit 1; }

step "1-2. The GitHub App and its OAuth client, in Bitwarden (dashboard-* secrets)"
# One process for both steps, so the Bitwarden write token is asked for once
# (scripts/go-live-secrets.py): it stays in that process's memory, never in this shell.
args=()
if in_bitwarden dashboard-app-id && in_bitwarden dashboard-app-key; then
  skip "dashboard-app-id and dashboard-app-key are in Bitwarden"
else
  echo "   Step 1: pubsec github-app create $manifest makes the app (owned by Sustenaut, public,"
  echo "   organization permissions Administration, Plan and Members read; no repository permission),"
  echo "   asks you to install it on Sustenaut, and writes dashboard-app-id, dashboard-app-key and"
  echo "   dashboard-installation-id."
  args+=(--app "$manifest")
fi
if in_bitwarden dashboard-client-id && in_bitwarden dashboard-client-secret; then
  skip "dashboard-client-id and dashboard-client-secret are in Bitwarden"
else
  echo "   Step 2: pubsec keeps no client secret, so make one on"
  echo "   https://github.com/organizations/Sustenaut/settings/apps/sustenaut-reader-test : copy its"
  echo "   Client ID and press \"Generate a new client secret\". Both are asked for after step 1."
  args+=(--client)
fi
if [ ${#args[@]} -gt 0 ]; then
  echo "   First, once for both steps: your Bitwarden access token with write access to Sustenaut"
  echo "   (0.<id>.<secret>:<key>), at a hidden prompt. It is not the client id."
  ask "Go on?"
  version=$(sed -n 's|.*/pubsec/releases/download/v\([0-9.]*\)/pubsec-.*|\1|p' pubkit.json | head -n 1)
  wheel=$(find "${XDG_CACHE_HOME:-$HOME/.cache}/pubkit/providers" -name "pubsec-$version-py3-none-any.whl" | head -n 1)
  [ -n "$wheel" ] || { echo "   pubsec $version is not in the cache: run ./pubdeploy types once, then again."; exit 1; }
  command -v bws >/dev/null || { echo "   bws is not installed: https://github.com/bitwarden/sdk-sm/releases"; exit 1; }
  uvx --from "$wheel" python scripts/go-live-secrets.py "${args[@]}"
fi

step "3. The deploy walk: session secret, Secret dashboard-secrets, DEPLOY_DASHBOARD, rollout"
echo "   It prints its plan and waits for a typed yes before it changes anything."
ask "Run the walk?"
./with-secrets ./pubdeploy walk --fulfil --server sustenaut --zones ../shared-infra/pubkit.json

step "4. Try it"
echo "   Open https://dashboard.sustenaut.eu , sign in with GitHub, choose Add project, pick Visit-ee"
echo "   and install Sustenaut reader (test) on it. Step 1 then shows what each way (A, B) read,"
echo "   and the Diagnostics table every call and its HTTP status."
