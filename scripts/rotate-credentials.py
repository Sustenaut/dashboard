"""Replaces the reader app's private key and its OAuth client secret in Bitwarden, after GitHub
has accepted each. Run by scripts/rotate-credentials.sh under the pubsec wheel pubrules.json pins.

The key is read from the .pem file GitHub downloaded (its path is asked for; the key is never
printed), and checked by signing the app's JWT with it and asking GitHub for the app. The client
secret is asked for at a hidden prompt, must be 40 hex characters, and is checked by sending it
with the client id and a code that is not real: GitHub answers bad_verification_code when the
pair is right. The Bitwarden write token is asked for once. Nothing is written unless both pass.
With --secret-only the key is left as it is, and only the client secret is asked for and written.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from pathlib import Path

from pubsec import github_app
from pubsec.bitwarden import WriteFailed, ensure, names, write

PROJECT = "Sustenaut"
PEM = re.compile(r"-----BEGIN (RSA )?PRIVATE KEY-----\n[A-Za-z0-9+/=\n]+-----END (RSA )?PRIVATE KEY-----\n?")


def stop(text: str) -> None:
    sys.exit(f"rotate-credentials: {text}. Nothing written")


def client_check(client_id: str, secret: str) -> str:
    request = urllib.request.Request(
        "https://github.com/login/oauth/access_token", method="POST",
        data=json.dumps({"client_id": client_id, "client_secret": secret, "code": "not-a-real-code"}).encode(),
        headers={"accept": "application/json", "content-type": "application/json", "user-agent": "sustenaut-dashboard"})
    with urllib.request.urlopen(request, timeout=20) as answer:
        return str(json.load(answer).get("error", ""))


def main() -> int:
    app_id = os.environ.get("DASHBOARD_APP_ID", "")
    client_id = os.environ.get("DASHBOARD_CLIENT_ID", "")
    if not (app_id and client_id):
        stop("no DASHBOARD_APP_ID or DASHBOARD_CLIENT_ID: run it through ./with-secrets")
    if why := ensure():
        stop(why)
    ask = github_app.ask_hidden
    secret_only = "--secret-only" in sys.argv[1:]
    total = 2 if secret_only else 3
    pem = None
    if not secret_only:
        pem = read_key(app_id)
    secret = ask(f"{total - 1} of {total}, the new client secret (40 hex characters; not the key): ")
    check_secret(client_id, secret)

    token = ask(f"{total} of {total}, Bitwarden access token with write access to {PROJECT} (hidden, not kept): ")
    if not (token.startswith("0.") and ":" in token):
        stop("that is not a Bitwarden access token (0.<id>.<secret>:<key>)")
    project, organization = github_app.project_id(token, github_app.Plan({}, PROJECT, True, PROJECT, "dashboard"))
    have = names(token, organization, project)
    writes = (("dashboard-client-secret", secret),) if pem is None else (("dashboard-app-key", pem), ("dashboard-client-secret", secret))
    for name, value in writes:
        ids = have.get(name, [])
        if len(ids) > 1:
            sys.exit(f"rotate-credentials: {len(ids)} secrets are named {name}; delete the extra ones in Bitwarden, then run it again")
        try:
            write(token, organization, project, name, value, "Sustenaut reader (test), for dashboard.sustenaut.eu", ids[0] if ids else None)
        except WriteFailed as error:
            sys.exit(f"rotate-credentials: {name} not written: {error}")
        print(f"   {'replaced' if ids else 'wrote'} {name} in Bitwarden")
    return 0


def read_key(app_id: str) -> str:
    """The new key, from the .pem GitHub downloaded, once GitHub accepts a JWT it signs."""
    path = Path(input("1 of 3, path of the new .pem file GitHub downloaded: ").strip()).expanduser()
    try:
        pem = path.read_text(encoding="ascii")
    except (OSError, UnicodeDecodeError) as error:
        stop(f"cannot read {path}: {getattr(error, 'strerror', None) or error}")
    if not PEM.fullmatch(pem.strip() + "\n"):
        stop(f"{path} is not a PEM private key")
    try:
        app = github_app.github("GET", "/app", "the app, signed with the new key", bearer=github_app.app_jwt(int(app_id), pem))
    except github_app.Stop as error:
        stop(f"GitHub did not accept the new key: {error}")
    if str(app.get("id")) != app_id:
        stop(f"the key is app {app.get('id')}'s, not the dashboard's ({app_id})")
    print(f"   GitHub accepts the new key for {app.get('slug')}.")
    return pem


def check_secret(client_id: str, secret: str) -> None:
    if secret.startswith("-----"):
        stop("that is a key, not a client secret")
    if not re.fullmatch(r"[0-9a-f]{40}", secret):
        stop(f"that is {len(secret)} characters, not a client secret (40 hex)")
    if (said := client_check(client_id, secret)) != "bad_verification_code":
        stop(f"GitHub did not accept the client secret with client id {client_id[:4]}... ({said})")
    print("   GitHub accepts the client id with the new secret.")


if __name__ == "__main__":
    sys.exit(main())
