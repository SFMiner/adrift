# pwsh tools/package.ps1
# Builds dist/adrift.zip for itch.io: the game's own files and nothing else (no docs, tests or tools).
# Upload the zip as an HTML game and tick "This file will be played in the browser".
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist 'adrift'
$zip = Join-Path $dist 'adrift.zip'

if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
if (Test-Path $zip) { Remove-Item -Force $zip }
New-Item -ItemType Directory -Force $stage | Out-Null

Copy-Item (Join-Path $root 'index.html') $stage
foreach ($dir in 'css', 'js') {
	Copy-Item -Recurse (Join-Path $root $dir) (Join-Path $stage $dir)
}
New-Item -ItemType Directory -Force (Join-Path $stage 'data') | Out-Null
Copy-Item (Join-Path $root 'data/fragments.json') (Join-Path $stage 'data')
New-Item -ItemType Directory -Force (Join-Path $stage 'assets') | Out-Null
foreach ($dir in 'fonts', 'symbols') {
	Copy-Item -Recurse (Join-Path $root "assets/$dir") (Join-Path $stage "assets/$dir")
}
# Recorded echo samples, if any have been added.
$audio = Join-Path $root 'assets/audio'
if ((Test-Path $audio) -and (Get-ChildItem $audio -File -Recurse)) {
	Copy-Item -Recurse $audio (Join-Path $stage 'assets/audio')
}

Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
$files = (Get-ChildItem -Recurse -File $stage).Count
$kb = [math]::Round((Get-Item $zip).Length / 1KB)
Write-Output "dist/adrift.zip: $files files, $kb KB"
