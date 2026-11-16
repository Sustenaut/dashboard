// A fake of GitHub's API and web sign-in, on a local port, for the scenarios: it answers the
// calls the dashboard makes, checks the app's JWT against the test key, and remembers every
// request so a scenario can say what was asked.
import { createVerify, generateKeyPairSync } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export const { privateKey: APP_KEY, publicKey: APP_PUBLIC } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
export const APP_ID = "123456";
export const USER_TOKEN = "user-token-b";
export const INSTALL_TOKEN = "installation-token-a";

export type Canned = { status: number; body?: unknown };
export type Seen = { method: string; path: string; auth?: string; body?: string };

export class FakeGitHub {
  server!: Server;
  url = "";
  seen: Seen[] = [];
  /** The orgs the person belongs to, with their role. */
  memberships: { org: string; role: "admin" | "member" }[] = [];
  /** Orgs the reader app is installed on, by installation id. */
  installations = new Map<number, string>();
  orgIds = new Map<string, number>();
  /** Answers for the org reads, by way ("A" installation token, "B" user token) and path. */
  answers: Record<"A" | "B", Map<string, Canned>> = { A: new Map(), B: new Map() };
  codes = new Set(["good-code"]);

  async start() {
    this.server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const url = new URL(req.url ?? "/", "http://fake");
        const auth = req.headers.authorization;
        this.seen.push({ method: req.method ?? "", path: url.pathname + url.search, auth, body });
        const { status, body: out } = this.answer(req.method ?? "", url, auth, body);
        res.writeHead(status, { "content-type": "application/json" });
        res.end(out === undefined ? "" : JSON.stringify(out));
      });
    });
    await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  stop() {
    return new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private jwtOk(auth?: string): boolean {
    const m = /^Bearer ([\w-]+)\.([\w-]+)\.([\w-]+)$/.exec(auth ?? "");
    if (!m) return false;
    const ok = createVerify("RSA-SHA256").update(`${m[1]}.${m[2]}`).verify(APP_PUBLIC, Buffer.from(m[3], "base64url"));
    const claims = JSON.parse(Buffer.from(m[2], "base64url").toString());
    return ok && claims.iss === APP_ID && claims.exp > Date.now() / 1000;
  }

  private answer(method: string, url: URL, auth: string | undefined, body: string): Canned {
    const p = url.pathname.replace(/^\/web\//, "/");
    if (method === "POST" && p === "/login/oauth/access_token") {
      const sent = JSON.parse(body || "{}");
      return this.codes.has(sent.code) && sent.client_secret === "client-secret"
        ? { status: 200, body: { access_token: USER_TOKEN, token_type: "bearer", expires_in: 28800 } }
        : { status: 200, body: { error: "bad_verification_code" } };
    }
    const asUser = auth === `Bearer ${USER_TOKEN}`;
    const asInstall = auth === `token ${INSTALL_TOKEN}`;
    if (p === "/user") return asUser ? { status: 200, body: { login: "david", name: "David" } } : { status: 401 };
    if (p === "/user/installations")
      return asUser
        ? {
            status: 200,
            body: {
              installations: [...this.installations.values()].map((login) => ({
                account: { login, type: "Organization" },
              })),
            },
          }
        : { status: 401 };
    if (p === "/user/memberships/orgs")
      return asUser
        ? { status: 200, body: this.memberships.map((m) => ({ role: m.role, organization: { login: m.org } })) }
        : { status: 401 };
    if (p === "/app")
      return this.jwtOk(auth) ? { status: 200, body: { slug: "sustenaut-reader-test" } } : { status: 401 };
    let m = /^\/orgs\/([^/]+)\/installation$/.exec(p);
    if (m) {
      if (!this.jwtOk(auth)) return { status: 401 };
      const id = [...this.installations].find(([, login]) => login === m![1])?.[0];
      return id ? { status: 200, body: { id } } : { status: 404, body: { message: "Not Found" } };
    }
    m = /^\/app\/installations\/(\d+)(\/access_tokens)?$/.exec(p);
    if (m) {
      if (!this.jwtOk(auth)) return { status: 401 };
      const login = this.installations.get(Number(m[1]));
      if (!login) return { status: 404 };
      return m[2]
        ? { status: 201, body: { token: INSTALL_TOKEN } }
        : { status: 200, body: { id: Number(m[1]), account: { login } } };
    }
    const way = asInstall ? "A" : asUser ? "B" : undefined;
    if (!way) return { status: 401, body: { message: "Bad credentials" } };
    const canned = this.answers[way].get(p);
    if (canned) return canned;
    m = /^\/orgs\/([^/]+)$/.exec(p);
    if (m && this.orgIds.has(m[1])) return { status: 200, body: { login: m[1], id: this.orgIds.get(m[1]) } };
    return { status: 404, body: { message: "Not Found" } };
  }
}
