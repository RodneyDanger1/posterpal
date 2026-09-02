/**
 * PosterPal Windows shell — no Docker.
 * Starts the desk on 0.0.0.0:8080 (so a phone on Wi‑Fi can reach it) and
 * opens a native window. Graph secrets stay in this process, never in the APK.
 */
import { app, BrowserWindow, Menu, Tray, nativeImage, dialog, shell, clipboard } from "electron";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packaged = app.isPackaged;
const projectRoot = packaged ? process.resourcesPath : join(here, "..");
const PORT = Number(process.env.POSTERPAL_PORT || process.env.PORT || 8080);
const HOST = "0.0.0.0";
const origin = `http://127.0.0.1:${PORT}`;

let child = null;
let win = null;
let tray = null;
let tickTimer = null;

function log(...args) {
  console.log("[posterpal-desktop]", ...args);
}

function lanUrls() {
  const out = [];
  const nets = networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const a of addrs ?? []) {
      const v4 = a.family === "IPv4" || a.family === 4;
      if (!v4 || a.internal) continue;
      out.push(`http://${a.address}:${PORT}`);
    }
  }
  return [...new Set(out)];
}

function ensureMasterKey(userData) {
  if (process.env.POSTERPAL_MASTER_KEY?.trim()) return process.env.POSTERPAL_MASTER_KEY.trim();
  const keyFile = join(userData, "master.key");
  try {
    if (existsSync(keyFile)) {
      const existing = readFileSync(keyFile, "utf8").trim();
      if (existing.length >= 16) return existing;
    }
  } catch {
    /* rewrite below */
  }
  const key = randomBytes(32).toString("hex");
  writeFileSync(keyFile, key, { encoding: "utf8" });
  return key;
}

function deskEnv() {
  const userData = app.getPath("userData");
  mkdirSync(userData, { recursive: true });
  const built = join(projectRoot, ".output", "server", "index.mjs");
  return {
    ...process.env,
    PORT: String(PORT),
    NITRO_PORT: String(PORT),
    NITRO_HOST: HOST,
    HOST,
    LISTEN_HOST: HOST,
    VITE_AUTH_ENABLED: process.env.VITE_AUTH_ENABLED ?? "false",
    POSTERPAL_MASTER_KEY: ensureMasterKey(userData),
    POSTERPAL_DESK: "1",
    PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR || join(userData, "pglite"),
    NODE_ENV: packaged || existsSync(built) ? "production" : process.env.NODE_ENV || "development",
  };
}

function openFirewall() {
  if (process.platform !== "win32") return;
  try {
    spawn(
      "netsh",
      [
        "advfirewall",
        "firewall",
        "add",
        "rule",
        "name=PosterPal desk 8080",
        "dir=in",
        "action=allow",
        "protocol=TCP",
        `localport=${PORT}`,
      ],
      { windowsHide: true, stdio: "ignore" },
    );
  } catch {
    log("could not add firewall rule — run PosterPal.bat as Administrator if the phone cannot connect");
  }
}

function startServer() {
  const env = deskEnv();
  const built = join(projectRoot, ".output", "server", "index.mjs");
  const useBuild = packaged || (existsSync(built) && process.env.POSTERPAL_DEV !== "1");
  if (useBuild && existsSync(built)) {
    log("starting production server", built);
    log("PGLite", env.PGLITE_DATA_DIR);
    child = spawn(process.execPath, [built], {
      cwd: join(projectRoot, ".output"),
      env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: "pipe",
      windowsHide: true,
    });
  } else {
    log("starting npm run dev (source tree)");
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    child = spawn(npm, ["run", "dev"], {
      cwd: join(here, ".."),
      env,
      stdio: "pipe",
      windowsHide: true,
      shell: true,
    });
  }
  child.stdout?.on("data", (b) => process.stdout.write(b));
  child.stderr?.on("data", (b) => process.stderr.write(b));
  child.on("exit", (code, sig) => log("server exited", code, sig));
}

async function waitForDesk(timeoutMs = 180_000) {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${origin}/api/health`, { cache: "no-store" });
      if (res.ok) return;
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Desk did not start on ${origin} within ${timeoutMs}ms (${last}). Is port ${PORT} already in use?`);
}

