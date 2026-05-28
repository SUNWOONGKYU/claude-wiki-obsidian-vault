---
name: claude-wiki-obsidian-vault-코어4
description: 본인 전용 디렉터·오케스트레이터. 자연어 한 줄로 Claude·Wiki·Obsidian Vault를 생성·갱신·흡수한다.
  3 모드(CREATE / LOAD / ADOPT) × 5 트랙(T0 Tiny / T1 캐주얼 / T2 구조화 / T2-A 흡수 / T3 RAG-ready) × 3 vault_role(active / archive / hybrid).
  v0.6.0부터 healthcheck.ps1이 vault 규모(.md 수·폴더 수)를 측정해 트랙을 자동 결정·추천 — 작은 vault(< 10 .md)는 T0 Tiny로 분기.
  페르소나·일관성 카드·1·2차 빌드를 수행하고, kepano 5종(obsidian-markdown/bases/cli, json-canvas, defuddle)을 도구로 호출.
  사용자가 "저장해", "vault 만들어", "위키 부트스트랩", "페르소나 박아", "이 vault에 페르소나 박아",
  "RAG 준비해", "raw 정리해", "1차 빌드", "2차 빌드", "archive vault 흡수", "승급" 등을 말할 때 발동.
metadata:
  type: core
  version: 0.6.0
  created: 2026-05-27
---

# claude-wiki-obsidian-vault-코어4

본인이 다양한 직무·프로젝트에서 사용하는 **Claude·Wiki·Obsidian Vault**를 자연어 한 줄로 생성·갱신·흡수하는 슈퍼스킬. 페르소나는 vault에 박힌다(`_meta/persona.md`) — 하드코딩 4종은 없다.

**v0.6.0 핵심 변화** (PO 결정 "자동으로 분기" 2026-05-29):
- **T0 Tiny 트랙 신설** — 작은 vault(< 10 .md, 0~1 폴더) 전용 최소 트랙. persona.md 1파일만 박음. 셋업 2분.
- **자동 트랙 결정** — healthcheck.ps1이 vault 규모를 측정해 T0 / T1 / T2 Structured / T2 Full / T2-A를 자동 추천. 사용자가 매번 분기 선택 X.
- **T0 → T2 자동 승급 안내** — vault가 30+ 노트로 성장하면 LOAD 모드에서 자동 안내.
- **"소 잡는 칼" 문제 해소** — 작은 vault에 풀 슈퍼스킬 강제 적용을 방지.

**v0.3.0 기반** (원성묵 원장 외부 검증 반영):
- **vault_role** 옵션 (`active` / `archive` / `hybrid`) — vault 성격에 맞춰 작업 자동 분기
- **`__unmapped__` 키워드** — 폴더 변수 값으로 박으면 그 폴더 작업 자체를 건너뜀 (archive vault용)
- **변수 치환 규칙** 본문 명시 (기존엔 변경이력에만 있었음)
- **본문 ↔ 부속파일 정합성 체크리스트** 추가 (v0.2.1 healthcheck 미구현 같은 사례 재발 차단)

## 진입 트리거

다음 표현 중 하나라도 잡히면 발동:
- `저장해` · `raw/에 넣어` · `이거 정리해서 vault에`
- `vault 만들어` · `위키 만들어` · `{프로젝트명} 부트스트랩`
- `페르소나 박아` · `이 vault에 페르소나 박아` · `{직무} 위키`
- `archive vault 흡수` · `보관소 vault에 메타만 박아`
- `RAG 준비해` · `wiki-e-rag 호환`
- `1차 빌드` · `2차 빌드` · `raw 정리`

## 의존성 (사용 전 healthcheck로 확인)

- Obsidian 1.12.7+ — Settings → General → Advanced → "Enable CLI" 활성화 (1.12.x부터 CLI 메뉴 정식 노출. 출처: kepano/obsidian-skills README + 본 PC 실측 v1.12.7.0 동작 확인 2026-05-27)
- kepano 5종 스킬: `obsidian-markdown` · `obsidian-bases` · `json-canvas` · `obsidian-cli` · `defuddle`
- PowerShell (scripts/ 실행용)
- T3 트랙에서 URL 정제 시: `npm install -g defuddle`

