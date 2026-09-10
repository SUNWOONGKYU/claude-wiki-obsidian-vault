#!/usr/bin/env node

/**
 * pre-compact-handoff.js — PreCompact hook (컴팩트 직전 핸드오프 생성)
 *
 * 목적: 오토컴팩트를 켜고도 exit 없이 장기 작업을 이어가기.
 *   컴팩션은 모델에게 보내는 컨텍스트를 잘라내므로 직후 작업 품질이 떨어진다("흐리멍텅").
 *   이 훅이 컴팩션 직전에 Sonnet으로 상세 핸드오프를 만들어 두면,
 *   컴팩션 직후 발화하는 SessionStart(source=compact)에서 session-restore.js가 그걸 주입한다.
 *   → exit → 재시작으로 얻던 '선명한 이어가기'를 세션을 끊지 않고 얻는다.
 *
 * 검증된 전제 (claude.exe v1.0.120 스키마 실측, 2026-09-09):
 *   PreCompact   입력 = { session_id, transcript_path, cwd, trigger: "manual"|"auto", custom_instructions }
 *   SessionStart 입력 = { ..., source: "startup"|"resume"|"clear"|"compact" }
 *   컨텍스트 주입 가능 이벤트 = SessionStart / UserPromptSubmit / UserPromptExpansion 뿐
 *     → PreCompact 자신은 주입 불가. 파일로 넘기고 SessionStart가 주입하는 구조인 이유.
 *
 * ★ raw(.jsonl)는 절대 저장하지 않는다 ★
 *   ① 컴팩션은 transcript 파일을 in-place로 이어 쓴다(실측: 컴팩트 지점 앞뒤가 한 파일에 공존)
 *      → 컴팩션으로 원본이 유실되지 않으므로 여기서 뜰 이유가 없다.
 *   ② session-save-raw.js는 같은 session_id 파일이 있으면 SessionEnd에서 스킵한다.
 *      여기서 raw를 저장하면 세션 종료 시 '이미 저장됨'으로 건너뛰어 컴팩트 이후 작업분이 통째로 빠진다.
 *
 * 이중저장 차단: 산출물은 sessions/compact/<sid>_핸드오프.md 단 1개(덮어쓰기).
 *   같은 세션에서 컴팩트가 N번 나도 파일은 1개다. summary/·wiki/·INDEX.md는 건드리지 않으므로
 *   SessionEnd가 만드는 정식 산출물(raw 1 + 요약 1 + 위키 1)과 겹치지 않는다.
 *
 * 절대 컴팩션을 막지 않는다 — 어떤 오류에서도 exit 0.
 *   (exit 2면 Claude Code가 "Compaction blocked by PreCompact hook"으로 컴팩션을 중단시킨다.)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { sessionsAnchor } = require('./lib-project-dir');

const HARD_BUDGET_MS = 110000; // 워커 자체 상한 90s + 기동 여유. settings.json 의 timeout(120)보다 작아야 한다.

let buf = '';
let done = false;

// 워커와 동일 기준: user 메시지 2개 이상이어야 '사람이 작업 중인 세션'.
// 서브에이전트·워크플로·wiki 워커 세션이 컴팩트돼도 핸드오프를 만들지 않는다.
function isInteractiveSession(transcriptPath) {
  try {
    const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
    let userCount = 0;
    for (const ln of lines) {
      const s = ln.trim(); if (!s) continue;
      let o; try { o = JSON.parse(s); } catch { continue; }
      if (o.type === 'user') userCount++;
      if (userCount >= 2) return true;
    }
    return false;
  } catch { return true; }
}

function finish() {
  if (done) return;
  done = true;
  try {
    // 재귀 방지: 이 훅이 띄운 claude -p 자식 세션이 다시 컴팩트돼도 아무것도 하지 않는다.
    if (process.env.CLAUDE_WIKI_CHILD) return process.exit(0);

    let d = {};
    try { d = JSON.parse(buf || '{}'); } catch (e) {}

    const cwd = d.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const transcript = d.transcript_path;
    const trigger = d.trigger || 'unknown'; // "manual" | "auto"
    const sid = String(d.session_id || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);

    if (!transcript || !fs.existsSync(transcript)) {
      console.log('[pre-compact-handoff] transcript 없음 — 건너뜀');
      return process.exit(0);
    }
    if (!isInteractiveSession(transcript)) {
      console.log('[pre-compact-handoff] 비인터랙티브 세션 — 건너뜀');
      return process.exit(0);
    }

    const projectDir = sessionsAnchor(cwd); // SessionEnd·SessionStart와 동일 앵커여야 같은 곳을 읽는다
    const worker = path.join(__dirname, 'wiki-distill-worker.js');

    // 동기 실행: 핸드오프가 완성된 뒤에 컴팩션이 진행돼야 SessionStart가 그걸 읽을 수 있다.
    // detached로 띄우면 SessionStart(수 초 뒤)가 아직 없는 파일을 읽게 된다.
    console.log(`[pre-compact-handoff] ${trigger} 컴팩트 감지 — 핸드오프 생성 중(최대 ${HARD_BUDGET_MS / 1000}s)...`);
    const r = spawnSync(process.execPath, [worker, transcript, projectDir, sid, '--compact'], {
      timeout: HARD_BUDGET_MS,
      windowsHide: true,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_WIKI_CHILD: '1' }
    });

    const out = path.join(projectDir, 'sessions', 'compact', `${sid}_핸드오프.md`);
    if (fs.existsSync(out)) {
      console.log(`[pre-compact-handoff] 핸드오프 준비 완료 → ${out}`);
    } else {
      // 실패해도 컴팩션은 그대로 진행된다. 주입할 게 없을 뿐, 지금까지의 동작과 동일.
      console.log(`[pre-compact-handoff] 핸드오프 생성 실패(${r.error ? r.error.message : 'timeout/무산출'}) — 컴팩션은 그대로 진행`);
    }
  } catch (e) {
    console.error('[pre-compact-handoff] 실패(무시): ' + e.message);
  }
  process.exit(0); // 무슨 일이 있어도 컴팩션을 막지 않는다
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { buf += c; });
process.stdin.on('end', finish);
setTimeout(finish, 4000); // stdin이 안 닫히는 환경 대비
