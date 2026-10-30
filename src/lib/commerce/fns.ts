/**
 * Commerce server functions (Fourthwall). Same contract as every other PosterPal
 * server fn: authMiddleware → validated input → lib call. React never imports
 * the client or the DB.
 */
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { CommerceError } from "./types";

function orgId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) throw new CommerceError("fourthwall", "connectionId is required.");
  return trimmed;
}

/** Load a media asset's bytes for this user (library first, then post content items). */
async function loadMediaBytes(
  userId: string,
  mediaAssetId: string,
): Promise<{ bytes: Buffer; mime: string; fileName: string }> {
  const id = mediaAssetId.trim();
  if (!id) throw new CommerceError("fourthwall", "Pick a media asset first.");
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{
    file_name: string | null;
    mime_type: string | null;
    data_url: string | null;
    file_path: string | null;
  }>`
    select file_name, mime_type, data_url, file_path from media_assets
    where id = ${id} and user_id = ${userId}
    union all
    select ci.file_name, ci.mime_type, ci.data_url, ci.file_path from content_items ci
    join posts po on po.id = ci.post_id
    where ci.id = ${id} and ci.user_id = ${userId}
    limit 1
  `;
  const row = rows[0];
  if (!row) throw new CommerceError("fourthwall", "That media asset no longer exists on this desk.");
  // New rows keep bytes on disk; legacy rows keep an inline data URL.
  if (row.file_path) {
    const { readMediaBytes } = await import("@/lib/posterpal/media-files");
    const stored = await readMediaBytes(row.file_path);
    if (!stored) {
      throw new CommerceError(
        "fourthwall",
        "This media asset's file is missing from the media folder. Re-upload or regenerate it.",
      );
    }
    const mime = (row.mime_type ?? "").toLowerCase() || "image/png";
    if (mime !== "image/png" && mime !== "image/jpeg") {
      throw new CommerceError("fourthwall", `Fourthwall accepts PNG or JPG only — got ${mime}.`);
    }
    return { bytes: stored, mime, fileName: row.file_name || (mime === "image/png" ? "design.png" : "design.jpg") };
  }
  const dataUrl = row.data_url ?? "";
  const decoded = decodeDataUrl(dataUrl);
  return {
    bytes: decoded.bytes,
    mime: decoded.mime,
    fileName: row.file_name || (decoded.mime === "image/png" ? "design.png" : "design.jpg"),
  };
}

function decodeDataUrl(dataUrl: string): { bytes: Buffer; mime: string } {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) {
    throw new CommerceError(
      "fourthwall",
      "This media asset has no inline bytes on the desk (it was stored as a URL). Generate or upload it again first.",
    );
  }
  const mime = match[1]!.toLowerCase();
  if (mime !== "image/png" && mime !== "image/jpeg") {
    throw new CommerceError("fourthwall", `Fourthwall accepts PNG or JPG only — got ${mime}.`);
  }
  return { bytes: Buffer.from(match[2]!, "base64"), mime };
}

/** Map Fourthwall's production method onto our print pipeline. Unsupported methods are refused, not guessed. */
function printMethodFor(productionMethod: string): "DTG" | "DTFX" | "SUBLIMATION" | "STICKERS" | "EMBROIDERY" | "SCREEN_PRINT" {
  const m = productionMethod.trim().toUpperCase();
  if (m === "DTG") return "DTG";
  if (m === "DTFX") return "DTFX";
  if (m === "SUBLIMATION") return "SUBLIMATION";
  if (m === "EMBROIDERY") return "EMBROIDERY";
  if (m === "SCREEN_PRINT" || m === "SCREENPRINT") return "SCREEN_PRINT";
  throw new CommerceError(
    "fourthwall",
    `Fourthwall production method "${productionMethod || "unknown"}" doesn't use a standard raster print file. ` +
      "Knitwear, for example, requires a production-ready BMP template that this pipeline does not generate — " +
      "create that product in the Fourthwall designer instead.",
  );
}

