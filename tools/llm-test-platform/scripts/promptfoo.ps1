$ErrorActionPreference = 'Stop'

$portableNode = Join-Path $PSScriptRoot '..\.node\node.exe'
$node = if (Test-Path $portableNode) {
  $portableNode
} else {
  (Get-Command node -ErrorAction Stop).Source
}
$entrypoint = Join-Path $PSScriptRoot '..\node_modules\promptfoo\dist\src\entrypoint.js'
if (!(Test-Path $entrypoint)) {
  throw 'Promptfoo fehlt. Fuehre zuerst bun install in tools/llm-test-platform aus.'
}

& $node $entrypoint @Args
exit $LASTEXITCODE
