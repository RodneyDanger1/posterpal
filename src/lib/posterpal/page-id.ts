import { getPage, listPages } from "./repo";

/** Resolve a Page the operator actually has. A missing/stale id does not
 * silently remap reads onto pages[0] — that posted Winona captions on North Shore. */
export async function resolvePageId(userId: string, pageId?: string | null): Promise<string | undefined> {
  if (pageId) {
    const page = await getPage(userId, pageId);
    return page?.id;
  }
  const pages = await listPages(userId);
  return pages[0]?.id;
}
