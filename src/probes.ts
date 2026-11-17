// Phase 0's question: which of an organization's facts can Sustenaut read, and how? Each fact
// is read both ways, A with the reader app's installation token and B with the token the person
// signed in with, and every call is kept (endpoint, way, HTTP status) for the Diagnostics table.
import type { Answer, Auth, GitHub } from "./github";

export type Way = "A" | "B";
export type Call = { way: Way; endpoint: string; status: number; note: string };
export type Reading = {
  /** What was read, or undefined when this way could not read it. */
  value?: string | number | boolean;
  /** Where it came from: an endpoint, or "plan" when derived from the plan's published limits. */
  source: string;
  status?: number;
  note?: string;
};
export type FieldKey =
  | "plan"
  | "twoFactor"
  | "minutesUsed"
  | "minutesBilled"
  | "minutesIncluded"
  | "storageUsed"
  | "storageBilled"
  | "storageIncluded"
  | "rulesets";
export type Field = { key: FieldKey; label: string; readings: Partial<Record<Way, Reading>> };
export type Report = { org: string; fields: Field[]; calls: Call[] };

export const LABELS: Record<FieldKey, string> = {
  plan: "GitHub plan",
  twoFactor: "2FA required for members",
  minutesUsed: "Actions minutes this month, all repos",
  minutesBilled: "Actions minutes billed this month",
  minutesIncluded: "Actions minutes included for private repos",
  storageUsed: "Packages and Actions storage this month (GB, average)",
  storageBilled: "Packages and Actions storage billed this month (GB-hours)",
  storageIncluded: "Packages and Actions storage included for private repos (GB)",
  rulesets: "Rulesets on private repos",
};

/** GitHub's published included amounts per plan, for private repositories. */
export const PLAN_LIMITS: Record<string, { minutes: number; storageGb: number; privateRulesets: boolean }> = {
  free: { minutes: 2000, storageGb: 0.5, privateRulesets: false },
  team: { minutes: 3000, storageGb: 2, privateRulesets: true },
  business: { minutes: 50000, storageGb: 50, privateRulesets: true },
  enterprise: { minutes: 50000, storageGb: 50, privateRulesets: true },
};

const note = (a: Answer): string => {
  if (a.status === 0) return "no answer";
  const message = a.body && typeof a.body === "object" && typeof a.body.message === "string" ? a.body.message : "";
  return message.slice(0, 120);
};

const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

/** The month's summary items for a product and unit (case and spacing aside), added up. GitHub's
 *  summary gives each SKU's gross quantity (all use, public repos included), the part its
 *  discounts cover (public repos, the plan's included amount) and the net part that is billed. */
function summed(items: any[], products: string[], unit: string): { gross: number; net: number } {
  const norm = (v: unknown) =>
    String(v ?? "")
      .toLowerCase()
      .replace(/[\s_-]/g, "");
  return items
    .filter((i) => products.includes(norm(i?.product)) && norm(i?.unitType) === unit)
    .reduce(
      (t, i) => ({ gross: t.gross + (Number(i?.grossQuantity) || 0), net: t.net + (Number(i?.netQuantity) || 0) }),
      { gross: 0, net: 0 },
    );
}

