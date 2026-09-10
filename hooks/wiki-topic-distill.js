#!/usr/bin/env node

/**
 * wiki-topic-distill.js — 2차 증류 워커 (LLM-Wiki 4단계)
 *
 * 1차 증류가 만든 세션별 위키 노트를 가로질러 읽어
 * "결정 / 패턴 / 함정" 주제별 지식 노트로 다시 묶는다.
 *
 *   sessions/wiki/*.md    세션별 — 그날 무슨 일을 했나
 *        │  2차 증류 + 자동 검증
 *        ▼
 *   sessions/topics/결정.md · 패턴.md · 함정.md      확정 지식
 *   sessions/topics/_미확정.md                        검증 실패분 격리
 *
 * 설계 원칙 (2026-09-10 개정)
 *  · 사람 승인 대기열을 만들지 않는다. 정상 항목은 곧바로 반영하고,
 *    검증에 실패한 항목만 미확정으로 격리해 다음 회차에 다시 본다.
 *  · AI에게 파일명을 쓰게 하지 않는다. [S1]·[S2] 슬롯 번호만 인용하게 하고
 *    실제 파일명은 프로그램이 대응시킨다. 링크가 깨질 여지를 원천 차단한다.
 *  · 작성과 검증을 분리한다. 같은 호출이 자기 결과를 검증하면 같은 실수를 놓친다.
 *
 * 실행:
 *   node wiki-topic-distill.js <projectDir>          # 미처리 노트가 임계치 이상일 때만
 *   node wiki-topic-distill.js <projectDir> --force  # 즉시 실행
 *
 * 인증: 잘못된 ANTHROPIC_API_KEY 제거 후 OAuth(구독) 사용. API 키 과금 없음.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 인프라 실패(구독 한도·인증)는 내용 실패가 아니다. 저장을 보류하고 다음 회차에 다시 한다.
const INFRA_RE = /weekly limit|usage limit|session limit|hit your .{0,20}limit|rate limit|Invalid API key|Fix external API key|insufficient.{0,10}credit|connectors are disabled|Not logged in|Please run \/login/i;
const isInfraError = (t) => !!t && INFRA_RE.test(t);

const THRESHOLD = 5;        // 미처리 노트가 이만큼 쌓이면 자동 실행
const MAX_INPUT = 90000;    // 입력 상한(자)
const MAX_RETRY = 2;        // 검증 실패 시 재작성 횟수 상한
const TOPICS = ['결정', '패턴', '함정'];
const MODEL = 'claude-sonnet-4-6';

const cwd = process.argv[2];
const FORCE = process.argv.includes('--force');
if (!cwd) { console.error('projectDir 인자가 필요하다'); process.exit(1); }

const sessionsDir = path.join(cwd, 'sessions');
const wikiDir = path.join(sessionsDir, 'wiki');
const topicsDir = path.join(sessionsDir, 'topics');
const unverifiedPath = () => path.join(topicsDir, '_미확정.md');
const historyDir = path.join(topicsDir, '_history');
const statePath = path.join(sessionsDir, '.topic-distill.state.json');
const logFile = path.join(sessionsDir, '.topic-distill.log');
const lockPath = path.join(sessionsDir, '.topic-distilling');

function log(m) {
  try {
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${m}\n`);
  } catch (e) {}
}
const readState = () => { try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (e) { return { done: [], lastRun: null }; } };
const writeState = (s) => { try { fs.writeFileSync(statePath, JSON.stringify(s, null, 2)); } catch (e) {} };

function acquireLock() {
  try {
    if (fs.existsSync(lockPath)) {
      const age = Date.now() - Number(fs.readFileSync(lockPath, 'utf8') || 0);
      if (age < 30 * 60 * 1000) return false;
    }
    fs.writeFileSync(lockPath, String(Date.now()));
    return true;
  } catch (e) { return true; }
}
const releaseLock = () => { try { fs.unlinkSync(lockPath); } catch (e) {} };

// claude CLI 1회 호출. 구독(OAuth)으로 돈다.
function callClaude(prompt, input, budgetMs, cb) {
  // 큰따옴표가 프롬프트에 들어가면 명령행 인용이 깨져 빈 출력이 난다. 항상 치환한다.
  const safe = String(prompt).replace(/"/g, "'").replace(/\s+/g, ' ');
  const cmd = `claude -p "${safe}" --model ${MODEL} --dangerously-skip-permissions`;
  const env = { ...process.env, CLAUDE_WIKI_CHILD: '1' };
  delete env.ANTHROPIC_API_KEY;
  let out = '', err = '', timedOut = false;
  const ch = spawn(cmd, { shell: true, env, windowsHide: true });
  ch.stdout.on('data', d => out += d.toString());
  ch.stderr.on('data', d => err += d.toString());
  const killer = setTimeout(() => { timedOut = true; try { ch.kill(); } catch (e) {} }, budgetMs);
  ch.on('error', e => { clearTimeout(killer); cb('', err, true); });
  ch.on('close', () => { clearTimeout(killer); cb((out || '').trim(), err, timedOut); });
  ch.stdin.write(input);
  ch.stdin.end();
}

function main() {
  if (!fs.existsSync(wikiDir)) { log('wiki/ 없음 — 건너뜀'); return; }

  const state = readState();
  const doneSet = new Set(state.done || []);
  const all = fs.readdirSync(wikiDir).filter(f => f.endsWith('.md') && f !== 'INDEX.md').sort();

  // 같은 세션이 여러 번 끝나 노트가 여러 개면 최신 1개만 본다.
  const bySid = new Map();
  for (const f of all) {
    const m = f.match(/_([0-9a-f]{8}-[0-9a-f-]{27,})_/i);
    if (!m) { bySid.set(f, f); continue; }
    const prev = bySid.get(m[1]);
    if (!prev || f > prev) bySid.set(m[1], f);
  }
  const unique = Array.from(bySid.values()).sort();
  const fresh = unique.filter(f => !doneSet.has(f));

  if (!fresh.length) { log('새 세션 노트 없음 — 건너뜀'); return; }
  if (!FORCE && fresh.length < THRESHOLD) { log(`새 노트 ${fresh.length}개 < 임계 ${THRESHOLD} — 대기`); return; }
  if (!acquireLock()) { log('다른 2차 증류가 실행 중 — 건너뜀'); return; }
  process.on('exit', releaseLock);

  if (!fs.existsSync(topicsDir)) fs.mkdirSync(topicsDir, { recursive: true });
  if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

  // ── 입력 조립 ─────────────────────────────────────────────────────────
  // 핵심: 파일명을 프롬프트에 넣지 않는다. 슬롯 번호 [S1]..[Sn]만 준다.
  // AI가 파일명을 만들어 쓸 수 없으므로 링크가 깨질 여지가 사라진다.
  let existing = '';
  for (const t of TOPICS) {
    const p = path.join(topicsDir, `${t}.md`);
    if (fs.existsSync(p)) existing += `\n===== 기존 주제 노트: ${t} =====\n` + bodyOf(fs.readFileSync(p, 'utf8')) + '\n';
  }

  const slots = [];
  let budget = MAX_INPUT - existing.length;
  for (let i = fresh.length - 1; i >= 0; i--) {
    const body = fs.readFileSync(path.join(wikiDir, fresh[i]), 'utf8').trim();
    const id = 'S' + (fresh.length - i);
    const block = `\n===== [${id}] =====\n${body}\n`;
    if (block.length > budget) break;
    budget -= block.length;
    slots.unshift({ id, file: fresh[i], body, block });
  }
  if (!slots.length) { log('입력 상한 초과 — 노트를 하나도 못 담음'); return releaseLock(); }

  // 슬롯 번호를 앞에서부터 다시 매긴다(S1이 가장 오래된 것)
  slots.forEach((s, i) => { const id = 'S' + (i + 1); s.block = s.block.replace(`[${s.id}]`, `[${id}]`); s.id = id; });
  const slotMap = new Map(slots.map(s => [s.id, s]));
  const input = existing + slots.map(s => s.block).join('');
  log(`[작성 시작] 새 노트 ${slots.length}/${fresh.length}개, 기존 주제 ${existing ? '있음' : '없음'}, 입력 ${input.length}자`);

  const WRITE_PROMPT = [
    'The input contains (a) EXISTING topic notes and (b) NEW session notes, each wrapped in a slot header like [S1].',
    'First detect the input main language, then write ALL output in that same language.',
    'SECOND-STAGE DISTILLATION: read ACROSS the session notes and reorganize their knowledge into exactly three topic notes:',
    '@@@결정@@@ (decisions: what was decided, on what grounds, under what condition it would be revisited),',
    '@@@패턴@@@ (patterns: approaches that worked repeatedly, with the conditions under which they held),',
    '@@@함정@@@ (pitfalls: what went wrong, the signal that predicts it, how to avoid it).',
    'RULES.',
    '1) MERGE, do not append: if an existing entry covers the same thing, merge into it rather than duplicating.',
    '2) UPDATE superseded entries: if newer sessions changed the conditions, revise and keep the old state distinguishable from the current one.',
    '3) If results CONFLICT, record both and state under which condition each held. Do not pick one.',
    '4) Never state a single experience as a general rule. Always record the condition under which it applied.',
    '5) Never present a suggestion or proposal as a settled decision. If a session only proposed something, say so.',
    '6) CITATION FORMAT — this is critical. End every entry with the slot tags it came from, exactly like [S1] or [S2][S5].',
    'Use ONLY slot tags that appear in the input. Never write a file name, never invent a tag, never abbreviate.',
    '7) Preserve every existing entry unless merged or superseded. Do not silently drop knowledge.',
    'Format each entry as ## followed by a short title, then the body, then the slot tags on their own last line.',
    'Output exactly three sections, each marker alone on its own line, in the order 결정, 패턴, 함정. No preamble.'
  ].join(' ');

  attempt(1, null);

  function attempt(round, feedback) {
    // 재작성 지시는 짧게 준다. 반려 사유를 길게 붙이면 모델이 출력 형식을 놓친다(실측).
    const prompt = feedback
      ? WRITE_PROMPT + ' RETRY NOTICE: a separate verifier rejected these entries because the cited source did not support them: '
        + feedback + '. Either fix them so every claim is supported by the cited slot, or drop the unsupported parts.'
        + ' Keep all other entries. OUTPUT FORMAT IS UNCHANGED: the three markers @@@결정@@@ @@@패턴@@@ @@@함정@@@ each alone on its own line, in that order. Output nothing else.'
      : WRITE_PROMPT;

    callClaude(prompt, input, 900000, (full, err, timedOut) => {
      if (timedOut) { log(`작성 타임아웃 (회차 ${round}) — 저장 보류`); return releaseLock(); }
      if (isInfraError(full) || isInfraError(err)) { log('인프라 장애 — 저장 보류, 다음 회차 재시도'); return releaseLock(); }
      if (!full) { log('빈 출력 — 저장 보류. stderr: ' + err.slice(0, 200)); return releaseLock(); }

      const parsed = parseSections(full);
      if (!parsed) { log('마커 누락 — 저장 보류. 앞부분: ' + full.slice(0, 150)); return releaseLock(); }

      const entries = [];
      for (const t of TOPICS) for (const e of splitEntries(parsed[t])) entries.push({ topic: t, ...e });
      if (!entries.length) { log('항목 0개 — 저장 보류'); return releaseLock(); }

      // ── 근거 슬롯 검사 (기계) ───────────────────────────────────────
      // 입력에 없는 슬롯을 인용했으면 그 항목은 근거가 없는 것이다.
      let ghost = 0;
      for (const e of entries) {
        e.slots = e.slots.filter(id => { const ok = slotMap.has(id); if (!ok) ghost++; return ok; });
      }
      if (ghost) log(`입력에 없는 슬롯 인용 ${ghost}건 제거`);

      verify(entries, round, feedback);
    });
  }

  // ── 검증: 작성과 분리된 호출로 주장과 원문을 대조한다 ──────────────────
  function verify(entries, round, prevFeedback) {
    const targets = entries.filter(e => e.slots.length);   // 근거 없는 항목은 아래에서 미확정 처리
    if (!targets.length) return save(entries, [], round);

    // 검증 입력: 항목 + 그 항목이 인용한 원문만. 전체를 다시 넣지 않는다.
    let vin = '';
    targets.forEach((e, i) => {
      e.vid = 'E' + (i + 1);
      vin += `\n===== [${e.vid}] 주장 =====\n${e.title}\n${e.body}\n`;
      for (const id of e.slots) vin += `----- 근거 원문 [${id}] -----\n${slotMap.get(id).body.slice(0, 3000)}\n`;
    });

    const VERIFY_PROMPT = [
      'You are a verifier. You did NOT write this. Check each claim against the source text quoted right under it.',
      'For each entry [E1], [E2], ... judge:',
      '(a) RELEVANCE — does the cited source actually discuss this claim? A source that is about a different topic is a failure even if it exists.',
      '(b) FACTS — are numbers, dates, names, and stated conditions supported by the source?',
      '(c) STATUS — does the entry present a mere suggestion or proposal as if it were a settled decision? That is a failure.',
      'Output one line per entry, nothing else, in this exact form:',
      'E1 OK',
      'E2 FAIL reason in one short clause',
      'Judge only what the quoted source supports. If the source does not support the claim, fail it. Do not be generous.'
    ].join(' ');

    callClaude(VERIFY_PROMPT, vin, 600000, (vout, verr, vTimedOut) => {
      if (vTimedOut || isInfraError(vout) || isInfraError(verr) || !vout) {
        // 검증을 못 했다면 확정할 수 없다. 저장 보류하고 다음 회차에 다시 한다.
        log('검증 호출 실패 — 저장 보류, 다음 회차 재시도');
        return releaseLock();
      }
      const verdict = new Map();
      for (const line of vout.split('\n')) {
        const m = line.trim().match(/^\[?(E\d+)\]?\s+(OK|FAIL)\b\s*(.*)$/i);
        if (m) verdict.set(m[1].toUpperCase(), { ok: /ok/i.test(m[2]), reason: (m[3] || '').trim() });
      }
      const failed = targets.filter(e => verdict.get(e.vid) && !verdict.get(e.vid).ok);
      log(`검증 결과 — 판정 ${verdict.size}건, 실패 ${failed.length}건 (회차 ${round})`);

      if (failed.length && round < MAX_RETRY) {
        // 제목만, 최대 6개까지. 사유 원문은 로그에만 남긴다.
        const fb = failed.slice(0, 6).map(e => e.title.replace(/["`]/g, '').slice(0, 40)).join(' / ');
        log(`재작성 ${round + 1}회차 — 실패 항목: ${fb.slice(0, 200)}`);
        return attempt(round + 1, fb);
      }
      save(entries, failed, round);
    });
  }

  // ── 저장: 정상은 확정, 실패·무근거는 미확정으로 격리 ──────────────────
  function save(entries, failed, round) {
    const failSet = new Set(failed.map(e => e.vid));
    const now = new Date().toISOString();
    const confirmed = {}, unverified = [];
    TOPICS.forEach(t => confirmed[t] = []);

    for (const e of entries) {
      if (!e.slots.length) { unverified.push({ ...e, why: '근거 없음' }); continue; }
      if (failSet.has(e.vid)) { unverified.push({ ...e, why: '원문 대조 실패' }); continue; }
      confirmed[e.topic].push(e);
    }

    let wrote = 0;
    for (const t of TOPICS) {
      if (!confirmed[t].length) { log(`${t}: 확정 항목 없음 — 기존 노트 유지`); continue; }
      const p = path.join(topicsDir, `${t}.md`);
      if (fs.existsSync(p)) {   // 되돌릴 수 있도록 이전본을 이력으로 남긴다
        try { fs.copyFileSync(p, path.join(historyDir, `${t}_${now.replace(/[:.]/g, '-')}.md`)); } catch (e) {}
      }
      const head = ['---', 'type: topic-note', `topic: ${t}`, 'stage: 2차증류', `updated: ${now}`,
        `entries: ${confirmed[t].length}`, `verified: auto`, '---', '', `# ${t}`, ''].join('\n');
      const body = confirmed[t].map(e =>
        `## ${e.title}\n${e.body}\n${e.slots.map(id => `[[${slotMap.get(id).file.replace(/\.md$/, '')}]]`).join(' ')}\n`
      ).join('\n');
      fs.writeFileSync(p, head + body);
      wrote++;
    }

    // 미확정 격리 — 확정 노트에 섞지 않는다. 다음 회차에 다시 본다.
    if (unverified.length) {
      const head = ['---', 'type: unverified', `updated: ${now}`, `entries: ${unverified.length}`, '---', '',
        '# 미확정', '', '> 자동 검증을 통과하지 못한 항목이다. 확정 근거로 쓰지 않는다.',
        '> 관련 자료가 더 들어오면 다음 회차에 다시 검토된다.', ''].join('\n');
      fs.writeFileSync(unverifiedPath(),
        head + unverified.map(e => `## [${e.topic}] ${e.title}\n${e.body}\n사유: ${e.why}\n`).join('\n'));
    } else if (fs.existsSync(unverifiedPath())) {
      try { fs.unlinkSync(unverifiedPath()); } catch (e) {}
    }

    if (!wrote && !unverified.length) { log('저장할 것이 없음 — 커서 전진 안 함'); return releaseLock(); }

    // 커서 전진은 저장 성공 후에만. 실패했는데 전진하면 그 세션들이 영영 안 읽힌다.
    state.done = Array.from(new Set([...(state.done || []), ...slots.map(s => s.file)]));
    state.lastRun = now;
    writeState(state);
    log(`2차 증류 완료 — 주제 ${wrote}개 갱신, 확정 ${entries.length - unverified.length}건, 미확정 ${unverified.length}건, 노트 ${slots.length}개 처리 (작성 ${round}회차)`);
    releaseLock();
  }
}

// ── 파싱 도우미 ────────────────────────────────────────────────────────
function bodyOf(raw) {   // 프런트매터·제목·안내문을 걷어낸 본문만. 회차마다 머리말이 겹치는 것을 막는다.
  let t = raw.replace(/^---[\s\S]*?\n---\n?/, '');
  const i = t.search(/^##\s/m);
  return i >= 0 ? t.slice(i).trim() : t.trim();
}
function parseSections(full) {
  const lines = full.split('\n');
  const idx = {};
  for (const t of TOPICS) idx[t] = lines.findIndex(l => l.trim() === `@@@${t}@@@`);
  if (TOPICS.some(t => idx[t] < 0)) return null;
  const bounds = TOPICS.map(t => idx[t]).concat([lines.length]);
  const out = {};
  TOPICS.forEach((t, i) => out[t] = lines.slice(bounds[i] + 1, bounds[i + 1]).join('\n').trim());
  return out;
}
function splitEntries(section) {
  const out = [];
  const blocks = section.split(/^##\s+/m).map(s => s.trim()).filter(Boolean);
  for (const b of blocks) {
    const nl = b.indexOf('\n');
    const title = (nl < 0 ? b : b.slice(0, nl)).trim();
    let body = (nl < 0 ? '' : b.slice(nl + 1)).trim();
    const slots = Array.from(body.matchAll(/\[(S\d+)\]/g)).map(m => m[1]);
    body = body.replace(/\[(S\d+)\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (title) out.push({ title, body, slots: Array.from(new Set(slots)) });
  }
  return out;
}

try { main(); } catch (e) { log('예외: ' + (e && e.message)); releaseLock(); }
