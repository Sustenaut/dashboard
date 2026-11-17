import { Given, Then, When } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { INSTALL_TOKEN } from "./fake-github";
import type { Dashboard } from "./world";

// Who and what
Given("a person who has signed in", async function (this: Dashboard) {
  await this.signIn();
  assert.ok(this.jar.has("dash_session"), "signing in gave no session");
});

Given(
  "they own the org {string} and are a member of {string}",
  function (this: Dashboard, owned: string, member: string) {
    this.github.memberships = [
      { org: owned, role: "admin" },
      { org: member, role: "member" },
    ];
    this.github.orgIds.set(owned, 9001);
  },
);

Given("the reader app is installed on {string}", function (this: Dashboard, org: string) {
  this.github.installations.set(42, org);
});

const orgPath = "/orgs/Visit-ee";

Given("way A reads the org as plan {string} with 2FA required", function (this: Dashboard, plan: string) {
  for (const way of ["A", "B"] as const)
    this.github.answers[way].set(orgPath, {
      status: 200,
      body: { login: "Visit-ee", plan: { name: plan }, two_factor_requirement_enabled: true },
    });
});

Given("way A reads the org as plan {string} with 2FA not required", function (this: Dashboard, plan: string) {
  this.github.answers.A.set(orgPath, {
    status: 200,
    body: { login: "Visit-ee", plan: { name: plan }, two_factor_requirement_enabled: false },
  });
});

const summaryPath = "/organizations/Visit-ee/settings/billing/usage/summary";
const summaryItems = (w: Dashboard): any[] => {
  const canned = w.github.answers.A.get(summaryPath);
  const items = (canned?.body as any)?.usageItems ?? [];
  w.github.answers.A.set(summaryPath, { status: 200, body: { usageItems: items } });
  return items;
};
const sku = (sku: string, unitType: string, gross: number, net: number) => ({
  product: "Actions",
  sku,
  unitType,
  grossQuantity: gross,
  discountQuantity: gross - net,
  netQuantity: net,
});

Given(
  "way A reads this month's summary as {int} Actions minutes, {int} billed",
  function (this: Dashboard, gross: number, net: number) {
    summaryItems(this).push(sku("actions_linux", "minutes", gross, net), {
      product: "Copilot",
      unitType: "user-months",
      grossQuantity: 3,
      netQuantity: 3,
    });
  },
);

Given(
  "way A reads this month's summary as {int} Actions minutes, {int} billed, over three runners",
  function (this: Dashboard, gross: number, net: number) {
    const items = summaryItems(this);
    items.push(sku("actions_linux", "minutes", gross - 747, net), sku("actions_windows", "minutes", 415, 0));
    items.push(sku("actions_macos", "Minutes", 332, 0));
  },
);

Given(
  "way A reads this month's storage as {float} GB-hours, {float} billed",
  function (this: Dashboard, gross: number, net: number) {
    summaryItems(this).push(sku("actions_storage", "gigabyte-hours", gross, net));
  },
);

Given("way B is refused the org's billing with HTTP {int}", function (this: Dashboard, status: number) {
  this.github.answers.B.set(summaryPath, { status, body: { message: "Resource not accessible by integration" } });
});

// What they do
When("a visitor opens the dashboard", async function (this: Dashboard) {
  await this.request("GET", "/");
});
When("they open the dashboard", async function (this: Dashboard) {
  await this.request("GET", "/");
});
When("a visitor opens the page {string}", async function (this: Dashboard, path: string) {
  await this.request("GET", path);
});
When("they open the page {string}", async function (this: Dashboard, path: string) {
  await this.request("GET", path);
});
When("they send a POST to {string}", async function (this: Dashboard, path: string) {
  await this.request("POST", path);
});
When("a visitor starts signing in", async function (this: Dashboard) {
  await this.request("GET", "/auth/login");
});

const stateFrom = (w: Dashboard) => new URL(w.res!.headers.get("location")!).searchParams.get("state");
let lastState: string | null = null;

When("GitHub sends them back with a good code and the same state", async function (this: Dashboard) {
  lastState = stateFrom(this);
  await this.request("GET", `/auth/callback?code=good-code&state=${lastState}`);
});
When("GitHub sends them back with a good code and another state", async function (this: Dashboard) {
  await this.request("GET", "/auth/callback?code=good-code&state=someone-elses");
});
When("GitHub sends them back with a bad code and the same state", async function (this: Dashboard) {
  await this.request("GET", `/auth/callback?code=bad-code&state=${stateFrom(this)}`);
});
When("their session cookie is changed by one character", function (this: Dashboard) {
  const v = this.jar.get("dash_session")!;
  this.jar.set(
    "dash_session",
    (v[5] === "A" ? "B" : "A").padStart(1) && v.slice(0, 5) + (v[5] === "A" ? "B" : "A") + v.slice(6),
  );
});
When("nine hours pass", function (this: Dashboard) {
  this.now = new Date(this.now.getTime() + 9 * 3600_000);
});
When("they sign out", async function (this: Dashboard) {
  await this.request("POST", "/auth/logout");
});