function iconPath(name) {
  const candidates = [
    join(projectRoot, "public", name),
    join(projectRoot, ".output", "public", name),
    join(here, "..", "public", name),
  ];
  return candidates.find((p) => existsSync(p));
}

function createWindow() {
  const file = iconPath("icon-512.png");
  const icon = file ? nativeImage.createFromPath(file) : undefined;
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: "PosterPal",
    backgroundColor: "#0b1220",
    icon,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  attachWindowOpen(win.webContents);
  win.on("close", (e) => {
    if (app.quitting) return;
    e.preventDefault();
    win.hide();
  });
  return win.loadURL(origin);
}

/** Facebook Login and developer docs belong in the system browser (real cookies, not Electron UA). */
function attachWindowOpen(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      const sameDesk = u.hostname === "127.0.0.1" || u.hostname === "localhost";
      const facebookStart = sameDesk && u.pathname.startsWith("/api/facebook/");
      const externalHttp = u.protocol === "http:" || u.protocol === "https:";
      if (facebookStart || (externalHttp && !sameDesk)) {
        void shell.openExternal(url);
        return { action: "deny" };
      }
    } catch {
      /* allow */
    }
    return { action: "allow" };
  });
}

function phoneHelp() {
  const urls = lanUrls();
  const body =
    urls.length > 0
      ? `Keep this window running. On the phone, open the PosterPal APK and paste:\n\n${urls.join("\n")}\n\nOr in the phone browser go to:\n${urls[0]}/get-app.html\n\nFacebook Login stays on this PC (http://127.0.0.1:${PORT}).`
      : `No Wi‑Fi/Ethernet address yet. Connect the PC to the same network as the phone, then retry.\n\nThis PC is ${origin}`;
  return body;
}

function createTray() {
  const file = iconPath("icon-192.png") || iconPath("icon-512.png");
  const img = file ? nativeImage.createFromPath(file) : nativeImage.createEmpty();
  tray = new Tray(img.resize({ width: 16, height: 16 }));
  tray.setToolTip("PosterPal — desk is running");
  const rebuild = () => {
    const urls = lanUrls();
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Open PosterPal",
          click: () => {
            win?.show();
            win?.focus();
          },
        },
        { label: "Open in browser", click: () => void shell.openExternal(origin) },
        { type: "separator" },
        {
          label: urls[0] ? `Phone URL: ${urls[0]}` : "Phone: no LAN address yet",
          click: () => {
            if (urls[0]) clipboard.writeText(urls[0]);
            dialog.showMessageBox({ type: "info", title: "Phone (same Wi‑Fi)", message: "PosterPal phone", detail: phoneHelp() });
          },
        },
        {
          label: "Copy phone URL",
          enabled: Boolean(urls[0]),
          click: () => {
            if (urls[0]) clipboard.writeText(urls[0]);
          },
        },
        {
          label: "Get-app page (APK download)",
          enabled: Boolean(urls[0]),
          click: () => {
            if (urls[0]) void shell.openExternal(`${urls[0]}/get-app.html`);
          },
        },
        { type: "separator" },
        {
          label: "Quit (stops the phone from reaching this desk)",
          click: () => {
            app.quitting = true;
            app.quit();
          },
        },
      ]),
    );
  };
  rebuild();
  tray.on("click", () => {
    win?.show();
    win?.focus();
  });
  setInterval(rebuild, 30_000);
}

function startBackgroundTick() {
  tickTimer = setInterval(() => {
    void fetch(`${origin}/api/tick`, { method: "POST" }).catch((err) => log("tick failed", err?.message));
  }, 60_000);
  void fetch(`${origin}/api/tick`, { method: "POST" }).catch(() => undefined);
}

function stopAll() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
  if (child && child.pid) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    } else {
      child.kill();
    }
    child = null;
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      win.show();
      win.focus();
    }
  });
  app.on("web-contents-created", (_e, contents) => attachWindowOpen(contents));
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    openFirewall();
    startServer();
    try {
      await waitForDesk();
    } catch (e) {
      dialog.showErrorBox("PosterPal", e instanceof Error ? e.message : String(e));
      app.quitting = true;
      app.quit();
      return;
    }
    createTray();
    await createWindow();
    startBackgroundTick();
  });
  app.on("before-quit", () => {
    app.quitting = true;
    stopAll();
  });
  app.on("window-all-closed", () => {
    /* keep running in tray so the phone still hits :8080 */
  });
}
