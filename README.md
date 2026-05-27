# claude-wiki-obsidian-vault

자연어 한 줄로 **Claude·Wiki·Obsidian Vault**를 생성·갱신·흡수하는 Claude Code 슈퍼스킬.

- **3 모드**: CREATE (신규) / LOAD (기존) / **ADOPT (큰 vault 흡수)**
- **4 트랙**: T1 캐주얼 "저장해" / T2 구조화 부트스트랩 / **T2-A 흡수** / T3 RAG-ready
- **3 vault_role**: active / **archive** / hybrid
- **6 폴더 변수** + **`__unmapped__` 키워드**: 본인 vault 어휘에 완전 적응

페르소나는 vault에 박힙니다(`_meta/persona.md`). 회계사·변호사 같은 하드코딩 4종은 없습니다.

---

## 설치 (Claude Code 마켓플레이스)

```
/plugin marketplace add SUNWOONGKYU/claude-wiki-obsidian-vault
/plugin install claude-wiki-obsidian-vault@claude-wiki-obsidian-vault
```

또는 GitHub repo zip 다운로드 → `~/.claude/skills/`에 풀기.

## 사용법 — 자연어 한 줄

```
저장해                    → T1 캐주얼 (raw 자동 저장)
이 vault에 페르소나 박아  → ADOPT 모드 (기존 큰 vault 흡수)
vault 만들어              → T2 구조화 부트스트랩
archive vault 흡수        → T2-A + vault_role=archive
RAG 준비해                → T3 RAG-ready 셋업
1차 빌드 / 2차 빌드        → raw → wiki 빌드 파이프라인
```

## 의존성

- **Obsidian 1.12.7+** — Settings → General → Advanced → "Enable CLI"
- **kepano 5종 스킬**: `obsidian-markdown` · `obsidian-bases` · `json-canvas` · `obsidian-cli` · `defuddle`
- PowerShell (scripts/ 실행)
- T3 트랙 URL 정제 시: `npm install -g defuddle`

## 폴더 구조 (산출 vault)

```
<vault>/
├── _meta/                          ← 슈퍼스킬 신설 (모든 vault_role 공통)
│   ├── persona.md                  ← 어휘 사전 (Stage 1 결과)
│   ├── 일관성카드.md               ← 5규칙
│   ├── dashboard.base              ← 4축 표 (Obsidian Bases)
│   └── lint.base                   ← orphan/stale/4축누락/summary부재
├── {folder_raw}/                   ← raw 자료 (LLM 미수정)
├── {folder_wiki}/                  ← 정제 위키 노트
├── {folder_who}/                   ← 사례·주체 노트
├── {folder_topic}/                 ← 주제·기준 노트
└── {folder_canvas}/                ← 다이어그램
```

각 폴더 변수는 페르소나에 따라 본인 어휘로 매핑 (예: `_위키`, `직능분석/에이전트`). `__unmapped__` 값을 박으면 해당 폴더 작업 자체를 건너뜁니다.

## 5규칙 + 4축 (Oh My Wiki 패턴)

1. **네이밍** — 노트 제목에 검색어 포함
2. **태그 4축** — `time` · `who` · `topic` · `kind`
3. **링크 방향** — 구체 → 추상 한 방향
4. **요약 1줄** — "이 노트는 X에 대한 Y이다"
5. **불완전 마커** — `[확인 필요]` / `[질문]`

## 출처 — Oh My Wiki 외부 derivative

- **Oh My Wiki** (5규칙·4축·페르소나 메타 IP): https://github.com/simonsez9510/oh-my-wiki — 원성묵 (Seongmuk Won)
- 본 슈퍼스킬은 Oh My Wiki v1.x의 *하드코딩 4종 페르소나*를 **vault-embedded 메타 페르소나**로 일반화하고, ADOPT 모드·6 폴더 변수·vault_role·`__unmapped__` 키워드를 추가한 외부 derivative입니다.
- Oh My Wiki 원장 검증 의견(v0.3·v0.4) 반영. 자세한 내용은 SKILL.md 변경 이력 참조.

## 변경 이력 (요약)

- **0.4.0 (2026-05-28)** — Codex(GPT) 외부 검증 88/100 반영. High 2 + Medium 3 해소 (자리표시자 wikilink 자기모순 / `__unmapped__` 다중 차단 / healthcheck 안내 보강 / archive 정책 통일)
- **0.3.0 (2026-05-27)** — 원성묵 원장 v0.3 의견 반영 (`vault_role` + `__unmapped__` + 변수 치환 규칙 + 본문↔부속 정합성 체크리스트)
- **0.2.x (2026-05-27)** — ADOPT 모드 + T2-A 트랙 + 폴더 변수 6종 + `templates/dashboard.base`·`lint.base` 정식 템플릿화
- **0.1.0 (2026-05-27)** — 초기 작성

## 디렉토리

```
.
├── SKILL.md                                    ← 슈퍼스킬 본체 (디렉터·오케스트레이터)
├── claude-wiki-obsidian-vault-architecture.svg ← 관계도+흐름도 통합 다이어그램
├── .claude-plugin/                             ← 마켓플레이스 메타
│   ├── marketplace.json
│   └── plugin.json
├── templates/                                  ← Stage 2 시딩 템플릿
│   ├── persona_meta.md
│   ├── 일관성카드.md
│   ├── dashboard.base
│   └── lint.base
├── prompts/                                    ← Stage 3 빌드 프롬프트
│   ├── first_build.md
│   └── second_build.md
└── scripts/                                    ← Stage 0·후처리 PowerShell
    ├── healthcheck.ps1                          ← Obsidian CLI + kepano 5종 + vault_role 자동 감지
    └── postsetup_refresh.ps1
```

## License

MIT (Oh My Wiki와 동일 라이선스 — derivative 허용).

## 작성자

선웅규 (Sunwoongkyu) — wksun999@hanmail.net — https://github.com/SUNWOONGKYU
