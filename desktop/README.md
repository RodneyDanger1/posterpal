# PosterPal for Windows (WPF / .NET 9)

This folder is the **Windows 10/11 x64** desktop source. It cannot be compiled in the Linux environment that hosts the live PosterPal web desk — compile it on a Windows machine with the .NET 9 SDK.

The live product you are using is the web PosterPal (same Graph v26.0 rules, same composer/inbox/calendar). This solution is the native shell specified for DPAPI, SQLite under `%AppData%\PosterPal`, and a self-contained `win-x64` exe.

```powershell
.\build.ps1
```

Outputs `artifacts/publish\PosterPal.exe` (PublishSingleFile, self-contained, no trim / no AOT).

See the root [SETUP.md](../SETUP.md) for Facebook App configuration. Loopback redirect is **exactly** `http://127.0.0.1:55443/callback/` — if that port is in use, the app shows an actionable error and does not pick a random port.
