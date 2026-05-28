# healthcheck.ps1 — Stage 0 의존성 점검
#
# claude-wiki-obsidian-vault-코어4 스킬 진입 시 호출.
# Obsidian CLI 활성, kepano 5종 설치, defuddle(선택), 대상 vault 상태 확인.
#
# 사용:
#   pwsh -File healthcheck.ps1 -VaultPath "<vault 경로>"
#
# 종료 코드:
#   0 = 모두 OK
#   1 = 필수 의존성 누락 (Obsidian CLI 또는 kepano 5종 부족)
#   2 = vault 경로 오류

param(
    [Parameter(Mandatory=$false)]
    [string]$VaultPath = "",
    [switch]$NoAutoInstall  # v0.5: 자동 설치 비활성화 (기본은 자동 시도)
)

$ErrorActionPreference = "Continue"
$ok = $true
$issues = @()

Write-Host "=== claude-wiki-obsidian-vault-코어4 / healthcheck ===" -ForegroundColor Cyan
Write-Host ""

# 1. Obsidian CLI 활성 검사
Write-Host "[1/4] Obsidian CLI 활성 검사" -ForegroundColor Yellow
$cli = Get-Command obsidian -ErrorAction SilentlyContinue
if ($cli) {
    Write-Host "  ✓ obsidian 명령 발견: $($cli.Source)" -ForegroundColor Green
    # native exe 호출 — 2>&1 redirect는 PS 5.1에서 NativeCommandError를 유발하므로 회피.
    # 대신 exit code($LASTEXITCODE)로 성공/실패 판정. 출력은 사용하지 않으므로 Out-Null.
    & obsidian vault info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ vault info 호출 성공" -ForegroundColor Green
    } else {
        $ok = $false
        $issues += "obsidian CLI 명령은 있으나 vault info 호출 실패(exit=$LASTEXITCODE). CLI 활성화 필요: Settings → General → Advanced → Enable CLI"
    }
} else {
    $ok = $false
    $issues += "obsidian CLI 명령을 찾을 수 없음. Obsidian 1.12.7+ 설치 + Settings → General → Advanced → Enable CLI 활성화 필요"
}

# 2. kepano 5종 스킬 설치 검사
Write-Host ""
Write-Host "[2/4] kepano 5종 스킬 설치 검사" -ForegroundColor Yellow
$skillRoot = "$env:USERPROFILE\.claude\skills"
$kepano = @("obsidian-markdown", "obsidian-bases", "json-canvas", "obsidian-cli", "defuddle")
$missing = @()
foreach ($s in $kepano) {
    $skillPath = Join-Path $skillRoot $s
    $skillMd = Join-Path $skillPath "SKILL.md"
    if (Test-Path $skillMd) {
        Write-Host "  ✓ $s (SKILL.md OK)" -ForegroundColor Green
    } elseif (Test-Path $skillPath) {
        Write-Host "  ⚠ $s (폴더 있으나 SKILL.md 부재 — 손상 의심)" -ForegroundColor Yellow
        $missing += $s
    } else {
        Write-Host "  ✗ $s (없음)" -ForegroundColor Red
        $missing += $s
    }
}
if ($missing.Count -gt 0) {
    $ok = $false
    $issues += "kepano 스킬 누락: $($missing -join ', '). /plugin marketplace add kepano/obsidian-skills 후 /plugin install obsidian@obsidian-skills"
}

# 3. defuddle (선택 — T3 트랙 URL 정제용)
Write-Host ""
Write-Host "[3/4] defuddle CLI (선택)" -ForegroundColor Yellow
$defuddle = Get-Command defuddle -ErrorAction SilentlyContinue
if ($defuddle) {
    Write-Host "  ✓ defuddle 발견: $($defuddle.Source)" -ForegroundColor Green
} else {
    Write-Host "  ⚠ defuddle CLI 미설치 — T3 트랙 URL 정제 시 필요. 설치: npm install -g defuddle" -ForegroundColor Yellow
}

