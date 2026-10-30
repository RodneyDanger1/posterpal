/**
 * Named AI-provider failures (pure — no I/O, safe in a unit test).
 *
 * The desk must never surface a bare "fetch failed" or a raw vendor JSON blob as
 * the reason a caption/image did not run. Every provider rejection is classified
 * into a small named kind and rewritten into an operator-facing refusal that
 * says WHO refused, WHAT the HTTP status was, and HOW to fix it (set the server
 * env key, fix the key in Settings, retry later, or pick another model).
 *
 * Used by ai.ts for every OpenAI-compatible call (DeepSeek, OpenAI, custom,
 * xAI) and by the Settings probes, so the named refusal is the same string in
 * the UI, the schedule log and the probe report.
 */

export type ProviderErrorKind =
  | "auth"
  | "rate_limit"
  | "model"
  | "network"
  | "timeout"
  | "server"
  | "bad_response"
  | "http";

const LABELS: Record<string, string> = {
  grok: "xAI",
  openai: "OpenAI",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  custom: "Custom provider",
  flux: "Flux",
};

/** Human label for a provider id ("deepseek" -> "DeepSeek"). */
export function providerLabel(provider: string): string {
  return LABELS[provider] ?? provider;
}

/** Env var that supplies the platform-wide key for a provider, when one exists. */
export function platformKeyEnvName(provider: string): string | null {
  if (provider === "grok") return "XAI_API_KEY";
  if (provider === "deepseek") return "DEEPSEEK_API_KEY";
  return null;
}

export type ProviderFailureInput = {
  /** HTTP status when the request reached the provider. */
  status?: number | null;
  /** Response body (error JSON or text), already read. */
  body?: string | null;
  /** True when the failure was at the transport layer (DNS/TLS/reset). */
  network?: boolean;
  /** True when the request was aborted by our own timeout. */
  timedOut?: boolean;
};

/**
 * Build the named refusal for a provider failure.
 *
 * The message is stable in shape: `<Label> <kind phrase> (HTTP <status>): <hint>`.
 * Callers surface it verbatim; the schedule log records the same text.
 */
export function providerFailure(
  provider: string,
  input: ProviderFailureInput,
): ProviderRequestError {
  const label = providerLabel(provider);
  if (input.timedOut) {
    return new ProviderRequestError(
      provider,
      "timeout",
      `${label} timed out before answering. Try again; if this repeats, shorten the prompt or lower the token budget.`,
      null,
    );
  }
  if (input.network || input.status == null) {
    return new ProviderRequestError(
      provider,
      "network",
      `${label} could not be reached from this server (network/DNS error). Check outbound HTTPS and the provider base URL.`,
      null,
    );
  }
  const status = input.status;
  const detail = cleanDetail(input.body);
  if (status === 401 || status === 403) {
    const env = platformKeyEnvName(provider);
    const fix = env
      ? `fix the key: set ${env} in the server environment or paste a valid key in Settings`
      : "fix the key in Settings";
    return new ProviderRequestError(
      provider,
      "auth",
      `${label} rejected the API key (HTTP ${status}). ${capitalize(fix)}.`,
      status,
    );
  }
  if (status === 402) {
    return new ProviderRequestError(
      provider,
      "auth",
      `${label} rejected the request for billing/quota reasons (HTTP 402). Top up the provider account or use another provider.`,
      status,
    );
  }
  if (status === 429) {
    return new ProviderRequestError(
      provider,
      "rate_limit",
      `${label} rate-limited the request (HTTP 429). Wait and retry; the desk does not bypass provider limits.`,
      status,
    );
  }
  if (status === 404 || status === 400) {
    return new ProviderRequestError(
      provider,
      "model",
      `${label} rejected the model or request shape (HTTP ${status})${detail ? `: ${detail}` : "."} Check the model id in the provider catalog.`,
      status,
    );
  }
  if (status >= 500) {
    return new ProviderRequestError(
      provider,
      "server",
      `${label} returned a server error (HTTP ${status}). Retry later${detail ? ` (${detail})` : ""}.`,
      status,
    );
  }
  return new ProviderRequestError(
    provider,
    "http",
    `${label} request failed (HTTP ${status})${detail ? `: ${detail}` : "."}`,
    status,
  );
}

/** Kind-specific named refusal for a missing key (no HTTP request made). */
export function providerKeyMissing(provider: string): ProviderRequestError {
  const env = platformKeyEnvName(provider);
  const label = providerLabel(provider);
  const hint = env
    ? `set ${env} in the server environment (self-host) or paste the key in Settings`
    : "paste the key in Settings";
  return new ProviderRequestError(
    provider,
    "auth",
    `${label} is not configured on this desk. To use it, ${hint}.`,
    null,
  );
}

/** Returned when the provider said 200 but the body was not usable JSON. */
export function providerBadResponse(provider: string): ProviderRequestError {
  return new ProviderRequestError(
    provider,
    "bad_response",
    `${providerLabel(provider)} returned a response the desk could not parse. Try again or switch provider.`,
    null,
  );
}

export class ProviderRequestError extends Error {
  readonly provider: string;
  readonly kind: ProviderErrorKind;
  readonly status: number | null;

  constructor(provider: string, kind: ProviderErrorKind, message: string, status: number | null) {
    super(message);
    this.name = "ProviderRequestError";
    this.provider = provider;
    this.kind = kind;
    this.status = status;
  }

  /** Stable `provider.kind` code for logs/probes without leaking vendor text. */
  get code(): string {
    return `${this.provider}.${this.kind}`;
  }
}

function cleanDetail(body: string | null | undefined): string {
  const raw = (body ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  // Prefer the vendor's own human message when the body is OpenAI-style JSON.
  let text = raw;
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as {
        error?: { message?: unknown } | string;
        message?: unknown;
      };
      const vendor =
        typeof parsed.error === "string"
          ? parsed.error
          : parsed.error && typeof parsed.error === "object"
            ? parsed.error.message
            : parsed.message;
      if (typeof vendor === "string" && vendor.trim()) text = vendor.trim();
    } catch {
      /* not JSON — keep the raw text */
    }
  }
  // Providers echo the Authorization header or full keys in some error bodies.
  // Never let a credential reach a log line or the operator UI.
  return text
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "sk-[redacted]")
    .slice(0, 220);
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