// What they see
Then("the page says {string}", function (this: Dashboard, text: string) {
  assert.ok(this.text.includes(text), `the page does not say "${text}":\n${this.text.slice(0, 2000)}`);
});
Then("the page does not say {string}", function (this: Dashboard, text: string) {
  assert.ok(!this.text.includes(text), `the page says "${text}"`);
});
Then("the page links to {string}", function (this: Dashboard, href: string) {
  assert.ok(this.page.includes(`href="${href.replace(/&/g, "&amp;")}"`), `no link to ${href}`);
});
Then("the page is tagged {string}", function (this: Dashboard, tag: string) {
  assert.match(this.page, new RegExp(`<span class="[^"]*rounded-full[^"]*">(<span[^>]*></span>)?${tag}</span>`));
});
Then("the page has no script", function (this: Dashboard) {
  assert.ok(!/<script/i.test(this.page));
});
Then("the answer is HTTP {int}", function (this: Dashboard, status: number) {
  assert.equal(this.res!.status, status);
});
Then("they are sent to {string}", function (this: Dashboard, to: string) {
  assert.equal(this.res!.status, 303);
  assert.equal(this.res!.headers.get("location"), to);
});
Then("they are sent to GitHub's authorize page with the dashboard's client and callback", function (this: Dashboard) {
  const to = new URL(this.res!.headers.get("location")!);
  assert.equal(to.origin + to.pathname, `${this.github.url}/web/login/oauth/authorize`);
  assert.equal(to.searchParams.get("client_id"), "client-id");
  assert.equal(to.searchParams.get("redirect_uri"), "https://dashboard.test/auth/callback");
  assert.ok((to.searchParams.get("state") ?? "").length >= 20);
});
Then("they are sent to the app's install page for the org's id", function (this: Dashboard) {
  assert.equal(
    this.res!.headers.get("location"),
    `${this.github.url}/web/apps/sustenaut-reader-test/installations/new/permissions?target_id=9001`,
  );
});
Then("they hold a session cookie that is HttpOnly, Secure and SameSite=Lax", function (this: Dashboard) {
  const line = this.res!.headers.getSetCookie().find((c) => c.startsWith("dash_session="))!;
  for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"])
    assert.ok(line.includes(attr), `no ${attr}: ${line}`);
});
Then("the session cookie does not show the GitHub token", function (this: Dashboard) {
  const v = decodeURIComponent(this.jar.get("dash_session")!);
  assert.ok(!v.includes("user-token") && !Buffer.from(v, "base64url").toString("latin1").includes("user-token"));
});
Then("they hold no session cookie", function (this: Dashboard) {
  assert.ok(!this.jar.has("dash_session"));
});

const fieldRow = (w: Dashboard, label: string) => {
  const rows = w.page
    .split("<tr>")
    .slice(1)
    .filter((r) => r.includes(`>${label}<`));
  assert.ok(rows.length, `no diagnostics row for ${label}`);
  return rows[0];
};
Then("the field {string} was read by {string}", function (this: Dashboard, label: string, by: string) {
  assert.ok(
    fieldRow(this, label).includes(`>${by}</span>`),
    `${label} was not read by ${by}: ${fieldRow(this, label)}`,
  );
});
Then("the page shows {string} as {string}", function (this: Dashboard, label: string, value: string) {
  assert.ok(this.text.includes(`${label} ${value} `), `"${label}" is not "${value}":\n${this.text}`);
});
Then("the diagnostics list {string} for both ways", function (this: Dashboard, endpoint: string) {
  const path = endpoint.replace("{org}", "Visit-ee");
  for (const way of ["A", "B"])
    assert.match(this.page, new RegExp(`<td[^>]*>${way}</td><td[^>]*>${path.replace(/[/{}]/g, "\\$&")}</td>`));
});
Then("the installation token was used only for way A calls", function (this: Dashboard) {
  const withToken = this.github.seen.filter((s) => s.auth === `token ${INSTALL_TOKEN}`);
  assert.equal(withToken.length, 3);
  assert.ok(withToken.every((s) => !s.path.startsWith("/user")));
});
Then("GitHub was not asked about {string}", function (this: Dashboard, path: string) {
  assert.ok(!this.github.seen.some((s) => s.path.startsWith(path)));
});
Then("the answer's content security policy forbids scripts and framing", function (this: Dashboard) {
  const csp = this.res!.headers.get("content-security-policy")!;
  assert.ok(
    csp.includes("default-src 'none'") && csp.includes("frame-ancestors 'none'") && !csp.includes("script-src"),
  );
});