## 변수 체계 (v0.3 본문 명시)

페르소나(`_meta/persona.md`)에 박힌 변수들이 후속 모든 Stage에서 자동 치환된다.

### 어휘 변수 (3종)

| 변수 | 정의 | 치환 시점 | 예시 |
|---|---|---|---|
| `{who_label}` | 본 vault의 *주체* 명명 (Stage 1 Q2 응답) | dashboard.base displayName, properties 설명, 1·2차 빌드 prompt | "의뢰인" / "거래처" / "직능" |
| `{topic_label}` | 본 vault의 *주제 영역* 명명 (Stage 1 Q3 응답) | dashboard.base displayName, 1·2차 빌드 prompt | "법률쟁점" / "요리" / "AI 에이전트" |
| `{kind_examples}` | 본 vault의 *문서 종류* 목록 (Stage 1 Q4 응답) | first_build.md frontmatter `kind` 후보, dashboard.base 필터 | ["의견서", "메모"] / ["레시피", "메뉴기획서"] |

### 폴더 변수 (6종 + `__unmapped__`)

| 변수 | 디폴트 (CREATE) | 본인 매핑 (ADOPT) | __unmapped__ |
|---|---|---|---|
| `folder_who` | `사례/` | `직능분석/에이전트` 등 다단계 | 사례 작업 건너뜀 |
| `folder_topic` | `주제/` | `_위키` 등 | 주제 작업 건너뜀 |
| `folder_wiki` | `wiki/` | `_위키` | wiki 빌드 건너뜀 |
| `folder_canvas` | `캔버스/` | `직능분석/sunmyung-ax-diagram` | canvas 박지 않음 |
| `folder_phase` | `_WorkLog/` | `직능분석/_WorkLog` | PHASE 파일 안 박음 |
| `folder_raw` | `raw/` | `archive` 등 | raw 빌드 건너뜀 |

**`__unmapped__` 의미** (v0.3 신규):
- 폴더 변수 값으로 `__unmapped__` 박으면 그 폴더 관련 *모든 작업을 건너뜀*
- 신설하지 않음, 읽지 않음, 빌드하지 않음
- archive vault에서 유용 (예: `folder_wiki: __unmapped__` — 위키 빌드 자체 건너뜀)

## Stage 0 — 진입 모드 감지 + 자동 트랙 결정 (healthcheck + v0.5 자동 설치 + v0.6 자동 분기)

1. `scripts/healthcheck.ps1` 실행 — Obsidian CLI 활성, kepano 5종, defuddle 확인
   - **v0.5**: 의존성 부족 시 `scripts/install-deps.ps1` 자동 호출 (winget·npm·git clone)
   - 자동 설치 후 healthcheck 재실행. `-NoAutoInstall` 플래그로 비활성 가능.
2. 작업 대상 vault 경로 결정 (사용자 메시지에 없으면 질문)
3. **vault 상태 3분기 검사**:
   - `_meta/persona.md` **존재** → **LOAD** 모드
   - 부재 + vault 거의 비어있음 → **CREATE** 모드
   - 부재 + 기존 폴더·파일 다수 → **ADOPT** 모드
4. **v0.6.0 자동 트랙 결정** — healthcheck.ps1이 vault 규모(`.md` 수·사용자 폴더 수)를 측정해 트랙 추천:

   | 측정값 | 자동 트랙 | 모드 | 박는 파일 | 셋업 |
   |---|---|---|---|---|
   | `.md < 10` & `folders < 1` | **T0 Tiny** ✨ | CREATE | persona.md 1파일 | 2분 |
   | `.md 10~30` & `folders < 3` | T1 Casual | CREATE | persona + 일관성카드 | 5분 |
   | `.md 30~100` & `folders < 3` | T2 Structured | CREATE | + dashboard.base | 10분 |
   | `.md 100~300` & `folders < 3` | T2 Full | CREATE | + lint.base | 15분 |
   | `.md ≥ 300` OR `folders ≥ 3` | T2-A ADOPT | ADOPT | 4파일 + 폴더 매핑 | 20~30분 |

   사용자 오버라이드: `/claude-wiki-obsidian-vault-코어4 T2 강제` 같이 명시하면 자동 추천 무시.

