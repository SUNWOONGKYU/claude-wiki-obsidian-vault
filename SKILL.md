---
name: claude-wiki-obsidian-vault-코어4
description: 본인 전용 디렉터·오케스트레이터. 자연어 한 줄로 Claude·Wiki·Obsidian Vault를 생성·갱신·흡수한다.
  3 모드(CREATE / LOAD / ADOPT) × 4 트랙(T1 캐주얼 / T2 구조화 / T2-A 흡수 / T3 RAG-ready)을 자동 분기.
  페르소나·일관성 카드·1·2차 빌드를 수행하고, kepano 5종(obsidian-markdown/bases/cli, json-canvas, defuddle)을 도구로 호출.
  사용자가 "저장해", "vault 만들어", "위키 부트스트랩", "페르소나 박아", "이 vault에 페르소나 박아",
  "RAG 준비해", "raw 정리해", "1차 빌드", "2차 빌드" 등을 말할 때 발동.
metadata:
  type: core
  version: 0.2.2
  created: 2026-05-27
---

# claude-wiki-obsidian-vault-코어4

본인이 다양한 직무·프로젝트에서 사용하는 **Claude·Wiki·Obsidian Vault**를 자연어 한 줄로 생성·갱신·흡수하는 슈퍼스킬. 페르소나는 vault에 박힌다(`_meta/persona.md`) — 회계사·변호사 같은 하드코딩 4종은 없다.

**v0.2 핵심 변화**: 기존 큰 vault(수천 파일·다단계 폴더)를 흡수하는 **ADOPT 모드** + 폴더 변수 6종(`folder_who`/`folder_topic`/`folder_wiki`/`folder_canvas`/`folder_phase`/`folder_raw`)으로 본인 vault 어휘에 완전 적응.

## 진입 트리거

다음 표현 중 하나라도 잡히면 발동:
- `저장해` · `raw/에 넣어` · `이거 정리해서 vault에`
- `vault 만들어` · `위키 만들어` · `{프로젝트명} 부트스트랩`
- `페르소나 박아` · `이 vault에 페르소나 박아` · `{직무} 위키`  
- `RAG 준비해` · `wiki-e-rag 호환`
- `1차 빌드` · `2차 빌드` · `raw 정리`

## 의존성 (사용 전 healthcheck로 확인)

- Obsidian 1.12.7+ — Settings → General → Advanced → "Enable CLI" 활성화 (1.12.x부터 CLI 메뉴 정식 노출. 출처: kepano/obsidian-skills README "Installation" + 본 PC 실측 v1.12.7.0 동작 확인 2026-05-27)
- kepano 5종 스킬 (이미 사용자 환경에 설치):
  - `obsidian-markdown` · `obsidian-bases` · `json-canvas` · `obsidian-cli` · `defuddle`
- PowerShell (scripts/ 실행용)
- T3 트랙에서 URL 정제 시: `npm install -g defuddle`

## Stage 0 — 진입 모드 감지 (healthcheck) — **v0.2 3분기**

1. `scripts/healthcheck.ps1` 실행 — Obsidian CLI 활성, kepano 5종 확인
2. 작업 대상 vault 경로 결정 (사용자 메시지에 없으면 질문)
3. **vault 상태 3분기 검사** (v0.2 신규):
   - `<vault>/_meta/persona.md` **존재** → **LOAD** 모드 (Stage 1에서 어휘 사전 로드)
   - 부재 + vault 내 폴더·파일 거의 없음(예: `.obsidian/` 외에 사용자 파일 ≤ 10) → **CREATE** 모드 (질문 5종으로 신규 페르소나)
   - 부재 + **기존 폴더·파일 다수**(사용자 명명 폴더 존재, 100+ 노트) → **ADOPT** 모드 ⭐ (질문 5종 + *기존 폴더 매핑 질문 6종*)
4. 호출 의도 + vault 상태로 트랙 자동 분기:
   - `저장해` 류 → **T1 캐주얼**
   - `vault 만들어` / CREATE 모드 → **T2 구조화**
   - `이 vault에 페르소나 박아` / ADOPT 모드 → **T2-A 흡수** (메타만 박고 본인 폴더 어휘로 매핑, 기존 자료 미수정)
   - `RAG 준비해` / `wiki-e-rag 호환` → **T3 RAG-ready**
