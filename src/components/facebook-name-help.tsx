import { useMemo, useState } from "react";
import {
  FB_APP_NAME_SUGGESTIONS,
  facebookAppNameIssues,
} from "@/lib/posterpal/facebook-names";

export function FacebookNameHelp() {
  const [name, setName] = useState("PosterPal");
  const issues = useMemo(() => facebookAppNameIssues(name), [name]);
  const ok = issues.length === 0;

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-[13px] font-semibold">Facebook App display name</p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Use <strong>PosterPal</strong> on developers.facebook.com. Meta rejects Book, Face, FB,
        Facebook, Meta, Instagram, and WhatsApp. That is why this desk is no longer called BookBoss.
      </p>
      <label className="mt-3 block text-[12px] font-medium" htmlFor="fb-app-name-check">
        Check a name before you type it into the Facebook dashboard
      </label>
      <input
        id="fb-app-name-check"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {ok ? (
        <p className="mt-2 text-[13px] text-success">“{name.trim()}” is allowed as a Facebook App name.</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-destructive">
          {issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12px] text-muted-foreground">Safe examples: {FB_APP_NAME_SUGGESTIONS.join(", ")}.</p>
    </div>
  );
}
