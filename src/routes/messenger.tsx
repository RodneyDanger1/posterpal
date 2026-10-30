import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  markMessengerHandledFn,
  messengerOverviewFn,
  messengerThreadFn,
  saveMessengerVerifyTokenFn,
  sendMessengerReplyFn,
} from "@/lib/posterpal/messenger-fns";
import { cn, copyText, relativeTime } from "@/lib/utils";

export const Route = createFileRoute("/messenger")({ component: () => <Guard><Messenger /></Guard> });

type Overview = Awaited<ReturnType<typeof messengerOverviewFn>>;
type ThreadView = Awaited<ReturnType<typeof messengerThreadFn>>;

function Messenger() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadView | null>(null);
  const [draft, setDraft] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Resolve the origin in an effect, not during render: server renders an empty
  // host while the browser would render the real one (hydration mismatch).
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const endpoint = `${origin}/api/facebook/messenger`;

  const load = (opts?: { silent?: boolean }) => {
    void messengerOverviewFn()
      .then((o) => {
        setOverview(o);
        setSelectedId((prev) => prev ?? o.threads[0]?.id ?? null);
      })
      .catch((e: unknown) => {
        if (!opts?.silent) toast.error(e instanceof Error ? e.message : "Could not load Messenger");
      });
  };

  useEffect(() => load(), []);

  // Messenger has no push into the desk beyond the webhook; poll gently so a new
  // thread shows up while the page is open (silent — no toast noise).
  useEffect(() => {
    const t = window.setInterval(() => load({ silent: true }), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setThread(null);
      return;
    }
    void messengerThreadFn({ data: { threadId: selectedId } })
      .then(setThread)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load thread"));
  }, [selectedId]);

  const send = async () => {
    if (!selectedId || !draft.trim()) return;
    setBusy("send");
    try {
      await sendMessengerReplyFn({ data: { threadId: selectedId, message: draft } });
      setDraft("");
      toast.success("Reply sent — a human wrote and sent it");
      const next = await messengerThreadFn({ data: { threadId: selectedId } });
      setThread(next);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messenger"
        hint="Page Messenger, human-in-the-loop. PosterPal ingests messages from Facebook's signed webhook and refuses to send outside the 24-hour standard messaging window. It never messages people first, never auto-replies, and never uses Message Tags for promotion."
      />

      <section className="rounded-xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Webhook setup</h2>
          <Badge variant={overview?.verifyTokenConfigured ? "success" : "warning"}>
            {overview?.verifyTokenConfigured ? "verify token saved" : "verify token missing"}
          </Badge>
        </div>
        <div className="mt-2 grid gap-3 lg:grid-cols-2">
          <div className="space-y-2 text-[13px]">
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                Meta app → <strong>Messenger</strong> product → Settings → Webhooks → <strong>Add Callback URL</strong>.
              </li>
              <li>
                Callback URL: <code className="break-all">{endpoint}</code>
              </li>
              <li>Verify token: the value you save here (letters, numbers, <code>_</code>, <code>-</code>).</li>
              <li>
                Subscribe to <code>messages</code> and <code>messaging_postbacks</code>, then select your Page.
              </li>
              <li>
                App Review: <code>pages_messaging</code> is required before anyone who is not an app role can message the Page.
              </li>
            </ol>
            <p className="text-[12px] text-muted-foreground">
              Inbound deliveries are authenticated with <code>X-Hub-Signature-256</code> using your App Secret before anything is stored.
            </p>
          </div>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy("token");
              void saveMessengerVerifyTokenFn({ data: { token: verifyToken } })
                .then(() => {
                  toast.success("Verify token saved — paste the same value into Meta");
                  setVerifyToken("");
                  load();
                })
                .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not save token"))
                .finally(() => setBusy(null));
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="verify-token">Verify token</Label>
              <Input
                id="verify-token"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                placeholder="posterpal_messenger_2026"
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!verifyToken.trim() || busy === "token"}>
                Save verify token
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void copyText(endpoint).then((ok) => toast[ok ? "success" : "error"](ok ? "Endpoint copied" : "Could not copy"))
                }
              >
                Copy endpoint
              </Button>
            </div>
          </form>
        </div>
        <ul className="mt-3 grid gap-1 text-[12px] text-muted-foreground sm:grid-cols-2">
          {(overview?.rules ?? []).map((rule) => (
            <li key={rule} className="rounded-md bg-secondary px-2 py-1">
              {rule}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-xl bg-card p-3 shadow-card">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="font-semibold">Threads</h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] tabular-nums text-muted-foreground">{overview?.threads.length ?? 0}</span>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Refresh Messenger threads"
                onClick={() => {
                  load();
                  if (selectedId) void messengerThreadFn({ data: { threadId: selectedId } }).then(setThread);
                }}
              >
                Refresh
              </Button>
            </div>
          </div>
          <ScrollArea className="mt-2 h-[420px]">
            <ul className="space-y-1">
              {(overview?.threads ?? []).length === 0 ? (
                <li className="px-1 py-2 text-[13px] text-muted-foreground">
                  No threads yet. Once the webhook is subscribed, a message to your Page appears here. Nothing is auto-replied.
                </li>
              ) : (
                overview!.threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        "w-full rounded-lg px-2 py-2 text-left text-[13px]",
                        selectedId === t.id ? "bg-secondary" : "hover:bg-secondary/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{t.display_name ?? `PSID ${t.psid.slice(0, 8)}…`}</span>
                        {t.needs_reply ? <Badge variant="warning">needs reply</Badge> : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {t.page_name} · {t.last_message_at ? relativeTime(t.last_message_at) : "—"}
                        {t.window_hours_left != null && t.window_hours_left > 0
                          ? ` · ${t.window_hours_left}h left`
                          : t.last_inbound_at
                            ? " · window closed"
                            : ""}
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </ScrollArea>
        </div>

        <div className="rounded-xl bg-card p-4 shadow-card">
          {thread ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{thread.thread.display_name ?? thread.thread.psid}</h2>
                  <div className="text-[12px] text-muted-foreground">
                    {thread.thread.page_name} · last inbound{" "}
                    {thread.thread.last_inbound_at ? relativeTime(thread.thread.last_inbound_at) : "never"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={thread.window.open ? "success" : "danger"}>
                    {thread.window.open
                      ? `window open · ${thread.window.hoursLeft}h left`
                      : "window closed"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void markMessengerHandledFn({ data: { threadId: thread.thread.id } })
                        .then(() => {
                          toast.success("Marked handled");
                          load();
                        })
                        .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update"))
                    }
                  >
                    Mark handled
                  </Button>
                </div>
              </div>

              <ScrollArea className="mt-3 h-[300px] rounded-lg border border-border p-3">
                <ul className="space-y-2">
                  {thread.messages.length === 0 ? (
                    <li className="text-[13px] text-muted-foreground">No messages stored for this thread yet.</li>
                  ) : (
                    thread.messages.map((m) => (
                      <li
                        key={m.id}
                        className={cn(
                          "max-w-[85%] rounded-lg px-3 py-2 text-[13px]",
                          m.direction === "outbound"
                            ? "ml-auto bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {m.body ? <p className="whitespace-pre-wrap">{m.body}</p> : null}
                        {m.attachments.length ? (
                          <p className="mt-1 text-[11px] opacity-80">
                            {m.attachments.map((a) => a.type).join(", ")} attachment
                            {m.attachments.length > 1 ? "s" : ""}
                          </p>
                        ) : null}
                        <div className="mt-1 text-[10px] opacity-70">{m.sent_at ? relativeTime(m.sent_at) : ""}</div>
                      </li>
                    ))
                  )}
                </ul>
              </ScrollArea>

              <div className="mt-3 space-y-2">
                <Label htmlFor="reply">Your reply (a human clicks Send)</Label>
                <Textarea
                  id="reply"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      if (thread.window.open && draft.trim() && busy !== "send") void send();
                    }
                  }}
                  maxLength={2000}
                  placeholder={
                    thread.window.open
                      ? "Write a real reply — it is sent only when you click Send (Ctrl+Enter)."
                      : "Window closed — sending is refused. Wait for the person to message the Page again."
                  }
                  disabled={!thread.window.open}
                  aria-describedby="reply-window-hint"
                />
                <div className="flex items-center justify-between gap-2">
                  <span id="reply-window-hint" className="text-[11px] text-muted-foreground">
                    {draft.length}/2000
                    {thread.window.open
                      ? ` · window closes ${thread.window.hoursLeft}h from now`
                      : " · 24-hour window closed"}
                  </span>
                  <Button
                    disabled={!thread.window.open || !draft.trim() || busy === "send"}
                    onClick={() => void send()}
                  >
                    {busy === "send" ? "Sending…" : "Send reply"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a thread. PosterPal stores inbound messages with their signature verified, and shows the 24-hour window
              for every conversation.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