5. **호출 의도 우선순위 (자동 트랙 위에 덮어쓰기)**:
   - `저장해` 류 → **T1 캐주얼** 강제
   - `archive vault 흡수` → T2-A + vault_role=archive 강제
   - `RAG 준비해` → **T3 RAG-ready** 강제
   - `승급` (LOAD + T0_Tiny 상태에서만) → T0 → T2 승급 절차
   - 명시 트리거 없으면 자동 추천 트랙 사용

6. **vault_role 추정** (v0.3):
   - LOAD 모드 → persona.md frontmatter의 `vault_role` 값 로드
   - T0 Tiny·T1·T2 CREATE 모드 → 디폴트 `active`
   - T2-A ADOPT 모드 → 사용자에게 R1 질문

7. **T0 → T2 자동 승급 안내** (v0.6.0): LOAD + `track: T0_Tiny` + `.md ≥ 30`이면 healthcheck.ps1이 자동 안내 출력. 사용자가 *"승급"* 한 마디 하면 T0 → T2 승급 절차 진입.

8. PHASE 파일 생성: `{folder_phase}/YYYY_MM_DD__HH.MM_PHASE_{vault명}_부트스트랩.md` (T0 Tiny에서는 PHASE 파일 생략 — 셋업 4단계뿐이라 불필요)

## Stage 1 — 페르소나 (T0 Tiny / CREATE / LOAD / ADOPT)

### T0 Tiny 분기 — 작은 vault (v0.6.0 신규)
**질문 3종만** (Q1·Q2·Q3). Q4·Q5·Q6·R1·F1~F6 모두 디폴트. `templates/persona_meta_tiny.md` 사용. 결과 `_meta/persona.md`의 frontmatter에 `track: T0_Tiny` 박힘.

### CREATE 분기 — 신규 vault
질문 5종 + 보조 1종 (sensitive). 폴더 변수 6종은 디폴트 사용.

### ADOPT 분기 — 기존 vault 흡수
질문 5종 + 보조 1종 + **vault_role 질문 1종** + **폴더 매핑 질문 6종**.

폴더 매핑 시 사용자가 `__unmapped__` 응답 가능. 예시:
```
F1. 본인 vault의 위키 폴더는?
   A. _위키        ← 폴더 있음·매핑
   B. (없음)        ← __unmapped__
```

vault_role=archive면 *F1~F6 중 __unmapped__ 비율이 높은 게 정상*. archive는 새 작업 안 함.

### LOAD 분기 — 기존 vault (이미 슈퍼스킬 부트스트랩됨)
`_meta/persona.md` 읽어 모든 변수(어휘 3종 + 폴더 6종 + vault_role) 자동 적재.

## Stage 2 — vault 시딩

### vault_role별 시딩 정책