5. PHASE 파일 생성: `{folder_phase}/YYYY_MM_DD__HH.MM_PHASE_{vault명}_부트스트랩.md` (folder_phase는 ADOPT 모드에서 사용자 지정 가능, 디폴트 `_WorkLog`)

## Stage 1 — 페르소나 (CREATE / LOAD / ADOPT)

### CREATE 분기 — 신규 vault

`templates/persona_meta.md` 로드 → 사용자에게 질문 5종:

1. 이 vault에서 본인 직무는?
2. *주체*(사람/조직)를 뭐라 부르나? (예: 의뢰인·환자·거래처·인터뷰이·학생)
3. *주제 영역*은? (예: 법률쟁점·진단·과목·취재주제)
4. *문서 종류*는 주로 뭘 만드나? (예: 의견서·차트·메모·평가서·강의안)
5. 예시 주제 1개 + 예시 주체 1개

추가 질문 6 — `sensitive` 플래그 (민감정보 vault 여부). `true`면 작업 시작 시 "이 vault는 민감정보. 클라우드 동기화 금지" 경고 출력.

### ADOPT 분기 (v0.2 신규) — 기존 큰 vault 흡수

질문 5종 + 보조 1종(sensitive) + **폴더 매핑 질문 6종** (vault 트리 자동 스캔 결과 제시):
- 본인 vault의 **위키 폴더**는? (디폴트 `wiki`, 본인은 `_위키` 등) → `folder_wiki`
- 본인 vault의 **사례·주체 폴더**는? (다단계 OK 예: `직능분석/에이전트`) → `folder_who`
- 본인 vault의 **주제·기준 폴더**는? (예: `_위키` 또는 `docs/topics`) → `folder_topic`
- 본인 vault의 **다이어그램 폴더**는? (예: `직능분석/sunmyung-ax-diagram`) → `folder_canvas`
- 본인 vault의 **PHASE 파일 폴더**는? (예: `직능분석/_WorkLog`) → `folder_phase`
- 본인 vault의 **원본 자료 폴더**는? (없으면 새로 `raw/`, 있으면 본인 폴더 매핑 예: `archive`) → `folder_raw`

응답으로 `_meta/persona.md` 생성. **기존 폴더·파일은 미수정**. dashboard·lint.base만 본인 어휘로 박힘.

### LOAD 분기 — 기존 vault (slim·기존 슈퍼스킬 vault)

`<vault>/_meta/persona.md` 읽기 → frontmatter에서 어휘 사전 추출 → 메모리 적재. 후속 Stage에서 모든 `{folder_*}` 변수 자동 치환.

## 폴더 변수 매핑 (v0.2 핵심)

페르소나는 다음 폴더 변수를 통해 *본인 vault 어휘*에 적응합니다:

| 변수 | 디폴트 | 의미 | 다단계 경로 예시 |
|---|---|---|---|
| `folder_who` | `사례/` | 주체(사람·조직) 노트 폴더 | `직능분석/에이전트` |
| `folder_topic` | `주제/` | 주제·기준 노트 폴더 | `_위키` 또는 `docs/topics` |
| `folder_wiki` | `wiki/` | 정제 위키 폴더 (v0.2 신규) | `_위키` 또는 `wiki` |
| `folder_canvas` | `캔버스/` | 다이어그램 폴더 (v0.2 신규) | `직능분석/sunmyung-ax-diagram` |
| `folder_phase` | `_WorkLog/` | PHASE 파일 폴더 (v0.2 신규) | `직능분석/_WorkLog` |
| `folder_raw` | `raw/` | 원본 자료 폴더 (선택, v0.2 신규) | `archive` 또는 `직능분석/_extract` |

각 변수는 *vault 루트 기준 상대 경로*로 **다단계 지원**. ADOPT 모드에서는 사용자가 본인 폴더로 매핑 → 슈퍼스킬 디폴트 폴더 신설 X (이중 구조 방지).

## Stage 2 — vault 시딩 (T2·T2-A·T3 트랙)

폴더·파일 박기 (변수 치환):