export const commerceOverviewFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const store = await import("./store");
    const [connections, products, orders, webhookEvents, checkoutClicks, printExports] = await Promise.all([
      store.listConnections(context.userId),
      store.listProducts(context.userId),
      store.listOrders(context.userId),
      store.listWebhookEvents(context.userId, 25),
      store.listCheckoutClicks(context.userId, 25),
      store.listRecentPrintExports(context.userId, 20),
    ]);
    const webhookConfigured: Record<string, boolean> = {};
    await Promise.all(
      connections.map(async (c) => {
        webhookConfigured[c.id] = await store.hasWebhookSecret(context.userId, c.id);
      }),
    );
    return { connections, products, orders, webhookEvents, checkoutClicks, printExports, webhookConfigured };
  });

export const saveFourthwallConnectionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      connectionId?: string | null;
      label: string;
      /** Blank on update keeps the stored credentials. */
      username?: string;
      password?: string;
      shopDomain?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const store = await import("./store");
    return store.saveConnection(context.userId, {
      connectionId: data.connectionId ?? null,
      provider: "fourthwall",
      label: data.label,
      username: data.username,
      password: data.password,
      shopDomain: data.shopDomain ?? "",
    });
  });

export const testCommerceConnectionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { connectionId: string }) => d)
  .handler(async ({ context, data }) => {
    const store = await import("./store");
    return store.testConnection(context.userId, orgId(data.connectionId));
  });

export const saveFourthwallWebhookSecretFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { connectionId: string; secret: string }) => d)
  .handler(async ({ context, data }) => {
    const store = await import("./store");
    await store.saveWebhookSecret(context.userId, orgId(data.connectionId), data.secret);
    return { ok: true };
  });

export const deleteCommerceConnectionFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { connectionId: string }) => d)
  .handler(async ({ context, data }) => {
    const store = await import("./store");
    await store.deleteConnection(context.userId, orgId(data.connectionId));
    return { ok: true };
  });

export const syncCommerceProductsFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { connectionId: string }) => d)
  .handler(async ({ context, data }) => {
    const store = await import("./store");
    return store.syncProducts(context.userId, orgId(data.connectionId));
  });

export const syncCommerceOrdersFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { connectionId: string }) => d)
  .handler(async ({ context, data }) => {
    const store = await import("./store");
    return store.syncOrders(context.userId, orgId(data.connectionId));
  });

/** Public Fourthwall catalogue — no connection or credentials required. */
export const fourthwallTemplatesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { page?: number }) => d)
  .handler(async ({ data }) => {
    const { fetchProductTemplates } = await import("./fourthwall");
    return fetchProductTemplates(data.page ?? 1);
  });

export const preparePrintAssetFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      mediaAssetId: string;
      method: string;
      printWidthIn: number;
      printHeightIn: number;
      format?: "png" | "jpg";
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const [{ prepareForPrint }, store] = await Promise.all([import("./print-assets"), import("./store")]);
    const source = await loadMediaBytes(context.userId, data.mediaAssetId);
    const result = await prepareForPrint({
      bytes: source.bytes,
      method: data.method as Parameters<typeof prepareForPrint>[0]["method"],
      printWidthIn: Number(data.printWidthIn),
      printHeightIn: Number(data.printHeightIn),
      format: data.format,
    });
    if (!result.bytes || !result.mime) {
      return { report: result.report, exportId: null, dataUrl: null };
    }
    const dataUrl = `data:${result.mime};base64,${result.bytes.toString("base64")}`;
    const exportId = await store.savePrintExport({
      userId: context.userId,
      mediaAssetId: data.mediaAssetId,
      method: result.report.method,
      printWidthIn: result.report.printWidthIn,
      printHeightIn: result.report.printHeightIn,
      dpi: result.report.dpi,
      targetWidthPx: result.report.targetWidth,
      targetHeightPx: result.report.targetHeight,
      sourceWidthPx: result.report.sourceWidth,
      sourceHeightPx: result.report.sourceHeight,
      verdict: result.report.verdict,
      warnings: result.report.warnings,
      dataUrl,
      byteSize: result.bytes.byteLength,
    });
    return { report: result.report, exportId, dataUrl };
  });

