#!/usr/bin/env node

/**
 * wiki-corpus-build.js — 코퍼스 빌더 (LLM-Wiki 6단계)
 *
 * 볼트에 흩어진 노트를 한 파일로 모아 "검색 대상 묶음"을 만든다.
 * 질문이 오면 이 코퍼스에서 관련 노트를 골라 Claude에게 건네는 것이 6단계 활용이다.
 *
 *   sessions/wiki/*.md      세션별 노트
 *   sessions/topics/*.md    주제별 노트 (2차 증류 산출물 — 가중치를 더 준다)
 *   sessions/summary/*.md   이어가기 요약
 *        │
 *        ▼
 *   sessions/corpus.jsonl   노트 1개 = 1줄 (경로·제목·요약1줄·태그4축·링크·갱신일·본문)
 *   sessions/corpus.index.json  역색인(토큰 → 노트) + 통계
 *
 * 벡터를 쓰지 않는다. 옵신 일관성 5규칙이 이미 (1)제목에 검색어를 넣고 (4)첫 줄에
 * "이 노트는 X에 대한 Y이다" 요약을 강제하므로, 규칙이 지켜진 볼트에서는 제목·요약·태그
 * 만으로도 상당히 걸린다. 자료가 늘어 이것만으로 부족해지면 그때 임베딩을 얹으면 된다.
 *
 * 실행:
 *   node wiki-corpus-build.js <projectDir>              # 코퍼스 재생성
 *   node wiki-corpus-build.js <projectDir> --query "질문"  # 코퍼스에서 관련 노트 검색
 */

const fs = require('fs');
const path = require('path');

const cwd = process.argv[2];
if (!cwd) { console.error('projectDir 인자가 필요하다'); process.exit(1); }

const qIdx = process.argv.indexOf('--query');
const QUERY = qIdx >= 0 ? (process.argv[qIdx + 1] || '') : null;
const TOP_N = 8;

const sessionsDir = path.join(cwd, 'sessions');
const corpusPath = path.join(sessionsDir, 'corpus.jsonl');
const indexPath = path.join(sessionsDir, 'corpus.index.json');
const logFile = path.join(sessionsDir, '.corpus.log');

// 노트 종류별 가중치 — 주제 노트(2차 증류)가 세션 노트보다 재사용 가치가 높다.
const SOURCES = [
  { dir: 'topics', kind: 'topic', weight: 3.0 },
  { dir: 'wiki', kind: 'session', weight: 1.0 },
  { dir: 'summary', kind: 'handoff', weight: 0.6 }
];

