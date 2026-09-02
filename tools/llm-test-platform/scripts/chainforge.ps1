$ErrorActionPreference = 'Stop'

$chainforge = Join-Path $PSScriptRoot '..\.venv-chainforge\Scripts\chainforge.exe'

if (!(Test-Path $chainforge)) {
  throw 'ChainForge fehlt. Installiere die Eval-Umgebung mit uv erneut.'
}

& $chainforge @Args
exit $LASTEXITCODE
