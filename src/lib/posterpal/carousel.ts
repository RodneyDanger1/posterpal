/**
 * Carousel publishing helpers — kept dependency-free so they are unit-testable
 * without pulling in the database layer (db.ts runs a module-scope bootstrap
 * that relies on Vite's import.meta.glob, which plain node/tsx does not have).
 */

/**
 * #15: surface partially-dropped carousel slides instead of silent success.
 * Returns null when nothing was dropped, otherwise a human-readable warning
 * naming every failed slide.
 */
export function carouselPartialWarning(total: number, dropped: string[]): string | null {
  if (dropped.length === 0) return null;
  return `Post published with ${total - dropped.length} of ${total} slides — ${dropped.length} failed to upload: ${dropped.join(", ")}.`;
}
