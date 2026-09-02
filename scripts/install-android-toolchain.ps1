# Install OpenJDK 17 + Android command-line tools (no Android Studio, no Docker).
$ErrorActionPreference = "Stop"

$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$cmd = Join-Path $sdk "cmdline-tools\latest"
New-Item -ItemType Directory -Force -Path $sdk | Out-Null

Write-Host "Installing Microsoft OpenJDK 17…"
winget install --id Microsoft.OpenJDK.17 -e --accept-package-agreements --accept-source-agreements --disable-interactivity

$javaHome = Get-ChildItem "C:\Program Files\Microsoft" -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like "jdk-17*" } |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $javaHome) {
  $javaHome = Get-ChildItem "C:\Program Files\Microsoft" -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "jdk-*" } |
    Select-Object -First 1 -ExpandProperty FullName
}
if ($javaHome) {
  $env:JAVA_HOME = $javaHome
  Write-Host "JAVA_HOME=$javaHome"
}

$zip = Join-Path $env:TEMP "android-cmdline-tools.zip"
if (-not (Test-Path (Join-Path $cmd "bin\sdkmanager.bat"))) {
  Write-Host "Downloading Android command-line tools…"
  Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" -OutFile $zip
  $extract = Join-Path $env:TEMP "android-cmdline-tools"
  if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $extract -Force
  New-Item -ItemType Directory -Force -Path $cmd | Out-Null
  $inner = Get-ChildItem $extract -Directory | Select-Object -First 1
  Copy-Item -Path (Join-Path $inner.FullName "*") -Destination $cmd -Recurse -Force
}

$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$sdkmanager = Join-Path $cmd "bin\sdkmanager.bat"
Write-Host "Installing Android SDK packages…"
$packages = @(
  "platform-tools",
  "platforms;android-34",
  "build-tools;34.0.0"
)
$yes = "y`ny`ny`ny`ny`ny`ny`ny`ny`ny`n"
$yes | & $sdkmanager --sdk_root=$sdk --licenses
& $sdkmanager --sdk_root=$sdk $packages

Write-Host "SDK ready at $sdk"
Write-Host "Set these for this machine:"
Write-Host "  JAVA_HOME=$env:JAVA_HOME"
Write-Host "  ANDROID_HOME=$sdk"
