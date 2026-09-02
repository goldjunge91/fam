$ErrorActionPreference = 'Stop'

$verificationDir = Split-Path -Parent $PSScriptRoot
$portableNode = Join-Path $verificationDir '.node\node.exe'
$node = if ($env:FAM_NODE_BIN) {
  $env:FAM_NODE_BIN
} elseif (Test-Path -LiteralPath $portableNode) {
  $portableNode
} else {
  (Get-Command node -ErrorAction Stop).Source
}

$entrypoint = Join-Path $verificationDir 'node_modules\promptfoo\dist\src\entrypoint.js'
if (!(Test-Path -LiteralPath $entrypoint)) {
  throw 'Promptfoo fehlt. Fuehre zuerst bun install in tools/recipe-suggestion-verification aus.'
}
if (!(Test-Path -LiteralPath $node)) {
  throw 'Node.js 22.22+ fehlt. Lege eine portable Runtime unter tools/recipe-suggestion-verification/.node ab oder setze FAM_NODE_BIN.'
}

if (!$env:PROMPTFOO_CONFIG_DIR) {
  $env:PROMPTFOO_CONFIG_DIR = Join-Path $verificationDir '.promptfoo'
}
if (!$env:PROMPTFOO_DISABLE_WAL_MODE) {
  $env:PROMPTFOO_DISABLE_WAL_MODE = 'true'
}
$preload = Join-Path $verificationDir 'scripts\promptfoo-node-preload.cjs'
$env:NODE_OPTIONS = "--require=$preload $env:NODE_OPTIONS".Trim()

$exitCode = 1
Push-Location $verificationDir
try {
  & $node $entrypoint @Args
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
exit $exitCode
