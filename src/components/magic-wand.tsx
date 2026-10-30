import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Save, Sparkles, Undo2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPromptPrefsFn, improvePromptFn, savePromptPrefsFn, savePromptStyleFn } from "@/lib/posterpal/prompt-fns";
import type { ImprovedPrompt, PromptKind, PromptLocks } from "@/lib/posterpal/prompt-craft";
import { LOCK_LABELS, PROMPT_STYLES, IMAGE_STYLE_PRESETS, DEFAULT_LOCKS, scoreCaption } from "@/lib/posterpal/prompt-craft";
import type { SavedPromptStyle } from "@/lib/posterpal/ops";
import { cn } from "@/lib/utils";

/**
 * Magic Wand — improves a caption or image prompt before it is sent.
 *
 * Behaviour that makes it trustworthy:
 *  - the AI rewrite is optional; deterministic structure/rules always apply and the
 *    panel says which one ran,
 *  - styles are presets or your own saved directives, persisted server-side,
 *  - locks (structure/tone/length/CTA/hashtags/audience) constrain the rewrite,
 *  - Accept writes to the editor; Undo restores what you had.
 */
export function MagicWand({
  kind,
  value,
  onChange,
  pageId,
  compact = false,
  className,
}: {
  kind: PromptKind;
  value: string;
  onChange: (next: string) => void;
  pageId?: string;
  compact?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(ImprovedPrompt & { reason?: string }) | null>(null);
  const [prevValue, setPrevValue] = useState("");
  const [style, setStyle] = useState("default");
  const [imageStyle, setImageStyle] = useState("photo");
  const [locks, setLocks] = useState<PromptLocks>(DEFAULT_LOCKS);
  const [audience, setAudience] = useState("");
  const [savedStyles, setSavedStyles] = useState<SavedPromptStyle[]>([]);
  const [newName, setNewName] = useState("");
  const [newDirective, setNewDirective] = useState("");
  const [savingStyle, setSavingStyle] = useState(false);
  const [spark, setSpark] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const loadPrefs = () => {
    void getPromptPrefsFn()
      .then(({ prefs, styles }) => {
        if (prefs.style) setStyle(prefs.style);
        if (prefs.imageStyle) setImageStyle(prefs.imageStyle);
        if (prefs.audience) setAudience(prefs.audience);
        if (prefs.locks) setLocks((cur) => ({ ...cur, ...(prefs.locks as Partial<PromptLocks>) }));
        setSavedStyles(styles);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    if (!open) return;
    loadPrefs();
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 360;
      const left = Math.min(Math.max(12, rect.left - width + rect.width), window.innerWidth - width - 12);
      // The panel is ~300–500 px tall. If there is not enough room below the
      // button (common on laptop composer screens), pin it near the top so the
      // primary action can never render off-screen.
      // Reserve room for the panel's max height so it never spills off-screen.
      const maxPanel = Math.min(window.innerHeight * 0.7, 520);
      const below = rect.bottom + 6;
      const top = Math.max(12, Math.min(below, window.innerHeight - maxPanel - 12));
      setPos({ top, left });
    }
  }, [open]);

  // Bring the result actions into view when a rewrite lands (small laptops).
  useEffect(() => {
    if (!result) return;
    const id = window.setTimeout(() => resultRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
    return () => window.clearTimeout(id);
  }, [result]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // The panel is portalled to <body>, so it is NOT inside wrapRef.
      if (!wrapRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const customStyle = style.startsWith("custom:") ? savedStyles.find((s) => `custom:${s.id}` === style) : null;
  const styleChoices = [
    ...PROMPT_STYLES.filter((s) => s.kinds.includes(kind)).map((s) => ({ id: s.id as string, label: s.label, saved: false })),
    ...savedStyles
      .filter((s) => s.kind === "both" || s.kind === kind)
      .map((s) => ({ id: `custom:${s.id}`, label: `${s.name} (saved)`, saved: true })),
  ];

  const improve = async () => {
    const text = value.trim();
    if (!text) {
      toast.error("Write something first — the wand improves your words, it doesn't invent them.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await improvePromptFn({
        data: {
          kind,
          text,
          style: customStyle ? "default" : style,
          locks,
          pageId,
          imageStyle,
          audience: audience.trim() || undefined,
          customDirective: customStyle?.directive,
        },
      });
      setResult(res);
      setSpark((n) => n + 1);
      if (res.reason) toast.message(res.reason);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not improve that prompt");
    } finally {
      setBusy(false);
    }
  };

  const accept = () => {
    if (!result) return;
    setPrevValue(value);
    onChange(result.text);
    void savePromptPrefsFn({ data: { style, locks, audience, imageStyle } }).catch(() => undefined);
    toast.success("Applied — edit further before sending.");
    setResult(null);
    setOpen(false);
  };

  const saveStyle = async () => {
    if (!newName.trim() || newDirective.trim().length < 8) {
      toast.error("Give the style a name and a directive (8+ characters).");
      return;
    }
    setSavingStyle(true);
    try {
      const res = await savePromptStyleFn({ data: { name: newName, kind, directive: newDirective } });
      setSavedStyles(res.styles);
      const created = res.styles.find((s) => s.name.toLowerCase() === newName.trim().toLowerCase());
      if (created) setStyle(`custom:${created.id}`);
      setNewName("");
      setNewDirective("");
      toast.success("Style saved to this desk");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save style");
    } finally {
      setSavingStyle(false);
    }
  };

  const quality = kind === "caption" && value.trim() ? scoreCaption(value) : null;

  return (
    <div ref={wrapRef} className={cn("relative inline-flex items-center gap-1.5", className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-expanded={open}
        aria-label={`Improve this ${kind} prompt with the magic wand`}
        onClick={() => setOpen((v) => !v)}
        className="magic-wand group gap-1.5 border-transparent bg-[linear-gradient(var(--color-card),var(--color-card))_padding-box,linear-gradient(120deg,color-mix(in_srgb,var(--color-primary)_70%,transparent),color-mix(in_srgb,var(--color-warning)_60%,transparent))_border-box] border"
      >
        <Wand2 className={cn("size-3.5 transition-transform duration-300", open ? "rotate-12" : "group-hover:-rotate-12")} />
        {compact ? null : "Magic wand"}
        {quality ? (
          <span
            className={cn(
              "rounded-full px-1.5 text-[10px] tabular-nums",
              quality.score >= 70 ? "bg-success/15 text-success" : quality.score >= 45 ? "bg-warning/20" : "bg-destructive/10 text-destructive",
            )}
            title={quality.notes.join(" · ") || "Caption quality"}
          >
            {quality.score}
          </span>
        ) : null}
      </Button>

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              className="wand-panel fixed z-[80] max-h-[70vh] w-[360px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border border-border bg-popover p-3 text-foreground shadow-lift"
              style={{ top: pos.top, left: pos.left }}
              role="dialog"
              aria-label="Magic wand prompt improver"
            >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Sparkles className="size-4 text-primary" /> Improve {kind === "caption" ? "caption" : "image prompt"}
            </div>
            <button type="button" aria-label="Close magic wand" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </button>
          </div>

          {/* Primary action first: on short laptop viewports the settings below can
              scroll, but "Improve" must never be pushed off-screen. */}
          <Button type="button" size="sm" disabled={busy} onClick={() => void improve()} className="mt-2 w-full">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
            {busy ? "Polishing…" : "Improve prompt"}
          </Button>

          <div className="mt-2 grid gap-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              Style
              <select
                className="mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-[12px] text-foreground"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              >
                {styleChoices.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
            {customStyle ? <p className="text-[11px] text-muted-foreground">{customStyle.directive}</p> : null}
            {kind === "image" ? (
              <label className="text-[11px] font-medium text-muted-foreground">
                Look
                <select
                  className="mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-[12px] text-foreground"
                  value={imageStyle}
                  onChange={(e) => setImageStyle(e.target.value)}
                >
                  {IMAGE_STYLE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <div>
              <div className=" text-[11px] font-medium text-muted-foreground">Locks</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {LOCK_LABELS.map((lock) => (
                  <button
                    key={lock.id}
                    type="button"
                    title={lock.hint}
                    aria-pressed={locks[lock.id]}
                    onClick={() => setLocks((cur) => ({ ...cur, [lock.id]: !cur[lock.id] }))}
                    className={cn(
                      "chip-in rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                      locks[lock.id] ? "border-primary/40 bg-accent text-accent-foreground" : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {lock.label}
                  </button>
                ))}
              </div>
            </div>
            <Input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Audience (optional): local hikers, new parents…"
              className="h-8 text-[12px]"
              aria-label="Audience"
            />
          </div>

          {result ? (
            <div ref={resultRef} key={spark} className="sparkle-wrap mt-2 rounded-lg border border-border bg-card p-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold">
                  {result.ai ? "Model rewrite" : "Local rewrite"}
                  {quality ? ` · ${scoreCaption(value).score}→${scoreCaption(result.text).score}` : ""}
                </span>
                <Sparkles className="sparkle size-3.5 text-warning" />
              </div>
              <textarea
                readOnly
                value={result.text}
                aria-label="Improved prompt preview"
                className="mt-1 max-h-32 min-h-20 w-full resize-none rounded-md bg-muted/50 p-2 text-[12px] leading-snug"
              />
              {result.applied.length ? (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {result.applied.slice(0, 5).map((a) => (
                    <li key={a} className="chip-in rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">{a}</li>
                  ))}
                </ul>
              ) : null}
              {result.notes.length ? (
                <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{result.notes.join(" · ")}</p>
              ) : null}
              {result.reason ? <p className="mt-1 text-[10px] text-warning">{result.reason}</p> : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button type="button" size="sm" onClick={accept}><Check className="size-3.5" /> Accept</Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void improve()}>
                  <Wand2 className="size-3.5" /> Again
                </Button>
                {prevValue ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => { onChange(prevValue); setPrevValue(""); setResult(null); }}>
                    <Undo2 className="size-3.5" /> Undo
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <details className="mt-2 rounded-lg border border-border px-2 py-1">
            <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">Save this as a style</summary>
            <div className="mt-1 grid gap-1.5">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Style name" className="h-8 text-[12px]" aria-label="New style name" />
              <Input value={newDirective} onChange={(e) => setNewDirective(e.target.value)} placeholder="How should it sound/structure? e.g. 3 lines: hook, fact, CTA" className="h-8 text-[12px]" aria-label="New style directive" />
              <Button type="button" size="sm" variant="outline" disabled={savingStyle} onClick={() => void saveStyle()}>
                {savingStyle ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save style
              </Button>
            </div>
          </details>
          {savedStyles.length ? (
            <button type="button" className="mt-1 text-[10px] text-primary hover:underline" onClick={() => { setOpen(false); void navigate({ to: "/settings" }); }}>
              Manage saved styles in Settings
            </button>
          ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
