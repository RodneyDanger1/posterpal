import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "./app-shell";
import { Skeleton } from "./ui/skeleton";

/** Personal desk — no sign-in wall. Session loading still gets a skeleton. */
export function Guard({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending && !user) {
    return (
      <div className="flex min-h-screen bg-background p-6">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }
  return <AppShell right={right}>{children}</AppShell>;
}