export async function readWay(
  gh: GitHub,
  org: string,
  auth: Auth,
  now: Date,
): Promise<{ readings: Record<FieldKey, Reading>; calls: Answer[] }> {
  const o = encodeURIComponent(org);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const [orgA, summary, rulesets] = await Promise.all([
    gh.call("GET", `/orgs/${o}`, auth),
    gh.call("GET", `/organizations/${o}/settings/billing/usage/summary?year=${year}&month=${month}`, auth),
    gh.call("GET", `/orgs/${o}/rulesets`, auth),
  ]);
  const ok = (a: Answer) => a.status === 200 && a.body && typeof a.body === "object";
  const failed = (a: Answer, what = ""): Reading => ({
    source: a.endpoint,
    status: a.status,
    note: what || note(a) || `HTTP ${a.status}`,
  });

  const planName: string | undefined =
    ok(orgA) && typeof orgA.body.plan?.name === "string" ? orgA.body.plan.name : undefined;
  const limits = planName ? PLAN_LIMITS[planName.toLowerCase()] : undefined;
  const fromPlan = (value: number | boolean | undefined, what: string): Reading =>
    planName === undefined
      ? { source: "plan", note: "the plan was not readable this way" }
      : value === undefined
        ? { source: "plan", note: `no published ${what} for plan ${planName}` }
        : { value, source: "plan", note: `GitHub's published ${what} for plan ${planName}` };

  const items: any[] | undefined =
    ok(summary) && Array.isArray(summary.body.usageItems) ? summary.body.usageItems : undefined;

  const plan: Reading = planName
    ? { value: planName, source: orgA.endpoint, status: orgA.status }
    : failed(orgA, ok(orgA) ? "answered without a plan" : "");

  const tfa = ok(orgA) ? orgA.body.two_factor_requirement_enabled : undefined;
  const twoFactor: Reading =
    typeof tfa === "boolean"
      ? { value: tfa, source: orgA.endpoint, status: orgA.status }
      : failed(orgA, ok(orgA) ? "two_factor_requirement_enabled was hidden" : "");

  const read = (value: number, what: string): Reading => ({ value, source: summary.endpoint, status: 200, note: what });
  const notRead = (): Reading => failed(summary);
  const minutes = items && summed(items, ["actions"], "minutes");
  const storage = items && summed(items, ["actions", "packages"], "gigabytehours");
  const hours = Math.max(1, (now.getTime() - Date.UTC(year, month - 1, 1)) / 3_600_000);
  const minutesUsed = minutes ? read(round(minutes.gross, 0), "gross minutes, public repos included") : notRead();
  const minutesBilled = minutes ? read(round(minutes.net, 0), "net minutes, what GitHub bills") : notRead();
  const minutesIncluded = fromPlan(limits?.minutes, "included minutes");
  const storageUsed = storage
    ? read(round(storage.gross / hours), `gross GB-hours over the ${Math.round(hours)} hours so far`)
    : notRead();
  const storageBilled = storage ? read(round(storage.net, 3), "net GB-hours, what GitHub bills") : notRead();
  const storageIncluded = fromPlan(limits?.storageGb, "included storage");

  const rules = fromPlan(limits?.privateRulesets, "ruleset support on private repositories");
  const rulesetsReading: Reading = {
    ...rules,
    note: `${rules.note}; ${rulesets.endpoint} answered HTTP ${rulesets.status}${note(rulesets) ? `: ${note(rulesets)}` : ""}`,
  };

  return {
    readings: {
      plan,
      twoFactor,
      minutesUsed,
      minutesBilled,
      minutesIncluded,
      storageUsed,
      storageBilled,
      storageIncluded,
      rulesets: rulesetsReading,
    },
    calls: [orgA, summary, rulesets],
  };
}

/** Reads the organization both ways: A when the reader app is installed there, B always. */
export async function readOrg(
  gh: GitHub,
  org: string,
  ways: Partial<Record<Way, Auth>>,
  now = new Date(),
): Promise<Report> {
  const fields: Field[] = (Object.keys(LABELS) as FieldKey[]).map((key) => ({ key, label: LABELS[key], readings: {} }));
  const calls: Call[] = [];
  for (const way of ["A", "B"] as Way[]) {
    const auth = ways[way];
    if (!auth) continue;
    const { readings, calls: answers } = await readWay(gh, org, auth, now);
    for (const f of fields) f.readings[way] = readings[f.key];
    for (const a of answers) calls.push({ way, endpoint: a.endpoint, status: a.status, note: note(a) });
  }
  return { org, fields, calls };
}

/** The value to show: way A's when it read one, else B's. */
export function shown(field: Field): Reading | undefined {
  return [field.readings.A, field.readings.B].find((r) => r?.value !== undefined);
}

/** Which ways GitHub answered the field directly: "A and B", "A only", "B only"; "from plan" when
 *  it was only derived from the plan's published limits; else "neither". */
export function readBy(field: Field): string {
  const direct = (r?: Reading) => r?.value !== undefined && r.source !== "plan";
  const a = direct(field.readings.A);
  const b = direct(field.readings.B);
  if (a || b) return a && b ? "A and B" : a ? "A only" : "B only";
  return shown(field) ? "from plan" : "neither";
}
