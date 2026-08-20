import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PosterPalMark } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/pair")({ component: PairPhone });

function PairPhone() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("Phone");
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <PosterPalMark size={40} />
        <h1 className="mt-4 text-xl font-semibold">Pair this device</h1>
        <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
          On the desk, open Settings → Devices and generate a 6-digit code. This phone then talks to the same Pages, drafts, and inbox. It still cannot auto-post.
        </p>
        <form
          className="mt-6 w-full max-w-sm space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            void fetch("/api/sync/pair", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                code,
                deviceName: name,
                platform: /android/i.test(navigator.userAgent) ? "android" : "web",
              }),
            })
              .then(async (r) => {
                const body = (await r.json()) as { token?: string; error?: string };
                if (!r.ok || !body.token) throw new Error(body.error || "Pairing failed");
                try {
                  localStorage.setItem("posterpal-device-token", body.token);
                } catch {
                  /* iframe / cookie-blocked */
                }
                toast.success("Paired. Same desk, same data.");
                void navigate({ to: "/" });
              })
              .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Pairing failed"))
              .finally(() => setBusy(false));
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-12 text-center text-2xl tracking-[0.4em]"
              placeholder="000000"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dname">Device name</Label>
            <Input id="dname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button className="h-11 w-full" disabled={busy || code.length !== 6} type="submit">
            {busy ? "Pairing…" : "Pair"}
          </Button>
        </form>
        <Link to="/" className="mt-6 text-sm text-primary underline">
          Back to the desk
        </Link>
      </div>
    </div>
  );
}
