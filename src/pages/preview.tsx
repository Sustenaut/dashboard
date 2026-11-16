// Screens 4 to 6 of the design: layout only in phase 0, every one tagged Preview.
import {
  AccountChip,
  Callout,
  CapabilityMatrix,
  DataTable,
  DeviceList,
  Disclosure,
  LaunchTile,
  MenuButton,
  Meter,
  PageHeading,
  Panel,
  RowActions,
  UnlockList,
  Button,
  type CapabilityCell,
} from "@sustenaut/ui";
import { Page, Preview, type User } from "./layout";

const launch = <Button variant="primary">Launch</Button>;
const addInfra = (
  <a
    href="/infra"
    className="inline-flex min-h-11 items-center justify-center rounded-control border border-rule-strong bg-surface font-bold no-underline"
  >
    Add infrastructure
  </a>
);

export function Project({ user, org }: { user: User; org: string }) {
  return (
    <Page user={user} place="project" project={org}>
      <PageHeading title={org} lede="Your project, once it is set up." actions={<Preview />} />
      <Callout>
        <strong>To launch apps that need storage or a database:</strong> link a provider that offers them.{" "}
        <a href="/infra">Link a provider</a>
      </Callout>
      <div className="grid gap-3 sm:grid-cols-2">
        <Panel title="Your address">
          <strong>&lt;app&gt;.your-project.sustenaut.app</strong>
          <span className="text-sm text-muted">Have your own domain? Move your apps to it with one transfer step.</span>
        </Panel>
        <Panel title="Actions minutes" actions={<a href="/wizard">Read in step 1</a>}>
          <Meter
            label="Example"
            used={1780}
            total={2000}
            note="Resets on the 1st. Real numbers are in the wizard's step 1."
          />
        </Panel>
      </div>
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="m-0 font-display text-2xl font-extrabold">Launch an app</h2>
          <span className="text-sm text-muted">Greyed apps need infrastructure you haven't linked yet</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <LaunchTile
            title="Blog"
            description="Posts written in Markdown, published by GitHub Pages."
            detail="blog.your-project.sustenaut.app"
            action={launch}
          />
          <LaunchTile
            title="Recipe site"
            description="Your recipes, kept private, served as a public site."
            detail="recipes.your-project.sustenaut.app"
            action={launch}
          />
          <LaunchTile
            title="Project page"
            description="A single page about your project, on GitHub Pages."
            detail="www.your-project.sustenaut.app"
            action={launch}
          />
          <LaunchTile
            title="Photo library"
            description="Albums and sharing for your photos."
            available={false}
            needs="Needs: file storage, database"
            action={addInfra}
          />
          <LaunchTile
            title="Shared notebooks"
            description="Data notebooks your team signs in to."
            available={false}
            needs="Needs: database, authorization"
            action={addInfra}
          />
          <LaunchTile
            title="Uptime monitoring"
            description="Checks your apps and warns you when one is down."
            available={false}
            needs="Needs: edge or your own infra"
            action={addInfra}
          />
        </div>
      </section>
    </Page>
  );
}

const yes = (mark?: string, tip?: string): CapabilityCell => ({ value: "yes", mark, tip: tip ?? "Available" });
const no = (tip?: string): CapabilityCell => ({ value: "no", tip: tip ?? "Not offered" });
const row = (key: string, name: string, cells: CapabilityCell[]) => ({
  key,
  name,
  cells: Object.fromEntries(["dns", "storage", "db", "authz", "zt", "edge"].map((c, i) => [c, cells[i]])),
});

export function Infra({ user, org }: { user: User; org: string }) {
  return (
    <Page user={user} place="infra" project={org}>
      <PageHeading
        title="Linked infrastructure"
        lede="The accounts your project runs on, and what each one can do for you."
        actions={<Preview />}
      />
      <Callout tone="success">
        <strong>Linking only scans. Nothing is created or changed.</strong> Every change to your infrastructure is made
        with your own keys, from your own accounts. We keep only the result of each check.
      </Callout>
      <Panel
        title="Linked SaaS accounts"
        actions={
          <MenuButton
            trigger="+ Link account"
            variant="primary"
            items={[
              { key: "own", label: "Your own servers", note: "Scan a machine you run", href: "#" },
              { key: "cf", label: "Cloudflare", note: "DNS, storage, databases, edge", href: "#" },
              { key: "ts", label: "Tailscale", note: "Zero trust network", href: "#" },
              { key: "gcp", label: "Google Cloud", note: "Storage, databases, DNS, edge", href: "#" },
              { key: "dns2", label: "Second DNS provider", note: "A backup for your DNS", href: "#" },
              { key: "other", label: "Other provider", note: "Tell us what you use", href: "#" },
            ]}
          />
        }
      >
        <div className="flex flex-wrap gap-2">
          <AccountChip id="github" name="GitHub" short={org} detail={`GitHub org ${org} · reader app installed`} />
          <AccountChip
            id="bitwarden"
            name="Bitwarden"
            short={org}
            detail={`Bitwarden project ${org} · machine account ${org}-platform`}
          />
        </div>
        <span className="text-sm text-muted">
          Hover or focus an account for its details. You can link more than one of a kind, such as a second DNS
          provider.
        </span>
      </Panel>
      <Panel title="Who can provide what">
        <p className="m-0 text-sm text-muted">
          Hover a cell for the trade-off. We combine providers so each capability comes from the cheapest one that
          offers it, with a second provider wherever a note says one is needed.
        </p>
        <CapabilityMatrix
          caption="Who can provide what"
          columns={[
            { key: "dns", header: "DNS" },
            { key: "storage", header: "File storage" },
            { key: "db", header: "Databases" },
            { key: "authz", header: "Authorization" },
            { key: "zt", header: "Zero trust / VPN" },
            { key: "edge", header: "Edge" },
          ]}
          rows={[
            row("byo", "Bring your own infra", [
              no("Your own servers cannot run DNS for you"),
              yes("¹", "A second provider is needed for backups and snapshots"),
              yes("¹", "A second provider is needed for backups and snapshots"),
              yes("²", "Only when Tailscale is in use"),
              { value: "partly", text: "via Tailscale", tip: "Add Tailscale for zero trust" },
              no("No edge services"),
            ]),
            row("cf", "Cloudflare", [
              yes(),
              yes(),
              yes("³", "A second database is needed; limited to 10 GB"),
              no("No authorization service"),
              yes("⁴", "Per user; the first 50 users are free"),
              yes(),
            ]),
            row("gcp", "Google Cloud ⁵", [
              yes(),
              yes(),
              yes(),
              yes("⁹", "Needs a load balancer: extra cost when combined with other infrastructure"),
              yes("⁶", "Inside Google Cloud only, unless you run a separate load balancer there"),
              yes("⁷", "No free-tier edge services"),
            ]),
            row("gh", "GitHub", [no(), yes(undefined, "Repositories, packages and Pages"), no(), no(), no(), no()]),
            row("ts", "Tailscale", [
              no(),
              no(),
              no(),
              no(),
              yes("⁸", "Personal use only; needed for the self-hosted platform layer"),
              no(),
            ]),
          ]}
          notes={[
            "A second provider is needed for backups and snapshots.",
            "Only when Tailscale is in use.",
            "A second database is needed; size is limited to 10 GB.",
            "Per user; the first 50 users are free.",
            "Google Cloud has no free tier.",
            "Inside Google Cloud only, unless you run a separate load balancer there.",
            "No free-tier edge services.",
            "Personal use only. Needed for the self-hosted platform layer.",
            "Needs a load balancer, an extra cost when combined with other infrastructure.",
          ]}
        />
      </Panel>
    </Page>
  );
}

