---
type: persona-meta-generator
version: 1.1
purpose: 신규 vault(CREATE) 또는 기존 vault(ADOPT) 어휘 사전을 즉석 생성. 회계사·변호사 같은 하드코딩 4종 금지.
---

# 페르소나 메타 — 즉석 생성기 (v0.2: CREATE + ADOPT 분기)

이 템플릿은 vault 부트스트랩 시 사용된다:
- **Stage 1 CREATE 분기** — 신규 vault에 페르소나 신설 (질문 5종 + 보조 1종)
- **Stage 1 ADOPT 분기** — 기존 큰 vault 흡수 (질문 5종 + 보조 1종 + **폴더 매핑 질문 6종**)

LLM이 사용자에게 질문하고 응답을 다음 frontmatter로 박는다.

## 질문 5종 + 보조 1종 (CREATE·ADOPT 공통)

```
Q1. 이 vault에서 본인 직무는?
    예시 응답: 변호사 (형사사건) / 데이터 사이언티스트 / 셰프 / 작곡가 / 도서관 사서 ...

Q2. 본인이 자주 다루는 *주체*(사람/조직)는 뭐라 부르나?
    예시: 의뢰인 · 환자 · 거래처 · 인터뷰이 · 학생 · 클라이언트 · 멘티

Q3. 본인이 다루는 *주제 영역*은?
    예시: 법률쟁점 · 진단 · 과목 · 취재주제 · 모델 아키텍처 · 레시피 · 작품

Q4. 본인이 만드는 *문서 종류*는 주로 뭘 만드나? (복수 가능)
    예시: 의견서 · 차트 · 메모 · 평가서 · 강의안 · 회의록 · 실험노트

Q5. 예시 주제 1개 + 예시 주체 1개를 들어줘
    예시: 정당방위(주제) / 김OO(주체)

Q6. (추가) sensitive 플래그 — 민감정보 포함 vault인가? (true/false)
    true면 작업 시작 시 "클라우드 동기화 금지" 경고 출력.
```

## 폴더 매핑 질문 6종 (ADOPT 분기 전용 — v0.2 신규)

healthcheck.ps1가 ADOPT 모드를 감지하면(기존 폴더·파일 다수), Q1~Q6에 이어 다음 6종을 추가로 물어본다. vault 트리 자동 스캔 결과를 함께 제시.

```
F1. 본인 vault의 *위키 폴더*는? (디폴트 'wiki', 본인 어휘는 '_위키' 등)
    → folder_wiki

F2. 본인 vault의 *사례·주체 폴더*는? (다단계 경로 OK. 예: '직능분석/에이전트')
    → folder_who

F3. 본인 vault의 *주제·기준 폴더*는? (예: '_위키' 또는 'docs/topics')
    → folder_topic

F4. 본인 vault의 *다이어그램 폴더*는? (예: '직능분석/sunmyung-ax-diagram')
    → folder_canvas

F5. 본인 vault의 *PHASE 파일 폴더*는? (예: '직능분석/_WorkLog')
    → folder_phase

F6. 본인 vault의 *원본 자료 폴더*는? (없으면 새로 'raw', 있으면 본인 폴더 예: 'archive')
    → folder_raw
```

CREATE 분기에서는 F1~F6를 묻지 않고 디폴트(`wiki`/`사례`/`주제`/`캔버스`/`_WorkLog`/`raw`)를 사용한다.

## 생성 결과 — `_meta/persona.md` frontmatter

응답을 받아 다음 형식으로 박는다:

