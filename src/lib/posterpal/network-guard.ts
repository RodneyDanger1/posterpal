/**
 * SSRF guard for user-supplied AI provider endpoints (server-only).
 *
 * The desk lets an operator add an OpenAI-compatible base URL. That URL is fetched
 * server-side, so without a guard it could be pointed at cloud metadata
 * (169.254.169.254), an internal admin panel, or localhost services. Rules:
 *
 *   - https only, by default
 *   - http is allowed ONLY for loopback when POSTERPAL_ALLOW_LOCAL_PROVIDERS=1
 *     (Ollama / LM Studio on the operator's own machine)
 *   - no embedded credentials, no non-http(s) schemes, max 300 chars
 *   - hostname must resolve to public addresses (DNS checked at save AND request time)
 *   - private/loopback/link-local/CGNAT/ULA/reserved ranges are rejected
 *   - fetch() is called with redirect:"error" by the provider code
 */
import { lookup } from "node:dns/promises";

export const LOCAL_PROVIDER_ENV = "POSTERPAL_ALLOW_LOCAL_PROVIDERS";

function ipv4Parts(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

/** True for any address that must not be reachable from the desk. */
export function isPrivateAddress(raw: string): boolean {
  const ip = raw.trim().toLowerCase();
  const v4 = ipv4Parts(ip);
  if (v4) {
    const [a, b] = v4;
    if (a === 0) return true; // "this network"
    if (a === 10) return true; // private
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b !== null && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b !== null && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 192 && b === 0 && v4[2] === 0) return true; // protocol assignments
    if (a >= 224) return true; // multicast/reserved/broadcast
    return false;
  }
  // IPv6 (URL hostname is bracketed; strip before calling this from URL parsing)
  if (ip === "::" || ip === "::1") return true;
  if (ip.startsWith("fe80:")) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/.test(ip)) return true; // unique local
  if (ip.startsWith("::ffff:")) return isPrivateAddress(ip.slice("::ffff:".length));
  return false;
}

export function localProvidersAllowed(): boolean {
  return process.env[LOCAL_PROVIDER_ENV] === "1" || process.env[LOCAL_PROVIDER_ENV] === "true";
}

export type UrlCheck =
  | { ok: true; url: URL; local: boolean }
  | { ok: false; reason: string };

/**
 * Structural validation (no DNS — safe to call in a form validator).
 * `allowLocal` controls whether http://localhost / 127.0.0.1 is accepted.
 */
export function checkProviderBaseUrl(raw: string, opts: { allowLocal?: boolean } = {}): UrlCheck {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, reason: "Base URL is required." };
  if (value.length > 300) return { ok: false, reason: "Base URL is too long." };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "Base URL is not a valid URL." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Only http(s) base URLs are allowed." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Do not put credentials in the base URL — use the key field." };
  }
  if (url.search || url.hash) {
    return { ok: false, reason: "Base URL must not contain a query string or fragment." };
  }
  const host = url.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "Base URL has no hostname." };
  const allowLocal = Boolean(opts.allowLocal);
  const loopbackHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".localhost");
  const isIpLiteral = /^\[?[0-9a-f.:]+\]?$/i.test(host);
  if (isIpLiteral) {
    const bare = host.replace(/^\[|\]$/g, "");
    if (isPrivateAddress(bare) && !(loopbackHost && allowLocal)) {
      return { ok: false, reason: "Private/loopback IP addresses are not allowed." };
    }
  }
  if (url.protocol === "http:" && !(allowLocal && loopbackHost)) {
    return { ok: false, reason: "Use https:// for remote providers (http is only allowed for a local endpoint when enabled)." };
  }
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) {
    return { ok: false, reason: "Local-network hostnames are not allowed." };
  }
  return { ok: true, url: new URL(url.toString().replace(/\/+$/, "")), local: loopbackHost };
}

/**
 * Structural + DNS validation. Use before persisting a provider URL.
 * A hostname that resolves to any private address is rejected (DNS-rebinding guard).
 */
export async function resolveProviderBaseUrl(
  raw: string,
): Promise<{ ok: true; baseUrl: string; local: boolean } | { ok: false; reason: string }> {
  const check = checkProviderBaseUrl(raw, { allowLocal: localProvidersAllowed() });
  if (!check.ok) return check;
  const host = check.url.hostname.replace(/^\[|\]$/g, "");
  if (check.local) return { ok: true, baseUrl: check.url.toString(), local: true };
  try {
    const records = await lookup(host, { all: true, verbatim: true });
    if (records.length === 0) return { ok: false, reason: "Base URL hostname did not resolve." };
    for (const rec of records) {
      if (isPrivateAddress(rec.address)) {
        return { ok: false, reason: "Base URL resolves to a private address — refusing to save it." };
      }
    }
  } catch {
    return { ok: false, reason: "Base URL hostname could not be resolved." };
  }
  return { ok: true, baseUrl: check.url.toString(), local: false };
}

/** Join a base URL path without double slashes. */
export function joinBaseUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
