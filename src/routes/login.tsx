import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { firstRunFn } from "@/lib/posterpal/fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({ component: Login });

/**
 * Login wall. On the personal desk (auth off) this redirects straight to the
 * app — there is no sign-in. With auth on (`VITE_AUTH_ENABLED` not "false") it
 * shows sign-in, plus first-run account creation only while no operator exists.
 */
function Login() {
  const { user, isPending } = useCurrentUserState();

  // Single-operator desk (auth off): no login wall.
  if (!authEnabled) return <Navigate to="/" />;
  // Already signed in: go to the desk.
  if (user && !user.isDevFallback) return <Navigate to="/" />;
  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  return <LoginForm />;
}

function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [hasUsers, setHasUsers] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void firstRunFn()
      .then((r) => setHasUsers(r.hasUsers))
      .catch(() => setHasUsers(true)); // fail closed: don't offer sign-up
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await authClient.signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0],
        });
        if (res.error) throw new Error(res.error.message ?? "Could not create the account.");
      } else {
        const res = await authClient.signIn.email({ email, password });
        if (res.error) throw new Error(res.error.message ?? "Sign-in failed.");
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-[#1877F2] text-lg font-bold text-white">
            P
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">PosterPal</h1>
            <p className="text-[13px] text-muted-foreground">
              {mode === "signin" ? "Sign in to your desk" : "Create your desk"}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Operator"
                autoComplete="name"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        {!hasUsers ? (
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="mt-4 w-full text-center text-[13px] text-muted-foreground underline-offset-4 hover:underline"
          >
            {mode === "signin"
              ? "No account yet? Create the first operator"
              : "Already have an account? Sign in"}
          </button>
        ) : (
          <p className="mt-4 text-center text-[12px] text-muted-foreground">
            One operator per desk. Account creation is locked after first sign-up.
          </p>
        )}
      </div>
    </div>
  );
}
