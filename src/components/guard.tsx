import { Navigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell } from "./app-shell";
import { Skeleton } from "./ui/skeleton";

export function Guard({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending && !user) {
    return (
      <div className="flex min-h-screen bg-background p-6">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }
  // Auth on + signed out -> the login wall. (Auth off: user is always DEV_USER,
  // never null, so this branch is unreachable on the personal desk.)
  if (!user) return <Navigate to="/login" />;
  return <AppShell right={right}>{children}</AppShell>;
}
