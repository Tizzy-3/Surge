const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const cases = [
  { folder: 'daily-signin', file: 'surge_cookie_capture.js', flag: 'QX_SIGNIN_CAPTURE_ENABLED', key: 'QX_SIGNIN_HASHIQI_COOKIE', url: 'https://www.haxiaohaios2.com/aspx3/mobile/qiandao.aspx', cookie: 'sid=new', old: 'sid=old', expected: 'sid=new', boxID: 'com.tizzy3.surge.daily-signin' },
  { folder: 'wps', file: 'wps.cookie.capture.js', flag: 'wps_capture_enabled', key: 'wps_sid', url: 'https://personal-act.wps.cn/activity-rubik/activity/page_info', cookie: 'wps_sids=new', old: 'old', expected: 'new', boxID: 'com.tizzy3.surge.wps-capture' },
];

function invoke(spec, data, { cookie = spec.cookie, failWrite = false, inspectRequest = true, method = 'GET' } = {}) {
  const notices = [], writes = [], done = [], logs = [];
  const context = vm.createContext({
    $persistentStore: { read: (key) => data.get(key) ?? null, write: (value, key) => { writes.push([key, value]); if (failWrite) return false; data.set(key, value); return true; } },
    $request: inspectRequest ? { url: spec.url, method, headers: { cOoKiE: cookie } } : new Proxy({}, { get() { throw new Error('Disabled capture inspected the request'); } }),
    $response: { headers: {} },
    $notification: { post: (...parts) => notices.push(parts) },
    $done: (result) => done.push(result),
    console: { log: (...parts) => logs.push(parts.join(' ')) },
    $httpClient: new Proxy({}, { get() { throw new Error('Capture must never download code or call account APIs'); } }),
  });
  vm.runInContext(fs.readFileSync(path.join(root, spec.folder, spec.file), 'utf8'), context, { timeout: 1000 });
  assert.equal(done.length, 1);
  assert.equal(JSON.stringify(done[0]), '{}');
  return { notices, writes, logs };
}

for (const spec of cases) {
  test(`${spec.folder}: BoxJS declares a default-off capture control using the actual gate key`, () => {
    const box = JSON.parse(fs.readFileSync(path.join(root, spec.folder, 'boxjs.json'), 'utf8'));
    const app = box.apps.find((app) => app.id === spec.boxID);
    assert.ok(app);
    const setting = app.settings.find((item) => item.id === spec.flag);
    assert.ok(app.keys.includes(spec.flag));
    assert.equal(setting.type, 'boolean');
    assert.equal(setting.val, false);
  });

  test(`${spec.folder}: unset, false and malformed switches preserve credentials silently before inspecting traffic`, () => {
    for (const value of [undefined, null, '', false, 'false', '0', 'bad']) {
      const data = new Map([[spec.key, spec.old]]);
      if (value !== undefined) data.set(spec.flag, value);
      const before = [...data];
      const result = invoke(spec, data, { inspectRequest: false });
      assert.deepEqual([...data], before);
      assert.equal(result.writes.length, 0);
      assert.equal(result.notices.length, 0);
      assert.equal(result.logs.length, 0);
    }
  });

  test(`${spec.folder}: enabled capture saves the credential, then switching off blocks updates and notifications`, () => {
    const data = new Map([[spec.flag, 'true'], [spec.key, spec.old]]);
    const first = invoke(spec, data);
    assert.equal(data.get(spec.key), spec.expected);
    assert.equal(first.notices.length, 1);
    data.set(spec.flag, 'false');
    const before = [...data];
    const second = invoke(spec, data, { cookie: 'sid=different; wps_sid=different' });
    assert.deepEqual([...data], before);
    assert.equal(second.writes.length, 0);
    assert.equal(second.notices.length, 0);
    assert.equal(first.logs.join('\n').includes(spec.cookie), false);
  });

  test(`${spec.folder}: unchanged credentials and failed writes never claim capture success`, () => {
    const same = invoke(spec, new Map([[spec.flag, 'true'], [spec.key, spec.expected]]));
    assert.equal(same.notices.length, 0);
    const data = new Map([[spec.flag, 'true'], [spec.key, spec.old]]);
    const failed = invoke(spec, data, { failWrite: true });
    assert.equal(data.get(spec.key), spec.old);
    assert.equal(failed.notices.length, 0);
  });
}

test('switches affect capture only; both modules retain one cron and their manual panels', () => {
  for (const [folder, file, cron, panel] of [
    ['daily-signin', 'DailySignIn.sgmodule', '0 7 * * *', 'Tizzy3_Manual_SignIn'],
    ['wps', 'WPS.sgmodule', '0 10 * * *', 'WPS_Manual_Test'],
  ]) {
    const moduleText = fs.readFileSync(path.join(root, folder, file), 'utf8');
    assert.equal(moduleText.split(/\r?\n/).filter((line) => line.includes('type=cron')).length, 1);
    assert.ok(moduleText.includes(`cronexp="${cron}"`));
    assert.ok(moduleText.includes(`script-name=${panel}`));
    for (const match of moduleText.matchAll(/script-path=https:\/\/raw\.githubusercontent\.com\/Tizzy-3\/Surge\/(?:refs\/heads\/)?main\/([^,\s]+)/g)) {
      assert.ok(fs.existsSync(path.join(root, match[1].split(/[?#]/)[0])));
    }
  }
  for (const [folder, file] of [['daily-signin', 'surge_signin.js'], ['wps', 'wps.panel.js']]) {
    const text = fs.readFileSync(path.join(root, folder, file), 'utf8');
    assert.doesNotMatch(text, /QX_SIGNIN_CAPTURE_ENABLED|wps_capture_enabled/);
  }
});
