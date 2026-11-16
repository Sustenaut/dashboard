// The dashboard's HTTP server: node:http, no framework, no database. Pages are drawn on the
// server with @sustenaut/ui and carry no script. The session is one sealed cookie (session.ts).
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import type { Config } from "./config";
import { GitHub, type Auth } from "./github";
import { readOrg, type Call } from "./probes";
import { cookies, openSession, seal, setCookie, unseal, type Session } from "./session";
import { html } from "./pages/layout";
import { SignIn } from "./pages/signin";
import { Workspace } from "./pages/workspace";
import { Wizard, type WizardState } from "./pages/wizard";
import { AccountPage, Infra, Project } from "./pages/preview";

const SESSION = "dash_session";
const STATE = "dash_state";
const SESSION_HOURS = 8;
const ORG = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

const ERRORS: Record<string, string> = {
  state: "The sign-in took too long or came from elsewhere. Try again.",
  denied: "GitHub did not sign you in. Try again when you are ready.",
  exchange: "GitHub would not swap the sign-in code for a token. Try again.",
  user: "GitHub gave a token but would not say who you are. Try again.",
};

const HEADERS = {
  "content-security-policy":
    "default-src 'none'; style-src 'self'; style-src-attr 'unsafe-inline'; font-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
};

const TYPES: Record<string, string> = { ".css": "text/css; charset=utf-8", ".woff2": "font/woff2" };

