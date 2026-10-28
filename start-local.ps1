$ErrorActionPreference = 'Stop'
$auctionRoot = $PSScriptRoot
$auctionNode = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $auctionNode) { $auctionNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
function Test-AuctionPort($port) {
    $connection = New-Object System.Net.Sockets.TcpClient
    try { $connection.Connect('127.0.0.1', $port); return $true } catch { return $false } finally { $connection.Dispose() }
}
if (-not (Test-AuctionPort 4001)) {
    $backend = Join-Path $auctionRoot 'server'
    $started = Start-Process -FilePath $auctionNode -ArgumentList 'local/start.js' -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput (Join-Path $backend 'local-server.log') -RedirectStandardError (Join-Path $backend 'local-server-error.log') -PassThru
    $started.Id | Set-Content (Join-Path $backend 'local-server.pid')
}
if (-not (Test-AuctionPort 5173)) {
    $frontend = Join-Path $auctionRoot 'client'
    $started = Start-Process -FilePath $auctionNode -ArgumentList 'node_modules/vite/bin/vite.js','preview','--configLoader','runner','--host','127.0.0.1','--port','5173','--strictPort' -WorkingDirectory $frontend -WindowStyle Hidden -RedirectStandardOutput (Join-Path $frontend 'local-client.log') -RedirectStandardError (Join-Path $frontend 'local-client-error.log') -PassThru
    $started.Id | Set-Content (Join-Path $frontend 'local-client.pid')
}
Write-Host 'Auction website: http://localhost:5173'
Write-Host 'Demo accounts and setup notes: LOCAL-SETUP.md'
