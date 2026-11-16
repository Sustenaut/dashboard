import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell, Button, SideNav, Tag, type NavSection } from "@sustenaut/ui";

export type User = { login: string; name?: string };

/** The parts the proof of concept makes real, and the parts that are layout only. */
export const Works = () => (
  <Tag tone="success" dot>
    Works in PoC
  </Tag>
);
export const Preview = () => <Tag>Preview</Tag>;

export function Brand() {
  return (
    <a href="/" className="flex items-center gap-2.5 text-ink no-underline">
      <svg width="26" height="26" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="13" className="fill-primary" />
        <path
          d="M14 21 V12 M14 15 C10 15 8.5 12 8.5 9 C12 9 14 11 14 15 M14 13 C17 13 19.5 10.5 19.5 7.5 C16 7.5 14 10 14 13"
          className="stroke-accent-soft"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-display text-xl font-extrabold">Sustenaut</span>
    </a>
  );
}

export function Account({ user }: { user: User }) {
  return (
    <form method="post" action="/auth/logout" className="flex items-center gap-3">
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex size-7 items-center justify-center rounded-full bg-sunken text-sm font-bold uppercase"
        >
          {user.login.slice(0, 2)}
        </span>
        @{user.login}
      </span>
      <Button type="submit" size="small" variant="quiet">
        Sign out
      </Button>
    </form>
  );
}

export type Place = "workspace" | "project" | "infra" | "account";

/** The side navigation: the workspace, the project (once there is one), its linked accounts, you. */
export function nav(current: Place, project?: string): NavSection[] {
  const sections: NavSection[] = [
    {
      key: "main",
      items: [
        { key: "workspace", label: "Workspace", href: "/", current: current === "workspace" },
        ...(project
          ? [{ key: "project", label: project, href: "/project", indent: true, current: current === "project" }]
          : []),
      ],
      note: project ? undefined : "Linked infrastructure appears here after your first project.",
    },
  ];
  if (project)
    sections.push({
      key: "infra",
      heading: "Linked infrastructure",
      items: [{ key: "saas", label: "Linked SaaS accounts", href: "/infra", meta: "2", current: current === "infra" }],
    });
  sections.push({
    key: "you",
    heading: project ? "You" : undefined,
    items: [{ key: "account", label: "Account and devices", href: "/account", current: current === "account" }],
  });
  return sections;
}

export function Page({
  user,
  place,
  project,
  bare,
  children,
}: {
  user?: User;
  place?: Place;
  project?: string;
  /** No side navigation: the sign-in page and the wizard. */
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <AppShell
      brand={<Brand />}
      account={user && <Account user={user} />}
      nav={!bare && place ? <SideNav sections={nav(place, project)} /> : undefined}
      width={bare ? "narrow" : "normal"}
      footer={
        bare && !user ? (
          <>
            <span>Self-hosted use is free. Infrastructure we run for you is paid.</span>
            <span>We keep no database: your session is one sealed cookie.</span>
          </>
        ) : undefined
      }
    >
      {children}
    </AppShell>
  );
}

/** A whole HTML document; no script, so the CSP forbids every one. */
export function html(title: string, body: ReactNode): string {
  return (
    "<!doctype html>" +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{`${title} · Sustenaut`}</title>
          <link rel="stylesheet" href="/assets/app.css" />
        </head>
        <body className="m-0 bg-ground font-sans text-ink">{body}</body>
      </html>,
    )
  );
}
