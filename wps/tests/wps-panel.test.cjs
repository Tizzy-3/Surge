const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const panel = fs.readFileSync(path.join(root, 'wps.panel.js'), 'utf8');
const sourceURL = 'https://raw.githubusercontent.com/MaYIHEI/paperclip/refs/heads/main/app/wps/wps.js';
const taskKeys = ['hot', 'trial', 'signin', 'fragment', 'lottery', 'clockin'];
const contractSource = '$notification.post("WPS 任务汇总", "", "✅ 每日签到:已签到"); $done();';

async function run({ trigger = 'button', input = { purpose: 'panel' }, cookie = 'fixture-sid', source = contractSource, downloadError = null, status = 200, duplicateDownload = false, notifyThrows = false, expire = false, storage = {}, accountReply } = {}) {
  const calls = [], completions = [], logs = [], notifications = [], timers = new Map();
  let nextTimer = 0;
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  const data = { wps_sid: cookie, ...storage };
  const context = vm.createContext({
    $input: input, $trigger: trigger,
    $persistentStore: { read: (key) => data[key] ?? null, write: (value, key) => { data[key] = value; return true; } },
    $done: (result) => { completions.push(result); resolveDone(); },
    console: { log: (...parts) => logs.push(parts.join(' ')) },
    setTimeout: (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
    clearTimeout: (id) => timers.delete(id),
    $httpAPI() { throw new Error('Panel must not delegate through the ambiguous cron API'); },
    $notification: { post: (...parts) => { if (notifyThrows) throw new Error('Notifications disabled'); notifications.push(parts); } },
    $httpClient: {
      get(request, callback) {
        calls.push({ method: 'GET', request });
        if (request.url === sourceURL) {
          callback(downloadError, { status }, source);
          if (duplicateDownload) callback(downloadError, { status }, source);
        } else if (accountReply) accountReply(request, callback);
        else throw new Error('Unexpected account request: ' + request.url);
      },
      post(request, callback) {
        calls.push({ method: 'POST', request });
        if (accountReply) accountReply(request, callback);
        else throw new Error('Unexpected account write');
      },
    },
  });
  vm.runInContext(panel, context, { timeout: 1000 });
  if (expire) for (const timer of [...timers.values()]) timer.fn();
  let watchdog;
  try {
    await Promise.race([done, new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error('Panel did not finish')), 1000); })]);
    await new Promise((resolve) => setImmediate(resolve));
  } finally { clearTimeout(watchdog); }
  assert.equal(completions.length, 1);
  assert.equal(timers.size, 0);
  return { calls, completions, logs, notifications };
}

test('module preserves upstream cron at 10:00 and uses a manually triggered WebView panel', () => {
  const text = fs.readFileSync(path.join(root, 'WPS.sgmodule'), 'utf8');
  assert.match(text, /cronexp="0 10 \* \* \*"/);
  assert.match(text, /^#!desc=.*10:00/m);
  assert.equal(text.split(/\r?\n/).filter((line) => /type=cron/.test(line)).length, 1);
  assert.match(text, /^WPS签到 = type=cron,[^\n]*timeout=120,[^\n]*script-path=https:\/\/raw\.githubusercontent\.com\/MaYIHEI\/paperclip\/refs\/heads\/main\/app\/wps\/wps\.js/m);
  assert.match(text, /wps\.cookie\.js/);
  assert.match(text, /^WPS_Manual_Test = type=generic,[^\n]*wps\/wps\.panel\.js[^\n]*timeout=150,[^\n]*engine=webview/m);
  const line = text.split(/\r?\n/).find((line) => line.startsWith('WPS_Manual_Panel ='));
  assert.match(line, /script-name=WPS_Manual_Test/);
  assert.doesNotMatch(line, /update-interval=/);
});

test('passive panel refresh never downloads or executes WPS', async () => {
  for (const trigger of ['auto-interval', 'editor', null]) {
    const result = await run({ trigger });
    assert.equal(result.calls.length, 0);
    assert.match(result.completions[0].content, /10:00/);
  }
  assert.equal((await run({ input: null })).calls.length, 0);
});

test('missing Cookie never downloads or executes WPS', async () => {
  const result = await run({ cookie: null });
  assert.equal(result.calls.length, 0);
  assert.match(result.completions[0].title, /缺少 Cookie/);
});

test('manual click runs original source and renders its actual notification', async () => {
  const result = await run();
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].request.url, sourceURL);
  assert.equal(result.calls[0].request.headers, undefined);
  assert.match(result.completions[0].content, /✅ 每日签到:已签到/);
  assert.equal(result.notifications.length, 1);
  assert.ok(result.logs.every((entry) => !entry.includes('fixture-sid')));
});

test('download failure, HTTP error, empty source and parse errors never retry', async () => {
  for (const options of [{ downloadError: 'offline' }, { status: 404 }, { source: '' }, { source: 'syntax ???' }]) {
    const result = await run(options);
    assert.equal(result.calls.length, 1);
    assert.equal(result.notifications.length, 0);
    assert.equal(result.completions[0].style, 'error');
  }
});

test('upstream failure remains visible, even when system notifications are disabled', async () => {
  const result = await run({ notifyThrows: true, source: '$notification.post("WPS", "🚫 登录态失效", "请重新抓取"); $done();' });
  assert.match(result.completions[0].content, /登录态失效/);
  assert.equal(result.completions[0].style, 'error');
});

test('duplicate download callbacks and upstream completion cannot replay the script', async () => {
  const result = await run({ duplicateDownload: true, source: contractSource + '$done();' });
  assert.equal(result.notifications.length, 1);
});

test('no result and unfinished upstream task are never reported as success or retried', async () => {
  assert.match((await run({ source: '$done();' })).completions[0].title, /未收到任务结果/);
  const result = await run({ source: '', downloadError: null });
  assert.equal(result.calls.length, 1);
  const expired = await run({ source: 'void 0;', expire: true });
  assert.match(expired.completions[0].title, /超时/);
  assert.equal(expired.calls.length, 1);
});

// Optional integration: use a locally downloaded, unmodified upstream script.
// HTTP is simulated and any unexpected endpoint fails; no live account is used.
const fixture = process.env.WPS_UPSTREAM_FIXTURE;
for (const scenario of ['already-signed', 'expired-cookie', 'tasks-disabled']) {
  test(`original upstream integration: ${scenario}`, { skip: !fixture }, async () => {
    const storage = Object.fromEntries(taskKeys.map((key) => [`wps_task_${key}`, 'false']));
    if (scenario === 'already-signed') storage.wps_task_signin = 'true';
    const result = await run({
      source: fs.readFileSync(fixture, 'utf8'), storage,
      accountReply(request, callback) {
        if (request.url === 'https://account.wps.cn/api/v3/islogin') {
          callback(null, { status: 200 }, JSON.stringify(scenario === 'expired-cookie' ? { result: 'error' } : { result: 'ok', userid: 'fixture-user' }));
        } else if (request.url === 'https://personal-bus.wps.cn/sign_in/v1/day_info') {
          callback(null, { status: 200 }, JSON.stringify({ data: { info: { has_sign: true } } }));
        } else assert.fail('Unexpected upstream endpoint: ' + request.url);
      },
    });
    assert.equal(result.calls.filter((call) => call.method === 'POST').length, 0);
    assert.match(result.completions[0].content, scenario === 'already-signed' ? /每日签到:已签到/ : scenario === 'expired-cookie' ? /登录态失效/ : /所有任务均已在 BoxJS 关闭/);
    assert.equal(result.notifications.length, 1);
    assert.equal(result.calls.length, scenario === 'already-signed' ? 3 : 2);
  });
}
