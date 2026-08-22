import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Preview-only entropy. NEVER use on a public host — §13.2 of Surpass.md. */
const PREVIEW_FALLBACK_KEY = "posterpal-preview-entropy-not-a-secret";

function keyBytes(): Buffer {
  const material =
    process.env.POSTERPAL_MASTER_KEY ||
    process.env.BETTER_AUTH_SECRET ||
    process.env.GROK_AUTH_CLIENT_SECRET ||
    PREVIEW_FALLBACK_KEY;
  if (material === PREVIEW_FALLBACK_KEY && process.env.NODE_ENV === "production") {
    throw new Error(
      "POSTERPAL_MASTER_KEY (or BETTER_AUTH_SECRET) is required in production. " +
        "The preview fallback key would make every encrypted token unreadable on a public host — " +
        "set a stable 32+ byte key and never change it.",
    );
  }
  return createHash("sha256").update(material).update("posterpal.dpapi.standin").digest();
}

/** AES-256-GCM stand-in for DPAPI CurrentUser. Tokens never leave ciphertext in the DB. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const iv = Buffer.from(parts[1]!, "base64url");
    const tag = Buffer.from(parts[2]!, "base64url");
    const data = Buffer.from(parts[3]!, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function redact(text: string): string {
  return text
    .replace(/(access_token|fb_exchange_token|client_secret|code)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/EAA[A-Za-z0-9]+/g, "[redacted-token]");
}
