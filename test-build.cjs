const { build } = require("esbuild");
build({
    entryPoints: ["functions/src/index.ts"],
    bundle: true,
    outfile: "functions/lib/index.js",
    platform: "node",
    external: ["firebase-functions", "firebase-admin"],
}).then(() => console.log("DONE")).catch(e => console.error(e));
