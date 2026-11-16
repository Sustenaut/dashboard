"""Steps 1 and 2 of scripts/go-live.sh, in one process, so the Bitwarden write token is asked for
once: at a hidden prompt, held in this process's memory, never exported, printed or written.

    python scripts/go-live-secrets.py [--app MANIFEST] [--client]

--app runs pubsec's `github-app create MANIFEST` (the app, its key and installation id), and
answers its token prompt with the token asked for here. --client writes the app's OAuth client
id and a client secret, which pubsec does not keep, asked for at hidden prompts. Run under the
pubsec wheel pubkit.json's deploy.providers pins (go-live.sh does that).
"""

from __future__ import annotations

import sys
from pathlib import Path

from pubsec import github_app
from pubsec.bitwarden import WriteFailed, ensure, names, write

PROJECT = "Sustenaut"
TOKEN_PROMPT = "Bitwarden access token with write access to"


def main(argv: list[str]) -> int:
    manifest = Path(argv[argv.index("--app") + 1]) if "--app" in argv else None
    client = "--client" in argv
    if why := ensure():  # fetches the Bitwarden SDK, which the pubsec wheel alone does not bring
        sys.exit(f"go-live: {why}")
    ask = github_app.ask_hidden
    token = ask(f"Bitwarden access token with write access to {PROJECT}, asked once for this run (hidden, not kept): ")
    if not token:
        sys.exit("go-live: no token, nothing done")
    if not (token.startswith("0.") and ":" in token):
        sys.exit("go-live: that is not a Bitwarden access token (0.<id>.<secret>:<key>). Nothing done: run it again")

    if manifest is not None:
        # pubsec asks for the token itself; give it this one. Its other prompts (another token
        # after a failed write) still reach the person.
        github_app.ask_hidden = lambda prompt: token if prompt.startswith(TOKEN_PROMPT) else ask(prompt)
        try:
            if (code := github_app.run(manifest, replace=False, dry_run=False)) != 0:
                return code
        finally:
            github_app.ask_hidden = ask

    if client:
        print("   Next, from https://github.com/organizations/Sustenaut/settings/apps/sustenaut-reader-test :")
        print("   its Client ID, then a client secret (\"Generate a new client secret\").")
        project, organization = github_app.project_id(token, github_app.Plan({}, PROJECT, True, PROJECT, "dashboard"))
        have = names(token, organization, project)
        for name, prompt in (("dashboard-client-id", "The app's Client ID (Iv23...): "),
                             ("dashboard-client-secret", "The client secret: ")):
            if name in have:
                print(f"   already in Bitwarden: {name}")
                continue
            value = ask(prompt)
            if not value:
                sys.exit(f"go-live: no {name}, stopped")
            try:
                write(token, organization, project, name, value,
                      "Sustenaut reader (test) OAuth client, for dashboard.sustenaut.eu")
            except WriteFailed as error:
                sys.exit(f"go-live: {name} not written: {error}")
            print(f"   wrote {name} ({len(value)} characters)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
