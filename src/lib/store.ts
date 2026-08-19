import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PrefillMedia = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  altText: string;
  createdWithAi: boolean;
};

export type ComposerPrefill = {
  message: string;
  pageId?: string | null;
  mediaType?: string;
  media?: PrefillMedia[];
};

type ShellState = {
  selectedPageId: string | null;
  setSelectedPageId: (id: string | null) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  composerPrefill: ComposerPrefill | null;
  setComposerPrefill: (p: ComposerPrefill | null) => void;
};

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      selectedPageId: null,
      setSelectedPageId: (id) => set({ selectedPageId: id }),
      commandOpen: false,
      setCommandOpen: (open) => set({ commandOpen: open }),
      theme: "light",
      setTheme: (t) => {
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("dark", t === "dark");
        }
        set({ theme: t });
      },
      composerPrefill: null,
      setComposerPrefill: (p) => set({ composerPrefill: p }),
    }),
    {
      name: "posterpal-shell",
      partialize: (s) => ({ theme: s.theme }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ShellState>;
        return { ...current, theme: p.theme === "dark" ? "dark" : current.theme };
      },
    },
  ),
);

/** Drop a Page id that no longer exists so rail, Composer, and lists stay in sync. */
export function adoptLivePageId(pageIds: string[], preferred?: string | null) {
  const ids = new Set(pageIds);
  const current = useShellStore.getState().selectedPageId;
  if (current && ids.has(current)) return current;
  const next = (preferred && ids.has(preferred) ? preferred : pageIds[0]) ?? null;
  useShellStore.getState().setSelectedPageId(next);
  return next;
}
