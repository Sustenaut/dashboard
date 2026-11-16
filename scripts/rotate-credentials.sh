#!/usr/bin/env bash
# Rotates the reader app's private key and OAuth client secret for dashboard.sustenaut.eu:
# checks each with GitHub, replaces dashboard-app-key and dashboard-client-secret in Bitwarden,
# then has the deploy walk make the Secret dashboard-secrets again (it compares keys, not
# values, so the old Secret is removed first) and restart the app. Run it from this repository's
# root on main, signed in to Sustenaut's tailnet, with Sustenaut/shared-infra beside it:
#
#   scripts/rotate-credentials.sh
#
# First, at https://github.com/organizations/Sustenaut/settings/apps/sustenaut-reader-test :
# "Generate a private key" (the browser downloads a .pem) and "Generate a new client secret".
# Delete the old key and secret there only after this has run. The client secret and the
# Bitwarden write token are asked for at hidden prompts; the key is read from its file. Nothing
# is printed or kept.
set -euo pipefail
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

ask() {
  local answer
  read -r -p "   $1 [y/N] " answer </dev/tty
  [[ $answer =~ ^[Yy] ]] || { echo "Stopped."; exit 1; }
}

echo "== 1. The new key and client secret, checked with GitHub, into Bitwarden"
version=$(sed -n 's|.*/pubsec/releases/download/v\([0-9.]*\)/pubsec-.*|\1|p' pubkit.json | head -n 1)
wheel=$(find "${XDG_CACHE_HOME:-$HOME/.cache}/pubkit/providers" -name "pubsec-$version-py3-none-any.whl" | head -n 1)
[ -n "$wheel" ] || { echo "   pubsec $version is not in the cache: run ./pubdeploy types once, then again."; exit 1; }
./with-secrets uvx --from "$wheel" python scripts/rotate-credentials.py

echo "== 2. The Secret dashboard-secrets made again from Bitwarden, and the app restarted"
echo "   This deletes the Secret, then the deploy walk makes it and restarts the app: the site is"
echo "   down for about a minute. The walk prints its plan and waits for a typed yes."
ask "Go on?"
ssh -o BatchMode=yes root@sustenaut "k3s kubectl -n dashboard delete secret dashboard-secrets --ignore-not-found"
./with-secrets ./pubdeploy walk --fulfil --server sustenaut --zones ../shared-infra/pubkit.json

echo "== 3. Clean up"
echo "   Delete the downloaded .pem (it is in Bitwarden now), then on"
echo "   https://github.com/organizations/Sustenaut/settings/apps/sustenaut-reader-test delete the"
echo "   old private key and the old client secret."
