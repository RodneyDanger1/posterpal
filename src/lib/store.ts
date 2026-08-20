import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

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
  when?: string;
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

const memoryBucket: Record<string, string> = {};

const memoryStorage: StateStorage = {
  getItem: (name) => memoryBucket[name] ?? null,
  setItem: (name, value) => {
    memoryBucket[name] = value;
  },
  removeItem: (name) => {
    delete memoryBucket[name];
  },
};

/**
 * Chrome "block third-party cookies" (the live preview iframe) also blocks
 * localStorage. Accessing it throws SecurityError and used to crash the desk.
 * Probe once, then never throw — fall back to in-memory for this session.
 */
function iframeSafeStorage(): StateStorage {
  try {
    const ls = globalThis.localStorage;
    const probe = "__posterpal_ok";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return {
      getItem: (name) => {
        try {
          return ls.getItem(name);
        } catch {
          return memoryStorage.getItem(name);
        }
      },
      setItem: (name, value) => {
        try {
          ls.setItem(name, value);
        } catch {
          memoryStorage.setItem(name, value);
        }
      },
      removeItem: (name) => {
        try {
          ls.removeItem(name);
        } catch {
          memoryStorage.removeItem(name);
        }
      },
    };
  } catch {
    return memoryStorage;
  }
}

function applyThemeClass(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  try {
    document.documentElement.classList.toggle("dark", theme === "dark");
  } catch {
    /* sandboxed / cookie-blocked document */
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
        applyThemeClass(t);
        set({ theme: t });
      },
      composerPrefill: null,
      setComposerPrefill: (p) => set({ composerPrefill: p }),
    }),
    {
      name: "posterpal-shell",
      storage: createJSONStorage(() => iframeSafeStorage()),
      partialize: (s) => ({ theme: s.theme }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyThemeClass(state.theme);
      },
    },
  ),
);

/** Drop a persisted Page id that no longer exists (PGLite reseeds on restart). */
export function adoptLivePageId(pageIds: string[], preferred?: string | null) {
  const ids = new Set(pageIds);
  const current = useShellStore.getState().selectedPageId;
  if (current && ids.has(current)) return current;
  const next = (preferred && ids.has(preferred) ? preferred : pageIds[0]) ?? null;
  useShellStore.getState().setSelectedPageId(next);
  return next;
}
