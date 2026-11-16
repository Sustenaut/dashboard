// GitHub, as the dashboard calls it: the app's own JWT, an installation's token ("way A"), the
// OAuth code exchange that signs a person in, and the user-to-server token it gives ("way B").
// Every call is answered as { status, body }: the diagnostics show what GitHub said, so nothing
// here throws on an HTTP status.
import { createSign } from "node:crypto";

export type Answer = { status: number; body: any; endpoint: string };
export type Auth = { kind: "app" | "installation" | "user"; token: string };

export class GitHub {
  constructor(
    private api: string,
    private web: string,
    private fetcher: typeof fetch = fetch,
  ) {}

  async call(method: string, path: string, auth?: Auth, body?: unknown): Promise<Answer> {
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "sustenaut-dashboard",
    };
    if (auth) headers.authorization = `${auth.kind === "installation" ? "token" : "Bearer"} ${auth.token}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    const endpoint = `${method} ${path.split("?")[0]}`;
    try {
      const res = await this.fetcher(this.api + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let parsed: any = text;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        /* not JSON: kept as text */
      }
      return { status: res.status, body: parsed, endpoint };
    } catch (error) {
      return { status: 0, body: { message: String(error) }, endpoint };
    }
  }

  /** The app's JWT (RS256, ten minutes, backdated a minute for clock drift). */
  static appJwt(appId: string, pem: string, now = Math.floor(Date.now() / 1000)): string {
    const part = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const unsigned = `${part({ alg: "RS256", typ: "JWT" })}.${part({ iat: now - 60, exp: now + 540, iss: appId })}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(pem).toString("base64url");
    return `${unsigned}.${signature}`;
  }

  /** Swaps an OAuth code for the person's user-to-server token. */
  async exchangeCode(clientId: string, clientSecret: string, code: string, redirectUri: string): Promise<Answer> {
    const endpoint = "POST /login/oauth/access_token";
    try {
      const res = await this.fetcher(`${this.web}/login/oauth/access_token`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "user-agent": "sustenaut-dashboard",
        },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
      });
      return { status: res.status, body: await res.json().catch(() => null), endpoint };
    } catch (error) {
      return { status: 0, body: { message: String(error) }, endpoint };
    }
  }

  authorizeUrl(clientId: string, redirectUri: string, state: string): string {
    const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, state });
    return `${this.web}/login/oauth/authorize?${q}`;
  }

  installUrl(slug: string, targetId?: number): string {
    const base = `${this.web}/apps/${encodeURIComponent(slug)}/installations/new`;
    return targetId ? `${base}/permissions?target_id=${targetId}` : base;
  }
}
