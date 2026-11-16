"""Replaces dashboard-client-secret in Bitwarden with a new client secret, after GitHub has
accepted it. Run by scripts/set-client-secret.sh under the pubsec wheel pubkit.json pins.

The Bitwarden write token and the client secret are asked for at hidden prompts and stay in this
process's memory. Before anything is written, the pair (dashboard-client-id from ./with-secrets,
the new secret) is sent to GitHub with a code that is not real: GitHub answers
bad_verification_code when the pair is right and incorrect_client_credentials when it is not.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request

from pubsec import github_app
from pubsec.bitwarden import WriteFailed, ensure, names, write

PROJECT = "Sustenaut"
NAME = "dashboard-client-secret"


def github_says(client_id: str, secret: str) -> str:
    request = urllib.request.Request(
        "https://github.com/login/oauth/access_token", method="POST",
        data=json.dumps({"client_id": client_id, "client_secret": secret, "code": "not-a-real-code"}).encode(),
        headers={"accept": "application/json", "content-type": "application/json", "user-agent": "sustenaut-dashboard"})
    with urllib.request.urlopen(request, timeout=20) as answer:
        return str(json.load(answer).get("error", ""))


def main() -> int:
    client_id = os.environ.get("DASHBOARD_CLIENT_ID", "")
    if not client_id:
        sys.exit("set-client-secret: no DASHBOARD_CLIENT_ID: run it through ./with-secrets")
    if why := ensure():
        sys.exit(f"set-client-secret: {why}")
    ask = github_app.ask_hidden
    secret = ask("1 of 2, the new client secret from the app's settings page (40 hex characters): ")
    if not re.fullmatch(r"[0-9a-f]{40}", secret):
        sys.exit(f"set-client-secret: that is {len(secret)} characters, not a client secret (40 hex). Nothing written")
    said = github_says(client_id, secret)
    if said != "bad_verification_code":
        sys.exit(f"set-client-secret: GitHub did not accept it with client id {client_id[:4]}... ({said}). Nothing written")
    print("   GitHub accepts the client id and this secret.")
    token = ask(f"2 of 2, Bitwarden access token with write access to {PROJECT} (hidden, not kept): ")
    if not (token.startswith("0.") and ":" in token):
        sys.exit("set-client-secret: that is not a Bitwarden access token (0.<id>.<secret>:<key>). Nothing written")
    project, organization = github_app.project_id(token, github_app.Plan({}, PROJECT, True, PROJECT, "dashboard"))
    ids = names(token, organization, project).get(NAME, [])
    if len(ids) > 1:
        sys.exit(f"set-client-secret: {len(ids)} secrets are named {NAME}; delete the extra ones in Bitwarden first")
    try:
        write(token, organization, project, NAME, secret, "Sustenaut reader (test) OAuth client secret, for dashboard.sustenaut.eu",
              ids[0] if ids else None)
    except WriteFailed as error:
        sys.exit(f"set-client-secret: not written: {error}")
    print(f"   {'replaced' if ids else 'wrote'} {NAME} in Bitwarden")
    return 0


if __name__ == "__main__":
    sys.exit(main())
