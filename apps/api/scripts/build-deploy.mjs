import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const API_DIR = resolve(HERE, "..");
const REPO_ROOT = resolve(API_DIR, "../..");
const OUT_DIR = resolve(API_DIR, "dist-deploy");
const WEB_DIST = resolve(REPO_ROOT, "apps/web/dist");

// 1. Clean output directory.
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

// 2. Determine external packages: everything in runtime deps EXCEPT workspace pkgs.
const pkg = JSON.parse(readFileSync(resolve(API_DIR, "package.json"), "utf8"));
const externals = Object.keys(pkg.dependencies || {}).filter(
  (k) => !k.startsWith("@gtaa/")
);

console.log("[bundle] externals:", externals.join(", "));

// 3. Bundle server.ts → dist-deploy/server.mjs with workspace deps inlined.
await build({
  entryPoints: [resolve(API_DIR, "src/server.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: resolve(OUT_DIR, "server.mjs"),
  external: externals,
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});

// 4. Emit a minimal package.json for Azure App Service.
const deployPkg = {
  name: "@gtaa/api-deploy",
  version: pkg.version,
  type: "module",
  main: "server.mjs",
  scripts: { start: "node server.mjs" },
  engines: { node: ">=22" },
  dependencies: Object.fromEntries(
    Object.entries(pkg.dependencies || {}).filter(
      ([k]) => !k.startsWith("@gtaa/")
    )
  ),
};
writeFileSync(
  resolve(OUT_DIR, "package.json"),
  JSON.stringify(deployPkg, null, 2)
);

// 5. Copy Web dist next to server.mjs so the static-web plugin finds it.
if (existsSync(WEB_DIST)) {
  cpSync(WEB_DIST, resolve(OUT_DIR, "public"), { recursive: true });
  console.log("[bundle] copied web dist → public/");
} else {
  console.warn(
    "[bundle] WARN: apps/web/dist not found — run `pnpm --filter @gtaa/web build` first"
  );
}

console.log(`[bundle] done → ${OUT_DIR}`);
