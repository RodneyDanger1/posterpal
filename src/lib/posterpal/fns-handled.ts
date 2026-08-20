import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const markCommentHandledFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { commentId: string }) => d)
  .handler(async ({ context, data }) => {
    const extra = await import("./inbox-extra");
    return extra.markCommentHandled(context.userId, data.commentId);
  });
