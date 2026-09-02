import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

export type PrefillMedia = {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  altText: string;
  createdWithAi: boolean;
  assetId?: string;
};

export type ComposerPrefill = {
  message: string;
  pageId?: string | null;
  mediaType?: string;
  media?: PrefillMedia[];
  when?: string | null;
  link?: string;
  imagePrompt?: string;
  firstComment?: string;
  recycleAfterDays?: number | null;
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
  lastAgentPersona: string | null;
  setLastAgentPersona: (id: string | null) => void;
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
      setCommandOpen: (open: boolean) => set({ commandOpen: open }),
      theme: "light",
      setTheme: (t) => {
        applyThemeClass(t);
        set({ theme: t });
      },
      composerPrefill: null,
      setComposerPrefill: (p) => set({ composerPrefill: p }),
      lastAgentPersona: null,
      setLastAgentPersona: (id) => set({ lastAgentPersona: id }),
    }),
    {
      name: "posterpal-shell",
      storage: createJSONStorage(() => iframeSafeStorage()),
      partialize: (s) => ({
        theme: s.theme,
        selectedPageId: s.selectedPageId,
        lastAgentPersona: s.lastAgentPersona,
        composerPrefill: s.composerPrefill
          ? {
              ...s.composerPrefill,
              media: s.composerPrefill.media?.map((m) => ({
                ...m,
                dataUrl: m.dataUrl?.startsWith("data:") ? "" : m.dataUrl,
              })),
            }
          : null,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ShellState>;
        return {
          ...current,
          theme: p.theme === "dark" ? "dark" : current.theme,
          selectedPageId: typeof p.selectedPageId === "string" ? p.selectedPageId : current.selectedPageId,
          lastAgentPersona: typeof p.lastAgentPersona === "string" ? p.lastAgentPersona : current.lastAgentPersona,
          composerPrefill: p.composerPrefill ?? current.composerPrefill,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyThemeClass(state.theme);
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

/** Ephemeral brief queued from Needs you / command palette into /agent. */
export type AgentBrief = { brief: string; persona?: string };

export const useAgentBriefStore = create<{
  pending: AgentBrief | null;
  queue: (brief: string, persona?: string) => void;
  consume: () => AgentBrief | null;
}>((set, get) => ({
  pending: null,
  queue: (brief, persona) => set({ pending: { brief: brief.slice(0, 2000), persona } }),
  consume: () => {
    const b = get().pending;
    set({ pending: null });
    return b;
  },
}));

/** Ephemeral — kept off the persisted shell so HMR and cookie-blocked storage cannot drop it. */
export const useInspectorStore = create<{
  postId: string | null;
  open: (id: string) => void;
  close: () => void;
}>((set) => ({
  postId: null,
  open: (id) => set({ postId: id }),
  close: () => set({ postId: null }),
}));
