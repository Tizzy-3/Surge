const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const panel = fs.readFileSync(path.join(root, 'wps.panel.js'), 'utf8');

function run({ trigger = 'button', input = { purpose: 'panel' }, cookie = 'fixture-sid', response = {}, extra = {} } = {}) {
  const calls = [];
  const completions = [];
  const logs = [];
  const context = vm.createContext({
    $input: input,
    $trigger: trigger,
    $persistentStore: { read: (key) => key === 'wps_sid' ? cookie : null },
    $done: (result) => completions.push(result),
    console: { log: (message) => logs.push(message) },
    $httpAPI: (...args) => {
      calls.push(args.slice(0, 3));
      args[3](response);
    },
    // Panel must use the configured cron, never download/evaluate another copy.
    $httpClient: { get() { throw new Error('Unexpected HTTP download'); } },
    ...extra,
  });
  vm.runInContext(panel, context, { timeout: 1000 });
  assert.equal(completions.length, 1);
  return { calls, completions, logs };
}

test('module preserves upstream scripts and schedules one daily task at 07:36', () => {
  const text = fs.readFileSync(path.join(root, 'WPS.sgmodule'), 'utf8');
  assert.match(text, /cronexp="36 7 \* \* \*"/);
  assert.match(text, /^#!desc=.*07:36/m);
  assert.equal(text.split(/\r?\n/).filter((line) => /type=cron/.test(line)).length, 1);
  assert.match(text, /^WPS签到 = type=cron,[^\n]*wake-system=true,[^\n]*timeout=120,[^\n]*script-path=https:\/\/raw\.githubusercontent\.com\/MaYIHEI\/paperclip\/refs\/heads\/main\/app\/wps\/wps\.js/m);
  assert.match(text, /wps\.cookie\.js/);
  assert.match(text, /^WPS_Manual_Test = type=generic,[^\n]*wps\/wps\.panel\.js[^\n]*timeout=150/m);
  const panelLine = text.split(/\r?\n/).find((line) => line.startsWith('WPS_Manual_Panel ='));
  assert.ok(panelLine);
  assert.match(panelLine, /script-name=WPS_Manual_Test/);
  assert.doesNotMatch(panelLine, /update-interval=/);
});

test('policy page and automatic panel refresh never execute WPS', () => {
  for (const trigger of ['auto-interval', 'editor', null]) {
    const result = run({ trigger });
    assert.equal(result.calls.length, 0);
    assert.match(result.completions[0].content, /07:36/);
  }
  assert.equal(run({ input: null }).calls.length, 0);
});

test('missing cookie is displayed without invoking any task', () => {
  const result = run({ cookie: null });
  assert.equal(result.calls.length, 0);
  assert.equal(result.completions[0].style, 'error');
  assert.match(result.completions[0].title, /缺少 Cookie/);
});

test('button invokes the existing cron exactly once by name', () => {
  const result = run();
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0][0], 'POST');
  assert.equal(result.calls[0][1], '/v1/scripting/cron/evaluate');
  assert.equal(result.calls[0][2].script_name, 'WPS签到');
  assert.equal(result.completions[0].style, 'info');
  assert.doesNotMatch(result.completions[0].title, /签到成功/);
  assert.match(result.completions[0].content, /通知和.*脚本日志/);
  assert.ok(result.logs.every((entry) => !entry.includes('fixture-sid')));
});

test('API errors are shown without replaying sign-in', () => {
  const result = run({ response: { error: 'fixture script not found' } });
  assert.equal(result.calls.length, 1);
  assert.equal(result.completions[0].style, 'error');
  assert.match(result.completions[0].content, /fixture script not found/);
});

test('unclear API outcome is not reported as success and is not retried', () => {
  const result = run({ response: null });
  assert.equal(result.calls.length, 1);
  assert.equal(result.completions[0].style, 'info');
  assert.match(result.completions[0].title, /待确认/);
});

test('missing API and synchronous errors still finish the panel once', () => {
  const missing = run({ extra: { $httpAPI: undefined } });
  assert.equal(missing.completions[0].style, 'error');
  const failed = run({ extra: { $httpAPI() { throw new Error('fixture native error'); } } });
  assert.equal(failed.completions[0].style, 'error');
  assert.match(failed.completions[0].content, /fixture native error/);
});

test('duplicate native callback produces only one panel completion', () => {
  const result = run({ extra: { $httpAPI(method, target, body, callback) { callback({}); callback({}); } } });
  assert.equal(result.completions.length, 1);
});
