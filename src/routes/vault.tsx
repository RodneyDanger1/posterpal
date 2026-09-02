import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { Happenings } from "@/components/happenings";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { deskHealthFn, deskLogsFn, logsFn, vaultFn } from "@/lib/posterpal/fns";
import { vaultAlarm } from "@/lib/posterpal/operator";
import type { SchedulerLogRow, VaultRow } from "@/lib/posterpal/types";
import { useAgentBriefStore } from "@/lib/store";
import { relativeTime } from "@/lib/utils";

export const Route = createFileRoute("/vault")({ component: () => <Guard><Vault /></Guard> });

function Vault() {
  const navigate = useNavigate();
  const [items, setItems] = useState<VaultRow[]>([]);
  const [logs, setLogs] = useState<SchedulerLogRow[]>([]);
  const [deskLogs, setDeskLogs] = useState<
    Array<{ id: string; level: string; scope: string; message: string; extra: string | null; created_at: string }>
  >([]);
  const [health, setHealth] = useState<{
    db: string;
    workerLastTick: string | null;
    schedulerLastTick: string | null;
    workerFresh: boolean;
    schedulerFresh: boolean;
  } | null>(null);
  useEffect(() => {
    void vaultFn()
      .then(setItems)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load vault"));
    void logsFn()
      .then(setLogs)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load log"));
    void deskLogsFn()
      .then(setDeskLogs)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load desk log"));
    void deskHealthFn()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Token vault"
        hint="User tokens encrypted at rest. Page tokens are re-derived from /me/accounts — never assumed immortal. Graph 190 marks the vault invalid and asks you to reconnect. Scheduler log and desk log: failures are never silent."
      />
      {health ? (
        <div className="rounded-xl bg-card p-4 text-[13px] shadow-card">
          <div className="font-semibold">Desk health</div>
          <p className="mt-1 text-muted-foreground">
            Database {health.db}. In-tab ticker {health.schedulerFresh ? "fresh" : health.schedulerLastTick ? `last ${relativeTime(health.schedulerLastTick)}` : "has not run"}.
            Background worker {health.workerFresh ? "fresh" : health.workerLastTick ? `last ${relativeTime(health.workerLastTick)}` : "idle — PosterPal.exe ticks LocalScheduled every 60s while the desk is open. Optional: npm run worker if you keep a Postgres DATABASE_URL."}.
          </p>
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Facebook user tokens yet. Connect in Settings when you want live Pages.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((v) => {
            const alarm = vaultAlarm(v.expires_at);
            return (
            <li key={v.id} className="rounded-xl bg-card p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{v.name}</div>
                <Badge variant={v.is_valid ? (alarm === "soon" || alarm === "expired" ? "warning" : "success") : "danger"}>
                  {!v.is_valid ? "Re-auth required" : alarm === "expired" ? "Expired" : alarm === "soon" ? "Expires soon" : "Valid"}
                </Badge>
              </div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                Expires {v.expires_at ? relativeTime(v.expires_at) : "unknown"} · scopes {v.scopes ?? "—"}
              </div>
              {alarm === "soon" || alarm === "expired" ? (
                <p className="mt-2 rounded-md bg-warning/20 px-3 py-2 text-[13px]">
                  <Link to="/settings" className="underline">Reconnect in Settings</Link> before Graph starts returning 190. Long-lived user tokens last ~60 days; Page tokens are re-derived from /me/accounts.
                </p>
              ) : null}
              <div className="text-[12px] text-muted-foreground">Last validated {relativeTime(v.last_validated_at)}</div>
            </li>
            );
          })}
        </ul>
      )}
      <div>
        <h2 className="text-lg font-semibold">Scheduler log</h2>
        <p className="mb-2 text-[13px] text-muted-foreground">Failures are never silent — they become Failed + a log row.</p>
        <div className="overflow-x-auto rounded-xl bg-card shadow-card">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Path</th>
                <th className="px-3 py-2 font-semibold">Error</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                    No scheduler attempts yet. Failures from publish or the 60s tick appear here — never silently.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 tabular-nums">{relativeTime(l.attempt_time)}</td>
                    <td className="px-3 py-2">{l.status}</td>
                    <td className="px-3 py-2">{l.request_path}</td>
                    <td className="px-3 py-2 text-destructive">{l.error_message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl bg-card p-4 shadow-card">
        <Happenings
          title="Happenings"
          logs={deskLogs}
          limit={12}
          empty="Quiet so far. Worker ticks, Graph, Agent runs, and UI crashes land here."
          onAsk={(row) => {
            useAgentBriefStore.getState().queue(
              `What's happening with ${row.scope}? ${row.message} Use DESK OPS. Do not invent Graph calls.`,
              "ops",
            );
            void navigate({ to: "/agent" });
          }}
        />
        <p className="mt-3 text-[12px] text-muted-foreground">
          Worker ticks, Graph sync, Agent runs, UI crashes, pairing. Last 14 days. Full rows below.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Level</th>
                <th className="px-3 py-2 font-semibold">Scope</th>
                <th className="px-3 py-2 font-semibold">Message</th>
              </tr>
            </thead>
            <tbody>
              {deskLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                    Quiet so far. Errors from the worker, Graph, and the UI land here.
                  </td>
                </tr>
              ) : (
                deskLogs.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 tabular-nums">{relativeTime(l.created_at)}</td>
                    <td className="px-3 py-2">{l.level}</td>
                    <td className="px-3 py-2">{l.scope}</td>
                    <td className="px-3 py-2">
                      {l.message}
                      {l.extra ? <div className="mt-1 max-h-16 overflow-auto text-[11px] text-muted-foreground">{l.extra}</div> : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