```
<vault>/
├── {folder_raw}/         (LLM 미수정 영역. 1글자도 안 건드림 — T2 신설, T2-A 매핑)
├── _meta/                (모든 트랙 신설 — 메타 박힘)
│   ├── persona.md        (Stage 1 결과)
│   ├── 일관성카드.md     (templates/일관성카드.md 복사 + vault 어휘 치환)
│   ├── dashboard.base    (templates/dashboard.base 복사 + {who_label}·{topic_label}·{folder_*} 치환)
│   ├── lint.base         (templates/lint.base 복사 — orphan/stale/4축누락/summary부재 4 뷰)
│   └── wiki-first.base   (T3만)
├── {folder_wiki}/        (T2는 wiki/ 신설 / T2-A는 본인 _위키/ 그대로)
│   └── faq/              (T3만)
├── {folder_who}/         (T2는 신설, T2-A는 본인 폴더 매핑·미수정)
├── {folder_topic}/
└── {folder_canvas}/
    ├── 관계도.canvas     (T2 신설, T2-A는 본인 다이어그램 폴더에 추가)
    └── knowledge-graph.canvas  (T3만)
```

**T2-A(ADOPT) 트랙의 안전 원칙**:
- `{folder_*}`가 본인 폴더로 매핑됐으면 **그 폴더는 미수정**. 그 안에 새 파일 박지 않음.
- `_meta/` 4파일만 신설. dashboard·lint.base가 본인 폴더 어휘 기반으로 *읽어서* 표·뷰 제공.
- 본인 명시 승인 후에만 추가 작업 (예: 100+ 기존 노트의 frontmatter 보강은 v0.3 Stage 2.5).

예시 노트 2장(사례 1 + 기준 1)은 **CREATE 모드에서만** 박음. ADOPT 모드는 기존 노트가 이미 hub 역할.

한글 멀티라인 본문은 **파일시스템 직접 쓰기** (`obsidian-cli create` 명령 회피 — 한글 escape 깨짐). CLI는 reload·property:set 같은 상태 액션 전용.

## Stage 3 — raw 1차·2차 빌드

### 3A — 1차 빌드

`prompts/first_build.md` 로드. `<vault>/{folder_raw}/{프로젝트명}/` 스캔:

- URL 파일이면 `defuddle parse <url> --md`로 정제 후 본문 추출
- 사례 문서 → `{folder_who}/`, 이론·기준 → `{folder_topic}/`로 자동 분류
- 원본 본문에서 **핵심 5~10줄만 추출** (전문 복사 금지)
- 노트 frontmatter에 properties 4축(time/who/topic/kind) + 도메인 확장 박기
- `{folder_raw}/` 원본은 절대 미수정

### 3B — 2차 점검 (사용자 승인 게이트 ⚠️)

`prompts/second_build.md` 로드. `lint.base` 결과 + 5규칙 위반 체크리스트 → **사용자 "OK" 받기 전 절대 적용 금지**.

### 3C — 적용

> **본문 변형 면제 조항**: 보호규칙 1(`{folder_raw}` 미수정)은 `{folder_raw}` 폴더만 적용된다. `{folder_wiki}`·`{folder_who}`·`{folder_topic}` 본문은 사용자 승인 후 **3종 최소 변형**만 허용된다 — ① 첫 줄 요약 1줄 삽입 ② 역방향 wikilink 줄 제거 ③ `[확인 필요]` 마커 인라인 추가.

승인 받으면 `obsidian-cli rename` + `property:set` + wikilink 교정. `scripts/postsetup_refresh.ps1` 실행 → `obsidian command "app:reload"`.

## 트랙별 단축 진입

### T1 — 캐주얼 "저장해"

Stage 0(healthcheck + LOAD) → 빠른 raw 저장:
- LOAD 부재 폴백: persona.md 없으면 "T2 부트스트랩 먼저 할까?" 또는 "ADOPT 모드로 흡수할까?" 질문 후 분기
1. 세션 정리 + frontmatter 4축 박기
2. `<vault>/{folder_raw}/{프로젝트명}/{YYYY_MM_DD_HH.MM}_[프로젝트명]_TYPE_TITLE.md`
3. `ingest.js + compile.js` (있으면)
4. `scripts/postsetup_refresh.ps1` → `obsidian command "app:reload"` (Stage 2·3C와 동일 reload 경로)

> 본인 운영 패턴: **Auto-Compaction OFF**(컨텍스트 자동 압축 비활성)·**3계층 정리 구조**(raw → wiki → 캔버스)·`{folder_raw}/{프로젝트명}/` 분리 보존.

### T2 — 구조화 부트스트랩 (CREATE 모드 전용)