```yaml
---
persona_name: "{Q1 응답}"
who_label: "{Q2 응답}"
topic_label: "{Q3 응답}"
kind_examples:
  - "{Q4 응답 항목 1}"
  - "{Q4 응답 항목 2}"
  - ...
folder_who: "{F2 응답 또는 디폴트 '사례' — 다단계 경로 OK 예: '직능분석/에이전트'}"
folder_topic: "{F3 응답 또는 디폴트 '주제' — 다단계 경로 OK}"
folder_wiki: "{F1 응답 또는 디폴트 'wiki'}"
folder_canvas: "{F4 응답 또는 디폴트 '캔버스'}"
folder_phase: "{F5 응답 또는 디폴트 '_WorkLog'}"
folder_raw: "{F6 응답 또는 디폴트 'raw'}"
example_topic: "{Q5 주제}"
example_who: "{Q5 주체}"
extra_properties:
  - status      # 진행중·완료·보류
  - "{직무별 추가 필드 — LLM 추론}"
sensitive: {Q6 응답: true|false}
created: {YYYY-MM-DD}
mode: {CREATE | ADOPT}    # healthcheck.ps1가 감지한 모드
# vault_root 분기:
#   sensitive: false → 절대경로 박기 (예: vault_root: "C:\Temp\my-vault")
#   sensitive: true  → vault 폴더명만 (예: vault_root: "my-vault") — 사용자 식별 가능 절대경로 노출 금지
vault_root: "{경로 또는 폴더명}"
---

# 본 vault 페르소나

이 vault는 {persona_name} 직무 전용입니다.
모드: {CREATE | ADOPT}
LLM은 후속 작업 시 이 매핑을 사용해 properties·폴더명·태그를 구성합니다.

## 변수 매핑 (LLM 자동 치환) — v0.2 6종 폴더 변수 포함

| 변수 | 값 |
|---|---|
| `{who_label}` | {who_label} |
| `{topic_label}` | {topic_label} |
| `{kind_examples}` | {kind_examples 배열} |
| `{folder_who}` | {folder_who}  ← 사례·주체 폴더 (다단계 OK) |
| `{folder_topic}` | {folder_topic}  ← 주제·기준 폴더 |
| `{folder_wiki}` | {folder_wiki}  ← 정제 위키 폴더 (v0.2 신규) |
| `{folder_canvas}` | {folder_canvas}  ← 다이어그램 폴더 (v0.2 신규) |
| `{folder_phase}` | {folder_phase}  ← PHASE 파일 폴더 (v0.2 신규) |
| `{folder_raw}` | {folder_raw}  ← 원본 자료 폴더 (v0.2 신규) |

## 도메인 확장 properties

direct 입력 외에 LLM이 직무별로 추가 추론한 properties:
{extra_properties 목록}
```

## ADOPT 모드 안전 원칙 (v0.2 신규)

- **본인 폴더 미수정** — F1~F6에서 본인 폴더로 매핑된 폴더는 절대 자동 변경 안 함
- `_meta/` 4파일만 신설 (persona·일관성카드·dashboard.base·lint.base)
- 본인 폴더가 슈퍼스킬 디폴트(`wiki`/`raw`/`캔버스`)와 다르면 *디폴트 폴더 신설 X* (이중 구조 방지)
- 기존 자료의 frontmatter 보강은 사용자 명시 요청 시 별도 단계 (Stage 2.5 — v0.3 예정)

## 금지 (하드코딩 페르소나 4종 금지 원칙)

다음 어휘는 LLM이 *추론에서 가져오는* 게 아니라 *사용자 응답에서만 박는다*:
- ❌ 회계사 (k-ifrs, 감사메모, 클라이언트 ...) 자동 추론 금지
- ❌ 변호사 (형법, 의견서, 의뢰인 ...) 자동 추론 금지
- ❌ 매체운영자 (취재원, 기사, 게이트키핑 ...) 자동 추론 금지
- ❌ 연구자 (논문, 가설, 피험자 ...) 자동 추론 금지

사용자가 직접 그 단어를 응답에서 말했을 때만 사용. LLM이 "회계사니까 클라이언트일 거야"라고 추측하지 않음 — 반드시 물어본다.

---

*출처: Oh My Wiki 페르소나 메타 변수 시스템 + 본 슈퍼스킬의 범용성 보장 원칙 (D3).*
*v1.1 (2026-05-27) — ADOPT 분기 + 폴더 매핑 질문 6종 + 변수 매핑 표 6변수 확장. healthcheck.ps1 v0.2 ADOPT 감지 로직과 정합.*
