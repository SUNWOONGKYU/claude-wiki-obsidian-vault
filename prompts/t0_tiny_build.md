# t0_tiny_build.md — T0 Tiny 트랙 빌드 절차 (v0.6.0 신규)

작은 vault(.md < 10, 폴더 0~1개)에 자동 분기되는 T0 Tiny 트랙의 빌드 절차. **단순함이 미덕**. 큰 vault용 1·2차 빌드와 다름.

## T0 Tiny 빌드 원칙

1. **2차 빌드 없음** — lint 의미 없는 규모이므로 자기 검증·승인 게이트 생략.
2. **`raw/` 폴더 강제 신설 안 함** — 사용자가 이미 vault에 박은 파일이 곧 콘텐츠. raw 분리 불필요.
3. **3종 변형도 안 함** — 변형 대상이 5개 미만이라 비용 > 가치. 사용자가 명시 요청 시만.
4. **kepano 5종 중 markdown + cli 만** — bases·canvas·defuddle 부르지 않음.
5. **dashboard·lint 안 박음** — 박지 않으면 자기 검증할 게 없음.

## 절차 (4단계, 5분 이내)

### Stage T0-1 — 페르소나 박기 (1분)

`templates/persona_meta_tiny.md` 질문 3종(Q1·Q2·Q3) 사용자 응답 받음.

→ `_meta/persona.md` 1파일 신설:
```yaml
---
persona_name: "{Q1}"
who_label: "{Q2}"
topic_label: "{Q3}"
kind_examples: ["메모"]
folder_who: "사례/"
folder_topic: "주제/"
folder_wiki: "__unmapped__"
folder_canvas: "__unmapped__"
folder_phase: "_WorkLog/"
folder_raw: "raw/"
sensitive: false
vault_role: active
track: T0_Tiny
created: {YYYY-MM-DD}
mode: CREATE
vault_root: "{vault 경로}"
---

# {persona_name} 페르소나 (T0 Tiny)
```

### Stage T0-2 — 기존 .md 파일 frontmatter 보강 (2분)

vault 안 기존 .md 파일(< 10개) 각각:

1. frontmatter 없으면 추가:
   ```yaml
   ---
   topic:
   who:
   kind: 메모
   summary: "{1줄 요약 — LLM 생성}"
   ---
   ```
2. frontmatter 있으면 `summary` 줄만 보강 (없을 때).
3. **본문 변경 금지** — frontmatter만 박음.

> **주의**: T0 Tiny는 본문 변형 안 함. T2 이상에서만 본문 3종 변형 허용.

### Stage T0-3 — vault reload (10초)

`scripts/postsetup_refresh.ps1` 호출 — Obsidian이 frontmatter 변경 인식.

### Stage T0-4 — 완료 보고 (30초)

사용자에게 박은 것·안 박은 것 보고:

```
=== T0 Tiny 빌드 완료 ===
박은 것:
  ✓ _meta/persona.md (어휘 3종 + 디폴트 폴더)
  ✓ 기존 .md {N}개에 frontmatter 보강 (summary 1줄씩)
안 박은 것:
  ✗ _meta/일관성카드.md (T0 미사용)
  ✗ _meta/dashboard.base (T0 미사용)
  ✗ _meta/lint.base (T0 미사용)
  ✗ raw/ 폴더 (T0 미신설)
  ✗ {folder_canvas} (__unmapped__)
  ✗ {folder_wiki} (__unmapped__)

승급 안내:
  vault가 30+ 노트로 자라면 "/claude-wiki-obsidian-vault-코어4 승급" 으로 T2로 승급 가능.
  (일관성카드 + dashboard + lint 추가 박음)
```

## T0에서 T2로의 승급 (사용자 명시 요청 시)

healthcheck.ps1이 LOAD 모드에서 `.md ≥ 30` 감지 시 자동 안내 출력. 사용자가 *"승급해"* 한 마디 하면:

1. 기존 `_meta/persona.md`의 `track: T0_Tiny` → `track: T2_Structured` 변경
2. `kind_examples`·`sensitive`·`vault_role`·폴더 매핑(F1~F6) 추가 질문 4개
3. `_meta/일관성카드.md` + `dashboard.base` + `lint.base` 신설
4. `folder_wiki` / `folder_canvas` `__unmapped__` 해제 (사용자 매핑 받음)
5. T2 Stage 3 1·2차 빌드 절차로 이관

승급 시간: 약 10분.

## 보호 규칙 (T0 전용)

- **`raw/` 안 만듦** — T0은 raw 개념 미사용. SKILL.md 보호규칙 1(`{folder_raw}` 미수정 + 내부 신설 금지)은 T0에 적용 안 됨 (대상이 없음).
- **본문 미수정** — frontmatter만 박음. 본문 1글자도 안 바꿈.
- **`_meta/`에 persona.md 외 신설 금지** — 일관성카드·dashboard·lint *절대* 안 박음. 사용자 명시 요청해도 "T2 승급 추천" 안내 후 진행.
- **2차 빌드 자동 차단** — `prompts/second_build.md` 호출 안 됨. lint 의미 없으므로.

---

*v1.0 (2026-05-29) — T0 Tiny 빌드 절차 신설. PO 결정 "자동으로 분기". Why: 작은 vault에 1·2차 빌드는 과잉.*
