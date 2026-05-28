# install-deps.ps1 — v0.5 의존성 자동 설치
#
# Stage 0 healthcheck에서 의존성 부족 시 자동 호출.
# Obsidian(winget) + defuddle(npm) + kepano 5종(git clone) 자동 시도.
#
# 사용:
#   pwsh -File install-deps.ps1 [-Force] [-SkipObsidian] [-SkipKepano] [-SkipDefuddle]
#
# 종료 코드:
#   0 = 모두 설치 성공
#   1 = 일부 실패 (수동 안내로 보강 필요)

param(
    [switch]$Force,
    [switch]$SkipObsidian,
    [switch]$SkipKepano,
    [switch]$SkipDefuddle
)

$ErrorActionPreference = "Continue"
$ok = $true
$installed = @()
$failed = @()

Write-Host "=== claude-wiki-obsidian-vault-코어4 / install-deps v0.5 ===" -ForegroundColor Cyan
Write-Host ""

# ─── 1. Obsidian 1.12.7+ 자동 설치 (winget) ───────────────────────
if (-not $SkipObsidian) {
    Write-Host "[1/3] Obsidian 설치 검사·시도" -ForegroundColor Yellow
    $obsPath = "$env:LOCALAPPDATA\Obsidian"
    $obsExe  = "$obsPath\Obsidian.exe"

    if ((Test-Path $obsExe) -and -not $Force) {
        $ver = (Get-Item $obsExe).VersionInfo.FileVersion
        Write-Host "  ✓ 이미 설치됨 ($ver)" -ForegroundColor Green
        $installed += "Obsidian (skip)"
    } else {
        Write-Host "  Obsidian 설치 시도 (winget Obsidian.Obsidian)..."
        $winget = Get-Command winget -ErrorAction SilentlyContinue
        if (-not $winget) {
            Write-Host "  ✗ winget 명령 없음 — Windows App Installer 필요" -ForegroundColor Red
            Write-Host "    수동: https://obsidian.md/download" -ForegroundColor Cyan
            $failed += "Obsidian (winget 부재)"
            $ok = $false
        } else {
            $wingetOut = winget install Obsidian.Obsidian --silent --accept-package-agreements --accept-source-agreements --disable-interactivity 2>&1
            Start-Sleep -Seconds 3
            if (Test-Path $obsExe) {
                Write-Host "  ✓ Obsidian 설치 성공" -ForegroundColor Green
                Write-Host "  ⚠ PO 액션 필요: Obsidian 실행 → Settings → General → Advanced → Enable CLI 토글 ON" -ForegroundColor Yellow
                $installed += "Obsidian"
            } else {
                Write-Host "  ✗ winget 설치 실패. 수동 설치 안내:" -ForegroundColor Red
                Write-Host "    1. https://obsidian.md/download 에서 다운로드" -ForegroundColor Cyan
                Write-Host "    2. 설치 후 Settings → General → Advanced → Enable CLI" -ForegroundColor Cyan
                $failed += "Obsidian (수동 필요)"
                $ok = $false
            }
        }
    }
}

# ─── 2. defuddle CLI 자동 설치 (npm) ──────────────────────────────
if (-not $SkipDefuddle) {
    Write-Host ""
    Write-Host "[2/3] defuddle CLI 설치 검사·시도" -ForegroundColor Yellow
    $def = Get-Command defuddle -ErrorAction SilentlyContinue
    if ($def -and -not $Force) {
        Write-Host "  ✓ 이미 설치됨: $($def.Source)" -ForegroundColor Green
        $installed += "defuddle (skip)"
    } else {
        $npm = Get-Command npm -ErrorAction SilentlyContinue
        if (-not $npm) {
            Write-Host "  ✗ npm 명령 없음 — Node.js 18+ 필요. https://nodejs.org" -ForegroundColor Red
            $failed += "defuddle (npm 부재)"
            $ok = $false
        } else {
            Write-Host "  npm install -g defuddle 실행..."
            npm install -g defuddle 2>&1 | Select-Object -Last 5
            $def = Get-Command defuddle -ErrorAction SilentlyContinue
            if ($def) {
                Write-Host "  ✓ defuddle 설치 성공: $($def.Source)" -ForegroundColor Green
                $installed += "defuddle"
            } else {
                Write-Host "  ✗ defuddle 설치 실패 — PATH 미반영 또는 권한 문제" -ForegroundColor Red
                $failed += "defuddle"
                $ok = $false
            }
        }
    }
}

