$ErrorActionPreference = 'Stop'

$platformDir = Split-Path -Parent $PSScriptRoot
$portableNode = Join-Path $platformDir '.node\node.exe'
$node = if (Test-Path $portableNode) { $portableNode } else { (Get-Command node -ErrorAction Stop).Source }
$script = Join-Path $PSScriptRoot 'measure-manual-capture.mjs'

& $node $script @Args
exit $LASTEXITCODE

