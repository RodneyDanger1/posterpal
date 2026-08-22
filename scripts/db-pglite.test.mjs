import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Regression tests for the Phase 0 PGLite persistence fix:
// `require()` inside an ESM module always threw, the catch always fired,
// and dev ran on a throwaway in-memory DB — so drafts vanished on restart.
//
// NOTE: db.ts runs `ensureDbReady()` at module scope when DATABASE_URL is
// unset (and its migrations rely on Vite's import.meta.glob, which plain
// node/tsx does not provide). Setting DATABASE_URL before the dynamic import
// routes dbSource to "neon" so the module loads cleanly; pgliteDataDir() is
// independent of the backend, so the assertions below are unaffected.

process.env.DATABASE_URL = "postgres://test-local";
const { pgliteDataDir } = await import("../src/lib/db.ts");

test("pgliteDataDir returns a real directory, never undefined-by-crash", () => {
  const dir = pgliteDataDir();
  assert.ok(dir, "must return a path when PGLITE_MEMORY is unset");
  assert.ok(existsSync(dir), `directory must exist on disk: ${dir}`);
});

test("pgliteDataDir honours PGLITE_MEMORY=1 opt-out", () => {
  process.env.PGLITE_MEMORY = "1";
  assert.equal(pgliteDataDir(), undefined);
  delete process.env.PGLITE_MEMORY;
});

test("pgliteDataDir honours PGLITE_DATA_DIR override", () => {
  const custom = join(process.cwd(), ".pglite-test-tmp");
  process.env.PGLITE_DATA_DIR = custom;
  const dir = pgliteDataDir();
  assert.equal(dir, custom);
  assert.ok(existsSync(custom));
  delete process.env.PGLITE_DATA_DIR;
  rmSync(custom, { recursive: true, force: true });
});
