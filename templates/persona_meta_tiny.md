---
type: persona-meta-generator-tiny
version: 1.0
purpose: T0 Tiny 트랙 전용 — 작은 vault(.md < 10)에 최소 페르소나만 박음. 일관성카드·dashboard·lint 전부 생략. 질문 3종만.
---

# 페르소나 메타 Tiny — T0 Tiny 트랙 전용 (v0.6.0 신규)

이 템플릿은 *작은 vault*(.md < 10, 폴더 0~1개)에 슈퍼스킬을 적용할 때 사용된다. healthcheck.ps1이 vault 규모를 측정해 T0 Tiny를 자동 추천하면 본 템플릿으로 분기.

## 왜 Tiny인가

50+ 노트용 슈퍼스킬을 5 노트짜리 vault에 박으면:
- 메타 파일 비중 역전 (사용자 노트 5 vs `_meta/` 4파일)
- dashboard.base 4축 표 = 5행 표 → 무의미
- lint.base orphan/stale 판정 → 모든 노트가 orphan, stale 기준 없음
- 12+ 질문 시퀀스 → 5분 메모에 5분 셋업

T0 Tiny는 **persona.md 1파일만 박고 끝**. 셋업 2분.

## 질문 3종만 (Q1 + Q2 + Q3)

```
Q1. 이 vault에서 본인 직무·용도는?
    예시: 강의 노트 / 독서 메모 / 짧은 일기 / 개인 자료 정리 / 회계법인 AI 컨설팅
    → persona_name

Q2. 본인이 자주 다루는 *주체*는 뭐라 부르나? → who_label
    예시: 의뢰인 · 책 · 강의 · 메모 · (없으면 "항목")

Q3. 본인이 다루는 *주제 영역*은? → topic_label
    예시: 법률쟁점 · 독서 · 강의주제 · 일상 · (없으면 "주제")
```

T0 Tiny는 **kind_examples·sensitive·vault_role·폴더 매핑(F1~F6) 안 묻음**. 모두 디폴트.

## 생성 결과 — `_meta/persona.md` frontmatter (최소형)

```yaml
---
persona_name: "{Q1 응답}"
who_label: "{Q2 응답}"
topic_label: "{Q3 응답}"
kind_examples: ["메모"]        # T0 디폴트
folder_who: "사례/"             # T0 디폴트
folder_topic: "주제/"           # T0 디폴트
folder_wiki: "__unmapped__"    # T0은 wiki 빌드 안 함
folder_canvas: "__unmapped__"  # T0은 canvas 안 박음
folder_phase: "_WorkLog/"
folder_raw: "raw/"
sensitive: false               # T0 디폴트 — 변경 시 사용자가 직접 수정
vault_role: active
track: T0_Tiny                 # ✨ T0 표식
created: {YYYY-MM-DD}
mode: CREATE
vault_root: "{경로}"
---

# 본 vault 페르소나 (T0 Tiny)

이 vault는 {persona_name} 용도입니다.
**T0 Tiny 트랙** — 작은 vault용 최소 페르소나. 셋업 2분.

## 이 트랙에서 박는 것 / 안 박는 것

| 박음 | ✅ `_meta/persona.md` (이 파일) |
| 안 박음 | ❌ `_meta/일관성카드.md` (작은 vault엔 부담) |
| 안 박음 | ❌ `_meta/dashboard.base` (5행 표 무의미) |
| 안 박음 | ❌ `_meta/lint.base` (orphan/stale 판정 무의미) |

필요해지면 → 사용자가 vault를 키운 후 *"풀 슈퍼스킬 박아"* 한 마디로 T2로 승급.

## T0 → T2 승급 (선택)

vault가 30+ 노트로 성장하면 본 페르소나는 그대로 두고:
- `_meta/일관성카드.md` 추가
- `_meta/dashboard.base` 추가
- `_meta/lint.base` 추가
- 필요 시 `kind_examples`·`sensitive`·`vault_role`·폴더 매핑 보강

healthcheck.ps1이 LOAD 모드에서 vault 규모 재측정 → 자동 승급 추천.
```

## T0 Tiny 동작 규칙

1. **신설 파일은 `_meta/persona.md` 1개만**.
2. **1차 빌드(Stage 3A)는 prompts/t0_tiny_build.md 사용** — `raw/` 안 만들고, 단순 frontmatter 박기·파일명 정리만.
3. **2차 빌드 없음** — 작은 vault엔 lint 의미 없음.
4. **dashboard·lint base 안 박음** — 사용자가 명시 요청 시 한해 추가.
5. **kepano 5종 중 obsidian-markdown + obsidian-cli 만 사용** — bases·canvas·defuddle 안 부름.

## T0 부적합 신호 (자동 승급 제안)

LOAD 모드에서 vault 규모 재측정 시 `.md ≥ 30`이면 자동 안내:
```
ℹ 이 vault는 이제 30+ 노트입니다. T2 Structured로 승급할까요?
  추가될 파일: _meta/일관성카드.md, _meta/dashboard.base
  (kind_examples·vault_role 등 추가 질문 4개)
  진행 시: /claude-wiki-obsidian-vault-코어4 승급
```

---

*v1.0 (2026-05-29) — T0 Tiny 트랙 신설. PO 결정 "자동으로 분기". Why: 작은 vault(.md < 10)에 풀 슈퍼스킬은 비용 > 가치 — "소 잡는 칼" 문제.*
