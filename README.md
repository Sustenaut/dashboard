# Sustenaut dashboard

dashboard.sustenaut.eu: sign in with GitHub, link an organization, and see what Sustenaut can
read about it. This is the **phase 0 proof of concept**. Its question: can a GitHub App with
organization permissions only (no repository access) read an org's plan, Actions minutes,
storage, 2FA requirement and ruleset support, and is the app's installation token or the
person's own sign-in token the way to do it?

What works: GitHub sign-in, picking an org you own, installing the test app **Sustenaut reader
(test)** on it, and step 1 of the wizard, which reads each field both ways and shows a
Diagnostics table. Every other screen of the design (the project's launch tiles, linked
infrastructure, account and devices, wizard steps 2 and 3) is layout only and tagged
**Preview**.

## How it reads

| Field | Endpoint | Note |
|---|---|---|
| Plan, 2FA required | `GET /orgs/{org}` (`plan.name`, `two_factor_requirement_enabled`) | |
| Actions minutes this month, and billed | `GET /organizations/{org}/settings/billing/usage/summary` | gross minutes (all repos, public ones free) and net minutes (what GitHub bills) |
| Storage this month, and billed | the same summary | gross GB-hours over the hours so far (an average in GB), and net GB-hours |
| Included minutes and storage | the plan's published limits | for private repos; no endpoint gives them |
| Rulesets on private repos | the plan (Free: no) | `GET /orgs/{org}/rulesets` answers 403 to the app even on Team, so its status is shown as evidence only |

Gross minutes are not compared with the included amount: they count public repos, which are free, and
telling private from public would take a repository permission the app does not have. The legacy
`…/settings/billing/actions` and `…/shared-storage` endpoints answer 410 and are not called.

Each field is read **A**, with the reader app's installation token, and **B**, with the
user-to-server token from signing in through the same app. The Diagnostics table shows, per
field, what each way read, from which endpoint and with which HTTP status ("from plan" when a
value only comes from the plan's published limits), and then every call made.

The app ([github-app/reader-test.json](github-app/reader-test.json)) asks for organization
**Administration**, **Plan** and **Members**, read only, and no repository permission.

## Design

The server is `node:http` with no framework and **no database**: the session is one cookie,
sealed with AES-256-GCM (`src/session.ts`), holding the login and the GitHub token for at most
eight hours. Pages are drawn on the server with [`@sustenaut/ui`](https://github.com/Sustenaut/ui)
and Tailwind on the Sustenaut theme, and carry no script; the content security policy forbids
any. `<details>` opens the wizard's steps and menus.

| Path | What |
|---|---|
| `src/server.tsx` | routes: sign-in (`/auth/login`, `/auth/callback`, `/auth/logout`), `/wizard`, `/wizard/install`, `/setup` (the app's setup URL), the preview pages, `/healthz`, `/assets/` |
| `src/github.ts` | GitHub calls, the app's JWT, the OAuth code exchange |
| `src/probes.ts` | reading an org both ways |
| `src/pages/` | the screens |
| `features/` | the scenarios (cucumber-js), against a fake GitHub (`features/steps/fake-github.ts`) |

## Working on it

```sh
npm ci
npm test        # typecheck, formatting, the scenarios with coverage (coverage/lcov.info)
npm run build   # dist/server.mjs (one bundled file) and dist/public (CSS, fonts)
```

`npm start` runs `dist/server.mjs`, which reads `DASHBOARD_APP_ID`, `DASHBOARD_APP_KEY`,
`DASHBOARD_CLIENT_ID`, `DASHBOARD_CLIENT_SECRET`, `DASHBOARD_SESSION_SECRET` (32 characters or
more) and, optionally, `DASHBOARD_PUBLIC_URL`, `GITHUB_API`, `GITHUB_WEB` and `PORT`.

## Deploying

`.github/workflows/deploy.yml` builds `ghcr.io/sustenaut/dashboard` (public: the bundled
server, CSS and fonts, no key) on each merge to main once CI has passed, and applies `k8s/` to
namespace `dashboard` on the Sustenaut k3s server once `DEPLOY_DASHBOARD` is on.
dashboard.sustenaut.eu's DNS record is Sustenaut/shared-infra's (`pubkit.json`, hosting sites).

pubkit.json's `deploy` block lists the rest, and `scripts/go-live.sh` takes it live once:

1. `./pubsec github-app create github-app/reader-test.json` makes the app and writes
   `dashboard-app-id`, `dashboard-app-key`, `dashboard-installation-id`, `dashboard-client-id`
   and `dashboard-client-secret` to Bitwarden, all from GitHub's answer (the manifest's
   `keep_oauth_client`).
2. The deploy walk generates `dashboard-session-secret`, makes the Secret `dashboard-secrets`,
   turns `DEPLOY_DASHBOARD` on and waits for the rollout and `/healthz`.

Branch protection is `./pubkit protect Sustenaut/dashboard`.
