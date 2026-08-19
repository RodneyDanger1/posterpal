import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
  when?: string | null;
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

const memoryStore: Record<string, string> = {};

function iframeSafeStorage(): Storage {
  try {
    const probe = "__posterpal_probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(memoryStore, k) ? memoryStore[k]! : null),
      setItem: (k, v) => {
        memoryStore[k] = v;
      },
      removeItem: (k) => {
        delete memoryStore[k];
      },
      clear: () => {
        for (const k of Object.keys(memoryStore)) delete memoryStore[k];
      },
      key: (i) => Object.keys(memoryStore)[i] ?? null,
      get length() {
        return Object.keys(memoryStore).length;
      },
    };
  }
}

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
      storage: createJSONStorage(() => iframeSafeStorage()),
      partialize: (s) => ({ theme: s.theme, selectedPageId: s.selectedPageId }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ShellState>;
        return {
          ...current,
          theme: p.theme === "dark" ? "dark" : current.theme,
          selectedPageId: typeof p.selectedPageId === "string" ? p.selectedPageId : current.selectedPageId,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state?.theme && typeof document !== "undefined") {
          document.documentElement.classList.toggle("dark", state.theme === "dark");
        }
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