# 4. vault 경로 검사 (지정된 경우)
Write-Host ""
Write-Host "[4/4] vault 상태 검사" -ForegroundColor Yellow
if ($VaultPath -and (Test-Path $VaultPath)) {
    Write-Host "  ✓ vault 경로 존재: $VaultPath" -ForegroundColor Green
    $personaPath = Join-Path $VaultPath "_meta\persona.md"
    if (Test-Path $personaPath) {
        Write-Host "  ✓ _meta/persona.md 존재 — LOAD 모드로 진입" -ForegroundColor Green
        Write-Host "    mode=LOAD" -ForegroundColor Cyan
        # v0.3 신규: vault_role 추출
        $personaContent = Get-Content $personaPath -Raw -Encoding UTF8
        if ($personaContent -match "(?m)^vault_role:\s*(\w+)") {
            $vrole = $matches[1]
            Write-Host "    vault_role=$vrole (persona.md에서 로드)" -ForegroundColor Cyan
            if ($vrole -eq "archive") {
                Write-Host "    ⚠ archive vault — Stage 3 빌드 차단됨 (T1 '저장해'도 차단)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "    ℹ vault_role 미명시 — 디폴트 active로 처리" -ForegroundColor Cyan
        }
        # v0.6.0: track 추출 + T0 → T2 자동 승급 안내
        if ($personaContent -match "(?m)^track:\s*(\w+)") {
            $vtrack = $matches[1]
            Write-Host "    track=$vtrack (persona.md에서 로드)" -ForegroundColor Cyan
            # T0 Tiny면 vault 규모 재측정 → 30+ 노트면 승급 안내
            if ($vtrack -eq "T0_Tiny") {
                $mdNow = (Get-ChildItem -Path $VaultPath -Filter "*.md" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "\\\.obsidian\\" } | Measure-Object).Count
                if ($mdNow -ge 30) {
                    Write-Host ""
                    Write-Host "  ℹ T0 Tiny → T2 승급 추천" -ForegroundColor Yellow
                    Write-Host "    근거: vault가 $mdNow 노트로 성장 (T0 임계 10, 승급 임계 30)" -ForegroundColor Yellow
                    Write-Host "    추가될 파일: _meta/일관성카드.md + dashboard.base (+ lint.base if 100+)" -ForegroundColor Yellow
                    Write-Host "    추가 질문: kind_examples · sensitive · vault_role · 폴더 매핑" -ForegroundColor Yellow
                    Write-Host "    승급 진행: '/claude-wiki-obsidian-vault-코어4 승급' 한 마디" -ForegroundColor Cyan
                }
            }
        } else {
            Write-Host "    ℹ track 미명시 — T2 호환 모드로 처리" -ForegroundColor Cyan
        }
    } else {
        # v0.2: CREATE vs ADOPT 분기 — vault 규모 측정
        # v0.6.0: 자동 트랙 결정 로직 (T0 Tiny / T1 Casual / T2 Structured / T2 Full / T2-A ADOPT)
        $reservedFolders = @('.obsidian', '_meta', 'raw', 'wiki', '캔버스', '_WorkLog', '.git', 'node_modules')
        $userFolders = Get-ChildItem -Path $VaultPath -Directory -ErrorAction SilentlyContinue | Where-Object { $reservedFolders -notcontains $_.Name }
        $folderCount = ($userFolders | Measure-Object).Count
        $mdFiles = Get-ChildItem -Path $VaultPath -Filter "*.md" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "\\\.obsidian\\" }
        $mdCount = ($mdFiles | Measure-Object).Count
        Write-Host "  ℹ _meta/persona.md 부재. vault 규모 측정 중..." -ForegroundColor Cyan
        Write-Host "    사용자 명명 폴더: $folderCount 개 / 마크다운 파일: $mdCount 개" -ForegroundColor Cyan

        # v0.6.0 자동 트랙 결정 (5단계 if/elseif)
        # 분기 기준:
        #   T0 Tiny:        .md < 10  & folders < 1
        #   T1 Casual:      .md 10~30 & folders < 3
        #   T2 Structured:  .md 30~100 & folders < 3
        #   T2 Full:        .md 100~300
        #   T2-A ADOPT:     .md >= 300 OR folders >= 3
        if ($folderCount -lt 1 -and $mdCount -lt 10) {
            Write-Host ""
            Write-Host "  → 자동 트랙: T0 Tiny ✨" -ForegroundColor Green
            Write-Host "    mode=CREATE / track=T0_Tiny" -ForegroundColor Cyan
            Write-Host "    근거: .md $mdCount 개 (< 10) — 풀 슈퍼스킬은 과잉 (소 잡는 칼)" -ForegroundColor Cyan
            Write-Host "    박을 파일: _meta/persona.md 1파일만 (어휘 3종)" -ForegroundColor Cyan
            Write-Host "    셋업 예상: 2분" -ForegroundColor Cyan
            Write-Host "    Stage 1 예정 질문: Q1·Q2·Q3 (3종만) — Q4·Q5·Q6·R1·F1~F6 모두 디폴트" -ForegroundColor Cyan
        } elseif ($mdCount -lt 30 -and $folderCount -lt 3) {
            Write-Host ""
            Write-Host "  → 자동 트랙: T1 Casual" -ForegroundColor Green
            Write-Host "    mode=CREATE / track=T1_Casual" -ForegroundColor Cyan
            Write-Host "    근거: .md $mdCount 개 (10~30) — 일관성카드까지만, dashboard·lint 부담" -ForegroundColor Cyan
            Write-Host "    박을 파일: _meta/persona.md + 일관성카드.md (2파일)" -ForegroundColor Cyan
            Write-Host "    셋업 예상: 5분" -ForegroundColor Cyan
            Write-Host "    Stage 1 예정 질문: Q1~Q5 (어휘 5종) — Q6·R1·F1~F6 디폴트" -ForegroundColor Cyan
        } elseif ($mdCount -lt 100 -and $folderCount -lt 3) {
            Write-Host ""
            Write-Host "  → 자동 트랙: T2 Structured" -ForegroundColor Green
            Write-Host "    mode=CREATE / track=T2_Structured" -ForegroundColor Cyan
            Write-Host "    근거: .md $mdCount 개 (30~100) — dashboard 가치 시작, lint는 아직 부담" -ForegroundColor Cyan
            Write-Host "    박을 파일: _meta/persona.md + 일관성카드.md + dashboard.base (3파일)" -ForegroundColor Cyan
            Write-Host "    셋업 예상: 10분" -ForegroundColor Cyan
            Write-Host "    Stage 1 예정 질문: Q1~Q6 (어휘 5종 + sensitive)" -ForegroundColor Cyan
        } elseif ($mdCount -lt 300 -and $folderCount -lt 3) {
            Write-Host ""
            Write-Host "  → 자동 트랙: T2 Full" -ForegroundColor Green
            Write-Host "    mode=CREATE / track=T2_Full" -ForegroundColor Cyan
            Write-Host "    근거: .md $mdCount 개 (100~300) — 풀 set 가치 발휘" -ForegroundColor Cyan
            Write-Host "    박을 파일: _meta/persona.md + 일관성카드 + dashboard.base + lint.base (4파일)" -ForegroundColor Cyan
            Write-Host "    셋업 예상: 15분" -ForegroundColor Cyan
            Write-Host "    Stage 1 예정 질문: Q1~Q6 (어휘 5종 + sensitive)" -ForegroundColor Cyan
        } else {
            Write-Host ""
            Write-Host "  → 자동 트랙: T2-A ADOPT" -ForegroundColor Yellow
            Write-Host "    mode=ADOPT / track=T2A_Adopt" -ForegroundColor Cyan
            Write-Host "    근거: .md $mdCount 개 또는 폴더 $folderCount 개 — 기존 큰 vault 흡수 필요" -ForegroundColor Cyan
            Write-Host "    박을 파일: _meta/* 4파일 (사용자 콘텐츠 폴더는 미수정)" -ForegroundColor Cyan
            Write-Host "    셋업 예상: 20~30분" -ForegroundColor Cyan
            Write-Host "    Stage 1 예정 질문: Q1~Q6 + R1(vault_role) + F1~F6(폴더 매핑)" -ForegroundColor Cyan
        }
        Write-Host ""
        Write-Host "  사용자 오버라이드:" -ForegroundColor DarkGray
        Write-Host "    다른 트랙 원하면 SKILL 진입 시 명시. 예: '/claude-wiki-obsidian-vault-코어4 T2 강제'" -ForegroundColor DarkGray
    }
    $consistencyPath = Join-Path $VaultPath "_meta\일관성카드.md"
    if (-not (Test-Path $consistencyPath)) {
        Write-Host "  ℹ _meta/일관성카드.md 부재 — Stage 2에서 시딩 필요" -ForegroundColor Cyan
    }
} elseif ($VaultPath) {
    Write-Host "  ✗ vault 경로 존재하지 않음: $VaultPath" -ForegroundColor Red
    exit 2
} else {
    Write-Host "  ℹ vault 경로 미지정 — Stage 1에서 사용자에게 질문" -ForegroundColor Cyan
}

