#!/usr/bin/env node

/**
 * session-knowledge-trigger.js — SessionEnd hook (4·6단계 누적 트리거)
 *
 * 1차 증류(wiki-distill-worker.js)가 이번 세션 노트를 다 쓴 뒤에
 *   ① 2차 증류(wiki-topic-distill.js) — 미처리 노트가 임계치에 닿았을 때만 실제로 돈다
 *   ② 코퍼스 재생성(wiki-corpus-build.js) — 항상, LLM 호출 없이 빠르게
 * 를 이어서 돌린다.
 *
 * 종료를 붙잡지 않는다: detached로 떠서 1차 증류가 남긴 .distilling 마커가 사라질 때까지
 * 기다렸다가(최대 5분) 실행한다. 마커를 안 기다리면 방금 만든 세션 노트가 코퍼스에 빠진다.
 *
 * 재귀 방지: CLAUDE_WIKI_CHILD 가 있으면(=워커가 띄운 claude 세션) 아무것도 안 한다.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { sessionsAnchor } = require('./lib-project-dir');

const WAIT_MAX_MS = 5 * 60 * 1000;   // 1차 증류 대기 상한
const POLL_MS = 5000;

let buf = '';
let done = false;

function finish() {
  if (done) return;
  done = true;
  try {
    if (process.env.CLAUDE_WIKI_CHILD) return process.exit(0);

    let d = {};
    try { d = JSON.parse(buf || '{}'); } catch (e) {}

    const cwd = d.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
    // 1차 증류·복원 훅과 같은 기준(git 루트)을 써야 같은 sessions/ 를 본다.
    const projectDir = sessionsAnchor(cwd);

    // 자기 자신을 detached 자식으로 다시 띄우고(--run), 부모는 즉시 종료 → 세션 종료가 안 느려진다.
    const child = spawn(process.execPath, [__filename, '--run', projectDir], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, CLAUDE_WIKI_CHILD: '1' }
    });
    child.unref();
  } catch (e) {}
  process.exit(0);
}

// ── detached 실행부 ────────────────────────────────────────────────────────
function runDetached(projectDir) {
  const sessionsDir = path.join(projectDir, 'sessions');
  const marker = path.join(sessionsDir, '.distilling');
  const logFile = path.join(sessionsDir, '.knowledge-trigger.log');

  const log = (m) => {
    try {
      if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${m}\n`);
    } catch (e) {}
  };

  const started = Date.now();
  const step = () => {
    // 1차 증류가 아직 도는 중이면 기다린다. 마커가 없거나 상한을 넘으면 진행.
    if (fs.existsSync(marker) && Date.now() - started < WAIT_MAX_MS) {
      return setTimeout(step, POLL_MS);
    }
    log(`1차 증류 대기 종료 (${Math.round((Date.now() - started) / 1000)}s) — 2차 증류·코퍼스 진행`);

    // 볼트 등록 — 매일 도는 예약 작업이 "어느 볼트를 돌아야 하는지" 알 방법이 이것뿐이다.
    // 세션이 실제로 열린 곳만 등록되므로 안 쓰는 폴더까지 훑지 않는다.
    // 단, 실제로 노트가 쌓이는 곳만 등록한다 — 시스템 폴더에서 훅이 한 번 돌았다는 이유로
    // C:\WINDOWS\system32 같은 곳이 목록에 박히는 일이 실제로 있었다. (2026-09-09)
    try {
      if (!fs.existsSync(path.join(sessionsDir, 'wiki'))) {
        log('위키 노트가 없는 폴더 — 볼트로 등록하지 않음: ' + projectDir);
        return process.exit(0);
      }
      const reg = path.join(__dirname, '.vault-registry.json');
      let list = [];
      try { list = JSON.parse(fs.readFileSync(reg, 'utf8')); } catch (e) {}
      if (!Array.isArray(list)) list = [];
      const found = list.find(v => v.dir === projectDir);
      if (found) found.lastSeen = new Date().toISOString();
      else list.push({ dir: projectDir, lastSeen: new Date().toISOString() });
      fs.writeFileSync(reg, JSON.stringify(list, null, 2));
    } catch (e) {}

    // ① 2차 증류 (임계 미달이면 스스로 건너뛴다)
    const t = spawn(process.execPath, [path.join(__dirname, 'wiki-topic-distill.js'), projectDir], {
      stdio: 'ignore', windowsHide: true, env: { ...process.env, CLAUDE_WIKI_CHILD: '1' }
    });
    t.on('close', () => {
      // ② 코퍼스 재생성 — 2차 증류가 주제 노트를 갱신했다면 그것까지 담긴다.
      const c = spawn(process.execPath, [path.join(__dirname, 'wiki-corpus-build.js'), projectDir], {
        stdio: 'ignore', windowsHide: true, env: { ...process.env, CLAUDE_WIKI_CHILD: '1' }
      });
      c.on('close', () => { log('코퍼스 재생성 완료'); process.exit(0); });
      c.on('error', () => process.exit(0));
    });
    t.on('error', (e) => { log('2차 증류 spawn 오류: ' + e.message); process.exit(0); });
  };
  step();
}

if (process.argv[2] === '--run') {
  runDetached(process.argv[3] || process.cwd());
} else {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', c => { buf += c; });
  process.stdin.on('end', finish);
  setTimeout(finish, 2000);
}
