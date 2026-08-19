import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function keyBytes(): Buffer {
  const material =
    process.env.BETTER_AUTH_SECRET ||
    process.env.GROK_AUTH_CLIENT_SECRET ||
    "posterpal-preview-entropy-not-a-secret";
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
