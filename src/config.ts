// What the server needs, from its environment: in the cluster, the Secret dashboard-secrets
// (k8s/app.yaml), which the deploy walk fills from Bitwarden (pubkit.json's deploy block).
export type Config = {
  /** Where people reach the dashboard, e.g. https://dashboard.sustenaut.eu: the OAuth callback is under it. */
  publicUrl: string;
  /** The GitHub App "Sustenaut reader (test)": its id and private key (PEM), for app and installation tokens. */
  appId: string;
  appKey: string;
  /** The same app's OAuth client, for signing in (the user-to-server token). */
  clientId: string;
  clientSecret: string;
  /** Seals the session cookie (AES-256-GCM, key = SHA-256 of it). */
  sessionSecret: string;
  /** GitHub's API and web addresses; the scenarios point them at a fake. */
  githubApi: string;
  githubWeb: string;
  /** Where the built CSS and fonts are. */
  publicDir: string;
};

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name];
  if (!value) throw new Error(`dashboard: ${name} is not set`);
  return value;
};

export function fromEnv(env: NodeJS.ProcessEnv, publicDir: string): Config {
  const sessionSecret = required(env, "DASHBOARD_SESSION_SECRET");
  if (sessionSecret.length < 32) throw new Error("dashboard: DASHBOARD_SESSION_SECRET is shorter than 32 characters");
  return {
    publicUrl: (env.DASHBOARD_PUBLIC_URL ?? "https://dashboard.sustenaut.eu").replace(/\/$/, ""),
    appId: required(env, "DASHBOARD_APP_ID"),
    appKey: required(env, "DASHBOARD_APP_KEY"),
    clientId: required(env, "DASHBOARD_CLIENT_ID"),
    clientSecret: required(env, "DASHBOARD_CLIENT_SECRET"),
    sessionSecret,
    githubApi: (env.GITHUB_API ?? "https://api.github.com").replace(/\/$/, ""),
    githubWeb: (env.GITHUB_WEB ?? "https://github.com").replace(/\/$/, ""),
    publicDir,
  };
}
