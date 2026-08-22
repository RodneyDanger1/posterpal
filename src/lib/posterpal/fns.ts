import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import type { ComposerInput } from "./types";

async function livePage(userId: string, pageId?: string | null) {
  const { resolvePageId } = await import("./page-id");
  return pageId ? resolvePageId(userId, pageId) : pageId ?? undefined;
}

export const bootstrapApp = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    return ops.bootstrapApp(context.userId);
  });

export const getSettingsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    return ops.getSettings(context.userId);
  });

export const saveFacebookApp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { appId: string; appSecret: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.saveFacebookApp(context.userId, data);
  });

export const saveAiKeysFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      openai?: string;
      google?: string;
      deepseek?: string;
      fal?: string;
      defaultTextProvider?: string;
      defaultImageProvider?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.saveAiKeys(context.userId, data);
  });

export const savePrefs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { theme?: "light" | "dark"; defaultPageId?: string | null; cadenceWarn?: number; cadenceBlock?: number }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.savePrefs(context.userId, data);
  });

export const completeSetup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    return ops.completeSetup(context.userId);
  });

export const startPractice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    return ops.startPractice(context.userId);
  });

export const beginFacebookOAuth = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { redirectUri: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.beginFacebookOAuth(context.userId, data.redirectUri);
  });

export const listPagesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    return ops.listPages(context.userId);
  });

export const listPostsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { pageId?: string; status?: string; limit?: number }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    const pageId = await livePage(context.userId, data.pageId);
    return ops.listPosts(context.userId, { ...data, pageId });
  });

export const getPostBundle = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { postId: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.getPostBundle(context.userId, data.postId);
  });

export const cadenceFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { pageId: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    const pageId = (await livePage(context.userId, data.pageId)) ?? data.pageId;
    return ops.cadence(context.userId, pageId);
  });

export const policyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      pageId: string;
      message: string;
      link?: string | null;
      merchUrl?: string | null;
      hasImages: boolean;
      missingAlt: boolean;
      createdWithAi: boolean;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.policy(context.userId, data);
  });

export const composeFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: ComposerInput) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.compose(context.userId, data);
  });

export const publishNowFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { postId: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.publishNow(context.userId, data.postId);
  });

export const rescheduleFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { postId: string; scheduledAt: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.reschedule(context.userId, data);
  });

export const cancelPostFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { postId: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.cancelPost(context.userId, data.postId);
  });

export const commentsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { filter: "needs" | "hidden" | "all"; pageId?: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    const pageId = await livePage(context.userId, data.pageId);
    return ops.comments(context.userId, data.filter, pageId);
  });

export const hideCommentFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { commentId: string; hidden: boolean }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.hideComment(context.userId, data);
  });

export const sendReplyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { commentId: string; message: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.sendReply(context.userId, data);
  });

export const markCommentHandledFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { commentId: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.markCommentHandled(context.userId, data.commentId);
  });

export const generateReplyDraftsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { commentId: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.generateReplyDrafts(context.userId, data.commentId);
  });

export const merchFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { pageId?: string } = {}) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    const pageId = await livePage(context.userId, data.pageId);
    return ops.merch(context.userId, pageId);
  });

export const saveMerchFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { pageId: string; title: string; url: string; platform?: string; utm?: string; cta?: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.saveMerch(context.userId, data);
  });

export const deleteMerchFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.deleteMerch(context.userId, data.id);
  });

export const vaultFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    return ops.vault(context.userId);
  });

export const logsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    return ops.logs(context.userId);
  });

export const searchFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { q: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.search(context.userId, data.q);
  });

export const analyticsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { pageId?: string; days: number }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    const pageId = await livePage(context.userId, data.pageId);
    return ops.analytics(context.userId, { ...data, pageId });
  });

export const mediaLibraryFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { pageId?: string } = {}) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    const pageId = await livePage(context.userId, data.pageId);
    return ops.mediaLibrary(context.userId, pageId);
  });

export const generateVariantsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { pageId: string; brief: string; merchCta?: string | null; provider?: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.generateVariants(context.userId, data);
  });

export const hashtagsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { pageId: string; caption: string; provider?: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.hashtags(context.userId, data);
  });

export const analyzeFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { content: string }) => d)
  .handler(async ({ data }) => {
    const ops = await import("./ops");
    return ops.analyze(data.content);
  });

export const updatePageVoiceFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { pageId: string; brandVoice: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.updatePageVoice(context.userId, data);
  });

export const exportCsvFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { pageId?: string; days: number }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    const pageId = await livePage(context.userId, data.pageId);
    return ops.exportCsv(context.userId, { ...data, pageId });
  });

export const tickFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    return ops.tick(context.userId);
  });

export const syncNowFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    return ops.syncNow(context.userId);
  });

export const calendarFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { pageId?: string } = {}) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    const pageId = await livePage(context.userId, data.pageId);
    return ops.calendar(context.userId, pageId);
  });

export const ideasFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { pageId?: string } = {}) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.ideas(context.userId, data.pageId);
  });

export const saveIdeaFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { pageId?: string | null; title?: string; body: string; mediaType?: string; notes?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.rememberIdea(context.userId, data);
  });

export const deleteIdeaFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.forgetIdea(context.userId, data.id);
  });

export const moveIdeaFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string; notes?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.moveIdea(context.userId, data);
  });

export const snippetsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { pageId?: string } = {}) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.snippets(context.userId, data.pageId);
  });

export const saveSnippetFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { pageId?: string | null; label: string; body: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.rememberSnippet(context.userId, data);
  });

export const deleteSnippetFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.forgetSnippet(context.userId, data.id);
  });

export const imaginePhotoFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { prompt: string; provider?: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.imaginePhoto(context.userId, data.prompt, data.provider);
  });

export const needsYouFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    return ops.listNeeds(context.userId);
  });

export const createPairingFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    return ops.createPairingCode(context.userId);
  });

export const listDevicesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    return ops.listDevices(context.userId);
  });

export const revokeDeviceFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.revokeDevice(context.userId, data.id);
  });

export const runAgentFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { pageId: string; prompt: string; provider?: string; mapPage?: boolean }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.runAgent(context.userId, data);
  });

export const pageProfileFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { pageId: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.pageResearchProfile(context.userId, data.pageId);
  });

export const listAgentRunsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { pageId?: string } = {}) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.listAgentRuns(context.userId, data.pageId);
  });

export const facebookStatusFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const ops = await import("./ops");
    return ops.facebookConnectStatus(context.userId);
  });

export const importFacebookTokenFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { token: string }) => d)
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.importPastedToken(context.userId, data.token);
  });

export const clonePostFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      postId: string;
      pageIds: string[];
      mode?: "local-draft" | "schedule";
      scheduledAt?: string | null;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const ops = await import("./ops");
    return ops.clonePost(context.userId, data);
  });
