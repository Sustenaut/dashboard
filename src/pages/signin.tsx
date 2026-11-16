import { Callout } from "@sustenaut/ui";
import { Page, Works } from "./layout";

export function SignIn({ error }: { error?: string }) {
  return (
    <Page bare>
      <section className="mx-auto mt-10 flex w-full max-w-md flex-col gap-5 rounded-panel border border-rule bg-surface px-8 py-9 shadow-panel">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Step 0 of your journey</span>
          <Works />
        </div>
        <h1 className="m-0 font-display text-3xl font-extrabold">Sign in to Sustenaut</h1>
        <p className="m-0 text-muted">
          Your Sustenaut account is linked to GitHub. We use it to read the state of your organizations and help you set
          up everything else, one step at a time.
        </p>
        {error && <Callout tone="danger">{error}</Callout>}
        <a
          href="/auth/login"
          className="flex min-h-12 items-center justify-center gap-2.5 rounded-control bg-primary text-lg font-bold text-on-primary no-underline"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true" className="fill-on-primary">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Sign in with GitHub
        </a>
        <div className="flex flex-col gap-1.5 border-t border-rule pt-4">
          <span className="font-bold">No GitHub account yet?</span>
          <a href="https://github.com/signup" className="font-semibold text-link">
            Create one on GitHub, then come back here
          </a>
        </div>
        <Callout>
          GitHub is the only way in for now. Once you build apps, you can add Google or your own email sign-in to the
          same account.
        </Callout>
      </section>
    </Page>
  );
}