Stage 0 → 1(CREATE) → 2 → 3 전체. 페르소나 vault 신규 생성. **빈 vault 또는 소규모 vault용**.

### T2-A — 흡수 (ADOPT 모드 전용, v0.2 신규) ⭐

Stage 0 → 1(ADOPT, 폴더 매핑 질문 6종 포함) → 2(메타만 + 본인 폴더 매핑) → (Stage 3는 사용자 명시 요청 시만).

**기존 큰 vault(수천 파일·다단계 폴더)에 페르소나·일관성카드·dashboard·lint만 박는 가벼운 모드**. 본인 폴더 구조 완전 보존. RAG-ready 변환은 v0.3 Stage 2.5에서.

### T3 — RAG-ready 셋업

Stage 0 → 1 → 2(+ wiki-first.base, knowledge-graph.canvas) → 3.

후속 안내 출력 (스킬 외부 — mychatbot-world가 담당):

```
1. POST /api/wiki/vault/sync          ← vault → Supabase (3-Storage: vault/wiki/kb)
2. POST /api/kb/embed                  ← 임베딩 (text-embedding-3-small)
3. POST /api/wiki/ingest               ← 5-Stage 자동 (분할·생성·dedup·임베딩·Accumulation)
4. /bot/{botId}/wiki                   ← Wiki-First Query 가동 (threshold ≥0.75)
5. /bot/{botId}/wiki/graph             ← D3.js 그래프뷰
6. {folder_wiki}/faq/ Accumulation     ← 동일 질의 N회 누적 시 FAQ 노트 자동 생성
```

L3 엔진(임베딩·pgvector·OpenAI)은 본인 mychatbot-world (Next.js + Supabase) 담당. 본 스킬은 호환 vault만 만든다. wiki-e-rag **L1**(vault) · **L2**(Supabase + Wiki-First + Accumulation + Lint + slug·page_type·YAML sync) · **L3**(임베딩·pgvector·OpenAI, **외부**) 3계층 중 L1·L2를 산출한다.

## kepano 5종 호출 매트릭스

| Stage | markdown | bases | canvas | cli | defuddle |
|---|:---:|:---:|:---:|:---:|:---:|
| 0 healthcheck       |   |   |   | ● |   |
| 1 페르소나 CREATE/ADOPT | ● |   |   | ● |   |
| 1 페르소나 LOAD     |   |   |   | ● |   |
| 2 일관성카드·예시노트 | ● |   |   |   |   |
| 2 dashboard.base    |   | ● |   |   |   |
| 2 관계도.canvas     |   |   | ● |   |   |
| 2 vault reload      |   |   |   | ● |   |
| 3A 1차 빌드          | ● |   |   |   | ● (URL) |
| 3B 2차 점검 (lint)   |   | ● |   |   |   |
| 3C 2차 적용          | ● |   |   | ● |   |
| T1 "저장해"          | ● |   |   | ● |   |
| T2-A 흡수            |   | ● |   |   |   |
| T3 wiki-first.base   |   | ● | ● |   |   |

## 보호 규칙 (절대 위반 금지)

1. **`{folder_raw}` 원본 미수정** — 1글자도 바꾸지 않음. `{folder_wiki}`·`{folder_who}`·`{folder_topic}` 본문은 3C 단계 사용자 승인 후 **3종 최소 변형**만 허용 (① 첫 줄 요약 삽입 ② 역방향 wikilink 제거 ③ `[확인 필요]` 마커 추가 — `prompts/second_build.md` "본문 변형 면제 조항" 참조).
2. **자기 검증 금지** — 2차 빌드는 반드시 사용자 승인 후 적용 (CLAUDE.md 정합)
3. **sensitive:true vault** — 작업 시작 시 "클라우드 동기화 금지" 경고 출력
4. **한글 멀티라인 본문은 파일시스템 직접 쓰기** (`obsidian-cli create` 회피)
5. **새 vault를 기존 vault 하위에 두지 않음** (옵시디언 공유 표시 회피)
6. **PHASE 파일은 Stage 완료 즉시 체크박스 업데이트** (코드 작업보다 먼저)
7. **하드코딩 페르소나 4종 금지** — 회계사·변호사·매체·연구자 어휘를 박지 않음. 항상 메타 페르소나로 즉석 생성.
8. **파일경로 표시는 폴더/파일명 분리** (CLAUDE.md 전역 규칙)
9. **ADOPT 모드에서 본인 폴더 미수정** (v0.2 신규) — `_meta/` 4파일만 박음. 기존 `{folder_*}`로 매핑된 폴더의 파일은 절대 자동 변경 안 함.

