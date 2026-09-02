import { Link } from "@tanstack/react-router";
import { identityIssues } from "@/lib/posterpal/briefing";
import type { HomeSnapshot } from "@/lib/posterpal/types";
import { useShellStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const STEPS = [
  "Create each Page on facebook.com/pages/creation — Graph cannot create Pages.",
  "Distinct name, category, About, and profile art. Meta treats lookalike fleets as inauthentic.",
  "Add yourself as Admin. Add your Development Mode app as Admin or Tester.",
  "One Connect on this PC imports every Page with CREATE_CONTENT. The phone never logs into Facebook.",
  "Set a brand voice and merch link per Page in Settings. Composer blocks copy-paste captions across Pages.",
];

export function IdentityPlanner({ data }: { data: HomeSnapshot }) {
  const setPage = useShellStore((s) => s.setSelectedPageId);
  const gaps = identityIssues(data.pages, data.pageMetrics);
  const live = data.pages.filter((p) => !p.is_practice).length;
  const practice = data.pages.filter((p) => p.is_practice).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fleet identities</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[13px] text-muted-foreground">
          {live} live · {practice} practice. Facebook Login stays on this PC. Create Pages on facebook.com, then Connect once.
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-muted-foreground">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {gaps.length > 0 ? (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Gaps on this desk</div>
            <ul className="mt-1.5 space-y-1.5">
              {gaps.slice(0, 8).map((g) => (
                <li key={g.pageId}>
                  <button
                    type="button"
                    className="w-full rounded-lg bg-muted/50 px-3 py-2 text-left hover:bg-muted"
                    onClick={() => setPage(g.pageId)}
                  >
                    <span className="text-[13px] font-medium">{g.name}</span>
                    {g.isPractice ? <span className="ml-1 text-[11px] text-muted-foreground">practice</span> : null}
                    <div className="text-[12px] text-muted-foreground">{g.issues.join(" · ")}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Voices, names, and merch look distinct. Keep captions unique when you publish.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/connect">Connect Facebook</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/settings">Voice & cadence</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="https://www.facebook.com/pages/creation/" target="_blank" rel="noreferrer">
              Create a Page
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
