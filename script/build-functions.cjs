const { build } = require("esbuild");
const path = require("path");
const fs = require("fs");

const rootDir = process.cwd();
const functionsDir = path.join(rootDir, "functions");
const outFile = path.join(functionsDir, "lib", "index.js");

async function buildFunctions() {
  console.log("Starting Functions Build...");

  // Clean lib directory
  if (fs.existsSync(path.join(functionsDir, "lib"))) {
    fs.rmSync(path.join(functionsDir, "lib"), { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(functionsDir, "lib"), { recursive: true });

  await build({
    entryPoints: [path.join(functionsDir, "src", "index.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
    sourcemap: true,
    outfile: outFile,
    tsconfig: path.join(rootDir, "tsconfig.json"),
    external: [
      "firebase-functions",
      "firebase-admin",
      "express",
      "express-rate-limit",
      "express-session",
      "zod",
      "openai",
      "stripe",
      "pdf-parse",
      "xlsx",
      "memorystore",
      "memoizee",
      "openid-client",
      "passport",
      "passport-local",
      "@sentry/node",
      "@google-cloud/storage",
      "p-limit",
      "p-retry",
      "dotenv"
    ],
    logLevel: "info",
  });

  // Copy definitions
  console.log("Copying workflow definitions...");
  const src = path.join(rootDir, "server", "workflow", "definitions");
  const dest = path.join(functionsDir, "lib", "definitions");
  fs.mkdirSync(dest, { recursive: true });
  if (fs.existsSync(src)) {
    const files = fs.readdirSync(src);
    for (const file of files) {
      fs.copyFileSync(path.join(src, file), path.join(dest, file));
    }
  }

  console.log("Functions Build Successful.");
}

buildFunctions().catch((err) => {
  console.error("Functions Build Failed:", err);
  process.exit(1);
});
