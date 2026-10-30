/**
 * Tiny fuzzy matcher (no dependencies) for the Page rail and command palette.
 *
 * Subsequence match with bonuses: word-start, camel boundary, consecutive runs.
 * Returns 0 for no match; higher is better. Deterministic and cheap enough to run
 * over a few hundred rows on every keystroke.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (!t) return 0;
  // Exact substring is always a strong match.
  const direct = t.indexOf(q);
  if (direct >= 0) return 1000 - direct * 2 + (direct === 0 ? 50 : 0);

  let qi = 0;
  let score = 0;
  let streak = 0;
  let lastIndex = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti += 1) {
    if (t[ti] !== q[qi]) continue;
    const boundary = ti === 0 || /[\s\-_/.]/.test(t[ti - 1] ?? "") || /[A-Z]/.test(text[ti] ?? "");
    score += 10;
    if (boundary) score += 12;
    if (ti === lastIndex + 1) {
      streak += 1;
      score += streak * 4;
    } else {
      streak = 0;
    }
    lastIndex = ti;
    qi += 1;
  }
  if (qi < q.length) return 0;
  // Prefer shorter targets when scores tie.
  return score - Math.min(20, Math.floor(t.length / 20));
}

/** Filter + rank rows by fuzzy match on one or more fields. */
export function fuzzyFilter<T>(
  rows: readonly T[],
  query: string,
  pick: (row: T) => Array<string | null | undefined>,
): T[] {
  const q = query.trim();
  if (!q) return [...rows];
  const scored = rows
    .map((row) => {
      const best = pick(row).reduce((acc, field) => Math.max(acc, fuzzyScore(q, field ?? "")), 0);
      return { row, score: best };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((r) => r.row);
}
