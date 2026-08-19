import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PosterPalMark } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  completeSetup,
  getSettingsFn,
  saveFacebookApp,
  startPractice,
} from "@/lib/posterpal/fns";
import { connectFacebookPopup, facebookCallbackUri } from "@/lib/posterpal/connect-client";
import { REQUIRED_SCOPES } from "@/lib/posterpal/constants";
import { FacebookNameHelp } from "@/components/facebook-name-help";

export const Route = createFileRoute("/setup")({ component: SetupPage });

function SetupPage() {
  return (
    <div className="min-h-screen bg-background">
      <SetupWizard />
    </div>
  );
}

function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [redirect, setRedirect] = useState("/api/facebook/callback");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRedirect(facebookCallbackUri());
    void getSettingsFn().then((s) => {
      setAppId(s.facebookAppId);
    });
  }, []);

  const saveCreds = async () => {
    setBusy(true);
    try {
      await saveFacebookApp({ data: { appId, appSecret } });
      toast.success("App credentials saved (encrypted).");
      setStep(3);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    try {
      const msg = await connectFacebookPopup();
      toast.success(msg);
      setStep(4);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start OAuth");
    } finally {
      setBusy(false);
    }
  };

  const practice = async () => {
    setBusy(true);
    try {
      await startPractice();
      toast.success("Practice Pages are ready.");
      void navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not seed practice workspace");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    await completeSetup();
    void navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <PosterPalMark size={36} />
        <div>
          <h1 className="text-xl font-semibold">First-run setup</h1>
          <p className="text-[13px] text-muted-foreground">Step {step} of 4 · Development Mode is enough</p>
        </div>
      </div>

      {step === 1 ? (
        <Panel
          title="How PosterPal talks to Facebook"
          body="This desk is yours — no Google or X account required. Create a Facebook App at developers.facebook.com. Keep it in Development Mode and add yourself as Admin, Developer, or Tester — App Review is not required for role users. Products: Facebook Login with Client OAuth Login and Web OAuth Login on."
        >
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Valid OAuth Redirect URI (this app): <code className="rounded bg-muted px-1 text-foreground">{redirect || `${typeof window !== "undefined" ? window.location.origin : ""}/api/facebook/callback`}</code></li>
            <li>Desktop WPF build uses the loopback URI <code className="rounded bg-muted px-1 text-foreground">http://127.0.0.1:55443/callback/</code></li>
            <li>Permissions: {REQUIRED_SCOPES.join(", ")}</li>
            <li>Page tokens come from <code className="rounded bg-muted px-1">/me/accounts</code>. CREATE_CONTENT is required to publish; ANALYZE-only Pages import as read-only.</li>
          </ol>
          <FacebookNameHelp />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => setStep(2)}>I have an App ID</Button>
            <Button variant="outline" onClick={() => void practice()} disabled={busy}>
              Skip — start with practice Pages
            </Button>
          </div>
        </Panel>
      ) : null}

      {step === 2 ? (
        <Panel title="Facebook App credentials" body="Stored encrypted. Never logged. Never compiled in.">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="appid">App ID</Label>
              <Input id="appid" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="123456789012345" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="secret">App Secret</Label>
              <Input id="secret" type="password" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="Paste secret" />
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={() => void saveCreds()} disabled={busy || !appId}>
              Save & continue
            </Button>
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
          </div>
        </Panel>
      ) : null}

      {step === 3 ? (
        <Panel title="Connect Facebook" body="Opens the official OAuth dialog in a popup. We exchange the code, request a long-lived user token, then import Pages from /me/accounts.">
          <p className="text-[13px] text-muted-foreground">
            Redirect URI that must be on the app: <code className="rounded bg-muted px-1 text-foreground">{redirect}</code>
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => void connect()} disabled={busy}>
              Connect Facebook
            </Button>
            <Button variant="outline" onClick={() => void practice()} disabled={busy}>
              Use practice Pages instead
            </Button>
          </div>
        </Panel>
      ) : null}

      {step === 4 ? (
        <Panel title="You are in" body="Optional: add AI later in Settings. Captions, hashtags, and reply drafts use Grok when the platform key is present — they never auto-send comments.">
          <div className="mt-5 flex gap-2">
            <Button onClick={() => void finish()}>Open PosterPal</Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function Panel({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-card p-6 shadow-card">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