export function createHandler(config: Config, fetcher: typeof fetch = fetch, now: () => Date = () => new Date()) {
  const gh = new GitHub(config.githubApi, config.githubWeb, fetcher);
  const callback = `${config.publicUrl}/auth/callback`;
  const app = (): Auth => ({ kind: "app", token: GitHub.appJwt(config.appId, config.appKey) });
  let slug: string | undefined;

  const send = (res: ServerResponse, status: number, body: string, headers: Record<string, string | string[]> = {}) => {
    res.writeHead(status, {
      ...HEADERS,
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
      ...headers,
    });
    res.end(body);
  };
  const redirect = (res: ServerResponse, to: string, headers: Record<string, string | string[]> = {}) =>
    send(res, 303, "", { location: to, ...headers });

  async function appSlug(): Promise<string | undefined> {
    if (slug) return slug;
    const a = await gh.call("GET", "/app", app());
    if (a.status === 200 && typeof a.body?.slug === "string") slug = a.body.slug;
    return slug;
  }

  async function installedOrgs(s: Session): Promise<string[]> {
    const a = await gh.call("GET", "/user/installations?per_page=100", { kind: "user", token: s.token });
    if (a.status !== 200 || !Array.isArray(a.body?.installations)) return [];
    return a.body.installations
      .filter((i: any) => i?.account?.type === "Organization" && typeof i.account.login === "string")
      .map((i: any) => i.account.login as string);
  }

  async function wizard(s: Session, org: string | undefined): Promise<WizardState> {
    const user: Auth = { kind: "user", token: s.token };
    if (!org) {
      const a = await gh.call("GET", "/user/memberships/orgs?state=active&per_page=100", user);
      if (a.status !== 200 || !Array.isArray(a.body))
        return { adminOrgsNote: `${a.endpoint} answered HTTP ${a.status}` };
      return {
        adminOrgs: a.body
          .filter((m: any) => m?.role === "admin" && typeof m.organization?.login === "string")
          .map((m: any) => m.organization.login as string),
      };
    }
    if (!ORG.test(org)) return { error: "That is not a GitHub organization name." };
    const lookup = await gh.call("GET", `/orgs/${org}/installation`, app());
    const lookupCall: Call = {
      way: "A",
      endpoint: lookup.endpoint,
      status: lookup.status,
      note: "the reader app's installation on the org",
    };
    if (lookup.status === 200 && typeof lookup.body?.id === "number") {
      const minted = await gh.call("POST", `/app/installations/${lookup.body.id}/access_tokens`, app());
      const mintCall: Call = {
        way: "A",
        endpoint: minted.endpoint,
        status: minted.status,
        note: "the installation token",
      };
      const ways: Partial<Record<"A" | "B", Auth>> = { B: user };
      if (minted.status === 201 && typeof minted.body?.token === "string")
        ways.A = { kind: "installation", token: minted.body.token };
      const report = await readOrg(gh, org, ways, now());
      report.calls.unshift(lookupCall, mintCall);
      return { org, installed: true, report };
    }
    if (lookup.status !== 404)
      return { org, error: `GitHub would not say whether the reader app is on ${org} (HTTP ${lookup.status}).` };
    if (!(await appSlug())) return { org, error: "The dashboard could not read its own GitHub App. Try again later." };
    return { org, installed: false, installUrl: `/wizard/install?org=${encodeURIComponent(org)}` };
  }

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", config.publicUrl);
    const jar = cookies(req.headers.cookie);
    const session = openSession(jar[SESSION], config.sessionSecret, now().getTime());
    const user = session && { login: session.login, name: session.name };
    const path = url.pathname;

    if (req.method === "GET" && path === "/healthz") return send(res, 200, "ok", { "content-type": "text/plain" });

    if (req.method === "GET" && path.startsWith("/assets/")) {
      const rel = normalize(path.slice("/assets/".length));
      if (rel.startsWith("..") || !TYPES[extname(rel)])
        return send(res, 404, "not found", { "content-type": "text/plain" });
      try {
        const body = await readFile(join(config.publicDir, rel));
        res.writeHead(200, {
          ...HEADERS,
          "content-type": TYPES[extname(rel)],
          "cache-control": "public, max-age=3600",
        });
        return void res.end(body);
      } catch {
        return send(res, 404, "not found", { "content-type": "text/plain" });
      }
    }

    if (req.method === "GET" && path === "/auth/login") {
      const state = randomBytes(18).toString("base64url");
      return redirect(res, gh.authorizeUrl(config.clientId, callback, state), {
        "set-cookie": setCookie(STATE, seal({ state, at: now().getTime() }, config.sessionSecret), 600),
      });
    }

    if (req.method === "GET" && path === "/auth/callback") {
      const kept = unseal<{ state: string; at: number }>(jar[STATE], config.sessionSecret);
      const clear = setCookie(STATE, "", 0);
      if (url.searchParams.get("error")) return redirect(res, "/?error=denied", { "set-cookie": clear });
      const code = url.searchParams.get("code");
      if (!kept || !code || kept.state !== url.searchParams.get("state") || now().getTime() - kept.at > 600_000)
        return redirect(res, "/?error=state", { "set-cookie": clear });
      const swapped = await gh.exchangeCode(config.clientId, config.clientSecret, code, callback);
      const token = swapped.status === 200 ? swapped.body?.access_token : undefined;
      if (typeof token !== "string") return redirect(res, "/?error=exchange", { "set-cookie": clear });
      const me = await gh.call("GET", "/user", { kind: "user", token });
      if (me.status !== 200 || typeof me.body?.login !== "string")
        return redirect(res, "/?error=user", { "set-cookie": clear });
      const lifetime = Math.min(SESSION_HOURS * 3600, Number(swapped.body?.expires_in) || SESSION_HOURS * 3600);
      const s: Session = {
        login: me.body.login,
        name: typeof me.body.name === "string" ? me.body.name : undefined,
        token,
        expires: Math.floor(now().getTime() / 1000) + lifetime,
      };
      return redirect(res, "/", { "set-cookie": [clear, setCookie(SESSION, seal(s, config.sessionSecret), lifetime)] });
    }

    if (req.method === "POST" && path === "/auth/logout")
      return redirect(res, "/", { "set-cookie": setCookie(SESSION, "", 0) });

    if (req.method !== "GET")
      return send(res, 405, "method not allowed", { "content-type": "text/plain", allow: "GET" });

    if (!session) {
      if (path !== "/") return redirect(res, "/");
      const error = ERRORS[url.searchParams.get("error") ?? ""];
      return send(res, 200, html("Sign in", <SignIn error={error} />));
    }

    switch (path) {
      case "/":
        return send(res, 200, html("Workspace", <Workspace user={user!} orgs={await installedOrgs(session)} />));
      case "/wizard": {
        const state = await wizard(session, url.searchParams.get("org")?.trim() || undefined);
        return send(res, 200, html("Set up your project", <Wizard user={user!} state={state} />));
      }
      case "/wizard/install": {
        const org = url.searchParams.get("org") ?? "";
        const name = ORG.test(org) ? await appSlug() : undefined;
        if (!name) return redirect(res, "/wizard");
        const target = await gh.call("GET", `/orgs/${org}`, { kind: "user", token: session.token });
        const id = target.status === 200 && typeof target.body?.id === "number" ? target.body.id : undefined;
        return redirect(res, gh.installUrl(name, id));
      }
      case "/setup": {
        // GitHub's Setup URL, after an install: back to step 1 for that org.
        const id = url.searchParams.get("installation_id") ?? "";
        if (!/^\d+$/.test(id)) return redirect(res, "/wizard");
        const inst = await gh.call("GET", `/app/installations/${id}`, app());
        const login = inst.status === 200 ? inst.body?.account?.login : undefined;
        return redirect(
          res,
          typeof login === "string" && ORG.test(login) ? `/wizard?org=${encodeURIComponent(login)}` : "/wizard",
        );
      }
      case "/project":
      case "/infra":
      case "/account": {
        const org = (await installedOrgs(session))[0];
        const shown = org ?? "your-org";
        const page =
          path === "/project" ? (
            <Project user={user!} org={shown} />
          ) : path === "/infra" ? (
            <Infra user={user!} org={shown} />
          ) : (
            <AccountPage user={user!} org={org} />
          );
        return send(
          res,
          200,
          html(path === "/project" ? shown : path === "/infra" ? "Linked infrastructure" : "Account and devices", page),
        );
      }
      default:
        return send(res, 404, html("Not found", <SignIn error="There is no such page." />));
    }
  };
}
