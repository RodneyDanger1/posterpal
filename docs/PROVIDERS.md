# AI providers — what PosterPal actually calls

**Verified against official docs on 2026-10-29.** Model IDs change; the code tries the list in
order and falls through on retirement, so this table is a starting point, not a guarantee.

| Provider | Kind | Model order (primary → fallback) | Timeout | Source |
|---|---|---|---|---|
| xAI | text | `grok-4.7` → `grok-4.6` → `grok-4.5` | 45 s | <https://docs.x.ai/developers/models.md> |
| xAI | image | `grok-imagine-image-2.0` → `grok-imagine-image` → `grok-imagine-image-quality` | 90 s | <https://docs.x.ai/developers/model-capabilities/images/generation.md> |
| OpenAI | text | `gpt-4.1-mini` → `gpt-4o-mini` (**UNVERIFIED** — image docs only) | 60 s | — |
| OpenAI | image | `gpt-image-2.5-flare` → `gpt-image-2.5-sunburst` → `gpt-image-1` | 120 s | <https://developers.openai.com/api/docs/guides/image-generation.md> |
| Google | text | `gemini-2.5-flash` → `gemini-2.0-flash` | 60 s | — |
| Google | image | `gemini-nano-banana-2.1` → `gemini-3.1-flash-image` → `gemini-3.1-flash-lite-image` → `gemini-2.5-flash-image` | 90 s | <https://ai.google.dev/gemini-api/docs/image-generation> |
| DeepSeek | text | `deepseek-flash` → `deepseek-v4-pro` (**live-verified 2026-10-30** against `/models`) | 60 s | <https://api-docs.deepseek.com/> |
| fal | image | `fal-ai/flux/schnell` | 60 s | fal model page (not re-verified this session) |

## Verified request details

- **xAI image API** — `POST https://api.x.ai/v1/images/generations`, bearer key. Supports
  `aspect_ratio` (`1:1`, `16:9`, `9:16`, `4:3`, `3:4`, …), `resolution` (`1k`/`2k` on 2.0),
  `quality` (`low`/`medium`/`auto` on 2.0), `response_format` (`url` default, `b64_json`),
  `n` 1–10, deferred generation with polling. PosterPal requests `b64_json` and 1k.
- **OpenAI image API** — `POST /v1/images/generations`, bearer key. Recommended sizes
  `1024x1024`, `1536x1024`, `1024x1536`; quality `low|medium|high|xhigh|max|auto`; base64 output by
  default; documented latency up to **2 minutes**; moderation blocks surface as
  `error.code = moderation_blocked`.
- **Google image API** — `generateContent` with `responseModalities: ["TEXT","IMAGE"]`; inline
  base64 parts. All Nano Banana outputs carry a **SynthID watermark** (their docs). The newest
  `gemini-nano-banana-2.1` is documented through the newer Interactions API; PosterPal tries it
  after the known-`generateContent` models and falls through on error.
- **DeepSeek** — OpenAI-compatible chat at `https://api.deepseek.com/chat/completions`;
  `deepseek-flash` and `deepseek-v4-pro` are reasoning models: chain-of-thought tokens count against `max_tokens`, so the desk doubles the requested budget (cap 4000) or JSON rewrites can return empty. Verified live with a real key: chat + wand JSON rewrite both succeed.

## UNVERIFIED claims (kept out of the UI copy)

| Claim | Status |
|---|---|
| OpenAI *text* model IDs are current | Only image docs were fetchable; text IDs are from the codebase |
| Flux/fal watermark behaviour | fal's own policy; verify before selling print artwork |
| Grok consumer-watermark behaviour | Not claimed anywhere now |
| Grok `resolution` is accepted on older Imagine models | We only send it on `-2.0` |

## How to check a provider yourself

1. Settings → **Probe** a text model (sends "ping", expects "pong") or Media → probe an image model
   (generates a tiny navy square). Failures return the vendor's status + body, not a generic error.
2. If a model retires, add the new ID to `src/lib/posterpal/providers.ts` (single source of truth)
   and add it to `scripts/providers.test.mjs` pinning the primary.
3. Images generated in Media are written to disk (`media-files.ts`), flagged `createdWithAi`, and
   never posted automatically.

## Cost notes (verified where cited, otherwise UNVERIFIED)

- xAI Imagine: `grok-imagine-image` $0.02, `grok-imagine-image-2.0` $0.04,
  `grok-imagine-image-quality` $0.05 per image (xAI pricing page, 2026-10-29).
- Every image click is one request; the desk never loops generations in the background.
- Print pipeline refuses >4× upscales, so a cheap 1k image cannot silently become a blurry poster.


## Custom OpenAI-compatible endpoint (free/cheap providers, safely)

Settings → *Custom OpenAI-compatible endpoint* lets you point PosterPal at **any endpoint you
personally trust**: Groq, OpenRouter, Cerebras, Mistral, Together, a local Ollama/LM Studio, etc.
Fields: base URL, text model, optional image model, API key (encrypted). The desk calls
`{base}/chat/completions` and `{base}/images/generations`.

Guard rails (because the URL is fetched server-side — SSRF is the real risk):

- HTTPS only. `http://` is accepted **only** for loopback when
  `POSTERPAL_ALLOW_LOCAL_PROVIDERS=1` (Ollama/LM Studio).
- No embedded credentials, query strings, or fragments; max 300 chars.
- Hostname is DNS-resolved at save **and** at request time; private/loopback/link-local/CGNAT/ULA/
  `.internal`/`.local` targets are rejected (DNS-rebinding guard).
- Request `redirect: "error"` so a redirect cannot land on an internal host.
- Tests: `scripts/network-guard.test.mjs` (17 assertions across both guard + catalog tests).

### Verdict on `open-free-llm-api/awesome-freellm-apis`

That repository is a **markdown link directory**, not malware: GitHub API shows no code language, no
releases/downloads, MIT licence, ~4.9k stars / 771 forks, description "134+ free LLM APIs…". Nothing
it contains executes. But it is an **untrusted directory**:

- Many "free" entries are third-party gateways/proxies — your prompts (and possibly keys) pass
  through operators you have not vetted. Some claims ("unlimited") are stale.
- Its companion site `freellm.net` hosts playground/API-key pages — **never paste a provider key
  into a third-party playground**.
- No endpoint from that list is hardcoded into PosterPal. Instead, use the custom-endpoint field
  with the **provider's own official base URL and key page**, so the provider is one you chose.

Recommended reputable free/low-cost starting points (verify current terms yourself):
OpenRouter (free model tier, official API), Groq (free tier, official API), Google AI Studio key
(official), DeepSeek (cheap, official), local Ollama/LM Studio (no per-call cost).
