/**
 * After `vite build` with NITRO_PRESET=node-server:
 * copy PGLite wasm/data next to the bundled module (nitro does not emit them),
 * and copy a built APK into public/ so the phone can download it from the desk.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const libs = join(root, ".output", "server", "_libs");
const pglite = join(root, "node_modules", "@electric-sql", "pglite", "dist");

if (!existsSync(libs)) {
  console.error("[prepare-desktop] missing .output/server/_libs — run vite build with NITRO_PRESET=node-server first");
  process.exit(1);
}

mkdirSync(libs, { recursive: true });
for (const name of ["pglite.wasm", "initdb.wasm", "pglite.data"]) {
  const from = join(pglite, name);
  if (!existsSync(from)) {
    console.error("[prepare-desktop] missing", from);
    process.exit(1);
  }
  copyFileSync(from, join(libs, name));
  console.log("[prepare-desktop] copied", name);
}

const apkCandidates = [
  join(root, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
  join(root, "release", "PosterPal.apk"),
];
const apk = apkCandidates.find((p) => existsSync(p));
if (apk) {
  mkdirSync(join(root, "release"), { recursive: true });
  if (apk !== join(root, "release", "PosterPal.apk")) {
    copyFileSync(apk, join(root, "release", "PosterPal.apk"));
  }
  console.log("[prepare-desktop] APK at release/PosterPal.apk");
} else {
  console.log("[prepare-desktop] no APK yet — phone download page will say so");
}
