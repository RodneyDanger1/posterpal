# PosterPal for Windows

The product you run is the **Electron desk** at the repo root — not this folder.

| What | Where |
| --- | --- |
| Windows app | Double-click `PosterPal.bat`, or `npm run desktop`, or the portable EXE from `npm run desktop:build` (`release/PosterPal-1.0.0.exe`) |
| Data | `%APPDATA%\PosterPal\pglite` (PGLite) and `master.key` |
| Phone | Same Wi‑Fi. APK is a WebView of `http://<pc-lan-ip>:8080`. Facebook Login stays on the PC. |

This `desktop/` folder is a **.NET 9 class library** (`PosterPal.Core`) with HMAC `appsecret_proof` and Jaccard tests. There is no WPF UI. `build.ps1` does not produce `PosterPal.exe`.

Facebook Redirect URI for the real Windows app:

`http://127.0.0.1:8080/api/facebook/callback`
