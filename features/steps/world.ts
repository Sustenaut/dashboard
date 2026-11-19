// Each scenario: a fake GitHub, the dashboard's handler on a local port in front of it, and a
// browser of sorts that keeps cookies and does not follow redirects. pubtest's HTTP steps send
// their requests through that browser.
import * as cucumber from "@cucumber/cucumber";
import { After, Before, setWorldConstructor, World } from "@cucumber/cucumber";
import { Answer, register, Result } from "@sustenaut/pubtest";
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
  declare pubtest: { acting(): void; ran(r: unknown): void; answer: Answer | null; client: unknown };

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

  /** Sends a request with the cookies the browser holds, and keeps those it is given. */
  async request(method: string, path: string, headers: Record<string, string> = {}, body?: string) {
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
    this.res = await fetch(this.base + path, {
      method,
      body,
      redirect: "manual",
      headers: cookie ? { ...headers, cookie } : headers,
    });
    for (const line of this.res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";");
      const [k, v] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
      if (attrs.some((a) => a.trim() === "Max-Age=0")) this.jar.delete(k);
      else this.jar.set(k, v);
    }
    this.page = await this.res.text();
    return new Answer(this.res.status, Object.fromEntries(this.res.headers.entries()), this.page);
  }

  /** A When of the suite's own that sends a request: its answer is the one pubtest's Thens read. */
  async send(method: string, path: string) {
    this.pubtest.acting();
    this.pubtest.answer = await this.request(method, path);
    this.pubtest.ran(new Result({ value: this.pubtest.answer }));
  }

  /** The page's text, tags dropped, as a reader sees it. */
  get text() {
    return this.page
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ");
  }

  /** The state GitHub's authorize page was sent in the last redirect. */
  get state() {
    return new URL(this.res!.headers.get("location")!).searchParams.get("state");
  }

  /** Signs in as the fake GitHub's user, through the real OAuth round trip. */
  async signIn() {
    await this.request("GET", "/auth/login");
    await this.request("GET", `/auth/callback?code=good-code&state=${this.state}`);
  }
}

setWorldConstructor(Dashboard);
Before(async function (this: Dashboard) {
  await this.start();
});
After(async function (this: Dashboard) {
  await this.stop();
});
register(cucumber, {
  client: (world: Dashboard) => (method: string, path: string, headers: Record<string, string>, body?: string) =>
    world.request(method, path, headers, body),
});
