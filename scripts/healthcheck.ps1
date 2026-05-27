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
    [string]$VaultPath = ""
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
    } else {
        # v0.2 신규: CREATE vs ADOPT 분기 — vault 규모 측정
        $reservedFolders = @('.obsidian', '_meta', 'raw', 'wiki', '캔버스', '_WorkLog', '.git', 'node_modules')
        $userFolders = Get-ChildItem -Path $VaultPath -Directory -ErrorAction SilentlyContinue | Where-Object { $reservedFolders -notcontains $_.Name }
        $folderCount = ($userFolders | Measure-Object).Count
        $mdFiles = Get-ChildItem -Path $VaultPath -Filter "*.md" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "\\\.obsidian\\" }
        $mdCount = ($mdFiles | Measure-Object).Count
        Write-Host "  ℹ _meta/persona.md 부재. vault 규모 측정 중..." -ForegroundColor Cyan
        Write-Host "    사용자 명명 폴더: $folderCount 개 / 마크다운 파일: $mdCount 개" -ForegroundColor Cyan
        # ADOPT 임계값: 사용자 폴더 >= 3 또는 .md 파일 >= 100
        if ($folderCount -ge 3 -or $mdCount -ge 100) {
            Write-Host "  → ADOPT 모드로 진입 (기존 큰 vault 흡수)" -ForegroundColor Yellow
            Write-Host "    mode=ADOPT" -ForegroundColor Cyan
            Write-Host "    Stage 1 예정 질문: Q1~Q5(어휘) + Q6(sensitive) + R1(vault_role) + F1~F6(폴더 매핑)" -ForegroundColor Cyan
        } else {
            Write-Host "  → CREATE 모드로 진입 (신규 vault)" -ForegroundColor Green
            Write-Host "    mode=CREATE" -ForegroundColor Cyan
            Write-Host "    Stage 1 예정 질문: Q1~Q5(어휘) + Q6(sensitive) — vault_role=active 디폴트, 폴더 변수 디폴트 사용" -ForegroundColor Cyan
        }
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
    Write-Host "✗ healthcheck 실패 — 다음 이슈 해결 필요:" -ForegroundColor Red
    foreach ($i in $issues) {
        Write-Host "  · $i" -ForegroundColor Red
    }
    exit 1
}