| vault_role | _meta/* 관리 파일 (4종) | 사용자 콘텐츠 폴더 |
|---|:---:|:---:|
| **active** | ✅ 4파일 신설 (persona·일관성카드·dashboard.base·lint.base) | 매핑된 폴더만 (T2-A) 또는 디폴트 신설 (T2). 콘텐츠 폴더 *내부에는* 사용자 승인 후에만 |
| **archive** | ✅ 4파일 신설 (lint.base는 orphan만 의미 — stale/conflict는 archive 정신상 무의미) | ❌ **사용자 콘텐츠 폴더에는 새 파일 신설 금지** (archive는 보관소) |
| **hybrid** | ✅ 4파일 신설 | active 폴더만 신설. `__unmapped__`인 archive 폴더는 *완전 건너뜀* |

**T2-A(ADOPT) 안전 원칙** (v0.4 표현 통일):
- **사용자 콘텐츠 폴더에는 새 파일 신설 금지** — `_meta/` 관리 파일 4개만 신설 OK (모든 vault_role 공통)
- `__unmapped__`로 박힌 폴더는 *완전 건너뜀* (신설·읽기·빌드 모두 X)
- 본인 폴더로 매핑된 폴더는 **미수정**
- archive vault: 4 관리 파일 신설 OK, 사용자 콘텐츠 폴더는 절대 미수정

## Stage 3 — raw 1·2차 빌드 (active·hybrid만)

vault_role=archive는 Stage 3 자체를 건너뜀 (archive는 빌드 안 함).

### 3A — 1차 빌드
`{folder_raw}`가 `__unmapped__`면 건너뜀. 아니면 prompts/first_build.md 절차.

### 3B — 2차 점검 (사용자 승인 게이트 ⚠️)
`lint.base` 결과 + 5규칙 위반 체크리스트 → 사용자 OK 받기 전 적용 금지.

### 3C — 적용
승인 받으면 `obsidian-cli rename` + `property:set` + wikilink 교정.

> **본문 변형 면제 조항**: 보호규칙 1(`{folder_raw}` 미수정)은 `{folder_raw}` 폴더만 적용된다. `{folder_wiki}`·`{folder_who}`·`{folder_topic}` 본문은 사용자 승인 후 **3종 최소 변형**만 허용 — ① 첫 줄 요약 삽입 ② 역방향 wikilink 줄 제거 ③ `[확인 필요]` 마커 추가.

## 트랙별 단축 진입

### T0 — Tiny (v0.6.0 신규, 자동 추천 .md < 10)
Stage 0(CREATE) → 1(T0 Tiny: Q1·Q2·Q3 3종) → `prompts/t0_tiny_build.md` 4단계 → 완료.
- 박는 것: `_meta/persona.md` 1파일 + 기존 .md에 frontmatter 보강
- 안 박는 것: 일관성카드·dashboard·lint·raw 폴더
- 셋업 시간: 2분
- vault가 30+ 노트로 자라면 LOAD 모드에서 T2 승급 자동 안내

### T1 — 캐주얼 "저장해" (active·hybrid)
Stage 0(LOAD) → frontmatter 박기 → `{folder_raw}/{프로젝트명}/...` 저장 → reload.
`vault_role=archive`면 T1 자체 차단 (archive 정신 위배). 사용자에게 안내: "archive vault에는 저장 안 합니다. 활성 vault 사용하세요."

### T2 — 구조화 부트스트랩 (CREATE 모드 전용)
Stage 0 → 1(CREATE) → 2 → 3 전체.

### T2-A — 흡수 (ADOPT 모드, v0.2)
Stage 0 → 1(ADOPT, 폴더 매핑·vault_role 질문) → 2(메타만 + 매핑된 폴더만) → (Stage 3는 active만).

### T3 — RAG-ready 셋업
Stage 0 → 1 → 2(+ wiki-first.base) → 3.

### T0 → T2 승급 절차 (v0.6.0 신규)
LOAD 모드 + `track: T0_Tiny` + `.md ≥ 30` 감지 시 healthcheck가 자동 안내. 사용자가 *"승급"* 한 마디:
1. 기존 `_meta/persona.md`의 `track: T0_Tiny` → `T2_Structured` 변경
2. 추가 질문 4개 (kind_examples·sensitive·vault_role·폴더 매핑)
3. `_meta/일관성카드.md` + `dashboard.base` + (필요 시 `lint.base`) 신설
4. Stage 3 1·2차 빌드 절차로 이관 가능

승급 시간: 약 10분.

## kepano 5종 호출 매트릭스

| Stage | markdown | bases | canvas | cli | defuddle |
|---|:---:|:---:|:---:|:---:|:---:|
| 0 healthcheck       |   |   |   | ● |   |
| 1 페르소나 CREATE/ADOPT | ● |   |   | ● |   |
| 2 일관성카드         | ● |   |   |   |   |
| 2 dashboard.base    |   | ● |   |   |   |
| 2 lint.base         |   | ● |   |   |   |
| 2 관계도.canvas (archive 제외) |   |   | ● |   |   |
| 3A 1차 빌드          | ● |   |   |   | ● (URL) |
| 3B 2차 점검          |   | ● |   |   |   |
| 3C 2차 적용          | ● |   |   | ● |   |
| T1 "저장해"          | ● |   |   | ● |   |

## 본문 ↔ 부속파일 정합성 체크리스트 (v0.3 신규)

본문의 *어떤 항목을 바꾸면 어떤 부속 파일도 동시에 갱신해야 하는지* 매핑. SKILL.md 본문을 수정한 LLM은 이 체크리스트를 매번 확인.

| SKILL.md 본문 항목 | 동시 갱신 필요 부속 파일 |
|---|---|
| Stage 0 모드 분기 (CREATE/LOAD/ADOPT/vault_role) | `scripts/healthcheck.ps1` 감지 로직 |
| Stage 0 자동 트랙 결정 (v0.6.0 신규) | `scripts/healthcheck.ps1` 5단계 if/elseif + T0→T2 승급 안내 |
| Stage 1 질문 시퀀스 (Q1~Q6 + F1~F6 + vault_role) | `templates/persona_meta.md` |
| Stage 1 T0 질문 시퀀스 (Q1·Q2·Q3 3종) | `templates/persona_meta_tiny.md` |
| 폴더 변수 정의·디폴트 | `templates/persona_meta.md` frontmatter + `templates/persona_meta_tiny.md` 디폴트 + `templates/일관성카드.md` 보호규칙 + `templates/dashboard.base`·`templates/lint.base` displayName |
| 1차 빌드 절차 (3A) — T1~T3 | `prompts/first_build.md` |
| T0 Tiny 빌드 절차 (4단계) | `prompts/t0_tiny_build.md` |
| 2차 빌드 절차 (3B·3C) | `prompts/second_build.md` |
| 보호규칙 (raw 미수정·3종 변형 면제 등) | `templates/일관성카드.md` 보호규칙 + `prompts/second_build.md` 면제 조항 + `prompts/t0_tiny_build.md` T0 전용 규칙 |
| vault reload 명령 | `scripts/postsetup_refresh.ps1` |

**자기점검 절차** (본문 변경 LLM 의무):
1. 본문 변경 시 위 표에서 해당 항목 찾기
2. 매핑된 부속 파일이 변경에 정합한지 확인
3. 미정합 발견 시 부속 파일도 *같은 응답*에서 갱신
4. 정합성 자기 검증 결과를 응답에 명시

**Why 명시**: v0.2.0에서 본문은 ADOPT 모드 3분기를 선언했으나 healthcheck.ps1은 2분기 구현. Cross Validator(서브에이전트)가 발견. *본문↔부속 정합성 체크리스트 부재가 원인*. v0.3에서 이 체크리스트를 본문에 박아 재발 차단.

## 보호 규칙 (절대 위반 금지)

1. **`{folder_raw}` 원본 미수정 + 내부 신설 금지** — 1글자도 안 바꿈 + **새 파일·하위 폴더 신설 금지**. `{folder_raw}`는 사용자가 부트스트랩 시점에 박은 *원본 자료만* 들어간다. 외부 자료·시뮬레이션 시드·LLM 산출·메모 등 *어떤 것도* `{folder_raw}` 안에 박지 않는다 — vault 루트의 별도 폴더(예: `external/`, `sim_seed/`, `_outputs/`)에 박는다. wiki·who·topic 본문은 3C 단계 사용자 승인 후 **3종 최소 변형**만.
2. **자기 검증 금지** — 2차 빌드는 반드시 사용자 승인 후 적용.
3. **sensitive:true vault** — 클라우드 동기화 금지 경고.
4. **한글 멀티라인** 파일시스템 직접 쓰기 (`obsidian-cli create` 회피).
5. **새 vault를 기존 vault 하위에 두지 않음**.
6. **PHASE 파일은 Stage 완료 즉시 체크박스 업데이트**.
7. **하드코딩 페르소나 4종 금지**.
8. **파일경로 표시는 폴더/파일명 분리**.
9. **ADOPT 모드 본인 폴더 미수정** (매핑된 폴더 자동 변경 안 함).
10. **`__unmapped__` 폴더는 완전 무시** (v0.3 신규) — 신설·읽기·빌드 모두 안 함.
11. **vault_role=archive 시 Stage 3 차단** (v0.3 신규) — 빌드 자체 안 함.
12. **본문 ↔ 부속파일 정합성 체크리스트 매번 점검** (v0.3 신규) — 본문 수정 시 의무.

## 출처

- Oh My Wiki (5규칙·4축·페르소나 메타): https://github.com/simonsez9510/oh-my-wiki
- 본인 운영 패턴: G:\내 드라이브\Claude-Wiki\llmwiki-obsidian-guide
- wiki-e-rag (L1·L2): G:\내 드라이브\mychatbot-world\docs\wiki-e-rag
- kepano 5종: https://github.com/kepano/obsidian-skills
- 통합 다이어그램: https://claude-wiki-obsidian-vault-diagrams.vercel.app/
- 본 스킬 폴더 다이어그램: `claude-wiki-obsidian-vault-architecture.svg`
- **공식 GitHub repo**: https://github.com/SUNWOONGKYU/claude-wiki-obsidian-vault
- **외부 검증**: 원성묵 원장 (Oh My Wiki 원천 IP 보유자) Mook-Wiki vault(341 .md, archive) 풀 시뮬레이션 — v0.3 기능(vault_role + __unmapped__) 제안 채택.

## 변경 이력

- **0.6.0 (2026-05-29)** — **자동 트랙 분기 + T0 Tiny 신설** (PO 결정 "자동으로 분기"):
  - **T0 Tiny 트랙 신설** — 작은 vault(`.md < 10` & `folders < 1`) 전용. `_meta/persona.md` 1파일만 박음, 셋업 2분.
  - **healthcheck.ps1 자동 트랙 결정 로직** — vault 규모 측정해 T0/T1/T2 Structured/T2 Full/T2-A 자동 추천 (5단계 if/elseif). 사용자 오버라이드 가능.
  - **T0 → T2 자동 승급 안내** — LOAD 모드 + `track: T0_Tiny` + `.md ≥ 30`이면 healthcheck가 승급 추천 출력. *"승급"* 한 마디로 진행.
  - **신규 부속파일**: `templates/persona_meta_tiny.md` (Q1·Q2·Q3 3종) + `prompts/t0_tiny_build.md` (4단계 빌드).
  - **본문 ↔ 부속파일 정합성 체크리스트 갱신** — T0 관련 항목 4개 추가.
  - **트리거 추가**: "승급" (LOAD + T0 상태에서만).
  - **Why**: 작은 vault에 풀 슈퍼스킬 적용 = "소 잡는 칼" 문제. 셋업 30~60분 vs 산출 가치 비용 역전. 자동 분기로 사용자 의사결정 부담 없이 적합 트랙 진입.

- **0.5.2 (2026-05-28)** — 보호규칙 1 강화: `{folder_raw}` 원본 미수정 *외에도* 내부에 **새 파일·하위 폴더 신설 금지** 명시. 외부 자료·시드·LLM 산출은 vault 루트 별도 폴더로(`external/`, `sim_seed/`, `_outputs/` 등). 원인: BuzzLab for Company vault 시딩 중 LLM이 `raw/external/`, `raw/sim_seed/`를 raw 내부에 박아 PO가 지적 → 재발 차단.

- **0.5.1 (2026-05-28)** — **다른 Claude Code 외부 검증 8건 fix** (Critical 2 + High 2 + Medium 2 + Low 2):
  - **C-1 (Critical)**: SKILL.md frontmatter `version: 0.4.0` → `0.5.1` (v0.5.0 미반영분 + 본 패치 동시) + 변경이력 박기
  - **C-2 (Critical)**: G드라이브 `SAL_Grid_Dev_Suite_Template/.claude/skills/claude-wiki-obsidian-vault-코어4/` 에 v0.5.1 통째 sync (v0.5.0 누락분 포함)
  - **H-1 (High)**: `install-deps.ps1`에 `obsidian-cli` npm 자동 설치 추가 (`npm install -g obsidian-cli`)
  - **H-2 (High)**: `install-deps.ps1`에 `codex` npm 자동 설치 추가 (`npm install -g @openai/codex`)
  - **M-1 (Medium)**: kepano 5종 git clone 후 "Claude Code 재시작 필요" 안내 추가 (신규 스킬 인식 위해)
  - **M-2 (Medium)**: Obsidian "Enable CLI" 토글 자동 검증·박기 — `%APPDATA%\obsidian\obsidian.json`의 `"cli":true` 직접 편집
  - **L-1 (Low)**: `healthcheck.ps1` → `install-deps.ps1` 호출 시 `-Skip*`/`-Force` 옵션 전달 (이미 설치된 부분 스킵)
  - **L-2 (Low)**: 자동 설치 성공 후 `healthcheck.ps1` 자기 재호출 (`-NoAutoInstall`) — 사용자 수동 실행 X

- **0.5.0 (2026-05-28)** — **의존성 자동 설치 박기** (PO 지적 반영):
  - `scripts/install-deps.ps1` 신규 — Obsidian(winget) + defuddle(npm) + kepano 5종(git clone) 자동 시도
  - `scripts/healthcheck.ps1` 보강 — 실패 시 install-deps 자동 호출 (`-NoAutoInstall`로 비활성)
  - SKILL.md Stage 0 본문 갱신 — 자동 설치 단계 명시
  - **Why**: v0.4까지는 의존성 부족 시 수동 안내만 — PO가 매번 수동 처리 부담. v0.5는 winget/npm/git 자동 시도 + 실패 시만 수동 안내.

- **0.4.0 (2026-05-28)** — Codex(GPT) 외부 검증 88/100 반영. v0.3.0 자기모순·미완 5건 해소:
  - **High-1 해소**: `first_build.md` `## 관련` 자리표시자 wikilink 예시 제거 — 같은 파일의 "자리표시자 금지" 규칙과 자기모순이었음
  - **High-2 해소**: `first_build.md` Stage 3A 0번 사전 검증 신설 — `folder_raw`/`folder_who`+`folder_topic`/`vault_role=archive` 시 1차 빌드 *전체 차단*. 부분 차단 규칙도 명시
  - **Medium-1 해소**: `healthcheck.ps1` ADOPT 출력에 R1(vault_role) + Q6(sensitive) 질문 안내 추가 — SKILL.md/persona_meta와 일치
  - **Medium-2 해소**: archive 정책 문구 통일 — "사용자 콘텐츠 폴더 신설·수정 금지, `_meta/` 관리 파일 4개만 신설"
  - **Medium-3 해소**: 외부 검증 세트에 dashboard.base·lint.base·postsetup_refresh.ps1 포함 (Round 5에 적용)
  - Low 2건은 v0.4.1로 이관 (healthcheck 정규식 견고화, 일관성카드 버전 표기)
- 0.3.0 (2026-05-27) — 원성묵 원장 외부 검증 의견 반영:
  - **vault_role 옵션** (`active` / `archive` / `hybrid`) — vault 성격별 작업 분기
  - **`__unmapped__` 키워드 정식 지원** — 폴더 변수 값으로 박으면 그 폴더 작업 건너뜀
  - **변수 치환 규칙** 본문에 명시 (who_label·topic_label·kind_examples 정의·치환 시점)
  - **본문 ↔ 부속파일 정합성 체크리스트** 신설 — v0.2.0 healthcheck Critical GAP 같은 재발 차단
  - 보호규칙 10·11·12 추가
- 0.2.2 (2026-05-27) — templates/dashboard.base + templates/lint.base 정식 템플릿화
- 0.2.1 (2026-05-27) — healthcheck ADOPT 감지 + 위성 5문서 변수화
- 0.2.0 (2026-05-27) — ADOPT 모드 + T2-A 트랙 + 폴더 변수 6종 (선명AX 분석)
- 0.1.0 (2026-05-27) — 초기 작성 (SVG v2.1.1 + 검증 100점)
