/**
 * Post-level Insights helpers (pure Graph, no DB import).
 *
 * Page Insights metrics are deprecated over time, and an invalid metric fails the
 * WHOLE Graph request (developers.facebook.com/docs/graph-api/reference/page/insights/).
 * So views are fetched separately from engagement, most specific metric first, and
 * the helper returns null — never a fabricated 0 — when no metric is available.
 */
import { GraphRequestError, graphFetch } from "./graph";

/** Try the richest metric request first; fall back to the narrower one. */
export const POST_VIEW_METRIC_ATTEMPTS = [
  "post_total_media_view,post_media_view",
  "post_media_view",
] as const;

export async function fetchPostMediaViews(
  postId: string,
  token: string,
  appSecret: string,
): Promise<number | null> {
  for (const metrics of POST_VIEW_METRIC_ATTEMPTS) {
    try {
      const pack = await graphFetch<{
        insights?: { data?: Array<{ name?: string; values?: Array<{ value?: number }> }> };
      }>({
        path: `/${postId}`,
        token,
        appSecret,
        query: { fields: `insights.metric(${metrics})` },
      });
      const rows = pack.data.insights?.data ?? [];
      const found = rows.find((r) => typeof r.values?.[0]?.value === "number");
      if (found) return Number(found.values?.[0]?.value);
    } catch (e) {
      if (e instanceof GraphRequestError && e.mapped.kind === "token") throw e;
      // invalid/deprecated metric → try the narrower request
    }
  }
  return null;
}
