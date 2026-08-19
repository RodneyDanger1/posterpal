import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { logsFn, vaultFn } from "@/lib/posterpal/fns";
import type { SchedulerLogRow, VaultRow } from "@/lib/posterpal/types";
import { relativeTime } from "@/lib/utils";

export const Route = createFileRoute("/vault")({ component: () => <Guard><Vault /></Guard> });

function Vault() {
  const [items, setItems] = useState<VaultRow[]>([]);
  const [logs, setLogs] = useState<SchedulerLogRow[]>([]);
  useEffect(() => {
    void vaultFn().then(setItems);
    void logsFn().then(setLogs);
  }, []);

  return (
    <div className="space-y-6">
      <div>
      <PageHeader
        title="Token vault"
        hint="User tokens encrypted at rest. Page tokens are re-derived from /me/accounts — never assumed immortal. Graph 190 marks the vault invalid and asks you to reconnect. Scheduler log: failures are never silent."
      />
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Facebook user tokens yet. Connect in Settings or setup.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((v) => (
            <li key={v.id} className="rounded-xl bg-card p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{v.name}</div>
                <Badge variant={v.is_valid ? "success" : "danger"}>{v.is_valid ? "Valid" : "Re-auth required"}</Badge>
              </div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                Expires {v.expires_at ? relativeTime(v.expires_at) : "unknown"} · scopes {v.scopes ?? "—"}
              </div>
              <div className="text-[12px] text-muted-foreground">Last validated {relativeTime(v.last_validated_at)}</div>
            </li>
          ))}
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
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 tabular-nums">{relativeTime(l.attempt_time)}</td>
                  <td className="px-3 py-2">{l.status}</td>
                  <td className="px-3 py-2">{l.request_path}</td>
                  <td className="px-3 py-2 text-destructive">{l.error_message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
