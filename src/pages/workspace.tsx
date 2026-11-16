import { PageHeading, Panel, UnlockList } from "@sustenaut/ui";
import { Page, type User } from "./layout";

const addProject =
  "inline-flex min-h-11 items-center rounded-control bg-primary px-4.5 font-bold text-on-primary no-underline";

/** The orgs the reader app is installed on and the person can see (GET /user/installations). */
export function Workspace({ user, orgs }: { user: User; orgs: string[] }) {
  return (
    <Page user={user} place="workspace" project={orgs[0]}>
      <PageHeading
        title="Your organizations"
        lede="The GitHub organizations you manage with Sustenaut."
        actions={
          <a href="/wizard" className={addProject}>
            Add project
          </a>
        }
      />
      {orgs.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-panel border border-dashed border-rule-strong bg-surface px-8 py-12 text-center">
          <h2 className="m-0 font-display text-2xl font-extrabold">No organizations yet</h2>
          <p className="m-0 max-w-xl text-muted">
            Add a project to link a GitHub organization and set up your own secrets. It takes three steps, and nothing
            is created on your accounts without you pressing the button.
          </p>
          <a href="/wizard" className={addProject}>
            Add project
          </a>
        </section>
      ) : (
        <Panel title="Linked organizations">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {orgs.map((o) => (
              <li key={o}>
                <a href={`/wizard?org=${encodeURIComponent(o)}`} className="font-bold text-link">
                  {o}
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel title="Unlock more">
        <UnlockList
          items={[
            {
              key: "2fa",
              todo: "Add a second factor to your Sustenaut account",
              unlocks: "making changes to your projects",
              action: <a href="/account">Add a passkey</a>,
            },
            {
              key: "org",
              todo: "Link a GitHub organization",
              unlocks: "your own secrets and release control",
              action: <a href="/wizard">Add project</a>,
            },
          ]}
        />
      </Panel>
    </Page>
  );
}
