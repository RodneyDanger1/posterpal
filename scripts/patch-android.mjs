/**
 * After `npx cap add android` / `cap sync`: permit LAN HTTP (cleartext) so the
 * WebView can open http://192.168.x.x:8080.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "android", "app", "src", "main", "AndroidManifest.xml");
if (!existsSync(manifestPath)) {
  console.error("android project missing — run npx cap add android");
  process.exit(1);
}

const xmlDir = join(root, "android", "app", "src", "main", "res", "xml");
mkdirSync(xmlDir, { recursive: true });
writeFileSync(
  join(xmlDir, "network_security_config.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">10.0.0.0</domain>
    <domain includeSubdomains="true">localhost</domain>
  </domain-config>
</network-security-config>
`,
  "utf8",
);

let manifest = readFileSync(manifestPath, "utf8");
if (!manifest.includes("android.permission.INTERNET")) {
  manifest = manifest.replace(
    "<manifest",
    `<manifest`,
  );
  manifest = manifest.replace(
    /<application\b/,
    `    <uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />\n    <application`,
  );
}
if (!manifest.includes("usesCleartextTraffic")) {
  manifest = manifest.replace(/<application\b([^>]*)>/, (m, attrs) => {
    if (attrs.includes("usesCleartextTraffic")) return m;
    return `<application${attrs} android:usesCleartextTraffic="true" android:networkSecurityConfig="@xml/network_security_config">`;
  });
} else if (!manifest.includes("networkSecurityConfig")) {
  manifest = manifest.replace(
    "android:usesCleartextTraffic=\"true\"",
    `android:usesCleartextTraffic="true" android:networkSecurityConfig="@xml/network_security_config"`,
  );
}
writeFileSync(manifestPath, manifest, "utf8");
console.log("[patch-android] cleartext LAN enabled");
