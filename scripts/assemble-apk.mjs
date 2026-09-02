/**
 * Run Gradle assembleDebug and copy the APK to public/apk/PosterPal.apk
 * so a phone on Wi‑Fi can download it from http://<pc>:8080/get-app.html
 */
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const android = join(root, "android");
const gradle = join(android, process.platform === "win32" ? "gradlew.bat" : "gradlew");

if (!existsSync(gradle)) {
  console.error("android/ is missing. Run: npx cap add android && npx cap sync android");
  process.exit(1);
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
if (existsSync(sdk)) {
  process.env.ANDROID_HOME = sdk;
  process.env.ANDROID_SDK_ROOT = sdk;
}

await run(gradle, ["assembleDebug"], android);

const built = join(android, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
if (!existsSync(built)) {
  console.error("Gradle finished but app-debug.apk was not produced.");
  process.exit(1);
}
const destDir = join(root, "release");
mkdirSync(destDir, { recursive: true });
const dest = join(destDir, "PosterPal.apk");
copyFileSync(built, dest);
console.log("APK ready:", dest);
console.log("On the phone browser (same Wi‑Fi as the running desk): http://<pc-lan-ip>:8080/get-app.html");
