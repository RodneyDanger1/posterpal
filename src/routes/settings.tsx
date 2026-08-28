import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createPairingFn,
  facebookStatusFn,
  getSettingsFn,
  importFacebookTokenFn,
  listDevicesFn,
  listPagesFn,
  revokeDeviceFn,
  saveAiKeysFn,
  saveFacebookApp,
  savePrefs,
  saveRssFeedFn,
  startPractice,
  syncNowFn,
  updatePageVoiceFn,
} from "@/lib/posterpal/fns";
import { IMAGE_PROVIDERS, TEXT_PROVIDERS } from "@/lib/posterpal/providers";
import { connectFacebookPopup } from "@/lib/posterpal/connect-client";
import { REQUIRED_SCOPES } from "@/lib/posterpal/constants";
import type { DeviceRow, PageRow, SettingsBag } from "@/lib/posterpal/types";
import { FacebookNameHelp } from "@/components/facebook-name-help";
import { FacebookDomainHelp } from "@/components/facebook-domain-help";
import { PageHeader } from "@/components/page-header";
import { useShellStore } from "@/lib/store";

export const Route = createFileRoute("/settings")({ component: () => <Guard><Settings /></Guard> });

function Settings() {
  const theme = useShellStore((s) => s.theme);
  const setTheme = useShellStore((s) => s.setTheme);
  const [settings, setSettings] = useState<SettingsBag | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [warn, setWarn] = useState(8);
  const [block, setBlock] = useState(20);
  const [voice, setVoice] = useState("");
  const [rssFeed, setRssFeed] = useState("");
  const [busy, setBusy] = useState(false);
  const pageId = useShellStore((s) => s.selectedPageId);
  const [openai, setOpenai] = useState("");
  const [google, setGoogle] = useState("");
  const [deepseek, setDeepseek] = useState("");
  const [fal, setFal] = useState("");
  const [textProvider, setTextProvider] = useState("grok");
  const [imageProvider, setImageProvider] = useState("grok");
  const [userToken, setUserToken] = useState("");

  useEffect(() => {
    void getSettingsFn().then((s) => {
      setSettings(s);
      setAppId(s.facebookAppId);
      setWarn(s.cadenceWarn);
      setBlock(s.cadenceBlock);
      setTextProvider(s.defaultTextProvider);
      setImageProvider(s.defaultImageProvider);
    });
    void listPagesFn().then(setPages);
  }, []);

  useEffect(() => {
    const p = pages.find((x) => x.id === pageId);
    setVoice(p?.brand_voice ?? "");
    setRssFeed(p?.rss_feed_url ?? "");
  }, [pages, pageId]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Settings"
        hint="Personal desk — no Google or X login. Facebook is optional. Register the Facebook App as PosterPal (Book is not allowed)."
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
        <h2 className="font-semibold">Where this desk lives</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Facebook Login only accepts the domain of the copy you are actually using. Put the yellow-box values from this screen on the Facebook App — they are generated from <em>this</em> URL, not a generic localhost.
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[13px] text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Grok preview (this chat):</span> not a forever host. The sandbox sleeps and the hostname can change. Fine for testing Connect. Bad as the only production URL.
          </li>
          <li>
            <span className="font-medium text-foreground">Publish from Grok:</span> ships a public HTTPS desk. After it is live, open Settings on that URL and paste the new App Domain / Site URL / Redirect URI into Facebook. Phone and PC both hit that same URL.
          </li>
          <li>
            <span className="font-medium text-foreground">Your PC, forever:</span> run the desk on a machine that stays on. For Facebook on that machine only, use Redirect URI <code className="rounded bg-muted px-1">http://127.0.0.1:8080/api/facebook/callback</code> and leave App Domains empty. A phone cannot reach 127.0.0.1 on your PC.
          </li>
          <li>
            <span className="font-medium text-foreground">PC + phone:</span> keep the PC on and give it a stable HTTPS name (Cloudflare Tunnel, Tailscale Funnel, or a cheap VPS). That hostname goes in App Domains. Pairing uses the same URL.
          </li>
        </ul>
      </section>

      <DevicesPanel />

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
            Desktop loopback (WPF only): <code className="rounded bg-muted px-1">http://127.0.0.1:55443/callback/</code>
            <br />
            Scopes: {REQUIRED_SCOPES.join(", ")}
          </p>
          <FacebookDomainHelp origin={typeof window !== "undefined" ? window.location.origin : undefined} />
          <FacebookNameHelp />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                void saveFacebookApp({ data: { appId, appSecret } })
                  .then(() => toast.success("Saved encrypted"))
                  .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"));
              }}
            >
              Save credentials
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void (async () => {
                  if (appId.trim()) await saveFacebookApp({ data: { appId, appSecret } });
                  const msg = await connectFacebookPopup(() => facebookStatusFn());
                  toast.success(msg);
                  const s = await getSettingsFn();
                  setSettings(s);
                  setPages(await listPagesFn());
                })()
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
          {settings?.facebookLastError ? (
            <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              Last connect: {settings.facebookLastError}
            </p>
          ) : settings?.facebookConnected ? (
            <p className="mt-3 rounded-md bg-success/10 px-3 py-2 text-[13px]">
              Live Pages on this desk: {settings.livePageCount}. Practice Pages stay local.
            </p>
          ) : null}
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-[12px] text-muted-foreground">
            <li>App type that supports Facebook Login. Display name PosterPal — Meta rejects Book, Face, FB, Meta.</li>
            <li>Products: Facebook Login. Client OAuth Login + Web OAuth Login ON.</li>
            <li>Paste App Domains, Site URL, and Redirect URI from the yellow box. Save Changes on Facebook, wait 30s, Connect again.</li>
            <li>Development Mode. Add your Facebook user as Admin / Developer / Tester.</li>
            <li>Allow pop-ups for this site. Connect opens Facebook in a new window — it cannot run inside this iframe.</li>
            <li>Do not paste App Secret in chat. Save it here. If the pop-up still fails, paste a User Token below.</li>
          </ol>
          <div className="mt-3 space-y-1">
            <Label>Paste User Token (Graph API Explorer fallback)</Label>
            <Input
              type="password"
              value={userToken}
              onChange={(e) => setUserToken(e.target.value)}
              placeholder="EAA… from developers.facebook.com/tools/explorer"
              autoComplete="off"
            />
            <p className="text-[12px] text-muted-foreground">
              Select <em>your</em> app in Graph API Explorer → permissions {REQUIRED_SCOPES.join(", ")} → Generate Access Token → paste here. Official Graph, not scraping. Token stays encrypted. Never paste App Secret.
            </p>
            <Button
              variant="outline"
              disabled={busy || userToken.trim().length < 20}
              onClick={() => {
                setBusy(true);
                void (async () => {
                  if (appId.trim()) await saveFacebookApp({ data: { appId, appSecret } });
                  const r = await importFacebookTokenFn({ data: { token: userToken } });
                  toast.success(`Imported ${r.imported} Page${r.imported === 1 ? "" : "s"}.`);
                  setUserToken("");
                  const s = await getSettingsFn();
                  setSettings(s);
                  setPages(await listPagesFn());
                })()
                  .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Token import failed"))
                  .finally(() => setBusy(false));
              }}
            >
              Import token
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
        <Button
          className="mt-3"
          onClick={() =>
            void savePrefs({ data: { cadenceWarn: warn, cadenceBlock: block } })
              .then(() => toast.success("Cadence saved"))
              .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"))
          }
        >
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
            void updatePageVoiceFn({ data: { pageId, brandVoice: voice } })
              .then(() => toast.success("Voice saved"))
              .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"));
          }}
        >
          Save voice
        </Button>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">RSS auto-draft · selected Page</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Paste a blog or news feed URL. The background worker checks it and drafts the newest
          items on this Page for your approval. Drafts only — nothing is published until you
          review and schedule it. Leave blank to turn off.
        </p>
        <div className="mt-3 space-y-1">
          <Label>Feed URL</Label>
          <Input
            type="url"
            placeholder="https://example.com/feed.xml"
            value={rssFeed}
            onChange={(e) => setRssFeed(e.target.value)}
          />
        </div>
        <Button
          className="mt-3"
          disabled={!pageId}
          onClick={() => {
            if (!pageId) return;
            void saveRssFeedFn({ data: { pageId, feedUrl: rssFeed } })
              .then(async () => {
                toast.success(rssFeed.trim() ? "Feed saved. New items will be drafted for review." : "Feed cleared.");
                setPages(await listPagesFn());
              })
              .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"));
          }}
        >
          Save feed
        </Button>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">AI models (bring your own keys)</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Keys are encrypted at rest, same as the Facebook App Secret. Grok stays the default when the platform xAI key is present.
          DeepSeek is captions only — it has no image model. Flux Schnell (fal) is images only. Nothing auto-posts.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>OpenAI key {settings?.providers.openai ? "(saved)" : ""}</Label>
            <Input type="password" value={openai} onChange={(e) => setOpenai(e.target.value)} placeholder="sk-…" autoComplete="off" />
          </div>
          <div className="space-y-1">
            <Label>Google Gemini key {settings?.providers.gemini ? "(saved)" : ""}</Label>
            <Input type="password" value={google} onChange={(e) => setGoogle(e.target.value)} placeholder="AI Studio key" autoComplete="off" />
          </div>
          <div className="space-y-1">
            <Label>DeepSeek key {settings?.providers.deepseek ? "(saved)" : ""}</Label>
            <Input type="password" value={deepseek} onChange={(e) => setDeepseek(e.target.value)} placeholder="sk-…" autoComplete="off" />
          </div>
          <div className="space-y-1">
            <Label>fal.ai key (Flux) {settings?.providers.flux ? "(saved)" : ""}</Label>
            <Input type="password" value={fal} onChange={(e) => setFal(e.target.value)} placeholder="fal key" autoComplete="off" />
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Caption model</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={textProvider}
              onChange={(e) => setTextProvider(e.target.value)}
            >
              {TEXT_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Image model</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={imageProvider}
              onChange={(e) => setImageProvider(e.target.value)}
            >
              {IMAGE_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ul className="mt-3 space-y-1 text-[12px] text-muted-foreground">
          {TEXT_PROVIDERS.map((p) => (
            <li key={p.id}>
              <span className="font-medium text-foreground">{p.label}:</span> {p.hint}
            </li>
          ))}
          {IMAGE_PROVIDERS.filter((p) => p.id === "flux").map((p) => (
            <li key={p.id}>
              <span className="font-medium text-foreground">{p.label}:</span> {p.hint}
            </li>
          ))}
        </ul>
        <Button
          className="mt-3"
          onClick={() => {
            void saveAiKeysFn({
              data: {
                openai,
                google,
                deepseek,
                fal,
                defaultTextProvider: textProvider,
                defaultImageProvider: imageProvider,
              },
            }).then(() => {
              toast.success("AI keys saved encrypted");
              setOpenai("");
              setGoogle("");
              setDeepseek("");
              setFal("");
              void getSettingsFn().then(setSettings);
            }).catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"));
          }}
        >
          Save AI keys
        </Button>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">AI</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {settings?.hasAiKey
            ? "Grok captions + Imagine stills are available. Flux (fal key) is the stills path without a Grok visible watermark. The agent drafts; you publish. Captions do not say they were drafted here."
            : "Grok is unavailable in this environment. Add an OpenAI, Gemini, or DeepSeek key above for captions — or Flux/Gemini/OpenAI for stills."}
        </p>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">Practice workspace</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">Seed two local Pages with drafts, comments, and merch if this account is empty.</p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() =>
            void startPractice()
              .then(() => {
                toast.success("Practice Pages ready if this desk was empty.");
                window.location.reload();
              })
              .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Seed failed"))
          }
        >
          Seed practice Pages
        </Button>
      </section>
    </div>
  );
}

