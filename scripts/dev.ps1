param([int]$Port = 3000)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDirectory
$packageCommand = Get-Command pnpm.cmd,pnpm -ErrorAction SilentlyContinue | Select-Object -First 1
if ($packageCommand) {
  & $packageCommand.Source dev --port $Port
  exit $LASTEXITCODE
}
$bundledPnpm = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm.cmd'
if (Test-Path -LiteralPath $bundledPnpm) {
  & $bundledPnpm dev --port $Port
  exit $LASTEXITCODE
}
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($npmCommand) {
  & $npmCommand.Source run dev -- --port $Port
  exit $LASTEXITCODE
}
throw 'Install Node.js 22+ and pnpm, then run pnpm install and pnpm dev.'