# ─── 3. kepano 5종 스킬 자동 설치 (git clone) ─────────────────────
if (-not $SkipKepano) {
    Write-Host ""
    Write-Host "[3/3] kepano 5종 스킬 설치 검사·시도" -ForegroundColor Yellow
    $skillRoot = "$env:USERPROFILE\.claude\skills"
    if (-not (Test-Path $skillRoot)) { New-Item -ItemType Directory $skillRoot -Force | Out-Null }

    $kepano = @("obsidian-markdown", "obsidian-bases", "json-canvas", "obsidian-cli", "defuddle")
    $allPresent = $true
    foreach ($s in $kepano) {
        if (-not (Test-Path "$skillRoot\$s\SKILL.md")) { $allPresent = $false; break }
    }

    if ($allPresent -and -not $Force) {
        Write-Host "  ✓ kepano 5종 모두 설치됨" -ForegroundColor Green
        $installed += "kepano 5종 (skip)"
    } else {
        $git = Get-Command git -ErrorAction SilentlyContinue
        if (-not $git) {
            Write-Host "  ✗ git 명령 없음 — Git for Windows 필요" -ForegroundColor Red
            Write-Host "    또는 Claude Code 슬래시 명령 (PO 직접):" -ForegroundColor Cyan
            Write-Host "      /plugin marketplace add kepano/obsidian-skills" -ForegroundColor Cyan
            Write-Host "      /plugin install obsidian@obsidian-skills" -ForegroundColor Cyan
            $failed += "kepano (git 부재)"
            $ok = $false
        } else {
            $tmp = "$env:TEMP\kepano-obsidian-skills"
            if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
            Write-Host "  git clone https://github.com/kepano/obsidian-skills ..."
            git clone --depth 1 https://github.com/kepano/obsidian-skills $tmp 2>&1 | Select-Object -Last 2

            if (Test-Path $tmp) {
                # 저장소 구조 자동 탐지: 1) 루트에 5 폴더 / 2) skills/<name>/ 형태
                $okCount = 0
                foreach ($s in $kepano) {
                    $candidates = @(
                        (Join-Path $tmp $s),
                        (Join-Path $tmp "skills\$s")
                    )
                    $srcSkill = $candidates | Where-Object { Test-Path "$_\SKILL.md" } | Select-Object -First 1
                    $destSkill = Join-Path $skillRoot $s
                    if ($srcSkill) {
                        if (Test-Path $destSkill) { Remove-Item $destSkill -Recurse -Force -ErrorAction SilentlyContinue }
                        Copy-Item $srcSkill $destSkill -Recurse -Force
                        Write-Host "  ✓ $s 설치" -ForegroundColor Green
                        $okCount++
                    } else {
                        Write-Host "  ✗ $s 폴더 미발견 (저장소 구조 변경 가능성)" -ForegroundColor Red
                    }
                }
                Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
                if ($okCount -eq 5) {
                    $installed += "kepano 5종"
                } else {
                    $failed += "kepano ($okCount/5 설치)"
                    if ($okCount -eq 0) {
                        Write-Host "  대안 — Claude Code 슬래시 명령 (PO 직접):" -ForegroundColor Cyan
                        Write-Host "    /plugin marketplace add kepano/obsidian-skills" -ForegroundColor Cyan
                        Write-Host "    /plugin install obsidian@obsidian-skills" -ForegroundColor Cyan
                    }
                    $ok = $false
                }
            } else {
                Write-Host "  ✗ git clone 실패 — 네트워크 또는 저장소 접근 문제" -ForegroundColor Red
                $failed += "kepano (clone 실패)"
                $ok = $false
            }
        }
    }
}

# ─── 종합 ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== 자동 설치 결과 ===" -ForegroundColor Cyan
if ($installed.Count -gt 0) {
    Write-Host "✓ 설치 성공:" -ForegroundColor Green
    foreach ($i in $installed) { Write-Host "  · $i" -ForegroundColor Green }
}
if ($failed.Count -gt 0) {
    Write-Host "✗ 설치 실패:" -ForegroundColor Red
    foreach ($f in $failed) { Write-Host "  · $f" -ForegroundColor Red }
}

if ($ok) {
    Write-Host ""
    Write-Host "✓ 모든 의존성 설치 완료 — healthcheck.ps1 재실행 권장" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "⚠ 일부 의존성 수동 처리 필요" -ForegroundColor Yellow
    exit 1
}