# 종합
Write-Host ""
Write-Host "=== 종합 ===" -ForegroundColor Cyan
if ($ok) {
    Write-Host "✓ healthcheck 통과 — 스킬 진입 가능" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ healthcheck 실패 — 다음 이슈 발견:" -ForegroundColor Red
    foreach ($i in $issues) {
        Write-Host "  · $i" -ForegroundColor Red
    }

    # v0.5.1: 자동 설치 시도 (L-1 옵션 전달 + L-2 자기 재호출)
    if (-not $NoAutoInstall) {
        Write-Host ""
        Write-Host "=== v0.5.1 자동 설치 시도 ===" -ForegroundColor Cyan
        $installScript = Join-Path $PSScriptRoot "install-deps.ps1"
        if (Test-Path $installScript) {
            # L-1: 이미 설치된 의존성은 -Skip 전달 (이미 위에서 $cli, $missing, $defuddle 측정됨)
            $installArgs = @()
            if ($missing.Count -eq 0) { $installArgs += '-SkipKepano' }
            if ($defuddle) { $installArgs += '-SkipDefuddle' }
            # Obsidian은 vault info 실패해도 Enable CLI 자동 박기 단계 필요 → SkipObsidian 안 줌

            Write-Host "install-deps.ps1 호출 (옵션: $($installArgs -join ' '))" -ForegroundColor Cyan
            & $installScript @installArgs
            $installExit = $LASTEXITCODE
            Write-Host ""
            if ($installExit -eq 0) {
                # L-2: 자동 설치 성공 → healthcheck 자기 재호출 (-NoAutoInstall로 무한 재귀 방지)
                Write-Host "✓ 자동 설치 완료 — healthcheck 자기 재호출 (L-2)" -ForegroundColor Green
                Write-Host ""
                & $MyInvocation.MyCommand.Path -VaultPath $VaultPath -NoAutoInstall
                exit $LASTEXITCODE
            } else {
                Write-Host "⚠ 자동 설치 일부 실패 — 위 안내대로 수동 처리 후 재실행" -ForegroundColor Yellow
                exit 1
            }
        } else {
            Write-Host "✗ install-deps.ps1 부재 — 수동 설치 필요" -ForegroundColor Red
            exit 1
        }
    }
    exit 1
}