function DevicesPanel() {
  const [code, setCode] = useState<string | null>(null);
  const [expires, setExpires] = useState<string | null>(null);
  const [devices, setDevices] = useState<DeviceRow[]>([]);

  const reload = () => {
    void listDevicesFn().then(setDevices).catch(() => setDevices([]));
  };
  useEffect(reload, []);

  return (
    <section className="rounded-xl bg-card p-4 shadow-card">
      <h2 className="font-semibold">Devices</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Pair a phone or a second browser to this desk. Same Pages, drafts, and inbox. The phone still cannot auto-post — you tap Publish.
        Open <Link to="/pair" className="underline">/pair</Link> on the phone, then enter the code.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            void createPairingFn()
              .then((t) => {
                setCode(t.code);
                setExpires(t.expiresAt);
                toast.success("Code is good for 10 minutes.");
              })
              .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not mint a code"));
          }}
        >
          Generate pairing code
        </Button>
        <Button variant="outline" asChild>
          <Link to="/pair">Open pair screen</Link>
        </Button>
      </div>
      {code ? (
        <div className="mt-3 rounded-lg bg-muted px-3 py-3 text-center">
          <div className="text-3xl font-semibold tracking-[0.35em] tabular-nums">{code}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            Expires {expires ? new Date(expires).toLocaleTimeString() : "in 10 minutes"}
          </div>
        </div>
      ) : null}
      <ul className="mt-3 space-y-2">
        {devices.length === 0 ? (
          <li className="text-[13px] text-muted-foreground">No paired devices yet.</li>
        ) : (
          devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {d.name} · {d.platform}
                {d.is_revoked ? " · revoked" : ""}
              </span>
              {!d.is_revoked ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void revokeDeviceFn({ data: { id: d.id } }).then(() => {
                      toast.success("Revoked.");
                      reload();
                    });
                  }}
                >
                  Revoke
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
