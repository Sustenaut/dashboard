// Each scenario: a fake GitHub, the dashboard's handler on a local port in front of it, and a
// browser of sorts that keeps cookies and does not follow redirects.
import { After, Before, setWorldConstructor, World } from "@cucumber/cucumber";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createHandler } from "../../src/server";
import { APP_ID, APP_KEY, FakeGitHub } from "./fake-github";

export const SESSION_SECRET = "a-session-secret-of-at-least-32-characters";

export class Dashboard extends World {
  github = new FakeGitHub();
  server!: Server;
  base = "";
  jar = new Map<string, string>();
  res?: Response;
  page = "";
  now = new Date("2026-11-16T12:00:00Z");

  async start() {
    await this.github.start();
    const handle = createHandler(
      {
        publicUrl: "https://dashboard.test",
        appId: APP_ID,
        appKey: APP_KEY,
        clientId: "client-id",
        clientSecret: "client-secret",
        sessionSecret: SESSION_SECRET,
        githubApi: this.github.url,
        githubWeb: `${this.github.url}/web`,
        publicDir: "features/assets",
      },
      fetch,
      () => this.now,
    );
    this.server = createServer((req, res) => void handle(req, res));
    await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
    this.base = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop() {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
    await this.github.stop();
  }

  async request(method: string, path: string) {
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    this.res = await fetch(this.base + path, { method, redirect: "manual", headers: cookie ? { cookie } : {} });
    for (const line of this.res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const [k, v] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
      if (attrs.some((a) => a.trim() === "Max-Age=0")) this.jar.delete(k);
      else this.jar.set(k, v);
    }
    this.page = await this.res.text();
    return this.res;
  }

  /** The page's text, tags dropped, as a reader sees it. */
  get text() {
    return this.page
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ");
  }

  /** Signs in as the fake GitHub's user, through the real OAuth round trip. */
  async signIn() {
    await this.request("GET", "/auth/login");
    const state = new URL(this.res!.headers.get("location")!).searchParams.get("state");
    await this.request("GET", `/auth/callback?code=good-code&state=${state}`);
  }
}

setWorldConstructor(Dashboard);
Before(async function (this: Dashboard) {
  await this.start();
});
After(async function (this: Dashboard) {
  await this.stop();
});
