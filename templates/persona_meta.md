---
type: persona-meta-generator
version: 1.2
purpose: 신규 vault(CREATE) 또는 기존 vault(ADOPT) 어휘 사전 즉석 생성. 하드코딩 4종 금지. v0.3에서 vault_role + __unmapped__ 지원.
---

# 페르소나 메타 — 즉석 생성기 (v0.3: CREATE + ADOPT + vault_role + __unmapped__)

이 템플릿은 vault 부트스트랩 시 사용된다:
- **Stage 1 CREATE 분기** — 신규 vault에 페르소나 신설 (질문 5종 + 보조 1종 + vault_role 디폴트 active)
- **Stage 1 ADOPT 분기** — 기존 vault 흡수 (질문 5종 + 보조 1종 + **vault_role 질문 1종** + **폴더 매핑 질문 6종**, `__unmapped__` 허용)

## 질문 5종 + 보조 1종 (CREATE·ADOPT 공통)

```
Q1. 이 vault에서 본인 직무는?
    예시 응답: 변호사 (형사사건) / 데이터 사이언티스트 / 셰프 / 작곡가 / 도서관 사서 / 회계법인 AI 컨설팅 ...

Q2. 본인이 자주 다루는 *주체*(사람/조직)는 뭐라 부르나? → who_label
    예시: 의뢰인 · 환자 · 거래처 · 인터뷰이 · 학생 · 클라이언트 · 멘티 · 직능

Q3. 본인이 다루는 *주제 영역*은? → topic_label
    예시: 법률쟁점 · 진단 · 과목 · 취재주제 · 모델 아키텍처 · 레시피 · 작품 · AI 에이전트

Q4. 본인이 만드는 *문서 종류*는 주로 뭘 만드나? (복수) → kind_examples
    예시: 의견서 · 차트 · 메모 · 평가서 · 강의안 · 회의록 · 실험노트 · 에이전트 카드

Q5. 예시 주제 1개 + 예시 주체 1개를 들어줘
    예시: 정당방위(주제) / 김OO(주체)

Q6. (추가) sensitive 플래그 — 민감정보 포함 vault인가? (true/false)
    true면 작업 시작 시 "클라우드 동기화 금지" 경고 출력.
```

## vault_role 질문 1종 (ADOPT 분기 — v0.3 신규)

```
R1. 이 vault의 성격은? (active / archive / hybrid)
    - active   : 계속 작업 중. 1·2차 빌드·저장 등 모든 기능 사용
    - archive  : 영구 보관소. 새 파일 박지 않음. _meta/만 박고 끝
    - hybrid   : 일부 폴더는 active, 일부는 archive. F1~F6에서 __unmapped__ 적절히
```

CREATE 분기에서는 R1 안 물음 (디폴트 `active`).

## 폴더 매핑 질문 6종 (ADOPT 분기 전용)

vault 트리 자동 스캔 결과를 함께 제시. 각 질문에 `__unmapped__` 응답 가능 (v0.3 신규).

```
F1. 본인 vault의 *위키 폴더*는?
    A. 본인 폴더명 (예: '_위키')
    B. __unmapped__  ← 위키 빌드 자체 안 함 (archive vault)
    → folder_wiki

F2. 본인 vault의 *사례·주체 폴더*는? (다단계 OK)
    A. 본인 폴더명 (예: '직능분석/에이전트')
    B. __unmapped__
    → folder_who

F3. 본인 vault의 *주제·기준 폴더*는?
    A. 본인 폴더명
    B. __unmapped__
    → folder_topic

F4. 본인 vault의 *다이어그램 폴더*는?
    A. 본인 폴더명
    B. __unmapped__  ← canvas 안 박음
    → folder_canvas

F5. 본인 vault의 *PHASE 파일 폴더*는?
    A. 본인 폴더명
    B. __unmapped__  ← PHASE 파일 안 박음
    → folder_phase

F6. 본인 vault의 *원본 자료 폴더*는?
    A. 본인 폴더명 (예: 'archive', '직능분석/_extract')
    B. __unmapped__  ← raw 작업 안 함 (archive vault에서 일반적)
    → folder_raw
```

## 생성 결과 — `_meta/persona.md` frontmatter