## 산출물

다음이 모두 박힌 **Claude·Wiki·Obsidian Vault**:

- `_meta/persona.md` — 어휘 사전 + 폴더 변수 6종 매핑
- `_meta/일관성카드.md` — 5규칙 원형 (vault 어휘로 치환)
- `_meta/dashboard.base` · `_meta/lint.base` (+ T3: `wiki-first.base`)
- `{folder_raw}/` — 원본 보존 (T2 신설, T2-A는 본인 폴더 매핑)
- `{folder_wiki}/` — 정제 노트 (wikilinks + callouts + 4축 properties)
- `{folder_who}/` · `{folder_topic}/` — 페르소나 변수 기반
- `{folder_canvas}/관계도.canvas` (+ T3: `knowledge-graph.canvas`)
- RAG-ready 포맷 (slug · page_type · YAML sync 호환)

→ 자동으로 mychatbot-world RAG 엔진에 연결 가능.

## 검증 가이드 (사용 후 확인)

```powershell
# vault 구조
Get-ChildItem -Path "<vault>" -Directory

# _meta 파일 존재
Test-Path "<vault>/_meta/persona.md"
Test-Path "<vault>/_meta/일관성카드.md"

# 폴더 변수 매핑 확인 (ADOPT 모드)
Get-Content "<vault>/_meta/persona.md" | Select-String "folder_"

# Obsidian에서 그래프뷰 확인 (hub 보임)
obsidian open vault="<vault-name>"
```

## 출처

- Oh My Wiki (5규칙·4축·페르소나 메타): https://github.com/simonsez9510/oh-my-wiki
- 본인 운영 패턴 (raw/{proj}/, ingest+compile, Auto-Compaction OFF):
  G:\내 드라이브\Claude-Wiki\llmwiki-obsidian-guide (2026-05-03 정리)
- wiki-e-rag (L1·L2 패턴, L3 엔진 외부):
  G:\내 드라이브\mychatbot-world\docs\wiki-e-rag
- kepano 5종: https://github.com/kepano/obsidian-skills
- 통합 다이어그램 v2.1.1: https://claude-wiki-obsidian-vault-diagrams.vercel.app/
- 본 스킬 폴더 내 다이어그램 (본인 표준 스킬 아키텍처 SVG):
  - `claude-wiki-obsidian-vault-architecture.svg` — 관계도(상단) + 흐름도(하단) **한 장 통합본**

## 변경 이력

- **0.2.0 (2026-05-27)** — 선명AX 실 vault 분석 시사점 반영:
  - **ADOPT 모드 신설** (Stage 0 3분기) — 기존 큰 vault 흡수 지원
  - **T2-A 트랙 신설** — 메타만 박고 본인 폴더 어휘로 매핑
  - **폴더 변수 6종** 도입 (`folder_who`/`folder_topic`/`folder_wiki`/`folder_canvas`/`folder_phase`/`folder_raw`) — 다단계 경로 지원
  - 보호규칙 9번 추가 — ADOPT 모드 기존 폴더 미수정 보장
  - v0.3 후속 예정: Stage 2.5 마이그레이션(기존 frontmatter 4축 일괄 보강) · vault 규모별 .base 템플릿 · 직무 도메인 표준 properties 가이드
- **0.2.2 (2026-05-27)** — 원성묵 원장(Oh My Wiki 원천 IP 보유자) 외부 검증 의견 반영:
  - **templates/dashboard.base 신설** — 변수 치환 가능한 표준 4축 표 뷰 (Stage 2 재현성 보장)
  - **templates/lint.base 신설** — orphan/stale/4축누락/summary부재 4 뷰 표준화
  - 그동안 LLM이 즉석 작성하던 .base를 정식 템플릿으로 박아 self-contained 보장
- 0.2.1 (2026-05-27) — v0.2.0 핫픽스: healthcheck ADOPT 감지 + 위성 5문서 변수화. CV 100/100
- 0.2.0 (2026-05-27) — 선명AX 실 vault 분석 반영: ADOPT 모드 + T2-A 트랙 + 폴더 변수 6종
- 0.1.0 (2026-05-27) — 초기 작성. SVG v2.1.1 + 검증 100점 기준.
