$ErrorActionPreference = 'Stop'

$verificationDir = Split-Path -Parent $PSScriptRoot
$localPython = Join-Path $verificationDir '.venv\Scripts\python.exe'

if ($env:FAM_CHAINFORGE_BIN) {
  if (!(Test-Path -LiteralPath $env:FAM_CHAINFORGE_BIN)) {
    throw 'FAM_CHAINFORGE_BIN verweist auf keinen vorhandenen Launcher.'
  }

  & $env:FAM_CHAINFORGE_BIN @Args
  exit $LASTEXITCODE
}

if (!(Test-Path -LiteralPath $localPython)) {
  throw 'ChainForge fehlt. Installiere ChainForge in recipe-suggestion-verification\.venv oder setze FAM_CHAINFORGE_BIN auf einen Launcher.'
}

# Windows-Console-Launcher enthalten den absoluten Pfad ihrer ursprünglichen
# venv. Der direkte Python-Einstieg bleibt auch nach dem Verschieben portabel.
& $localPython -c 'from chainforge import main; main()' @Args
exit $LASTEXITCODE
