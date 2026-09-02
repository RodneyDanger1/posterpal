import { useEffect, useState } from "react";
import { toast } from "sonner";
import { facebookGuideFn, facebookStatusFn, getSettingsFn, saveFacebookApp } from "@/lib/posterpal/fns";
import { copyText } from "@/lib/utils";
import { CONNECT_STEPS, OFFICIAL_GUIDES, type FetchedGuide } from "@/lib/posterpal/facebook-docs";
import { connectFacebookPopup } from "@/lib/posterpal/connect-client";
import { REQUIRED_SCOPES } from "@/lib/posterpal/constants";
import { FacebookDomainHelp } from "@/components/facebook-domain-help";
import { FacebookNameHelp } from "@/components/facebook-name-help";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function openOfficial(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function ConnectCoach({ onConnected }: { onConnected?: () => void }) {
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [guide, setGuide] = useState<FetchedGuide | null>(null);
  const [guideBusy, setGuideBusy] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [hasSecret, setHasSecret] = useState(false);
  const [redirectUri, setRedirectUri] = useState("");

  useEffect(() => {
    void getSettingsFn().then((s) => {
      setAppId(s.facebookAppId);
      setConnected(s.facebookConnected);
      setLiveCount(s.livePageCount);
      setLastError(s.facebookLastError);
      setHasSecret(s.hasFacebookSecret);
      setRedirectUri(s.oauthRedirectUri);
    });
  }, []);

  const loadGuide = (url: string) => {
    setGuideBusy(true);
    void facebookGuideFn({ data: { url } })
      .then(setGuide)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load official docs"))
      .finally(() => setGuideBusy(false));
  };

  useEffect(() => {
    const first = OFFICIAL_GUIDES.find((g) => g.fetchable);
    if (first) loadGuide(first.url);
    // First paint: auto-load Meta's "create an app" doc. Failures stay on the curated steps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      if (appId.trim()) await saveFacebookApp({ data: { appId, appSecret } });
      const msg = await connectFacebookPopup(() => facebookStatusFn());
      toast.success(msg);
      const s = await getSettingsFn();
      setConnected(s.facebookConnected);
      setLiveCount(s.livePageCount);
      setLastError(s.facebookLastError);
      onConnected?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">How this desk talks to Facebook</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Official Graph API v26.0 only. PosterPal never scrapes facebook.com, never reuses cookies, never logs in as you
          unofficially. You create the Meta app and Pages in Facebook’s own UI. We load <em>public developer docs</em> so
          you can see Meta’s words next to our checklist.
        </p>
      </div>

      <FacebookDomainHelp />
      <FacebookNameHelp />

      <ol className="space-y-3">
        {CONNECT_STEPS.map((step) => {
          const open = OFFICIAL_GUIDES.find((g) => g.id === step.openId);
          const read = OFFICIAL_GUIDES.find((g) => g.id === step.guideId);
          return (
            <li key={step.id} className="rounded-xl bg-card p-4 shadow-card">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(done[step.id])}
                  onChange={() => setDone((d) => ({ ...d, [step.id]: !d[step.id] }))}
                />
                <span>
                  <span className="font-semibold">
                    {step.id}. {step.title}
                  </span>
                  <span className="mt-1 block text-[13px] text-muted-foreground">{step.body}</span>
                </span>
              </label>
              <div className="mt-3 flex flex-wrap gap-2 pl-7">
                {open ? (
                  <Button type="button" size="sm" onClick={() => openOfficial(open.url)}>
                    Open {open.title}
                  </Button>
                ) : null}
                {read?.fetchable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={guideBusy}
                    onClick={() => loadGuide(read.url)}
                  >
                    {guideBusy ? "Loading…" : "Load official instructions"}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {guide ? (
        <section className="rounded-xl border border-border bg-muted/40 p-4">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            {guide.live ? "Loaded from Meta" : "Official page (open in a new window if this is thin)"}
          </div>
          <h3 className="mt-1 font-semibold">{guide.title}</h3>
          <p className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap text-[13px] text-muted-foreground">{guide.text}</p>
          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => openOfficial(guide.url)}>
            Open this page on developers.facebook.com
          </Button>
        </section>
      ) : null}

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">App ID + Secret, then Connect</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Scopes requested: {REQUIRED_SCOPES.join(", ")}. Role users only — stay in Development Mode. Graph v26.0. The Agent cannot click Login for you.
        </p>
        {redirectUri ? (
          <div className="mt-3 space-y-1">
            <Label>Valid OAuth Redirect URI (paste this on the Meta app)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-2 py-1.5 text-[12px]">{redirectUri}</code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void copyText(redirectUri).then((ok) =>
                    toast[ok ? "success" : "error"](ok ? "Redirect URI copied." : "Could not copy."),
                  );
                }}
              >
                Copy URI
              </Button>
            </div>
          </div>
        ) : null}
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="coach-app-id">App ID</Label>
            <Input id="coach-app-id" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="123456789012345" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="coach-secret">App Secret</Label>
            <Input
              id="coach-secret"
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder="Paste secret — stored encrypted"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy || !appId.trim()}
            onClick={() => {
              void saveFacebookApp({ data: { appId, appSecret } })
                .then(() => toast.success("Saved encrypted."))
                .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"));
            }}
          >
            Save credentials
          </Button>
          <Button
            type="button"
            disabled={busy || !appId.trim() || (!appSecret.trim() && !hasSecret)}
            onClick={() => void connect()}
          >
            {busy ? "Connecting…" : "Connect Facebook Login"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => openOfficial("https://developers.facebook.com/tools/explorer")}>
            Graph API Explorer
          </Button>
        </div>
        {connected ? (
          <p className="mt-3 rounded-md bg-success/10 px-3 py-2 text-[13px]">
            Connected. {liveCount} live Page{liveCount === 1 ? "" : "s"} imported. Practice Pages are hidden so they do not mix with Graph.
          </p>
        ) : null}
        {lastError ? (
          <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{lastError}</p>
        ) : null}
      </section>
    </div>
  );
}
