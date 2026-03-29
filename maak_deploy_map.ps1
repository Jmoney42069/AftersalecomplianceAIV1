$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = "$env:USERPROFILE\Desktop\Voltera_Deploy"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
$excludeDirs = @(".venv",".git","__pycache__","recordings","transcripts","uploads","node_modules",".next","pending_uploads")
$excludeFiles = @("*.log","*.pyc","maak_deploy_map.ps1","test_upload.py","agent_installer.zip")
function Copy-Clean($From,$To) {
    New-Item -ItemType Directory -Path $To -Force | Out-Null
    Get-ChildItem -Path $From | ForEach-Object {
        if ($_.PSIsContainer) {
            if ($excludeDirs -contains $_.Name) { return }
            Copy-Clean $_.FullName (Join-Path $To $_.Name)
        } else {
            $skip = $false
            foreach ($p in $excludeFiles) { if ($_.Name -like $p) { $skip = $true } }
            if (-not $skip) { Copy-Item $_.FullName (Join-Path $To $_.Name) }
        }
    }
}
Copy-Clean $src $dest
@("recordings","transcripts","uploads\pending","uploads\processing","uploads\done","uploads\failed") | ForEach-Object { New-Item -ItemType Directory -Path "$dest\$_" -Force | Out-Null }
$env_src = Join-Path $src ".env"
if (Test-Path $env_src) { Copy-Item $env_src "$dest\.env"; Write-Host "[OK] .env gekopieerd" } else { Copy-Item "$src\.env.example" "$dest\.env"; Write-Host "[!] Vul .env in met API keys!" }
Write-Host "Deploy map klaar: $dest"
