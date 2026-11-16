// Starts the dashboard: node dist/server.mjs (the bundle esbuild makes from this file).
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fromEnv } from "./config";
import { createHandler } from "./server";

const config = fromEnv(
  process.env,
  process.env.DASHBOARD_PUBLIC_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "public"),
);
const handle = createHandler(config);
const port = Number(process.env.PORT ?? 8080);
createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error("dashboard: request failed:", error instanceof Error ? error.message : error);
    if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
    res.end("Something went wrong.");
  });
}).listen(port, () => console.log(`dashboard: listening on ${port}`));
