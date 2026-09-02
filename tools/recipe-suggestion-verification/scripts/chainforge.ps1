$ErrorActionPreference = 'Stop'

$verificationDir = Split-Path -Parent $PSScriptRoot
$defaultChainforge = Join-Path $verificationDir '.venv\Scripts\chainforge.exe'
$chainforge = if ($env:FAM_CHAINFORGE_BIN) {
  $env:FAM_CHAINFORGE_BIN
} else {
  $defaultChainforge
}

if (!(Test-Path -LiteralPath $chainforge)) {
  throw 'ChainForge fehlt. Installiere ChainForge in recipe-suggestion-verification\.venv oder setze FAM_CHAINFORGE_BIN auf den Launcher.'
}

& $chainforge @Args
exit $LASTEXITCODE
