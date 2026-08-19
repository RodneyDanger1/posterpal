import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getSettingsFn,
  listPagesFn,
  saveFacebookApp,
  savePrefs,
  startPractice,
  syncNowFn,
  updatePageVoiceFn,
} from "@/lib/posterpal/fns";
import { connectFacebookPopup, facebookCallbackUri } from "@/lib/posterpal/connect-client";
import { REQUIRED_SCOPES } from "@/lib/posterpal/constants";
import type { PageRow, SettingsBag } from "@/lib/posterpal/types";
import { FacebookNameHelp } from "@/components/facebook-name-help";
import { PageHeader } from "@/components/page-header";
import { useShellStore } from "@/lib/store";
import { copyText } from "@/lib/utils";

export const Route = createFileRoute("/settings")({ component: () => <Guard><Settings /></Guard> });

function Settings() {
  const theme = useShellStore((s) => s.theme);
  const setTheme = useShellStore((s) => s.setTheme);
  const selectedPageId = useShellStore((s) => s.selectedPageId);
  const setSelectedPageId = useShellStore((s) => s.setSelectedPageId);
  const [settings, setSettings] = useState<SettingsBag | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [warn, setWarn] = useState(8);
  const [block, setBlock] = useState(20);
  const [voice, setVoice] = useState("");
  const [busy, setBusy] = useState(false);
  const pageId = selectedPageId;

  useEffect(() => {
    void getSettingsFn().then((s) => {
      setSettings(s);
      setAppId(s.facebookAppId);
      setWarn(s.cadenceWarn);
      setBlock(s.cadenceBlock);
      if (s.defaultPageId) setSelectedPageId(s.defaultPageId);
    });
    void listPagesFn().then(setPages);
  }, [setSelectedPageId]);

  useEffect(() => {
    const p = pages.find((x) => x.id === pageId);
    setVoice(p?.brand_voice ?? "");
  }, [pages, pageId]);

  const redirect = typeof window !== "undefined" ? facebookCallbackUri() : (settings?.oauthRedirectUri ?? "");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Settings"
        hint="Personal desk — no Google or X login. Facebook is optional and only needed to publish to real Pages. The Facebook App display name cannot be PosterPal."
      />

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">Appearance</h2>
        <label className="mt-3 flex items-center justify-between gap-3 text-sm">
          Dark theme
          <Switch
            checked={theme === "dark"}
            onCheckedChange={(on) => {
              const t = on ? "dark" : "light";
              setTheme(t);
              void savePrefs({ data: { theme: t } });
            }}
          />
        </label>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">Default Page</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Composer, Calendar, and Inbox open on this Page after a restart.
        </p>
        <select
          className="mt-3 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={pageId ?? ""}
          onChange={(e) => {
            const id = e.target.value || null;
            setSelectedPageId(id);
            void savePrefs({ data: { defaultPageId: id } }).then(() => toast.success("Default Page saved"));
          }}
        >
          <option value="">No default</option>
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.is_practice ? " (practice)" : ""}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">Facebook app</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Development Mode is the intended personal-use mode. App Review is not required if only app roles use it.
        </p>
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <Label>App ID</Label>
            <Input value={appId} onChange={(e) => setAppId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>App Secret {settings?.hasFacebookSecret ? "(saved)" : ""}</Label>
            <Input type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="Leave blank to keep existing" />
          </div>
          <p className="text-[12px] text-muted-foreground">
            Valid OAuth Redirect URI: <code className="rounded bg-muted px-1">{redirect}</code>{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                void copyText(redirect).then((ok) =>
                  toast[ok ? "success" : "error"](ok ? "Redirect URI copied." : "Could not copy."),
                );
              }}
            >
              Copy
            </button>
            <br />
            Desktop loopback: <code className="rounded bg-muted px-1">http://127.0.0.1:55443/callback/</code>
            <br />
            Scopes: {REQUIRED_SCOPES.join(", ")}
          </p>
          <FacebookNameHelp />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                void saveFacebookApp({ data: { appId, appSecret } }).then(() => toast.success("Saved encrypted"));
              }}
            >
              Save credentials
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void connectFacebookPopup()
                  .then((msg) => {
                    toast.success(msg);
                    void listPagesFn().then(setPages);
                  })
                  .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Connect failed"))
                  .finally(() => setBusy(false));
              }}
            >
              Connect Facebook
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void syncNowFn()
                  .then((r) => {
                    toast.success(`Synced ${r.postsUpdated} posts, ${r.commentsImported} comments.`);
                    if (r.errors[0]) toast.message(r.errors[0]);
                  })
                  .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Sync failed"))
                  .finally(() => setBusy(false));
              }}
            >
              Sync from Graph
            </Button>
            <Button variant="outline" asChild>
              <Link to="/setup">Open wizard</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">Cadence guard</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Warn default 8 / 24h. Hard cap default 20. Not a Graph limit — a spam-risk control.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Warn at</Label>
            <Input type="number" value={warn} onChange={(e) => setWarn(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>Block at</Label>
            <Input type="number" value={block} onChange={(e) => setBlock(Number(e.target.value))} />
          </div>
        </div>
        <Button className="mt-3" onClick={() => void savePrefs({ data: { cadenceWarn: warn, cadenceBlock: block } }).then(() => toast.success("Cadence saved"))}>
          Save cadence
        </Button>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">Brand voice · selected Page</h2>
        <textarea
          className="mt-3 min-h-24 w-full rounded-lg border border-input bg-card p-3 text-sm"
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
        />
        <Button
          className="mt-3"
          disabled={!pageId}
          onClick={() => {
            if (!pageId) return;
            void updatePageVoiceFn({ data: { pageId, brandVoice: voice } }).then(() => toast.success("Voice saved"));
          }}
        >
          Save voice
        </Button>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">AI</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {settings?.hasAiKey
            ? "Grok is available for captions, hashtags, sentiment, and reply drafts. Nothing auto-sends."
            : "AI buttons stay visible. Captions fall back to local variants until an xAI key is present in the environment."}
        </p>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">Practice workspace</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Seed two local Pages with drafts, comments, and merch if this account is empty.</p>
        <Button className="mt-3" variant="outline" onClick={() => void startPractice().then(() => toast.success("Practice Pages ready"))}>
          Seed practice Pages
        </Button>
      </section>
    </div>
  );
}
