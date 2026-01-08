const { build } = require("esbuild");
const path = require("path");
const { rm } = require("fs/promises");

const rootDir = process.cwd();
const functionsDir = path.join(rootDir, "functions");
const outFile = path.join(functionsDir, "lib", "index.js");

async function buildFunctions() {
  await rm(path.join(functionsDir, "lib"), { recursive: true, force: true });

  await build({
    entryPoints: [path.join(functionsDir, "src", "index.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    sourcemap: true,
    outfile: outFile,
    tsconfig: path.join(rootDir, "tsconfig.json"),
    external: ["firebase-functions", "firebase-admin"],
    logLevel: "info",
  });
}

buildFunctions().catch((err) => {
  console.error(err);
  process.exit(1);
});
