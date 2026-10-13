$ErrorActionPreference = 'Stop'

Set-Location -Path $PSScriptRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm was not found. Install Node.js and npm, then run this script again.'
}

if (-not (Test-Path -Path (Join-Path $PSScriptRoot 'node_modules'))) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

npm run dev
exit $LASTEXITCODE