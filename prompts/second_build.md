# 2차 빌드 프롬프트 (Stage 3B·3C)

> 1차 빌드 결과물을 5규칙에 맞춰 점검하고 교정하는 단계.
> **3B는 점검만 — 사용자 승인 후에만 3C 적용.** (자기 검증 금지 원칙)

## 사전 로드

1. `<vault>/_meta/일관성카드.md` — 5규칙
2. `<vault>/_meta/persona.md` — 어휘 사전
3. `<vault>/_meta/lint.base` — orphan/stale/conflict 뷰 (obsidian-bases)

## Stage 3B — 점검 (사용자 승인 게이트 ⚠️)

### 5규칙 위반 스캔

각 위키 노트(`<vault>/{folder_wiki}/*`, `<vault>/{folder_who}/*`, `<vault>/{folder_topic}/*`)에 대해 다음을 확인:

| # | 규칙 | 위반 패턴 | 검사 방법 |
|---|---|---|---|
| 1 | 네이밍 | 추상 제목 (예: `메모.md`, `Untitled.md`) | 파일명에 검색 가능 식별자(고유명사·번호) 부재 |
| 2 | 태그 4축 | frontmatter에 `time`/`who`/`topic`/`kind` 중 하나라도 누락 | YAML 파싱 |
| 3 | 링크 방향 | 추상 노트가 구체 노트를 가리킴 (역방향) | wikilink 그래프 분석 |
| 4 | 요약 1줄 | 본문 첫 줄에 "이 노트는 X에 대한 Y이다" 패턴 부재 | 본문 첫 줄 정규식 |
| 5 | 불완전 마커 | 모호 표현(예: "약 N건", "대략")이 마커 없이 박혀 있음 | LLM 정성 판단 |

### 추가 lint (obsidian-bases lint.base 결과 합산)

- **orphan** — `view_count` 0인 노트 (RAG 결합 vault인 경우)
- **stale** — `file.mtime` 30일+ 미수정
- **conflict** — 같은 제목·과도하게 유사한 본문

### 출력 — 점검 보고서 (사용자에게 표로 제시)

```
## 5규칙 위반 점검표 ({총 N건})

| # | 노트 | 위반 규칙 | 권고 교정 |
|---|---|---|---|
| 1 | {who}/메모.md | 네이밍 | "김OO_2025_사건메모.md"로 변경 |
| 2 | {topic}/가설.md | 태그 4축 (kind 누락) | kind: "검토메모" 추가 |
| 3 | {topic}/정당방위.md → {who}/김OO.md | 링크 방향 역방향 | 링크 제거 (백링크가 자동) |
| 4 | {who}/김OO_2025_사건메모.md | 요약 1줄 누락 | "이 노트는 김OO의 2025 형사사건에 대한 사건메모이다." 첫 줄 추가 |
| 5 | {topic}/정당방위_형법21조.md | 불완전 마커 누락 | "대략 50건" → "약 50건 [확인 필요]" |

## lint.base 추가 발견
- orphan: K건
- stale (30일+): M건
- conflict: P건 (제목 중복)

→ 위 N+K+M+P건을 적용하시겠습니까?
   [ Yes — 3C 적용 진행 ]
   [ No — 일부만 / 전체 보류 ]
```

### 절대 금지 (3B 단계)

- **사용자 응답 받기 전 적용 금지** — Read·검사만, Write·rename·property:set 일체 호출 금지
- **자기 검증 금지** — 이 점검표를 만든 LLM 인스턴스가 "통과"를 선언할 수 없음. 반드시 사용자 명시 승인.

## Stage 3C — 적용 (사용자 OK 후에만)

> **본문 변형 면제 조항**: 보호규칙 1(`{folder_raw}` 미수정)은 `{folder_raw}` 폴더만 적용된다. `{folder_wiki}`·`{folder_who}`·`{folder_topic}` 본문은 사용자 승인 후 다음 **3종 최소 변형**만 허용된다 — ① 첫 줄 요약 1줄 삽입 ② 역방향 wikilink 줄 제거 ③ `[확인 필요]` 마커 인라인 추가. 그 외 본문 문장·단어·숫자·고유명사는 한 글자도 변경 금지.

승인 받으면 다음 호출:

### 3C-1. 네이밍 교정
- `obsidian-cli rename` — 파일명 변경 (wikilink 자동 추적)

### 3C-2. 태그 4축 강제
- `obsidian-cli property:set` — frontmatter properties 추가·수정

### 3C-3. 링크 방향 정정
- 본문 직접 편집(파일시스템 쓰기) — 역방향 wikilink 제거. **본문 텍스트는 변경 금지**, wikilink 줄만 삭제.

### 3C-4. 요약 1줄 삽입
- 본문 첫 줄에 "이 노트는 ... 이다" 삽입 (기존 본문 그대로 유지)

### 3C-5. 불완전 마커 삽입
- 모호 표현 옆에 `[확인 필요]` 인라인 추가 (단어 자체는 변경 금지)

### 3C-6. orphan/stale/conflict 처리
- orphan → 본인 판단 위임 (자동 삭제 금지)
- stale → 본인 알림만 (재인제스트 권고)
- conflict → 사용자에게 머지 선택권 제시

### 3C 최종 보고

```
## 2차 빌드 적용 완료

- 네이밍 교정: {N}건
- 태그 4축 보강: {M}건
- 링크 방향 정정: {K}건
- 요약 1줄 삽입: {P}건
- 불완전 마커 삽입: {Q}건
- orphan/stale/conflict: 본인 검토 위임 ({R+S+T}건)

잔여 [확인 필요] 마커: {U}건 (본인 판단 필요)

vault 새로고침: scripts/postsetup_refresh.ps1 실행 완료 ✓
```

---

*출처: Oh My Wiki second_build.md + wiki-e-rag Lint (orphan/stale/conflict) + CLAUDE.md 자기 검증 금지 원칙.*