export function AccountPage({ user, org }: { user: User; org?: string }) {
  return (
    <Page user={user} place="account" project={org}>
      <PageHeading
        title="Account and devices"
        lede="Securing your account unlocks more of what you can do. We check again whenever you sign in."
        actions={<Preview />}
      />
      <Panel title="Unlock more">
        <UnlockList
          items={[
            {
              key: "passkey",
              todo: "Add a second passkey for recovery",
              unlocks: "linking infrastructure",
              action: <a href="#">Add passkey</a>,
            },
            {
              key: "verify",
              todo: "Verify yourself with an EU wallet or a payment method",
              unlocks: "paid platform services",
              action: <a href="#">Verify</a>,
            },
          ]}
        />
      </Panel>
      <Panel title="Sign-in methods">
        <DataTable
          caption="Sign-in methods"
          columns={[
            { key: "method", header: "Method" },
            { key: "last", header: "Last used" },
            { key: "actions", header: <span className="sr-only">Actions</span> },
          ]}
          rows={[
            {
              key: "gh",
              method: (
                <>
                  <strong>GitHub</strong> @{user.login}
                </>
              ),
              last: "Today",
              actions: (
                <RowActions
                  note="Always on"
                  more={[
                    {
                      key: "sec",
                      label: "Open GitHub security settings",
                      href: "https://github.com/settings/security",
                    },
                  ]}
                />
              ),
            },
            {
              key: "pk",
              method: (
                <>
                  <strong>Passkey</strong> on this laptop
                </>
              ),
              last: "Example",
              actions: (
                <RowActions
                  usual={{ label: "Remove passkey", icon: "trash" }}
                  more={[
                    { key: "rename", label: "Rename" },
                    { key: "remove", label: "Remove passkey", danger: true },
                  ]}
                />
              ),
            },
          ]}
        />
        <span className="text-sm text-muted">
          We keep only the last use of each method, never a history of your sign-ins.
        </span>
      </Panel>
      <Panel title="Your devices">
        <DeviceList
          caption="Your devices"
          devices={[
            {
              key: "1",
              name: "Firefox on Linux",
              badge: "This device",
              country: "Estonia",
              lastSeen: "2026-11-16",
              action: (
                <RowActions
                  note="Signed in"
                  more={[
                    { key: "rename", label: "Rename" },
                    { key: "out", label: "Sign out" },
                  ]}
                />
              ),
            },
            {
              key: "2",
              name: "Safari on iPhone",
              country: "Estonia",
              lastSeen: "2026-11-12",
              action: (
                <RowActions
                  usual={{ label: "Forget device", icon: "trash" }}
                  more={[
                    { key: "rename", label: "Rename" },
                    { key: "out", label: "Sign out" },
                    { key: "forget", label: "Forget device", danger: true },
                  ]}
                />
              ),
            },
            {
              key: "3",
              name: "Chrome on Windows",
              badge: "New country",
              country: "Finland",
              lastSeen: "2026-11-15",
              action: (
                <RowActions
                  usual={{ label: "Not me: sign out and block", icon: "flag", danger: true }}
                  more={[
                    { key: "me", label: "This was me" },
                    { key: "block", label: "Not me: sign out and block", danger: true },
                    { key: "forget", label: "Forget device" },
                  ]}
                />
              ),
            },
          ]}
        />
        <Disclosure summary="What we keep about your devices">
          <ul className="m-0 pl-5 text-sm text-muted">
            <li>
              One row per device, replaced each time you sign in: a random device id kept in your browser, a hash of
              stable browser details, the browser name, the country and the day.
            </li>
            <li>No IP addresses, no times of day, no sign-in history.</li>
            <li>Used only to secure your sign-in. Devices unused for 180 days are deleted.</li>
          </ul>
        </Disclosure>
      </Panel>
    </Page>
  );
}
