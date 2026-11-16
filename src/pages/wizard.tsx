import { Callout, DataTable, Disclosure, Meter, Stat, StepList, Tag } from "@sustenaut/ui";
import { readBy, shown, type Field, type Reading, type Report } from "../probes";
import { Page, Preview, Works, type User } from "./layout";

export type WizardState = {
  /** Orgs the person is an admin of, as GitHub listed them with their token (undefined: the list failed). */
  adminOrgs?: string[];
  adminOrgsNote?: string;
  org?: string;
  /** Whether the reader app is installed on org, and its install link if not. */
  installed?: boolean;
  installUrl?: string;
  report?: Report;
  error?: string;
};

const button =
  "inline-flex min-h-11 items-center rounded-control bg-primary px-4.5 font-bold text-on-primary no-underline";
const n = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

const text = (r?: Reading) =>
  r?.value === undefined
    ? "—"
    : typeof r.value === "boolean"
      ? r.value
        ? "Yes"
        : "No"
      : typeof r.value === "number"
        ? n.format(r.value)
        : r.value;
const num = (f?: Field) => {
  const r = f && shown(f);
  return typeof r?.value === "number" ? r.value : undefined;
};
const cell = (r?: Reading) =>
  r === undefined ? (
    "not tried"
  ) : (
    <span className="flex flex-col">
      <strong>{text(r)}</strong>
      <span className="text-xs text-muted">
        {r.source}
        {r.status !== undefined ? ` · HTTP ${r.status}` : ""}
      </span>
      {r.note && <span className="text-xs text-muted">{r.note}</span>}
    </span>
  );

function Readings({ report }: { report: Report }) {
  const get = (k: Field["key"]) => report.fields.find((f) => f.key === k)!;
  const plan = shown(get("plan"));
  const rules = shown(get("rulesets"));
  const minutes = [num(get("minutesUsed")), num(get("minutesIncluded"))];
  const storage = [num(get("storageUsed")), num(get("storageIncluded"))];
  return (
    <div className="flex flex-col gap-3.5">
      <h3 className="m-0 font-display text-lg font-extrabold">What we read from {report.org}</h3>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Stat
          label="GitHub plan"
          value={typeof plan?.value === "string" ? plan.value[0].toUpperCase() + plan.value.slice(1) : "—"}
        />
        <Stat label="2FA required for members" value={text(shown(get("twoFactor")))} />
        <Stat
          label="Rulesets on private repos"
          value={rules?.value === undefined ? "—" : rules.value ? "Yes" : "Not on this plan"}
        />
      </div>
      {minutes[0] !== undefined && minutes[1] !== undefined ? (
        <Meter label="Actions minutes this month" used={minutes[0]} total={minutes[1]} format={(v) => n.format(v)} />
      ) : (
        <Callout tone="warning">Actions minutes: not readable either way (see Diagnostics).</Callout>
      )}
      {storage[0] !== undefined && storage[1] !== undefined ? (
        <Meter label="Packages and Actions storage" used={storage[0]} total={storage[1]} unit="GB" />
      ) : (
        <Callout tone="warning">Storage: not readable either way (see Diagnostics).</Callout>
      )}
      {rules?.value === false && (
        <Callout tone="warning">
          Your plan can't protect private repos with rulesets. Your code repos start public, with private data and
          settings kept in your private release-state. When you deploy complex services, add our runners for gated
          private builds, or move to GitHub's paid plan (about €4 per user).
        </Callout>
      )}
      <Diagnostics report={report} />
      <Disclosure summary="What we stored">
        <ul className="m-0 pl-5 text-sm text-muted">
          <li>Nothing on our side: the dashboard has no database.</li>
          <li>Your login and GitHub token, sealed in your session cookie, for eight hours.</li>
          <li>No repository names, no contents.</li>
        </ul>
      </Disclosure>
    </div>
  );
}

/** Per field: what each way read and from where; then every call and its HTTP status. */
export function Diagnostics({ report }: { report: Report }) {
  return (
    <section aria-labelledby="diagnostics" className="flex flex-col gap-3 rounded-control border border-rule p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="diagnostics" className="m-0 font-display text-lg font-extrabold">
          Diagnostics
        </h3>
        <span className="text-sm text-muted">A: reader app installation token · B: your sign-in token</span>
      </div>
      <DataTable
        caption="How each field was read"
        columns={[
          { key: "field", header: "Field", wrap: true },
          { key: "by", header: "Read by" },
          { key: "a", header: "Way A", wrap: true },
          { key: "b", header: "Way B", wrap: true },
        ]}
        rows={report.fields.map((f) => ({
          key: f.key,
          field: f.label,
          by: (
            <Tag tone={readBy(f) === "neither" ? "warning" : readBy(f) === "from plan" ? "neutral" : "success"}>
              {readBy(f)}
            </Tag>
          ),
          a: cell(f.readings.A),
          b: cell(f.readings.B),
        }))}
      />
      <DataTable
        caption="Every call to GitHub"
        columns={[
          { key: "way", header: "Way" },
          { key: "endpoint", header: "Endpoint", wrap: true },
          { key: "status", header: "HTTP", numeric: true },
          { key: "note", header: "GitHub said", wrap: true },
        ]}
        rows={report.calls.map((c, i) => ({
          key: String(i),
          way: c.way,
          endpoint: c.endpoint,
          status: c.status || "—",
          note: c.note,
        }))}
      />
    </section>
  );
}

