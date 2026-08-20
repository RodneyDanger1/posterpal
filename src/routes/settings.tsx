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
  getSettingsFn,
  listDevicesFn,
  listPagesFn,
  revokeDeviceFn,
  saveAiKeysFn,
  saveFacebookApp,
  savePrefs,
  startPractice,
  syncNowFn,
  updatePageVoiceFn,
} from "@/lib/posterpal/fns";
import type { DeviceRow, PageRow, SettingsBag } from "@/lib/posterpal/types";
import { FacebookNameHelp } from "@/components/facebook-name-help";
import { PageHeader } from "@/components/page-header";
import { useShellStore } from "@/lib/store";
import { copyText } from "@/lib/utils";

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
  const [busy, setBusy] = useState(false);
  const [redirect, setRedirect] = useState("/api/facebook/callback");
  const pageId = useShellStore((s) => s.selectedPageId);
  const [openai, setOpenai] = useState("");
  const [google, setGoogle] = useState("");
  const [deepseek, setDeepseek] = useState("");
  const [fal, setFal] = useState("");
  const [textProvider, setTextProvider] = useState("grok");
  const [imageProvider, setImageProvider] = useState("grok");

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
    setRedirect(facebookCallbackUri());
  }, []);

  useEffect(() => {
    const p = pages.find((x) => x.id === pageId);
    setVoice(p?.brand_voice ?? "");
  }, [pages, pageId]);

  const page = pages.find((x) => x.id === pageId) ?? pages[0];

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
            });
          }}
        >
          Save AI keys
        </Button>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">AI</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {settings?.hasAiKey
            ? "Grok is available for captions, hashtags, sentiment, and reply drafts. Paste other keys above to switch models in Composer. Nothing auto-sends."
            : "Grok is unavailable in this environment. Add an OpenAI, Gemini, or DeepSeek key above for captions — or Flux/Gemini/OpenAI for stills."}
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
