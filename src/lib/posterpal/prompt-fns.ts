/**
 * Magic Wand + saved prompt styles server functions.
 *
 * The AI rewrite is best-effort: when no model is configured (or the call fails)
 * the deterministic improver from prompt-craft.ts runs instead and the response
 * says `ai: false` with a reason. The UI never claims a model improved something
 * when it didn't.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { ImageStylePresetId, ImprovedPrompt, PromptKind, PromptLocks, PromptStyleId } from "./prompt-craft";
import { buildImproverSystemPrompt, heuristicImprove } from "./prompt-craft";

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const getPromptPrefsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    const [prefs, styles] = await Promise.all([ops.promptPrefs(context.userId), ops.savedPromptStyles(context.userId)]);
    return { prefs, styles };
  });

export const savePromptPrefsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      style?: string;
      locks?: Partial<PromptLocks>;
      audience?: string;
      imageStyle?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    const { setSetting } = await import("./repo");
    const cur = await ops.promptPrefs(context.userId);
    const next = {
      ...cur,
      ...(data.style !== undefined ? { style: data.style } : {}),
      ...(data.locks ? { locks: { ...(cur.locks ?? {}), ...data.locks } } : {}),
      ...(data.audience !== undefined ? { audience: data.audience.slice(0, 120) } : {}),
      ...(data.imageStyle !== undefined ? { imageStyle: data.imageStyle } : {}),
    };
    await setSetting(context.userId, "prompt_prefs", JSON.stringify(next), false);
    return { prefs: next };
  });

export const savePromptStyleFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { name: string; kind: "caption" | "image" | "both"; directive: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    const { setSetting } = await import("./repo");
    const { randomUUID } = await import("node:crypto");
    const name = data.name.trim();
    const directive = data.directive.trim();
    if (name.length < 2 || name.length > 40) throw new Error("Style name must be 2–40 characters.");
    if (directive.length < 8 || directive.length > 400) throw new Error("Style directive must be 8–400 characters.");
    if (!["caption", "image", "both"].includes(data.kind)) throw new Error("Style kind must be caption, image, or both.");
    const current = await ops.savedPromptStyles(context.userId);
    if (current.length >= 20) throw new Error("20 saved styles is the cap — delete one first.");
    const next = [
      ...current.filter((s) => s.name.toLowerCase() !== name.toLowerCase()),
      { id: randomUUID(), name, kind: data.kind, directive, createdAt: new Date().toISOString() },
    ];
    await setSetting(context.userId, "prompt_styles", JSON.stringify(next), false);
    return { styles: next };
  });

export const deletePromptStyleFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    const { setSetting } = await import("./repo");
    const current = await ops.savedPromptStyles(context.userId);
    const next = current.filter((s) => s.id !== data.id);
    await setSetting(context.userId, "prompt_styles", JSON.stringify(next), false);
    return { styles: next };
  });

/**
 * Improve a caption or image prompt. AI first (structured system prompt from
 * prompt-craft), deterministic fallback always available and labelled.
 */
export const improvePromptFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      kind: PromptKind;
      text: string;
      style?: string;
      locks?: Partial<PromptLocks>;
      pageId?: string;
      imageStyle?: string;
      customDirective?: string;
      audience?: string;
    }) => d,
  )
  .handler(async ({ context, data }): Promise<ImprovedPrompt & { reason?: string }> => {
    const text = (data.text ?? "").trim();
    if (data.kind !== "caption" && data.kind !== "image") throw new Error("Unknown prompt kind.");
    if (text.length < 3) throw new Error("Write a little more first.");
    if (text.length > 4000) throw new Error("That prompt is too long to improve (4000 characters max).");

    const ops = await import("./ops");
    const page = data.pageId ? await (await import("./repo")).getPage(context.userId, data.pageId) : null;
    const ctx = {
      kind: data.kind,
      style: (data.style ?? "default") as PromptStyleId,
      locks: data.locks as PromptLocks | undefined,
      pageName: page?.name,
      brandVoice: page?.brand_voice,
      audience: data.audience?.trim() || undefined,
      imageStyle: (data.imageStyle ?? "photo") as ImageStylePresetId,
      customDirective: data.customDirective?.trim() || undefined,
    };
    const fallback = heuristicImprove(text, ctx);

    try {
      const runtime = await ops.textRuntime(context.userId);
      const ai = await import("./ai");
      const canUse = runtime.provider === "grok" ? ai.grokAvailable() : Boolean(runtime.apiKey) || Boolean(runtime.custom);
      if (!canUse) {
        return {
          ...fallback,
          ai: false,
          reason: "No caption model configured — applied local structure and rules instead.",
        };
      }
      const raw = await ai.chatWithProvider({
        provider: runtime.provider,
        apiKey: runtime.apiKey,
        custom: runtime.custom,
        maxTokens: 900,
        system: buildImproverSystemPrompt(ctx),
        user: text,
      });
      const parsed = parseJsonObject(raw);
      const improved = typeof parsed?.improved === "string" ? parsed.improved.trim() : "";
      if (!improved) {
        return { ...fallback, ai: false, reason: "The model returned no usable rewrite — applied local rules instead." };
      }
      const toList = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 8) : [];
      return {
        text: improved,
        issues: fallback.issues,
        applied: toList(parsed?.applied).length ? toList(parsed?.applied) : ["Rewritten by the caption model"],
        notes: toList(parsed?.notes).length ? toList(parsed?.notes) : fallback.notes,
        ai: true,
      };
    } catch (e) {
      return {
        ...fallback,
        ai: false,
        reason: `Model unavailable (${e instanceof Error ? e.message.slice(0, 140) : "error"}) — applied local rules instead.`,
      };
    }
  });
