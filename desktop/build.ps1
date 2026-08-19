$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

dotnet restore
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

dotnet test PosterPal.Tests -c Release --no-restore
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

dotnet publish PosterPal.UI/PosterPal.UI.csproj -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -p:PublishTrimmed=false `
  -p:EnableCompressionInSingleFile=true `
  -o artifacts/publish

exit $LASTEXITCODE
