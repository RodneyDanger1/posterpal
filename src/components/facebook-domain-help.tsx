import { useEffect, useState } from "react";
import { toast } from "sonner";
import { facebookDomainHints } from "@/lib/posterpal/facebook-domains";
import { copyText } from "@/lib/utils";
import { Button } from "./ui/button";

function CopyRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[12px] font-semibold">{label}</div>
      <p className="text-[12px] text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-2 py-1.5 text-[12px]">{value}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void copyText(value).then((ok) =>
              toast[ok ? "success" : "error"](ok ? `${label} copied.` : "Could not copy."),
            );
          }}
        >
          Copy
        </Button>
      </div>
    </div>
  );
}

export function FacebookDomainHelp({ origin }: { origin?: string }) {
  const [liveOrigin, setLiveOrigin] = useState<string | undefined>(undefined);
  useEffect(() => {
    setLiveOrigin(origin ?? window.location.origin);
  }, [origin]);
  if (!liveOrigin) return null;
  const hints = facebookDomainHints(liveOrigin);
  const publishedHost = (import.meta.env.VITE_PUBLIC_HOSTNAME as string | undefined)?.trim() || "";
  const published = Boolean(publishedHost);
  if (hints.isLoopback) {
    return (
      <div className="space-y-2 rounded-lg bg-muted/60 px-3 py-2 text-[13px] text-muted-foreground">
        <p>
          This copy is running as localhost. Leave <strong>App Domains</strong> empty — Facebook rejects IP addresses.
          Put only this Redirect URI in Facebook Login → Valid OAuth Redirect URIs:{" "}
          <code className="rounded bg-muted px-1 text-foreground">{hints.redirectUri}</code>
        </p>
        <p>
          A phone cannot reach localhost on your PC. For an APK you need a public HTTPS URL (published desk or a tunnel to this machine).
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
      <p className="text-[13px] font-semibold">
        Facebook error “domain isn’t included in the app’s domains” means this hostname is missing on the app — not a bad App Secret.
      </p>
      <p className="text-[13px] text-muted-foreground">
        {published
          ? "This is the published HTTPS desk. Put these values on the Facebook App. They stay valid as long as this published URL stays the same."
          : "This is the live preview in Grok — not a forever host. The hostname can change when the preview restarts or when you publish. After you publish, come back here and update Facebook with the new values."}
      </p>
      <CopyRow
        label="App Domains"
        value={hints.hostname}
        hint="developers.facebook.com → your app → Settings → Basic → App Domains. Hostname only, no https://."
      />
      <CopyRow
        label="Site URL"
        value={`${hints.siteUrl}/`}
        hint="Settings → Basic → Add platform → Website → Site URL. Include https://."
      />
      <CopyRow
        label="Valid OAuth Redirect URI"
        value={hints.redirectUri}
        hint="Facebook Login → Settings → Valid OAuth Redirect URIs. Exact match, no trailing slash on callback."
      />
      <ol className="list-decimal space-y-1 pl-5 text-[12px] text-muted-foreground">
        <li>Save those three fields, then click Save Changes at the bottom of the Facebook page.</li>
        <li>Facebook Login: Client OAuth Login and Web OAuth Login ON.</li>
        <li>Wait ~30 seconds. Facebook caches domains. Then Connect again.</li>
        <li>Still blocked? Use the User Token paste below — Graph API Explorer, your app selected.</li>
      </ol>
    </div>
  );
}
