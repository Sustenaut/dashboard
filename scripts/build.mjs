// Builds dist/: the server as one file (esbuild, React and @sustenaut/ui bundled in, so the image
// needs no node_modules), and dist/public: the CSS (Tailwind) and the theme's fonts beside it.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/public/fonts", { recursive: true });
await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: "dist/server.mjs",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "warning",
});
execFileSync(
  "npx",
  ["--no-install", "@tailwindcss/cli", "-i", "src/app.css", "-o", "dist/public/app.css", "--minify"],
  {
    stdio: "inherit",
  },
);
const fonts = "node_modules/@sustenaut/theme/fonts";
for (const f of readdirSync(fonts)) cpSync(`${fonts}/${f}`, `dist/public/fonts/${f}`);