export const createFourthwallProductFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      connectionId: string;
      mediaAssetId: string;
      productTemplateId: string;
      productionMethod: string;
      name: string;
      description?: string;
      printWidthIn: number;
      printHeightIn: number;
      region?: string;
      profitMargin?: number;
      publishOnCreate?: boolean;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const [{ FourthwallClient }, { prepareForPrint }, store] = await Promise.all([
      import("./fourthwall"),
      import("./print-assets"),
      import("./store"),
    ]);
    const connectionId = orgId(data.connectionId);
    const found = await store.getConnection(context.userId, connectionId);
    if (!found) throw new CommerceError("fourthwall", "Connection not found.");
    const name = data.name.trim();
    if (!name) throw new CommerceError("fourthwall", "Product name is required.");
    if (!data.productTemplateId.trim()) throw new CommerceError("fourthwall", "Pick a product template.");

    const method = printMethodFor(data.productionMethod);
    const source = await loadMediaBytes(context.userId, data.mediaAssetId);
    const prepared = await prepareForPrint({
      bytes: source.bytes,
      method,
      printWidthIn: Number(data.printWidthIn),
      printHeightIn: Number(data.printHeightIn),
      format: "png",
    });
    if (!prepared.bytes || !prepared.report.outputWidth || !prepared.report.outputHeight) {
      throw new CommerceError(
        "fourthwall",
        `This image is not print-ready for ${method}: ${prepared.report.warnings.join(" ") || "resolution check failed."}`,
      );
    }

    const client = new FourthwallClient(found.creds);
    const created = await client.createDesignProductFromImage({
      bytes: prepared.bytes,
      fileName: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "design"}.png`,
      contentType: "image/png",
      width: prepared.report.outputWidth,
      height: prepared.report.outputHeight,
      productTemplateId: data.productTemplateId.trim(),
      name,
      description: (data.description ?? "").trim(),
      regions: [data.region?.trim() || "front"],
      profitMargin: typeof data.profitMargin === "number" ? data.profitMargin : undefined,
      publishOnCreate: Boolean(data.publishOnCreate),
    });

    await store.recordProductFromCreation({
      userId: context.userId,
      connectionId,
      provider: found.row.provider,
      productId: created.productId,
      name,
      description: (data.description ?? "").trim() || null,
      imageUrl: created.images[0]?.url ?? null,
      sourceMediaId: data.mediaAssetId,
    });

    return {
      productId: created.productId,
      imageId: created.imageId,
      images: created.images,
      printReport: prepared.report,
    };
  });

/** Build (and log) the on-site buy link that hands off to Fourthwall checkout. */
export const buildFourthwallCheckoutLinkFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      connectionId: string;
      variantId: string;
      productName?: string;
      pageId?: string | null;
      tracking?: Record<string, string>;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const [{ buildCheckoutUrl }, store] = await Promise.all([import("./fourthwall"), import("./store")]);
    const connectionId = orgId(data.connectionId);
    const found = await store.getConnection(context.userId, connectionId);
    if (!found) throw new CommerceError("fourthwall", "Connection not found.");
    const shopDomain = found.row.config.shopDomain ?? "";
    const tracking = Object.fromEntries(
      Object.entries(data.tracking ?? {}).filter(([k, v]) => typeof v === "string" && v.trim() && k),
    ) as Parameters<typeof buildCheckoutUrl>[0]["tracking"];
    const url = buildCheckoutUrl({
      shopDomain,
      items: [{ variantId: data.variantId.trim(), quantity: 1 }],
      tracking,
    });
    await store.recordCheckoutClick({
      userId: context.userId,
      connectionId,
      variantId: data.variantId.trim(),
      productName: data.productName ?? null,
      pageId: data.pageId ?? null,
      utm: tracking ?? {},
    });
    return { url };
  });
