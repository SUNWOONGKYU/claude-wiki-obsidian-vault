#!/usr/bin/env node

/**
 * wiki-daily-run.js — 매일 도는 2차 증류·코퍼스 갱신 (윈도우 예약 작업이 부른다)
 *
 * 세션 종료 트리거(session-knowledge-trigger.js)만으로는 PC를 안 켠 날이나
 * 세션이 임계치에 못 닿은 날이 비어버린다. 하루 한 번 여기서 훑는다.
 *
 * 대상 볼트는 .vault-registry.json 에서 읽는다 — 세션이 실제로 열렸던 곳만 등록돼 있다.
 * REGISTRY_STALE_DAYS 넘게 안 쓴 볼트는 건너뛴다(오래된 프로젝트까지 매일 돌 이유 없음).
 *
 * 실행: node wiki-daily-run.js [--force]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const FORCE = process.argv.includes('--force');
const REGISTRY_STALE_DAYS = 30;

const regPath = path.join(__dirname, '.vault-registry.json');
const logPath = path.join(__dirname, '.wiki-daily-run.log');

function log(m) {
  const line = `[${new Date().toISOString()}] ${m}`;
  try { fs.appendFileSync(logPath, line + '\n'); } catch (e) {}
  console.log(line);
}

let list = [];
try { list = JSON.parse(fs.readFileSync(regPath, 'utf8')); } catch (e) {}
if (!Array.isArray(list) || !list.length) { log('등록된 볼트 없음 — 종료'); process.exit(0); }

const cutoff = Date.now() - REGISTRY_STALE_DAYS * 86400000;
let ran = 0;

for (const v of list) {
  const dir = v && v.dir;
  if (!dir || !fs.existsSync(path.join(dir, 'sessions', 'wiki'))) continue;
  if (!FORCE && v.lastSeen && Date.parse(v.lastSeen) < cutoff) {
    log(`건너뜀(${REGISTRY_STALE_DAYS}일 이상 미사용): ${dir}`);
    continue;
  }

  log(`처리 시작: ${dir}`);
  const env = { ...process.env, CLAUDE_WIKI_CHILD: '1' };
  delete env.ANTHROPIC_API_KEY;

  // ① 2차 증류 — 예약 실행은 임계치와 무관하게 돌린다(하루치를 모아 정리하는 것이 목적).
  const args = [path.join(__dirname, 'wiki-topic-distill.js'), dir];
  if (FORCE) args.push('--force');
  const t = spawnSync(process.execPath, args, { env, windowsHide: true, timeout: 400000 });
  if (t.error) log(`  2차 증류 오류: ${t.error.message}`);

  // ② 코퍼스 재생성 — LLM 호출 없음. 2차 증류가 실패해도 이건 돌려둔다.
  const c = spawnSync(process.execPath, [path.join(__dirname, 'wiki-corpus-build.js'), dir], {
    env, windowsHide: true, timeout: 120000
  });
  if (c.error) log(`  코퍼스 오류: ${c.error.message}`);

  ran++;
}

log(`완료 — 볼트 ${ran}개 처리`);
