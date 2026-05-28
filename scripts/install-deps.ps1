# install-deps.ps1 — v0.5.1 의존성 자동 설치
#
# Stage 0 healthcheck에서 의존성 부족 시 자동 호출.
# Obsidian(winget+config) + defuddle/obsidian-cli/codex(npm) + kepano 5종(git clone) 자동 시도.
#
# 사용:
#   pwsh -File install-deps.ps1 [-Force] [-SkipObsidian] [-SkipObsidianCli] [-SkipKepano] [-SkipDefuddle] [-SkipCodex]
#
# 종료 코드:
#   0 = 모두 설치 성공
#   1 = 일부 실패 (수동 안내로 보강 필요)

param(
    [switch]$Force,
    [switch]$SkipObsidian,
    [switch]$SkipObsidianCli,  # v0.5.1 신규
    [switch]$SkipKepano,
    [switch]$SkipDefuddle,
    [switch]$SkipCodex          # v0.5.1 신규
)

$ErrorActionPreference = "Continue"
$ok = $true
$installed = @()
$failed = @()
$kepanoFreshInstalled = $false  # M-1 안내 트리거용

Write-Host "=== claude-wiki-obsidian-vault-코어4 / install-deps v0.5.1 ===" -ForegroundColor Cyan
Write-Host ""

# ─── 1. Obsidian 1.12.7+ 자동 설치 (winget) + Enable CLI 자동 박기 ───
if (-not $SkipObsidian) {
    Write-Host "[1/5] Obsidian 설치·CLI 활성 검사·시도" -ForegroundColor Yellow

    # v0.5.1 보강: 실제 설치 경로 다중 검색 (LOCALAPPDATA\Obsidian, LOCALAPPDATA\Programs\Obsidian)
    $obsCandidates = @(
        "$env:LOCALAPPDATA\Obsidian\Obsidian.exe",
        "$env:LOCALAPPDATA\Programs\Obsidian\Obsidian.exe",
        "C:\Program Files\Obsidian\Obsidian.exe"
    )
    $obsExe = $obsCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($obsExe -and -not $Force) {
        $ver = (Get-Item $obsExe).VersionInfo.FileVersion
        Write-Host "  ✓ 이미 설치됨 ($ver) at $obsExe" -ForegroundColor Green
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
            winget install Obsidian.Obsidian --silent --accept-package-agreements --accept-source-agreements --disable-interactivity | Out-Null
            Start-Sleep -Seconds 3
            $obsExe = $obsCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
            if ($obsExe) {
                Write-Host "  ✓ Obsidian 설치 성공: $obsExe" -ForegroundColor Green
                $installed += "Obsidian"
            } else {
                Write-Host "  ✗ winget 설치 실패. 수동: https://obsidian.md/download" -ForegroundColor Red
                $failed += "Obsidian (수동 필요)"
                $ok = $false
            }
        }
    }

    # M-2: Obsidian "Enable CLI" 토글 자동 박기 (obsidian.json 편집)
    if ($obsExe) {
        Write-Host "  → Enable CLI 토글 자동 확인·박기 (obsidian.json 편집)" -ForegroundColor Cyan
        $obsJson = "$env:APPDATA\obsidian\obsidian.json"
        if (Test-Path $obsJson) {
            $cfgText = Get-Content $obsJson -Raw -Encoding utf8
            if ($cfgText -match '"cli"\s*:\s*true') {
                Write-Host "  ✓ Enable CLI 이미 활성" -ForegroundColor Green
            } else {
                # cli 키 박기 (없으면 추가, false면 true로)
                if ($cfgText -match '"cli"\s*:\s*false') {
                    $cfgText = $cfgText -replace '"cli"\s*:\s*false', '"cli":true'
                } else {
                    # 끝 } 직전에 ,"cli":true 박기
                    $cfgText = $cfgText -replace '\}\s*$', ',"cli":true}'
                }
                [System.IO.File]::WriteAllText($obsJson, $cfgText, [System.Text.UTF8Encoding]::new($false))
                Write-Host "  ✓ Enable CLI 자동 활성 (obsidian.json 편집 완료, 재시작 시 반영)" -ForegroundColor Green
                $installed += "Obsidian Enable CLI"
            }
        } else {
            Write-Host "  ⚠ $obsJson 부재 — Obsidian 1회 실행 후 재시도" -ForegroundColor Yellow
        }
    }
}

# ─── 2. defuddle CLI 자동 설치 (npm) ──────────────────────────────
if (-not $SkipDefuddle) {
    Write-Host ""
    Write-Host "[2/5] defuddle CLI 설치 검사·시도" -ForegroundColor Yellow
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
            npm install -g defuddle 2>&1 | Select-Object -Last 3 | Out-Null
            $def = Get-Command defuddle -ErrorAction SilentlyContinue
            if ($def) {
                Write-Host "  ✓ defuddle 설치 성공: $($def.Source)" -ForegroundColor Green
                $installed += "defuddle"
            } else {
                Write-Host "  ✗ defuddle 설치 실패" -ForegroundColor Red
                $failed += "defuddle"
                $ok = $false
            }
        }
    }
}

