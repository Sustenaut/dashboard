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

step "1. The GitHub App, its key and its installation id in Bitwarden"
if in_bitwarden dashboard-app-id && in_bitwarden dashboard-app-key; then
  skip "dashboard-app-id and dashboard-app-key are in Bitwarden"
else
  echo "   ./pubsec github-app create $manifest makes the app (owned by Sustenaut, public, organization"
  echo "   permissions Administration, Plan and Members read; no repository permission), asks you to"
  echo "   install it on Sustenaut, and writes dashboard-app-id, dashboard-app-key and"
  echo "   dashboard-installation-id. It asks for a Bitwarden token that may write to Sustenaut."
  ask "Make the app?"
  ./pubsec github-app create "$manifest"
fi

step "2. The app's OAuth client: dashboard-client-id and dashboard-client-secret"
if in_bitwarden dashboard-client-id && in_bitwarden dashboard-client-secret; then
  skip "dashboard-client-id and dashboard-client-secret are in Bitwarden"
else
  echo "   pubsec keeps no client secret, so make one: open"
  echo "   https://github.com/organizations/Sustenaut/settings/apps/sustenaut-reader-test , copy its"
  echo "   Client ID and press \"Generate a new client secret\"."
  echo "   Three hidden prompts follow, in this order:"
  echo "     1. your Bitwarden access token with write access to Sustenaut (0.<id>.<secret>:<key>),"
  echo "        the same one step 1 took; not the client id"
  echo "     2. the app's Client ID (Iv23...)"
  echo "     3. the client secret you just generated"
  ask "Ready, with the Bitwarden token first?"
  version=$(sed -n 's|.*/pubsec/releases/download/v\([0-9.]*\)/pubsec-.*|\1|p' pubkit.json | head -n 1)
  wheel=$(find "${XDG_CACHE_HOME:-$HOME/.cache}/pubkit/providers" -name "pubsec-$version-py3-none-any.whl" | head -n 1)
  [ -n "$wheel" ] || { echo "   pubsec $version is not in the cache: run ./pubdeploy types once, then again."; exit 1; }
  uvx --from "$wheel" python -c '
import sys
from pubsec.bitwarden import WriteFailed, ensure, names, write
from pubsec.github_app import Plan, ask_hidden, project_id
if why := ensure():  # fetches the Bitwarden SDK, which the pubsec wheel alone does not bring
    sys.exit(f"go-live: {why}")
token = ask_hidden("1 of 3, Bitwarden access token with write access to Sustenaut (hidden, not kept): ")
if not token:
    sys.exit("go-live: no token, nothing written")
if not (token.startswith("0.") and ":" in token):
    sys.exit("go-live: that is not a Bitwarden access token (0.<id>.<secret>:<key>); the client id comes next. Nothing written: run it again")
project, organization = project_id(token, Plan({}, "Sustenaut", True, "Sustenaut", "dashboard"))
have = names(token, organization, project)
for name, prompt in (("dashboard-client-id", "2 of 3, the app Client ID: "), ("dashboard-client-secret", "3 of 3, the client secret: ")):
    if name in have:
        print(f"   already in Bitwarden: {name}")
        continue
    value = ask_hidden(prompt)
    if not value:
        sys.exit(f"go-live: no {name}, stopped")
    try:
        write(token, organization, project, name, value, "Sustenaut reader (test) OAuth client, for dashboard.sustenaut.eu")
    except WriteFailed as error:
        sys.exit(f"go-live: {name} not written: {error}")
    print(f"   wrote {name} ({len(value)} characters)")
'
fi

step "3. The deploy walk: session secret, Secret dashboard-secrets, DEPLOY_DASHBOARD, rollout"
echo "   It prints its plan and waits for a typed yes before it changes anything."
ask "Run the walk?"
./with-secrets ./pubdeploy walk --fulfil --server sustenaut --zones ../shared-infra/pubkit.json

step "4. Try it"
echo "   Open https://dashboard.sustenaut.eu , sign in with GitHub, choose Add project, pick Visit-ee"
echo "   and install Sustenaut reader (test) on it. Step 1 then shows what each way (A, B) read,"
echo "   and the Diagnostics table every call and its HTTP status."