```yaml
---
persona_name: "{Q1 응답}"
who_label: "{Q2 응답}"
topic_label: "{Q3 응답}"
kind_examples:
  - "{Q4 응답 항목 1}"
  - "{Q4 응답 항목 2}"
folder_who: "{F2 응답 — 본인 폴더 또는 __unmapped__}"
folder_topic: "{F3 응답}"
folder_wiki: "{F1 응답}"
folder_canvas: "{F4 응답}"
folder_phase: "{F5 응답}"
folder_raw: "{F6 응답}"
example_topic: "{Q5 주제}"
example_who: "{Q5 주체}"
extra_properties:
  - status
  - "{직무별 추가 필드 — LLM 추론}"
sensitive: {Q6 응답: true|false}
vault_role: {R1 응답: active | archive | hybrid}    # v0.3 신규
created: {YYYY-MM-DD}
mode: {CREATE | ADOPT}
# vault_root 분기:
#   sensitive: false → 절대경로 박기
#   sensitive: true  → vault 폴더명만
vault_root: "{경로 또는 폴더명}"
---

# 본 vault 페르소나

이 vault는 {persona_name} 직무 전용입니다.
모드: {CREATE | ADOPT}
역할: {active | archive | hybrid}
LLM은 후속 작업 시 이 매핑을 사용해 properties·폴더명·태그를 구성합니다.

## 변수 매핑 (v0.3 — 어휘 3종 + 폴더 6종 + vault_role)

| 변수 | 값 |
|---|---|
| `{who_label}` | {who_label} |
| `{topic_label}` | {topic_label} |
| `{kind_examples}` | {kind_examples 배열} |
| `{folder_who}` | {folder_who 또는 __unmapped__} |
| `{folder_topic}` | {folder_topic 또는 __unmapped__} |
| `{folder_wiki}` | {folder_wiki 또는 __unmapped__} |
| `{folder_canvas}` | {folder_canvas 또는 __unmapped__} |
| `{folder_phase}` | {folder_phase 또는 __unmapped__} |
| `{folder_raw}` | {folder_raw 또는 __unmapped__} |
| `vault_role` | {active | archive | hybrid} |

## `__unmapped__` 동작 규칙

폴더 변수 값이 `__unmapped__`이면 그 폴더 관련 *모든 작업을 건너뜀*:
- Stage 2 시딩 시 신설하지 않음
- 1·2차 빌드 시 읽지 않음
- dashboard.base / lint.base가 그 폴더 안 노트를 스캔하지 않음
- `[[wikilink]]`에서 해당 폴더 참조하지 않음

archive vault 예시:
- `folder_wiki: __unmapped__` — 위키 빌드 자체 안 함
- `folder_raw: __unmapped__` — raw 작업 안 함
- `folder_canvas: __unmapped__` — 다이어그램 안 박음
```

## ADOPT + archive 모드 안전 원칙 (v0.4 표현 통일)

- **본인 폴더 미수정** — F1~F6에서 본인 폴더로 매핑된 폴더는 절대 자동 변경 안 함
- **`__unmapped__` 폴더 완전 무시** — 신설·읽기·빌드 모두 안 함
- **사용자 콘텐츠 폴더 신설·수정 금지** — `_meta/` 관리 파일 4개(persona·일관성카드·dashboard.base·lint.base)만 신설 OK (모든 vault_role 공통)
- **archive vault → Stage 3 차단** — 1·2차 빌드 자체 안 함. T1 "저장해" 트리거 시 사용자 안내. lint.base 점검만 가능
- 기존 자료 frontmatter 보강은 사용자 명시 요청 시만 (v0.5 Stage 2.5 예정)

## 금지 (하드코딩 페르소나 4종 금지 원칙)

다음 어휘는 LLM이 *추론*에서 가져오지 말고 *사용자 응답에서만 박는다*:
- ❌ 회계사 (k-ifrs, 감사메모, 클라이언트 ...) 자동 추론 금지
- ❌ 변호사 (형법, 의견서, 의뢰인 ...) 자동 추론 금지
- ❌ 매체운영자 (취재원, 기사, 게이트키핑 ...) 자동 추론 금지
- ❌ 연구자 (논문, 가설, 피험자 ...) 자동 추론 금지

---

*출처: Oh My Wiki 페르소나 메타 + 본 슈퍼스킬 범용성 원칙 (D3) + 원성묵 원장 v0.3 의견 (vault_role + __unmapped__).*
*v1.2 (2026-05-27) — vault_role 질문 1종 + `__unmapped__` 키워드 정식 지원.*