function StepOne({ s }: { s: WizardState }) {
  if (!s.org)
    return (
      <form method="get" action="/wizard" className="flex flex-col gap-4">
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 font-bold">Which organization?</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <span className="flex min-h-16 flex-col gap-0.5 rounded-control border-2 border-primary bg-accent-soft px-3.5 py-2.5">
              <strong>Use an org I own</strong>
              <span className="text-sm text-muted">We list the orgs where you are an owner</span>
            </span>
            <a
              href="https://github.com/account/organizations/new"
              className="flex min-h-16 flex-col gap-0.5 rounded-control border border-rule-strong bg-surface px-3.5 py-2.5 text-ink no-underline"
            >
              <strong>Create a new org</strong>
              <span className="text-sm text-muted">Opens GitHub's form; come back and pick it here</span>
            </a>
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5 font-bold">
          Organization
          <input
            name="org"
            list="admin-orgs"
            required
            pattern="[A-Za-z0-9-]{1,39}"
            defaultValue={s.adminOrgs?.[0]}
            className="min-h-11 rounded-control border border-rule-strong bg-surface px-3 font-normal"
          />
          <datalist id="admin-orgs">
            {(s.adminOrgs ?? []).map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <span className="text-sm font-normal text-muted">
            {s.adminOrgs === undefined
              ? `GitHub would not list your organizations (${s.adminOrgsNote ?? "no answer"}): type its name.`
              : s.adminOrgs.length
                ? `Orgs you own: ${s.adminOrgs.join(", ")}.`
                : "GitHub lists no org you own with this sign-in: type its name."}
          </span>
        </label>
        <div>
          <button type="submit" className={`${button} cursor-pointer border-0`}>
            Continue
          </button>
        </div>
      </form>
    );
  return (
    <>
      <Callout>
        The <strong>Sustenaut reader</strong> app reads your org's plan, limits and security settings. It never reads
        your repositories or their contents, and you can remove it at any time.
      </Callout>
      {!s.installed && s.installUrl && (
        <div className="flex flex-wrap items-center gap-3">
          <a href={s.installUrl} className={button}>
            Install Sustenaut reader on {s.org}
          </a>
          <a href="/wizard" className="text-link">
            Pick another org
          </a>
        </div>
      )}
      {s.report && <Readings report={s.report} />}
    </>
  );
}

export function Wizard({ user, state }: { user: User; state: WizardState }) {
  const linked = Boolean(state.installed && state.report);
  const plan = state.report && shown(state.report.fields.find((f) => f.key === "plan")!);
  return (
    <Page user={user} bare>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-muted">New project</span>
        <h1 className="m-0 font-display text-3xl font-extrabold">Set up your project</h1>
        <p className="m-0 text-muted">
          Three steps. Each one shows its state, and what we saved. You can leave and come back at any time.
        </p>
      </div>
      {state.error && <Callout tone="danger">{state.error}</Callout>}
      <StepList
        label="Set up your project"
        steps={[
          {
            id: "org",
            title: "Link a GitHub organization",
            summary: linked
              ? `${state.org} linked${plan?.value ? `: ${plan.value} plan` : ""}`
              : "Pick or create an org you own, then install the reader app",
            status: linked ? "done" : "current",
            open: true,
            tags: (
              <>
                <Works />
                <Tag tone={linked ? "success" : "warning"}>{linked ? "ready" : "missing"}</Tag>
              </>
            ),
            children: <StepOne s={state} />,
          },
          {
            id: "secrets",
            title: "Keep your own secrets in Bitwarden",
            summary: "Your keys stay with you. We never see them.",
            status: linked ? "current" : "upcoming",
            open: false,
            tags: <Preview />,
            children: (
              <>
                <p className="m-0">
                  Bitwarden holds every key your project uses: GitHub, Cloudflare, your servers. Our software runs in
                  your GitHub Actions and reads them with one token that only you hold. Nobody else, Sustenaut included,
                  can use them.
                </p>
                <ol className="m-0 flex flex-col gap-2 pl-5">
                  <li>
                    Create release-state in your org from our template. It is private and holds your project's settings.
                  </li>
                  <li>Create a Bitwarden account and turn on Secrets Manager.</li>
                  <li>Make a project and a machine account with read and write on it.</li>
                  <li>
                    Paste its token into release-state's Actions secret <strong>BITWARDEN_TOKEN</strong>. You type it
                    into GitHub, never into Sustenaut.
                  </li>
                </ol>
              </>
            ),
          },
          {
            id: "release",
            title: "Turn on release control",
            summary: "Runs only in your GitHub Actions, with your keys",
            status: "upcoming",
            open: false,
            tags: <Preview />,
            children: (
              <>
                <p className="m-0">
                  The release control app keeps release-state up to date: it finds your repos, checks their settings and
                  opens pull requests for you to merge. No server is involved, yours or ours.
                </p>
                <p className="m-0 text-muted">
                  With GitHub alone you can then launch GitHub Pages apps such as a blog or a recipe site. Apps that
                  need storage or a database ask for linked infrastructure.
                </p>
              </>
            ),
          },
        ]}
      />
      <a href="/" className="font-semibold text-link">
        Save and leave
      </a>
    </Page>
  );
}