# ─── 3. obsidian-cli npm (v0.5.1 H-1 신규) ───────────────────────
if (-not $SkipObsidianCli) {
    Write-Host ""
    Write-Host "[3/5] obsidian-cli (npm) 설치 검사·시도" -ForegroundColor Yellow
    $ocli = Get-Command obsidian-cli -ErrorAction SilentlyContinue
    if ($ocli -and -not $Force) {
        Write-Host "  ✓ 이미 설치됨: $($ocli.Source)" -ForegroundColor Green
        $installed += "obsidian-cli (skip)"
    } else {
        npm install -g obsidian-cli 2>&1 | Select-Object -Last 3 | Out-Null
        $ocli = Get-Command obsidian-cli -ErrorAction SilentlyContinue
        if ($ocli) {
            Write-Host "  ✓ obsidian-cli 설치 성공: $($ocli.Source)" -ForegroundColor Green
            $installed += "obsidian-cli"
        } else {
            Write-Host "  ⚠ obsidian-cli npm 설치 실패 — kepano obsidian-cli 스킬만으로도 동작 가능" -ForegroundColor Yellow
            # 실패해도 fatal 아님 (kepano obsidian-cli 스킬이 대체)
        }
    }
}

# ─── 4. codex npm (v0.5.1 H-2 신규) ──────────────────────────────
if (-not $SkipCodex) {
    Write-Host ""
    Write-Host "[4/5] codex (npm @openai/codex) 설치 검사·시도" -ForegroundColor Yellow
    $codex = Get-Command codex -ErrorAction SilentlyContinue
    if ($codex -and -not $Force) {
        Write-Host "  ✓ 이미 설치됨: $($codex.Source)" -ForegroundColor Green
        $installed += "codex (skip)"
    } else {
        npm install -g `@openai/codex 2>&1 | Select-Object -Last 3 | Out-Null
        $codex = Get-Command codex -ErrorAction SilentlyContinue
        if ($codex) {
            Write-Host "  ✓ codex 설치 성공: $($codex.Source)" -ForegroundColor Green
            $installed += "codex"
        } else {
            Write-Host "  ⚠ codex 설치 실패 — 선택 의존성이므로 fatal 아님" -ForegroundColor Yellow
        }
    }
}

# ─── 5. kepano 5종 스킬 자동 설치 (git clone) ─────────────────────
if (-not $SkipKepano) {
    Write-Host ""
    Write-Host "[5/5] kepano 5종 스킬 설치 검사·시도" -ForegroundColor Yellow
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
            git clone --depth 1 https://github.com/kepano/obsidian-skills $tmp 2>&1 | Select-Object -Last 2 | Out-Null

            if (Test-Path $tmp) {
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
                        Write-Host "  ✗ $s 폴더 미발견" -ForegroundColor Red
                    }
                }
                Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
                if ($okCount -eq 5) {
                    $installed += "kepano 5종"
                    $script:kepanoFreshInstalled = $true
                } else {
                    $failed += "kepano ($okCount/5 설치)"
                    $ok = $false
                }
            } else {
                Write-Host "  ✗ git clone 실패" -ForegroundColor Red
                $failed += "kepano (clone 실패)"
                $ok = $false
            }
        }
    }
}

# ─── 종합 ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== 자동 설치 결과 (v0.5.1) ===" -ForegroundColor Cyan
if ($installed.Count -gt 0) {
    Write-Host "✓ 설치 성공:" -ForegroundColor Green
    foreach ($i in $installed) { Write-Host "  · $i" -ForegroundColor Green }
}
if ($failed.Count -gt 0) {
    Write-Host "✗ 설치 실패:" -ForegroundColor Red
    foreach ($f in $failed) { Write-Host "  · $f" -ForegroundColor Red }
}

# M-1: kepano 신규 설치 시 Claude Code 재시작 안내
if ($script:kepanoFreshInstalled) {
    Write-Host ""
    Write-Host "⚠ kepano 5종 신규 설치됨 — Claude Code 재시작 권장" -ForegroundColor Yellow
    Write-Host "  새 스킬이 사용 가능한 도구 목록에 인식되려면 Claude Code 재시작 필요" -ForegroundColor Cyan
}

if ($ok) {
    Write-Host ""
    Write-Host "✓ 모든 의존성 설치 완료" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "⚠ 일부 의존성 수동 처리 필요" -ForegroundColor Yellow
    exit 1
}