function log(m) {
  try {
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${m}\n`);
  } catch (e) {}
}

// 한글·영문·숫자 토큰. 한 글자 토큰은 노이즈라 버린다.
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/)
    .filter(t => t.length >= 2);
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: {}, body: raw };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_가-힣]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { fm, body: raw.slice(m[0].length) };
}

// 일관성 5규칙 중 (4) 요약 1줄 — 본문 첫 실질 문장을 요약으로 본다.
function firstMeaningfulLine(body) {
  for (const l of body.split('\n')) {
    const s = l.trim();
    if (!s) continue;
    if (s.startsWith('#') || s.startsWith('>') || s.startsWith('---')) continue;
    return s.slice(0, 200);
  }
  return '';
}

function extractLinks(body) {
  const out = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(body))) out.push(m[1].trim());
  return Array.from(new Set(out));
}

function build() {
  let docs = [];

  for (const src of SOURCES) {
    const dir = path.join(sessionsDir, src.dir);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md') || f === 'INDEX.md') continue;
      const full = path.join(dir, f);
      let raw;
      try { raw = fs.readFileSync(full, 'utf8'); } catch (e) { continue; }
      const { fm, body } = parseFrontmatter(raw);
      // 미확정 노트는 검색 대상에서 뺀다. 확정 근거로 쓰이면 안 되기 때문이다.
      // 자동 검증을 통과하지 못한 항목이 다음 답변의 근거가 되는 것을 막는 자리다. (2026-09-10)
      if (fm.type === 'unverified' || f.startsWith('_')) continue;
      const title = (body.match(/^#\s+(.+)$/m) || [])[1] || f.replace(/\.md$/, '');
      const stat = fs.statSync(full);

      docs.push({
        id: `${src.dir}/${f}`,
        path: full,
        kind: src.kind,
        weight: src.weight,
        title: title.trim(),
        summary: firstMeaningfulLine(body),
        // 옵신 태그 4축
        time: fm.time || fm.date || fm.updated || stat.mtime.toISOString().slice(0, 10),
        who: fm.who || '',
        topic: fm.topic || '',
        note_kind: fm.kind || fm.type || '',
        links: extractLinks(body),
        chars: body.length,
        body: body.trim()
      });
    }
  }

  // 같은 세션의 중복 노트 제거 — 세션 하나가 여러 번 끝나면 위키 노트가 여러 개 생긴다.
  // 훅에서 최신 1개만 남기도록 고쳤지만, 그 전에 쌓인 것이 남아 있으므로 여기서도 걸러낸다.
  // 파일명이 `<시각>_<세션ID>_위키.md` 라 세션 ID로 묶어 가장 최신 것만 남긴다. (2026-09-09)
  const bySid = new Map();
  const kept = [];
  for (const d of docs) {
    const m = d.id.match(/_([0-9a-f]{8}-[0-9a-f-]{27,})_/i);
    if (!m) { kept.push(d); continue; }
    const key = d.kind + '|' + m[1];
    const prev = bySid.get(key);
    if (!prev || String(d.id) > String(prev.id)) bySid.set(key, d);   // 파일명이 시각 프리픽스라 사전순=시간순
  }
  const dupDropped = docs.length - (kept.length + bySid.size);
  docs = kept.concat(Array.from(bySid.values()));
  if (dupDropped > 0) log(`같은 세션 중복 노트 ${dupDropped}건 제외`);

  // 역색인: 제목·요약·태그는 본문보다 무겁게 센다 (규칙 1·4가 여기 걸린다).
  const inverted = {};
  docs.forEach((d, i) => {
    const fields = [
      [d.title, 4], [d.summary, 3],
      [`${d.who} ${d.topic} ${d.note_kind}`, 3],
      [d.links.join(' '), 2], [d.body, 1]
    ];
    const seen = {};
    for (const [text, w] of fields) {
      for (const t of tokenize(text)) seen[t] = (seen[t] || 0) + w;
    }
    for (const [t, w] of Object.entries(seen)) {
      (inverted[t] = inverted[t] || []).push([i, w]);
    }
  });

  fs.writeFileSync(corpusPath, docs.map(d => JSON.stringify(d)).join('\n') + '\n');
  fs.writeFileSync(indexPath, JSON.stringify({
    built: new Date().toISOString(),
    docCount: docs.length,
    byKind: SOURCES.reduce((a, s) => (a[s.kind] = docs.filter(d => d.kind === s.kind).length, a), {}),
    tokenCount: Object.keys(inverted).length,
    inverted
  }));

  log(`코퍼스 생성 — 노트 ${docs.length}개 (주제 ${docs.filter(d => d.kind === 'topic').length} · 세션 ${docs.filter(d => d.kind === 'session').length} · 요약 ${docs.filter(d => d.kind === 'handoff').length}), 토큰 ${Object.keys(inverted).length}개`);
  return { docs, inverted };
}

function search(q) {
  let docs, inverted;
  if (fs.existsSync(corpusPath) && fs.existsSync(indexPath)) {
    docs = fs.readFileSync(corpusPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    inverted = JSON.parse(fs.readFileSync(indexPath, 'utf8')).inverted;
  } else {
    ({ docs, inverted } = build());
  }

  const scores = new Map();
  for (const t of tokenize(q)) {
    const hits = inverted[t];
    if (!hits) continue;
    // 흔한 토큰은 변별력이 낮으므로 가중치를 낮춘다 (idf 근사).
    const idf = Math.log(1 + docs.length / hits.length);
    for (const [i, w] of hits) {
      scores.set(i, (scores.get(i) || 0) + w * idf * (docs[i].weight || 1));
    }
  }

  const ranked = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([i, s]) => ({ score: Number(s.toFixed(2)), ...docs[i] }));

  if (!ranked.length) {
    console.log('관련 노트를 찾지 못했다. 질문의 고유명사(파일명·프로젝트명·번호)를 넣어 다시 물어보라.');
    return;
  }

  console.log(`# 질문: ${q}\n`);
  console.log(`관련 노트 ${ranked.length}개를 코퍼스에서 골랐다. 아래를 근거로 답하고, 각 주장마다 출처 노트를 밝혀라.\n`);
  for (const r of ranked) {
    console.log(`---\n## [${r.kind}] ${r.title}`);
    console.log(`출처: ${r.id}  ·  갱신: ${String(r.time).slice(0, 10)}  ·  점수: ${r.score}`);
    if (r.summary) console.log(`요약: ${r.summary}`);
    console.log('');
    console.log(r.body.slice(0, 2500));
    console.log('');
  }
}

try {
  if (QUERY) search(QUERY);
  else {
    const { docs } = build();
    console.log(`코퍼스 생성 완료 — 노트 ${docs.length}개`);
    console.log(`  ${corpusPath}`);
    console.log(`  ${indexPath}`);
  }
} catch (e) {
  log('예외: ' + (e && e.message));
  console.error('오류:', e && e.message);
  process.exit(1);
}
