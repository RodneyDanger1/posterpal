import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Guard } from "@/components/guard";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  buildFourthwallCheckoutLinkFn,
  commerceOverviewFn,
  createFourthwallProductFn,
  deleteCommerceConnectionFn,
  fourthwallTemplatesFn,
  preparePrintAssetFn,
  saveFourthwallConnectionFn,
  saveFourthwallWebhookSecretFn,
  syncCommerceOrdersFn,
  syncCommerceProductsFn,
  testCommerceConnectionFn,
} from "@/lib/commerce/fns";
import { PRINT_METHODS, PRINT_SPECS } from "@/lib/commerce/print-specs";
import type { CommerceProduct, ProductTemplate } from "@/lib/commerce/types";
import { mediaLibraryFn } from "@/lib/posterpal/fns";
import type { MediaLibraryItem } from "@/lib/posterpal/types";
import { copyText, relativeTime } from "@/lib/utils";

export const Route = createFileRoute("/commerce")({ component: () => <Guard><Commerce /></Guard> });

type Overview = Awaited<ReturnType<typeof commerceOverviewFn>>;
type PrintReport = Awaited<ReturnType<typeof preparePrintAssetFn>>["report"];

function money(cents: number | null, currency: string | null): string {
  if (cents == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency ?? ""}`.trim();
  }
}

/** Sensible starting print areas per Fourthwall production method (inches). */
const PRINT_PRESETS: Record<string, { width: number; height: number }> = {
  DTG: { width: 10, height: 12 },
  DTFX: { width: 12, height: 16 },
  SUBLIMATION: { width: 8, height: 8 },
  STICKERS: { width: 3, height: 3 },
  EMBROIDERY: { width: 4, height: 4 },
  SCREEN_PRINT: { width: 12, height: 16 },
};

function presetFor(method: string): { width: number; height: number } | null {
  return PRINT_PRESETS[method.trim().toUpperCase()] ?? null;
}

function Commerce() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // connection form
  const [label, setLabel] = useState("Fourthwall");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [credUser, setCredUser] = useState("");
  const [credPass, setCredPass] = useState("");
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({});

  // templates / product creation
  const [templates, setTemplates] = useState<ProductTemplate[]>([]);
  const [templatePage, setTemplatePage] = useState(1);
  const [templateTotal, setTemplateTotal] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<ProductTemplate | null>(null);
  const [media, setMedia] = useState<MediaLibraryItem[]>([]);
  const [mediaId, setMediaId] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [region, setRegion] = useState("front");
  const [printWidthIn, setPrintWidthIn] = useState(10);
  const [printHeightIn, setPrintHeightIn] = useState(12);
  const [profitMargin, setProfitMargin] = useState(10);
  const [publishOnCreate, setPublishOnCreate] = useState(false);

  // print pipeline
  const [method, setMethod] = useState<(typeof PRINT_METHODS)[number]>("DTG");
  const [exportPreview, setExportPreview] = useState<{ dataUrl: string | null; report: PrintReport } | null>(null);

  const connection = overview?.connections[0] ?? null;

  const load = () => {
    setLoading(true);
    setLoadError(null);
    void commerceOverviewFn()
      .then((o) => {
        setOverview(o);
        const first = o.connections[0];
        if (first) {
          setShopDomain((prev) => prev || first.config.shopDomain || "");
        }
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Could not load commerce data";
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    void mediaLibraryFn()
      .then((items) => {
        setMedia(items);
        if (items[0]) setMediaId((prev) => prev || items[0]!.id);
      })
      .catch(() => setMedia([]));
  }, []);

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(success);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  };

  const loadTemplates = async (page = 1) => {
    setBusy("templates");
    try {
      const res = await fourthwallTemplatesFn({ data: { page } });
      setTemplates(res.results);
      setTemplateTotal(res.total);
      setTemplatePage(page);
      toast.success(`${res.results.length} templates loaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load Fourthwall templates");
    } finally {
      setBusy(null);
    }
  };

  // Origin is only known in the browser. Reading window during render causes a
  // hydration mismatch (server renders "" and the client renders the real host),
  // so resolve it in an effect.
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const webhookUrl = connection ? `${origin}/api/commerce/fourthwall/webhook` : "";
  const checkoutBase = (product: CommerceProduct, variantId?: string) =>
    connection
      ? `${origin}/api/commerce/fourthwall/checkout?connectionId=${connection.id}&variantId=${
          variantId ?? product.variants[0]?.id ?? ""
        }&productName=${encodeURIComponent(product.name)}`
      : "";

  const buyLinks = useMemo(
    () =>
      (overview?.products ?? []).map((p) => ({
        product: p,
        storeUrl:
          connection && p.slug ? `https://${connection.config.shopDomain || "shop.fourthwall.com"}/products/${p.slug}` : null,
      })),
    [overview?.products, connection],
  );

  const header = (
    <PageHeader
      title="Commerce"
      hint="Fourthwall is the Merchant of Record: browsing, product pages, and the buy button live on your site; only the payment step hands off to Fourthwall's hosted checkout. PosterPal builds that handoff with fbclid/utm/_fbp preserved, ingests orders by API and signed webhook, and turns AI stills into print-ready files at Fourthwall's exact DPI."
    />
  );

  if (loading && !overview) {
    return (
      <div className="space-y-6">
        {header}
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {loadError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-[13px]">
          <span className="text-destructive">{loadError}</span>
          <Button size="sm" variant="outline" onClick={() => load()}>
            Retry
          </Button>
        </div>
      ) : null}

      <section className="rounded-xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Fourthwall connection</h2>
          {connection ? (
            <Badge variant={connection.status === "connected" ? "success" : connection.status === "error" ? "danger" : "warning"}>
              {connection.status}
            </Badge>
          ) : (
            <Badge variant="warning">not connected</Badge>
          )}
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Credentials: Fourthwall dashboard → Settings → For developers → Open API → Create API user
          (Super Admin required). Sent as HTTP Basic auth; stored AES-256-GCM encrypted.
        </p>
        {connection ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="space-y-2 text-[13px]">
              <div>
                <span className="text-muted-foreground">Shop</span>{" "}
                <span className="font-medium">{connection.account_ref ?? "— verified once, name unknown —"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Checkout domain</span>{" "}
                <span className="font-medium">{connection.config.shopDomain || "not set"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Last sync</span>{" "}
                <span className="font-medium">{connection.last_sync_at ? relativeTime(connection.last_sync_at) : "never"}</span>
              </div>
              {connection.last_error ? <p className="text-destructive">{connection.last_error}</p> : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" disabled={busy === "test"} onClick={() => void run("test", () => testCommerceConnectionFn({ data: { connectionId: connection.id } }), "Fourthwall verified")}>
                  Test connection
                </Button>
                <Button size="sm" variant="outline" disabled={busy === "products"} onClick={() => void run("products", async () => {
                  const r = await syncCommerceProductsFn({ data: { connectionId: connection.id } });
                  toast.success(`${r.synced} products synced`);
                }, "Products synced")}>
                  Sync products
                </Button>
                <Button size="sm" variant="outline" disabled={busy === "orders"} onClick={() => void run("orders", async () => {
                  const r = await syncCommerceOrdersFn({ data: { connectionId: connection.id } });
                  toast.success(`${r.synced} orders synced`);
                }, "Orders synced")}>
                  Sync orders
                </Button>
                <Button size="sm" variant="outline" disabled={busy === "delete"} onClick={() => void run("delete", () => deleteCommerceConnectionFn({ data: { connectionId: connection.id } }), "Connection removed")}>
                  Remove
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="shop-domain">Shop domain for buy links</Label>
                <Input id="shop-domain" value={shopDomain} onChange={(e) => setShopDomain(e.target.value)} placeholder="your-shop.fourthwall.com" />
                <p className="text-[11px] text-muted-foreground">Used to build `https://{"{domain}"}/cart/checkout` links. Testing fills it automatically.</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === "save"}
                  onClick={() =>
                    void run(
                      "save",
                      () =>
                        saveFourthwallConnectionFn({
                          data: { connectionId: connection.id, label: connection.label, shopDomain },
                        }),
                      "Shop domain saved — credentials untouched",
                    )
                  }
                >
                  Save domain
                </Button>
              </div>

              <details className="rounded-lg border border-border px-3 py-2">
                <summary className="cursor-pointer text-[13px] font-medium">Update Open API credentials</summary>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Leave both blank to keep the stored credentials. Saving new ones marks the connection unverified — press Test
                  connection afterwards.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Input
                    aria-label="New Open API username"
                    value={credUser}
                    onChange={(e) => setCredUser(e.target.value)}
                    placeholder="Open API username"
                    autoComplete="off"
                  />
                  <Input
                    aria-label="New Open API password"
                    type="password"
                    value={credPass}
                    onChange={(e) => setCredPass(e.target.value)}
                    placeholder="Open API password"
                    autoComplete="off"
                  />
                </div>
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={!credUser.trim() || !credPass.trim() || busy === "creds"}
                  onClick={() =>
                    void run(
                      "creds",
                      async () => {
                        await saveFourthwallConnectionFn({
                          data: {
                            connectionId: connection.id,
                            label: connection.label,
                            username: credUser,
                            password: credPass,
                            shopDomain,
                          },
                        });
                        setCredUser("");
                        setCredPass("");
                      },
                      "Credentials replaced — press Test connection",
                    )
                  }
                >
                  Save credentials
                </Button>
              </details>

              <div className="space-y-1">
                <Label htmlFor="webhook-secret">Webhook signing secret</Label>
                <Input id="webhook-secret" type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="From Settings → For developers → Webhooks" autoComplete="off" />
                <p className="text-[11px] text-muted-foreground">
                  Endpoint: <code className="break-all">{webhookUrl || "/api/commerce/fourthwall/webhook"}</code> ·{" "}
                  {overview?.webhookConfigured[connection.id] ? "secret saved" : "no secret yet"}
                </p>
              </div>
              <Button
                size="sm"
                disabled={!webhookSecret.trim() || busy === "hook"}
                onClick={() =>
                  void run(
                    "hook",
                    async () => {
                      await saveFourthwallWebhookSecretFn({ data: { connectionId: connection.id, secret: webhookSecret } });
                      setWebhookSecret("");
                    },
                    "Webhook secret saved",
                  )
                }
              >
                Save webhook secret
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run("connect", async () => {
                await saveFourthwallConnectionFn({ data: { label, username, password, shopDomain } });
                setPassword("");
              }, "Fourthwall connection saved — now press Test connection");
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="fw-label">Label</Label>
              <Input id="fw-label" value={label} onChange={(e) => setLabel(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fw-user">Open API username</Label>
              <Input id="fw-user" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="off" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fw-pass">Open API password</Label>
              <Input id="fw-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="off" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fw-domain">Shop domain (optional — filled by Test)</Label>
              <Input id="fw-domain" value={shopDomain} onChange={(e) => setShopDomain(e.target.value)} placeholder="your-shop.fourthwall.com" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy === "connect"}>Save connection</Button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Fourthwall product templates</h2>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span>{templateTotal ? `${templateTotal} templates` : "public endpoint, no credentials needed"}</span>
            <Button size="sm" variant="outline" disabled={busy === "templates"} onClick={() => void loadTemplates(templatePage)}>
              {templates.length ? "Refresh" : "Load templates"}
            </Button>
            {templates.length ? (
              <>
                <Button size="sm" variant="ghost" disabled={templatePage <= 1} onClick={() => void loadTemplates(templatePage - 1)}>Prev</Button>
                <span>page {templatePage}</span>
                <Button size="sm" variant="ghost" disabled={templates.length === 0} onClick={() => void loadTemplates(templatePage + 1)}>Next</Button>
              </>
            ) : null}
          </div>
        </div>
        {selectedTemplate ? (
          <p className="mt-2 rounded-md bg-secondary px-3 py-2 text-[13px]">
            Selected: <span className="font-semibold">{selectedTemplate.name}</span> · {selectedTemplate.production_method} ·{" "}
            {money(selectedTemplate.base_price_cents, selectedTemplate.currency)} base ·{" "}
            {selectedTemplate.supports_backend_rendering ? "design pipeline supported" : "design pipeline NOT supported"}
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-muted-foreground">Load templates, then pick one to create a design product from an AI still.</p>
        )}
        {templates.length ? (
          <ScrollArea className="mt-3 h-64">
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(t);
                      setProductName((prev) => prev || `Ridgeboundia ${t.name}`);
                      // Start from the print area this production method needs;
                      // the operator can still override both numbers.
                      const preset = presetFor(t.production_method);
                      if (preset) {
                        setPrintWidthIn(preset.width);
                        setPrintHeightIn(preset.height);
                      }
                    }}
                    className={`w-full rounded-lg border p-2 text-left text-[13px] transition ${
                      selectedTemplate?.id === t.id ? "border-primary bg-secondary" : "border-border hover:bg-secondary/60"
                    }`}
                  >
                    <div className="font-medium">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t.brand} · {t.production_method} · {money(t.base_price_cents, t.currency)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : null}
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">Create a Fourthwall design product from a media asset</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Runs the print pipeline (exact DPI, sRGB, PNG) then the documented Fourthwall flow: request upload URL → PUT bytes →
          register media image → create design product. Products are created hidden unless you tick publish.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="media">Media asset</Label>
            <select
              id="media"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={mediaId}
              onChange={(e) => setMediaId(e.target.value)}
            >
              <option value="">Select a media asset…</option>
              {media.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.file_name} · {m.page_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pname">Product name</Label>
            <Input id="pname" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Trailhead Tee" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pdesc">Description</Label>
            <Input id="pdesc" value={productDescription} onChange={(e) => setProductDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="region">Print region</Label>
            <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="front" />
          </div>
          <div className="space-y-1">
            <Label>Print size (inches at template DPI)</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={40} step={0.1} value={printWidthIn} onChange={(e) => setPrintWidthIn(Number(e.target.value))} />
              <span className="text-muted-foreground">×</span>
              <Input type="number" min={1} max={40} step={0.1} value={printHeightIn} onChange={(e) => setPrintHeightIn(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="margin">Profit margin (USD)</Label>
            <Input id="margin" type="number" min={0} step={0.5} value={profitMargin} onChange={(e) => setProfitMargin(Number(e.target.value))} />
          </div>
          <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
            <input type="checkbox" checked={publishOnCreate} onChange={(e) => setPublishOnCreate(e.target.checked)} />
            Publish immediately (leave off to review the mockups in Fourthwall first)
          </label>
          <div className="sm:col-span-2">
            <Button
              disabled={!connection || !selectedTemplate || !mediaId || busy === "create"}
              onClick={() => {
                if (!connection || !selectedTemplate) return;
                void run("create", async () => {
                  const res = await createFourthwallProductFn({
                    data: {
                      connectionId: connection.id,
                      mediaAssetId: mediaId,
                      productTemplateId: selectedTemplate.id,
                      productionMethod: selectedTemplate.production_method,
                      name: productName,
                      description: productDescription,
                      printWidthIn,
                      printHeightIn,
                      region,
                      profitMargin,
                      publishOnCreate,
                    },
                  });
                  toast.success(`Created ${res.productId} · upload image ${res.imageId}`);
                }, "Product created");
              }}
            >
              Create product
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">Print-ready export</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Fourthwall accepts PNG/JPG only — never PDF, SVG, AI, EPS, PSD, or TIFF. Apparel needs ≥150 DPI at print size, hard
          goods ≥300 DPI. Exports above a 4× upscale are refused instead of shipping a blurry file.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="pmethod">Print method</Label>
            <select
              id="pmethod"
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof PRINT_METHODS)[number])}
            >
              {PRINT_METHODS.map((m) => (
                <option key={m} value={m}>{PRINT_SPECS[m].label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Print width (in)</Label>
            <Input type="number" min={1} max={40} step={0.1} value={printWidthIn} onChange={(e) => setPrintWidthIn(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>Print height (in)</Label>
            <Input type="number" min={1} max={40} step={0.1} value={printHeightIn} onChange={(e) => setPrintHeightIn(Number(e.target.value))} />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={!mediaId || busy === "print"}
              onClick={() => {
                void run("print", async () => {
                  const res = await preparePrintAssetFn({ data: { mediaAssetId: mediaId, method, printWidthIn, printHeightIn } });
                  setExportPreview({ dataUrl: res.dataUrl, report: res.report });
                  toast[res.dataUrl ? "success" : "error"](
                    res.dataUrl ? `Export ready (${res.report.verdict})` : res.report.warnings[0] ?? "Export rejected",
                  );
                }, "Print export finished");
              }}
            >
              Export print file
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">{PRINT_SPECS[method].note}</p>
        {exportPreview ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
            {exportPreview.dataUrl ? (
              <a href={exportPreview.dataUrl} download={`print-${exportPreview.report.method.toLowerCase()}.png`}>
                <img src={exportPreview.dataUrl} alt="Print-ready preview" className="w-40 rounded-md border border-border" />
              </a>
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-md border border-destructive text-center text-[12px] text-destructive">
                rejected
              </div>
            )}
            <div className="text-[13px]">
              <div>
                Source {exportPreview.report.sourceWidth}×{exportPreview.report.sourceHeight}px → target{" "}
                {exportPreview.report.targetWidth}×{exportPreview.report.targetHeight}px at {exportPreview.report.dpi} DPI
              </div>
              <div className="text-muted-foreground">
                Scale {exportPreview.report.scale ?? "—"}× · verdict {exportPreview.report.verdict} · output{" "}
                {exportPreview.report.outputWidth ?? "—"}×{exportPreview.report.outputHeight ?? "—"}
              </div>
              <ul className="mt-1 list-disc pl-5 text-[12px] text-muted-foreground">
                {exportPreview.report.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
        {overview?.printExports.length ? (
          <ul className="mt-3 space-y-1 text-[12px] text-muted-foreground">
            {overview.printExports.slice(0, 6).map((e) => (
              <li key={e.id}>
                {relativeTime(e.created_at)} · {e.method} {e.print_width_in}×{e.print_height_in}in @ {e.dpi} DPI · {e.verdict}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">Products & on-site buy links</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Paste a buy link on your site or a Page post. It logs the click, then 303-redirects to Fourthwall checkout with
          attribution intact — the last step is theirs because they are the Merchant of Record.
        </p>
        {buyLinks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No synced products yet. Connect, verify, then Sync products.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {buyLinks.map(({ product, storeUrl }) => {
              const chosen = variantChoice[product.id] ?? product.variants[0]?.id ?? "";
              const url = checkoutBase(product, chosen);
              const chosenVariant = product.variants.find((v) => v.id === chosen) ?? product.variants[0];
              return (
              <li key={product.id} className=" rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-[12px] text-muted-foreground">
                      {product.state} · {product.access} · {money(product.price_cents, product.currency)} ·{" "}
                      {product.variants.length} variants
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {product.variants.length > 1 ? (
                      <select
                        aria-label={`Variant for ${product.name}`}
                        className="h-9 rounded-md border border-input bg-card px-2 text-[12px]"
                        value={chosen}
                        onChange={(e) => setVariantChoice((prev) => ({ ...prev, [product.id]: e.target.value }))}
                      >
                        {product.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name || v.id.slice(0, 8)}
                            {v.price_cents != null ? ` · ${money(v.price_cents, product.currency)}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!chosen}
                      onClick={() =>
                        void copyText(url).then((ok) =>
                          toast[ok ? "success" : "error"](
                            ok
                              ? `Buy link copied${chosenVariant?.name ? ` (${chosenVariant.name})` : ""}`
                              : "Could not copy",
                          ),
                        )
                      }
                    >
                      Copy buy link
                    </Button>
                    {storeUrl ? (
                      <a href={storeUrl} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="ghost">Open on Fourthwall</Button>
                      </a>
                    ) : null}
                    {connection && chosen ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void run("link", async () => {
                            const res = await buildFourthwallCheckoutLinkFn({
                              data: {
                                connectionId: connection.id,
                                variantId: chosen,
                                productName: product.name,
                              },
                            });
                            await copyText(res.url);
                          }, "Direct checkout URL built and copied")
                        }
                      >
                        Copy checkout URL
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-card p-4 shadow-card">
        <h2 className="font-semibold">Orders</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Order</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Total</th>
                <th className="px-2 py-2">Items</th>
                <th className="px-2 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.orders ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-muted-foreground">
                    No orders synced. Sync orders pulls the last 100; ORDER_PLACED webhooks also land in the events table below.
                  </td>
                </tr>
              ) : (
                overview!.orders.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0">
                    <td className="px-2 py-2 font-mono text-[12px]">{o.friendly_id ?? o.external_id.slice(0, 10)}</td>
                    <td className="px-2 py-2">{o.status ?? "—"}</td>
                    <td className="px-2 py-2 tabular-nums">{money(o.total_cents, o.currency)}</td>
                    <td className="px-2 py-2">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ") || "—"}</td>
                    <td className="px-2 py-2 tabular-nums">{relativeTime(o.provider_created_at ?? o.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl bg-card p-4 shadow-card">
          <h2 className="font-semibold">Webhook deliveries</h2>
          <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
            {(overview?.webhookEvents ?? []).length === 0 ? (
              <li>None yet. Register the endpoint URL with the secret above.</li>
            ) : (
              overview!.webhookEvents.map((e) => (
                <li key={e.id}>
                  {relativeTime(e.received_at)} · {e.type} · {e.event_id.slice(0, 10)} · {e.processed ? "processed" : "new"}
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-card">
          <h2 className="font-semibold">Buy-link clicks</h2>
          <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
            {(overview?.checkoutClicks ?? []).length === 0 ? (
              <li>No handoffs recorded yet.</li>
            ) : (
              overview!.checkoutClicks.map((c) => (
                <li key={c.id}>
                  {relativeTime(c.created_at)} · {c.product_name ?? "variant"} · {Object.entries(c.utm).map(([k, v]) => `${k}=${v}`).join(" ") || "no utm"}
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-xl bg-card p-4 shadow-card">
          <h2 className="font-semibold">What this cannot do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-muted-foreground">
            <li>Host a Fourthwall payment form — no such API exists.</li>
            <li>Create Fourthwall orders — only read them and receive webhooks.</li>
            <li>Upload vector/SVG artwork — Fourthwall rejects it.</li>
            <li>Use a Message Tag for merchandising in Messenger.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
