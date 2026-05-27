# 1차 빌드 프롬프트 (Stage 3A)

> 이 프롬프트는 `<vault>/{folder_raw}/{프로젝트명}/` 폴더의 원본 자료를 `<vault>/{folder_wiki}/`·`{folder_who}/`·`{folder_topic}/` 안의 위키 노트로 1차 변환할 때 LLM에 주는 지시문.

## 0. 사전 검증 — 1차 빌드 차단 조건 (v0.4 신규)

다음 조건 중 하나라도 충족되면 1차 빌드 **전체 차단** (목적지·원본이 없으면 빌드 의미 없음):

- `folder_raw == __unmapped__` → 스캔할 원본 폴더 없음 → 차단
- `folder_who == __unmapped__` AND `folder_topic == __unmapped__` → 사례·이론 두 목적지 다 없음 → 차단
- `vault_role == archive` → archive는 빌드 자체 안 함 → 차단

차단 시 사용자에게 안내:
```
이 vault는 1차 빌드 진행 불가:
- 원인: {차단 조건}
- 권고: persona.md의 folder_* 변수 또는 vault_role을 점검하세요.
- archive vault라면 빌드 대신 _meta/lint.base로 점검만 수행 가능.
```

### 부분 차단 (개별 폴더 unmapped)
- `folder_raw`가 매핑됐지만 `folder_who: __unmapped__` → 모든 노트를 `folder_topic`으로만 저장
- 반대로 `folder_topic: __unmapped__` → 모든 노트를 `folder_who`로만 저장
- `folder_wiki: __unmapped__` → 위키 폴더 통합 저장 안 함 (사례·이론 폴더에 분류만)
>
> **v0.3 변수 체계**: 모든 폴더 경로는 `_meta/persona.md`의 6 변수(`folder_who`/`folder_topic`/`folder_wiki`/`folder_canvas`/`folder_phase`/`folder_raw`)에서 치환된다. 디폴트는 `사례`/`주제`/`wiki`/`캔버스`/`_WorkLog`/`raw`.
>
> **`__unmapped__` 처리 (v0.3 신규)**: 변수 값이 `__unmapped__`이면 그 폴더 관련 작업 전체 건너뜀.
> - `folder_raw: __unmapped__` → **1차 빌드 자체 건너뜀** (스캔할 raw 자료 없음)
> - `folder_who: __unmapped__` → 사례 노드 생성 안 함 (이론 노드만)
> - `folder_topic: __unmapped__` → 이론 노드 생성 안 함 (사례 노드만)
> - `folder_wiki: __unmapped__` → 위키 폴더 안 박음 (사례/이론 폴더 분류만)
>
> **vault_role 처리 (v0.3 신규)**: `vault_role: archive`이면 1차 빌드 자체 차단. 사용자 안내 후 종료.

## 사전 로드 (반드시)

1. `<vault>/_meta/persona.md` — 어휘 사전 (`{who_label}`, `{topic_label}`, `{kind_examples}` + 6 폴더 변수 치환용)
2. `<vault>/_meta/일관성카드.md` — 5규칙 (네이밍·태그4축·링크방향·요약1줄·불완전마커)

## 실행 절차

### 1. `{folder_raw}/` 스캔

`<vault>/{folder_raw}/{프로젝트명}/` 안 모든 파일 리스트업. 다음 타입 분류:
- `.md` / `.txt` → 직접 추출
- `.pdf` / `.docx` → 텍스트 추출 (필요 시 외부 도구)
- `.url` 또는 본문 첫 줄이 `http://`·`https://`인 파일 → `defuddle parse <url> --md`로 정제

### 2. 토픽 분류

각 파일 본문을 LLM이 읽고 분류:
- **사례 노드 (구체)** — 특정 주체·사건·프로젝트 중심 → `<vault>/{folder_who}/` 에 노트 생성
- **이론 노드 (추상)** — 기준·규약·이론·일반론 중심 → `<vault>/{folder_topic}/` 에 노트 생성
- 애매하면 `[확인 필요]` 마커 박고 사례 쪽으로 (사용자가 2차 빌드에서 수정 가능)

### 3. 노트 생성 (파일당)

`obsidian-markdown` 스킬 호출 형식으로 frontmatter + 본문 작성:

```yaml
---
time: {raw 파일 날짜 또는 YYYY-Q?}
who: {who 라벨 인스턴스 — 예: "(주)가나" 또는 "김OO"}
topic: {topic 라벨 인스턴스 — 예: "수익인식" 또는 "정당방위"}
kind: {kind_examples 중 하나}
source: {folder_raw}/{프로젝트명}/{원본 파일명}
slug: {kebab-case 슬러그}        # T3 트랙만 (Wiki-First Query 키)
page_type: auto_generated         # T3 트랙만 (auto_generated | manual | faq)
view_count: 0                     # T3 트랙만 (Wiki-First threshold ≥0.75 계산 기반)
quality_score: 0                  # T3 트랙만 (0~1 범위, mychatbot-world가 업데이트)
status: 진행중
tags:
  - {who_label}/{who 인스턴스}
  - 진행중
---

이 노트는 {who 인스턴스}의 {topic 인스턴스}에 대한 {kind}이다.

## 핵심 5~10줄
{원본에서 핵심 5~10줄만 발췌. 전문 복사 금지.}

## 관련
(아래는 자리표시자가 아닌 *작성 지침*. 실재 노트가 있을 때만 wikilink, 없으면 평문으로.)
- 실재 노트가 있으면: `[[{folder_topic}/실제 노트명]]` (예: `[[_위키/정당방위_형법21조]]`)
- 미존재 노트면: 평문 표기 (예: `관련 기준: 정당방위 (관련 노트 작성 예정)`)
- 절대 금지: `[[{folder_topic}/관련 기준 노트]]` 같은 자리표시자 wikilink — dead-link 생성

## 미해결
[확인 필요] {모호한 부분}
```

### 4. 절대 금지

- **`{folder_raw}` 원본 미수정** — 1글자도 안 건드림 (변수가 가리키는 폴더가 어떤 명칭이든 동일 원칙)
- **본문 전체 복사 금지** — 핵심 5~10줄만 추출
- **숫자·고유명사 변형 금지** — 원본 그대로 인용
- **존재하지 않는 wikilink 생성 금지** — 실재 노트만 링크
- **자리표시자 wikilink 금지** — 미존재 노트는 평문으로 (예: `관련: 신선로 (관련 노트 작성 예정)`). `[[ ... (작성 예정)]]` 같은 dead-link 패턴 금지. 확실치 않으면 본문에 `[확인 필요]` 마커

### 5. 출력 보고

작업 완료 후 사용자에게 표로 보고:

```
| 폴더 | 노트 수 | 핵심 변환 사례 |
|---|---|---|
| {folder_who}/ | N | 김OO_2025_사건메모 |
| {folder_topic}/ | M | 정당방위_형법21조 |
| [확인 필요] 마커 | K개 | ... |
```

→ 사용자가 검토 후 **2차 빌드(`prompts/second_build.md`)**로 진입.

---

*출처: Oh My Wiki first_build.md 패턴 + 본 슈퍼스킬의 페르소나 변수 치환 통합.*
*v0.2.1 (2026-05-27) — 폴더 변수 `{folder_raw}`·`{folder_wiki}` 변수화로 ADOPT 모드 호환.*
