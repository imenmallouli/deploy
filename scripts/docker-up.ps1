$ErrorActionPreference = 'Stop'

$dockerDesktopExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

function Test-DockerReady {
    docker info *> $null
    return ($LASTEXITCODE -eq 0)
}

if (-not (Test-DockerReady)) {
    if (-not (Test-Path $dockerDesktopExe)) {
        throw "Docker Desktop introuvable: $dockerDesktopExe"
    }

    Write-Host "Docker daemon indisponible. Démarrage de Docker Desktop..."
    Start-Process $dockerDesktopExe

    $ready = $false
    for ($i = 0; $i -lt 90; $i++) {
        Start-Sleep -Seconds 2
        if (Test-DockerReady) {
            $ready = $true
            break
        }
    }

    if (-not $ready) {
        throw "Docker daemon non prêt après 180 secondes."
    }
}

Set-Location (Split-Path -Parent $PSScriptRoot)
docker compose up -d --build
docker compose ps

Write-Host "Backend Docker démarré avec succès."
