/**
 * GET/HEAD /api/apk — stream PosterPal.apk from disk.
 * Lives in Nitro middleware (not a React route) so the client bundle never
 * touches node:fs.
 */
interface ApkEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

export default async function apkMiddleware(
  event: ApkEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  if (event.url.pathname !== "/api/apk") return next();
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return next();

  const { existsSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const extras = typeof process !== "undefined" && "resourcesPath" in process ? String(process.resourcesPath) : "";
  const cwd = process.cwd();
  const candidates = [
    extras ? join(extras, "apk", "PosterPal.apk") : "",
    join(cwd, "apk", "PosterPal.apk"),
    join(cwd, "release", "PosterPal.apk"),
    join(cwd, "..", "release", "PosterPal.apk"),
    join(cwd, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
    join(cwd, "..", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
  ].filter(Boolean);
  const path = candidates.find((p) => existsSync(p));
  if (!path) {
    if (method === "HEAD") return new Response(null, { status: 404 });
    return Response.json({ error: "APK is not on this PC yet. On Windows run: npm run mobile:apk" }, { status: 404 });
  }
  const buf = readFileSync(path);
  const headers: Record<string, string> = {
    "content-type": "application/vnd.android.package-archive",
    "content-length": String(buf.byteLength),
    "content-disposition": 'attachment; filename="PosterPal.apk"',
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  };
  if (method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(buf, { status: 200, headers });
}
