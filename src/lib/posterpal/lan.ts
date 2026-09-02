import { networkInterfaces } from "node:os";

export function deskPort(): number {
  const n = Number(process.env.PORT || process.env.NITRO_PORT || 8080);
  return Number.isFinite(n) && n > 0 ? n : 8080;
}

export function listLanOrigins(port = deskPort()): string[] {
  const out: string[] = [];
  const nets = networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const a of addrs ?? []) {
      const v4 = String(a.family) === "IPv4" || Number(a.family) === 4;
      if (!v4 || a.internal) continue;
      out.push(`http://${a.address}:${port}`);
    }
  }
  return [...new Set(out)];
}

export function isLoopbackOrPrivateIp(ip: string): boolean {
  const v = ip.replace("::ffff:", "").trim();
  if (v === "127.0.0.1" || v === "::1" || v === "localhost") return true;
  if (v.startsWith("10.")) return true;
  if (v.startsWith("192.168.")) return true;
  if (v.startsWith("169.254.")) return true;
  const m = /^172\.(\d+)\./.exec(v);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

export function clientIp(request: Request): string {
  // Do NOT trust X-Forwarded-For here — a tunneled public client could spoof
  // 127.0.0.1 and hit local-only routes. Host / URL hostname is the listener
  // the caller actually used (127.0.0.1, LAN IP, or a public name).
  const host = request.headers.get("host")?.split(",")[0]?.trim() || "";
  const hostname = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  if (hostname) return hostname;
  return new URL(request.url).hostname;
}

export function isLocalTickCaller(request: Request): boolean {
  const ip = clientIp(request);
  return isLoopbackOrPrivateIp(ip);
}
