# postsetup_refresh.ps1 — vault 새로고침 헬퍼
#
# Stage 2(시딩) 또는 Stage 3C(2차 적용) 완료 후 호출.
# Obsidian이 변경된 파일을 즉시 인식하도록 vault reload.
#
# 사용:
#   pwsh -File postsetup_refresh.ps1 -VaultName "<vault 이름>"
#   또는
#   pwsh -File postsetup_refresh.ps1 -VaultPath "<vault 경로>"

param(
    [Parameter(Mandatory=$false)]
    [string]$VaultName = "",
    [Parameter(Mandatory=$false)]
    [string]$VaultPath = ""
)

$ErrorActionPreference = "Continue"

Write-Host "=== vault 새로고침 ===" -ForegroundColor Cyan

# vault 식별: 이름 우선, 그 다음 경로 (Obsidian CLI는 --vault <name> 플래그 사용)
$targetVault = ""
if ($VaultName) {
    $targetVault = $VaultName
    Write-Host "대상 vault: $VaultName (이름 기반)" -ForegroundColor Yellow
} elseif ($VaultPath -and (Test-Path $VaultPath)) {
    # Obsidian CLI는 이름 기반 식별이 안정적. 경로로 vault 이름 추정.
    $targetVault = Split-Path -Leaf $VaultPath
    Write-Host "대상 vault: $targetVault (경로 → 이름 추정: $VaultPath)" -ForegroundColor Yellow
} else {
    Write-Host "ℹ vault 미지정 — 현재 active vault 새로고침" -ForegroundColor Cyan
}

# 1. Obsidian command 실행 — app:reload (vault reload)
# native exe에 2>&1 redirect는 PS 5.1에서 NativeCommandError 유발 → 2>$null 사용.
# try/catch는 native 명령에 대해 동작하지 않으므로 $LASTEXITCODE로 판정.
Write-Host ""
Write-Host "[1/1] Obsidian vault reload (app:reload)" -ForegroundColor Yellow
if ($targetVault) {
    & obsidian command "app:reload" --vault $targetVault 2>$null | Out-Null
} else {
    & obsidian command "app:reload" 2>$null | Out-Null
}
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ app:reload 명령 발행 성공" -ForegroundColor Green
} else {
    Write-Host "  ⚠ app:reload 실패(exit=$LASTEXITCODE) — 수동으로 F5 또는 Ctrl+R 권장" -ForegroundColor Yellow
}

# 2. 후속 안내 (액션 없음, 단순 안내)
Write-Host ""
Write-Host "[안내] 그래프뷰·Bases·Dataview 재계산" -ForegroundColor Yellow
Write-Host "  ℹ 그래프뷰가 열려 있으면 자동 갱신됨. 닫혀 있으면 Ctrl+G로 열기." -ForegroundColor Cyan
Write-Host "  ℹ _meta/*.base 또는 dataview 쿼리는 vault reload 시 자동 재계산." -ForegroundColor Cyan
Write-Host "  ℹ 즉시 보강 필요시 Obsidian 창에서 Ctrl+R로 강제 reload." -ForegroundColor Cyan

Write-Host ""
Write-Host "✓ vault 새로고침 완료. Obsidian 창에서 F5로 한 번 더 강제 갱신 권장." -ForegroundColor Green
