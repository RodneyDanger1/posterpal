import { getPage, listPages } from "./repo";

/** If the client sent a stale Page id (PGLite reseed, deleted Page), use a live one. */
export async function resolvePageId(userId: string, pageId?: string | null): Promise<string | undefined> {
  if (pageId) {
    const page = await getPage(userId, pageId);
    if (page) return page.id;
  }
  const pages = await listPages(userId);
  return pages[0]?.id;
}
