import { authClient, authEnabled } from "./client";

/** Normalized user shape used across the app, auth on or off. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  /** True when this is the sandbox/dev fallback (auth not configured). */
  isDevFallback: boolean;
};

/**
 * Stable operator identity. PosterPal is a personal desk — no sign-in screen.
 * Same id (`dev-user`) that `verify.server.ts` uses, so every row belongs to
 * one consistent owner.
 */
export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Operator",
  primaryEmail: null,
  profileImageUrl: null,
  isDevFallback: true,
};

/** `useCurrentUserState()` result: the user plus the session-loading flag. */
export type CurrentUserState = {
  /** The user — `null` BOTH while the session loads and when signed out. */
  user: AppUser | null;
  /** True while the session is still resolving — don't treat `user: null` as signed out yet. */
  isPending: boolean;
};

/**
 * Current user + loading state.
 *   - Auth disabled (PosterPal default) -> Operator, never pending.
 *   - Auth enabled -> real session, or Operator fallback so the desk never blocks.
 */
export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled) return { user: DEV_USER, isPending: false };
  const { data, isPending } = authClient.useSession();
  const user = data?.user;
  return {
    user: user
      ? {
          id: user.id,
          displayName: user.name ?? null,
          primaryEmail: user.email ?? null,
          profileImageUrl: user.image ?? null,
          isDevFallback: false,
        }
      : DEV_USER,
    isPending: isPending && !user,
  };
}

/**
 * Convenience view of `useCurrentUserState().user` for display.
 */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
