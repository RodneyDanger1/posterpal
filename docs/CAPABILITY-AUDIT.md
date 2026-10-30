# PosterPal capability audit

Generated: 2026-10-30T05:16:53.688Z · source-derived (not hand-written)

## Matrix

| Capability | Code marker | Verdict |
|---|---|---|
| Publish now (Graph) | `src/lib/posterpal/publish.ts` · `attemptGraphPublish` | PASS |
| Schedule on Graph (10m–30d window) | `src/lib/posterpal/graph.ts` · `facebookScheduleWindow` | PASS |
| Local scheduler (worker/tick) | `scripts/worker.ts` · `tickScheduler` | PASS |
| Inbox: reply / hide / handled | `src/routes/api/sync/action.ts` · `hide` | PASS |
| Analytics: post engagement | `src/lib/posterpal/sync.ts` · `reactions_count` | PASS |
| Analytics: media views w/ metric fallback | `src/lib/posterpal/insights.ts` · `post_media_view` | PASS |
| AI captions (multi-provider) | `src/lib/posterpal/ai.ts` · `generateCaptionVariants` | PASS |
| AI images (multi-provider + aspect) | `src/lib/posterpal/ai.ts` · `aspectRatio` | PASS |
| Agent research with refuse list | `src/lib/posterpal/agent.ts` · `REFUSE_RE` | PASS |
| Messenger webhook + 24h window | `src/lib/posterpal/messenger.ts` · `messagingWindow` | PASS |
| Commerce: Fourthwall products/orders/webhook | `src/lib/commerce/fourthwall.ts` · `verifyFourthwallSignature` | PASS |
| Print pipeline (DPI/upscale/quantise) | `src/lib/commerce/print-assets.ts` · `prepareForPrint` | PASS |
| Media on disk + serving route | `src/routes/api/media/$id.ts` · `readMediaBytes` | PASS |
| Needs-you inbox aggregation | `src/lib/posterpal/devices.ts` · `needsYou` | PASS |
| Custom OpenAI-compatible provider | `src/lib/posterpal/ai.ts` · `chatCustom` | PASS |
| Magic Wand prompt improver (works without AI) | `src/lib/posterpal/prompt-craft.ts` · `improveImagePromptHeuristic` | PASS |
| Image metadata scrub before publish | `src/lib/posterpal/publish.ts` · `sanitizeDataUrl` | PASS |
| Magic-byte upload validation | `src/lib/posterpal/media-files.ts` · `sniffMime` | PASS |
| Fuzzy Page rail search | `src/components/app-shell.tsx` · `fuzzyFilter` | PASS |
| List auto-animation (@formkit/auto-animate) | `src/routes/inbox.tsx` · `useAutoAnimate` | PASS |
| Wand UI wired to caption/image prompts | `src/components/magic-wand.tsx` · `improvePromptFn` | PASS |
| Saved prompt styles + locks persisted | `src/lib/posterpal/prompt-fns.ts` · `savePromptStyleFn` | PASS |
| Caption quality score | `src/lib/posterpal/prompt-craft.ts` · `scoreCaption` | PASS |
| SSRF guard for custom endpoints | `src/lib/posterpal/network-guard.ts` · `resolveProviderBaseUrl` | PASS |

## Server functions

- Exported: **84** · referenced somewhere: **82** · unreferenced: **2**
- Unreferenced (dead surface or mobile-only): `deleteSnippetFn`, `needsYouFn`

## Desk agent

- Personas: research, ops, inbox, shop, rewrite, calendar, memory, connect
- Skills: research-web, map-page, diagnose-desk, draft-captions, draft-inbox, rewrite-failed, merch-cta, policy-check, schedule-slot, week-plan, cadence-watch, vault-watch, quota-watch, rss-remix, recall-later, recall-runs, meta-docs, browse-web
- Personas without config: none
- Skills not gated in `skillsForRun`: none
- Refuse list present: yes

## AI providers

- Text: grok, openai, gemini, deepseek, custom
- Image: grok, openai, gemini, flux, custom
- Missing text handlers: none
- Missing image handlers: none
- Custom endpoint SSRF guard: present

## Graph endpoint census (paths referenced in code)

- `/debug_token`
- `/me/accounts`
- `/{id}`
- `/{id}/comments`
- `/{id}/feed`
- `/{id}/photo_stories`
- `/{id}/photos`
- `/{id}/published_posts`
- `/{id}/video_reels`
- `/{id}/video_stories`
- `/{id}/videos`
- `first_comment`
- `local`
- `local-scheduler`
- `practice`
- `sync`

## Verdict

- All claimed capabilities have a code path; no advertised provider/persona/skill is unimplemented.
