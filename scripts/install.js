#!/usr/bin/env node

/**
 * install.js — LLM-Wiki Kit 설치
 *
 *   node scripts/install.js            설치
 *   node scripts/install.js --check    설치 상태만 확인
 *   node scripts/install.js --uninstall 훅 등록 해제 (파일은 지우지 않는다)
 *
 * 하는 일
 *  1) hooks/*.js 를 ~/.claude/hooks/ 로 복사한다
 *  2) ~/.claude/settings.json 의 SessionStart·SessionEnd·PreCompact 에 필요한 항목만 추가한다
 *     · 기존 항목은 지우지 않는다
 *     · 이미 등록돼 있으면 다시 넣지 않는다 (재설치해도 중복되지 않는다)
 *  3) 설치 전 settings.json 을 백업한다
 *
 * 경로와 사용자 이름을 하드코딩하지 않는다. 실행하는 계정의 홈 디렉터리를 쓴다.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = process.env.USERPROFILE || process.env.HOME || os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const HOOKS_DIR = path.join(CLAUDE_DIR, 'hooks');
const SETTINGS = path.join(CLAUDE_DIR, 'settings.json');
const SRC_HOOKS = path.join(__dirname, '..', 'hooks');

const MODE = process.argv.includes('--uninstall') ? 'uninstall'
  : process.argv.includes('--check') ? 'check' : 'install';

// 훅 등록표 — 이벤트별로 어떤 스크립트를 어떤 순서로 붙이는지
const REGISTRY = [
  { event: 'SessionStart', file: 'session-restore.js' },
  { event: 'SessionEnd', file: 'session-save-raw.js' },
  { event: 'SessionEnd', file: 'session-to-wiki.js' },
  { event: 'SessionEnd', file: 'session-knowledge-trigger.js' },
  { event: 'PreCompact', file: 'pre-compact-handoff.js', optional: true }
];

const q = (p) => p.replace(/\\/g, '/');
const cmdOf = (file) => `node "${q(path.join(HOOKS_DIR, file))}"`;

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch (e) { return {}; }
}

// 이미 등록됐는지 판단 — 경로 표기가 달라도 파일명으로 알아본다
function alreadyRegistered(settings, event, file) {
  const groups = ((settings.hooks || {})[event]) || [];
  for (const g of groups) for (const h of (g.hooks || [])) {
    if (typeof h.command === 'string' && h.command.includes(file)) return true;
  }
  return false;
}

function doCheck() {
  const s = readSettings();
  console.log('설치 상태');
  console.log('  홈           : ' + HOME);
  console.log('  훅 폴더      : ' + HOOKS_DIR + (fs.existsSync(HOOKS_DIR) ? '' : '  (없음)'));
  let missing = 0;
  for (const r of REGISTRY) {
    const fileOk = fs.existsSync(path.join(HOOKS_DIR, r.file));
    const regOk = alreadyRegistered(s, r.event, r.file);
    if (!fileOk || !regOk) missing++;
    console.log(`  ${r.event.padEnd(13)} ${r.file.padEnd(30)} 파일 ${fileOk ? 'O' : 'X'} · 등록 ${regOk ? 'O' : 'X'}`);
  }
  console.log(missing ? `\n미완료 ${missing}건 — node scripts/install.js 로 설치한다.` : '\n설치 완료 상태다.');
}

function doInstall() {
  if (!fs.existsSync(HOOKS_DIR)) fs.mkdirSync(HOOKS_DIR, { recursive: true });

  // 1) 훅 파일 복사
  let copied = 0;
  for (const f of fs.readdirSync(SRC_HOOKS)) {
    if (!f.endsWith('.js')) continue;
    fs.copyFileSync(path.join(SRC_HOOKS, f), path.join(HOOKS_DIR, f));
    copied++;
  }
  console.log(`훅 파일 ${copied}개 복사 → ${HOOKS_DIR}`);

  // 2) settings.json 백업 후 필요한 항목만 추가
  const s = readSettings();
  if (fs.existsSync(SETTINGS)) {
    const bak = SETTINGS + '.bak-' + new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(SETTINGS, bak);
    console.log('설정 백업 → ' + path.basename(bak));
  }
  s.hooks = s.hooks || {};

  let added = 0, skipped = 0;
  for (const r of REGISTRY) {
    if (r.optional && !fs.existsSync(path.join(HOOKS_DIR, r.file))) continue;
    if (alreadyRegistered(s, r.event, r.file)) { skipped++; continue; }
    s.hooks[r.event] = s.hooks[r.event] || [];
    if (!s.hooks[r.event].length) s.hooks[r.event].push({ hooks: [] });
    s.hooks[r.event][0].hooks = s.hooks[r.event][0].hooks || [];
    s.hooks[r.event][0].hooks.push({ type: 'command', command: cmdOf(r.file) });
    added++;
  }
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2));
  console.log(`훅 등록 — 추가 ${added}건, 이미 있어 건너뜀 ${skipped}건`);

  // 3) JSON 유효성 자체 확인
  try { JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); console.log('settings.json 유효성 확인'); }
  catch (e) { console.error('settings.json 이 깨졌다. 백업본으로 되돌려라: ' + e.message); process.exit(1); }

  console.log('\n설치 완료. 확인: node scripts/install.js --check');
  console.log('다음 작업 대화를 한 번 끝내면 <작업폴더>/sessions/ 아래에 기록이 쌓이기 시작한다.');
}

function doUninstall() {
  const s = readSettings();
  if (!s.hooks) { console.log('등록된 훅이 없다.'); return; }
  let removed = 0;
  for (const ev of Object.keys(s.hooks)) {
    for (const g of s.hooks[ev]) {
      const before = (g.hooks || []).length;
      g.hooks = (g.hooks || []).filter(h =>
        !(typeof h.command === 'string' && REGISTRY.some(r => h.command.includes(r.file))));
      removed += before - g.hooks.length;
    }
    s.hooks[ev] = s.hooks[ev].filter(g => (g.hooks || []).length);
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2));
  console.log(`훅 등록 해제 ${removed}건. 훅 파일과 쌓인 기록은 지우지 않았다.`);
}

if (MODE === 'check') doCheck();
else if (MODE === 'uninstall') doUninstall();
else doInstall();
