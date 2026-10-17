const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const runner = fs.readFileSync(path.join(root, 'surge_signin.js'), 'utf8');
const capture = fs.readFileSync(path.join(root, 'surge_cookie_capture.js'), 'utf8');
const functionsOnly = runner.replace(/^main\(\)\r?\n[\s\S]*?(?=async function main\()/m, '');
assert.notEqual(functionsOnly, runner, 'test harness must suppress automatic sign-in');

function environment(extra = {}, initial = {}) {
  const saved = new Map(Object.entries(initial));
  const notifications = [];
  const completions = [];
  const context = vm.createContext({
    console: { log() {} },
    URL,
    setTimeout: (fn) => { queueMicrotask(fn); return 1; },
    $persistentStore: {
      read: (key) => saved.get(key) || null,
      write: (value, key) => { saved.set(key, value); return true; },
    },
    $notification: { post: (...args) => notifications.push(args) },
    $done: (result) => completions.push(result),
    // A network call without an explicit fixture must always fail the test.
    $httpClient: new Proxy({}, { get: (_, method) => () => { throw new Error(`Unexpected network call: ${method}`); } }),
    ...extra,
  });
  return { context, saved, notifications, completions };
}

function runCapture(request, response, initial = {}, extra = {}) {
  const input = { ...extra };
  if (request !== undefined) input.$request = request;
  if (response !== undefined) input.$response = response;
  const env = environment(input, initial);
  vm.runInContext(capture, env.context, { timeout: 1000 });
  assert.equal(env.completions.length, 1, 'capture completes exactly once');
  assert.equal(JSON.stringify(env.completions[0]), '{}', 'capture must preserve original traffic');
  return env;
}

function runnerEnv(extra = {}, initial = {}) {
  const env = environment(extra, initial);
  vm.runInContext(functionsOnly, env.context, { timeout: 1000 });
  return env;
}

test('Hashiqi capture merges response cookies and removes volatile cookies', () => {
  const env = runCapture(
    { url: 'https://www.haxiaohaios2.com/aspx3/mobile/qiandao.aspx', headers: { Cookie: 'sid=old; _ga=volatile' } },
    { headers: { 'Set-Cookie': ['sid=new; Path=/', 'auth=value; Expires=Wed, 21 Oct 2030 07:28:00 GMT'] } },
  );
  assert.equal(env.saved.get('QX_SIGNIN_HASHIQI_COOKIE'), 'auth=value; sid=new');
  assert.equal(env.notifications[0][0], '哈士奇');
});

test('IMYAI request capture reads Bearer token without a response object', () => {
  const env = runCapture({ url: 'https://api.daka.today/api/auth/get-info', headers: { Authorization: 'Bearer fixture-jwt' } });
  assert.equal(env.saved.get('QX_SIGNIN_IMYAI_JWT'), 'fixture-jwt');
});

test('IMYAI response capture reads a nested JSON token and preserves response body', () => {
  const token = 'eyJfixture.payload.signature';
  const body = JSON.stringify({ data: { access_token: token } });
  const response = { headers: {}, body };
  const env = runCapture({ url: 'https://api.imyaigc.com/api/auth/login', headers: {} }, response);
  assert.equal(env.saved.get('QX_SIGNIN_IMYAI_JWT'), token);
  assert.equal(response.body, body);
});

test('IMYAI web capture reads token from cookies in header-only mode', () => {
  const env = runCapture({ url: 'https://super.imyaigc.com/', headers: { cookie: 'CROSS_DOMAIN_JWT=web-token' } }, { headers: {} });
  assert.equal(env.saved.get('QX_SIGNIN_IMYAI_JWT'), 'web-token');
});

test('Kingdee capture saves cookie, CSRF and product line', () => {
  const env = runCapture(
    { url: 'https://vip.kingdee.com/', headers: { cookie: 'sid=one; V-CSRF-TOKEN=csrf-fixture', currentProductLineId: '8' } },
    { headers: {} },
  );
  assert.equal(env.saved.get('QX_SIGNIN_KINGDEE_CSRF_TOKEN'), 'csrf-fixture');
  assert.equal(env.saved.get('QX_SIGNIN_KINGDEE_PRODUCT_LINE_ID'), '8');
  assert.match(env.saved.get('QX_SIGNIN_KINGDEE_COOKIE'), /sid=one/);
});

test('capture saves refreshed credentials while suppressing cooldown notifications', () => {
  const env = runCapture(
    { url: 'https://api.daka.today/api/auth/get-info', headers: { authorization: 'Bearer refreshed-token' } }, undefined,
    { QX_SIGNIN_IMYAI_JWT: 'old-token', QX_SIGNIN_IMYAI_JWT_LAST_NOTIFY_AT: String(Date.now()) },
  );
  assert.equal(env.saved.get('QX_SIGNIN_IMYAI_JWT'), 'refreshed-token');
  assert.equal(env.notifications.length, 0);
});

test('unchanged credentials do not cause repeated notifications', () => {
  const env = runCapture(
    { url: 'https://api.daka.today/api/auth/get-info', headers: { authorization: 'Bearer same-token' } }, undefined,
    { QX_SIGNIN_IMYAI_JWT: 'same-token' },
  );
  assert.equal(env.notifications.length, 0);
});

test('failed persistent writes do not claim capture success', () => {
  const env = runCapture(
    { url: 'https://api.daka.today/api/auth/get-info', headers: { authorization: 'Bearer unsaved-token' } }, undefined, {},
    { $persistentStore: { read: () => null, write: () => false } },
  );
  assert.equal(env.notifications.length, 0);
  assert.equal(env.saved.size, 0);
});

test('missing request and unrelated hosts pass through exactly once', () => {
  runCapture();
  const env = runCapture({ url: 'https://unrelated.example/', headers: { cookie: 'sid=private' } }, { body: 'unchanged' });
  assert.equal(env.saved.size, 0);
});

test('native GET converts timeout to seconds and normalizes Surge response', async () => {
  let options;
  const env = runnerEnv({ $httpClient: { get: (input, callback) => {
    options = input;
    callback(null, { status: 200, headers: { 'content-type': 'application/json' } }, '{"ok":true}');
  } } }, { QX_SIGNIN_REQUEST_TIMEOUT_MS: '12500' });
  const response = await env.context.request({ url: 'https://fixture.invalid/info' });
  assert.equal(options.timeout, 12.5);
  assert.equal(options['auto-cookie'], false);
  assert.equal(options['auto-redirect'], false);
  assert.equal(options.method, undefined);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, '{"ok":true}');
  assert.match(options.headers['User-Agent'], /Surge/);
});

test('native POST preserves body and explicit cookie jar and merges Set-Cookie', async () => {
  let options;
  const jar = { sid: 'old' };
  const env = runnerEnv({ $httpClient: { post: (input, callback) => {
    options = input;
    callback(null, { status: 200, headers: { 'Set-Cookie': ['sid=new; Path=/', 'auth=fixture; Path=/'] } }, 'ok');
  } } });
  await env.context.request({ url: 'https://fixture.invalid/sign', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"check":true}', jar });
  assert.equal(options.body, '{"check":true}');
  assert.equal(options.headers.Cookie, 'sid=old');
  assert.equal(options.jar, undefined);
  assert.deepEqual(jar, { sid: 'new', auth: 'fixture' });
});

test('storeCookies=false preserves explicit cookie jar', async () => {
  const jar = { sid: 'old' };
  const env = runnerEnv({ $httpClient: { get: (_, callback) => callback(null, { status: 200, headers: { 'set-cookie': 'sid=new; Path=/' } }, '') } });
  await env.context.request({ url: 'https://fixture.invalid/info', jar, storeCookies: false });
  assert.deepEqual(jar, { sid: 'old' });
});

test('HTTP failures and native timeout errors reject rather than look successful', async () => {
  const failed = runnerEnv({ $httpClient: { get: (_, callback) => callback(null, { status: 503, headers: {} }, 'unavailable') } });
  await assert.rejects(failed.context.requestOnce({ url: 'https://fixture.invalid', method: 'GET' }), /HTTP 503.*unavailable/);
  const timedOut = runnerEnv({ $httpClient: { get: (_, callback) => callback('Request timed out', null, null) } });
  await assert.rejects(timedOut.context.requestOnce({ url: 'https://fixture.invalid', method: 'GET' }), /Request timed out/);
});

test('configured retry count applies to the native HTTP adapter', async () => {
  let calls = 0;
  const env = runnerEnv({ $httpClient: { get: (_, callback) => {
    calls += 1;
    if (calls < 3) callback('fixture timeout', null, null);
    else callback(null, { status: 200, headers: {} }, 'ok');
  } } }, { QX_SIGNIN_REQUEST_RETRIES: '2' });
  const result = await env.context.request({ url: 'https://fixture.invalid/info' });
  assert.equal(calls, 3);
  assert.equal(result.body, 'ok');
});

test('duplicate native callback does not modify the jar after completion', async () => {
  const jar = {};
  const env = runnerEnv({ $httpClient: { get: (_, callback) => {
    callback(null, { status: 200, headers: { 'set-cookie': 'sid=first' } }, 'first');
    callback(null, { status: 200, headers: { 'set-cookie': 'sid=second' } }, 'second');
  } } });
  const result = await env.context.request({ url: 'https://fixture.invalid', jar });
  assert.equal(result.body, 'first');
  assert.equal(jar.sid, 'first');
});

test('storage and notifications use native Surge APIs', () => {
  const env = runnerEnv();
  assert.equal(env.context.setPref('QX_SIGNIN_TEST', 42), true);
  assert.equal(env.context.pref('QX_SIGNIN_TEST'), '42');
  env.context.notify('title', 'subtitle', 'body');
  assert.deepEqual(env.notifications, [['title', 'subtitle', 'body']]);
});

test('automatic runner with no credentials skips all sites and completes once', async () => {
  const env = environment();
  vm.runInContext(runner, env.context, { timeout: 1000 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(env.completions.length, 1);
  assert.equal(env.notifications.length, 1);
  assert.match(env.notifications[0][2], /哈士奇/);
  assert.match(env.notifications[0][2], /IMYAI/);
  assert.match(env.notifications[0][2], /金蝶/);
});

test('invalid configuration still terminates runner exactly once', async () => {
  const env = environment({}, { QX_SIGNIN_CRYPTOJS_URL: 'invalid-url' });
  vm.runInContext(runner, env.context, { timeout: 1000 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(env.completions.length, 1);
  assert.equal(env.notifications[0][1], '运行失败');
});

test('module uses bounded capture, appends hosts, and references existing resources', () => {
  const moduleText = fs.readFileSync(path.join(root, 'DailySignIn.sgmodule'), 'utf8');
  assert.match(moduleText, /hostname = %APPEND% /);
  assert.match(moduleText, /cronexp="0 8 \* \* \*"/);
  assert.match(moduleText, /type=cron[^\n]*timeout=300[^\n]*wake-system=true[^\n]*engine=webview/);
  const responseLine = moduleText.split(/\r?\n/).find((line) => line.startsWith('Tizzy3 IMYAI Response Capture ='));
  assert.match(responseLine, /requires-body=true,max-size=2097152/);
  assert.match(responseLine, /\/api\//);
  const example = fs.readFileSync(path.join(root, 'surge.conf.example'), 'utf8');
  const scriptSection = (text) => text.replace(/\r\n/g, '\n').slice(text.replace(/\r\n/g, '\n').search(/^\[Script\]$/m));
  assert.equal(scriptSection(example), scriptSection(moduleText).replace('hostname = %APPEND% ', 'hostname = '));
  for (const text of [moduleText, example, fs.readFileSync(path.join(root, 'boxjs.json'), 'utf8')]) {
    for (const match of text.matchAll(/https:\/\/raw\.githubusercontent\.com\/Tizzy-3\/Surge\/(?:refs\/heads\/)?main\/([^\s",]+)/g)) {
      assert.ok(fs.existsSync(path.join(root, match[1])), `missing resource ${match[1]}`);
    }
  }
});

test('module regexes cover all capture hosts with at most one script per type', () => {
  const text = fs.readFileSync(path.join(root, 'DailySignIn.sgmodule'), 'utf8');
  const scripts = text.split(/\r?\n/).filter((line) => /type=http-(request|response)/.test(line)).map((line) => ({
    type: /type=([^,]+)/.exec(line)[1],
    regex: new RegExp(/pattern=([^,]+)/.exec(line)[1]),
  }));
  for (const url of ['https://www.haxiaohaios2.com/aspx3/mobile/qiandao.aspx', 'https://super.imyaigc.com/', 'https://api.daka.today/api/auth/get-info', 'https://api.imyaigc.com/api/auth/login', 'https://vip.kingdee.com/']) {
    assert.equal(scripts.filter((script) => script.type === 'http-response' && script.regex.test(url)).length, 1);
  }
  assert.equal(scripts.filter((script) => script.regex.test('https://unrelated.example/api/auth')).length, 0);
  assert.equal(scripts.filter((script) => script.regex.test('https://api.daka.today/large-static-file')).length, 0);
});

test('BoxJS IDs are independent while credential keys remain compatible', () => {
  const box = JSON.parse(fs.readFileSync(path.join(root, 'boxjs.json'), 'utf8'));
  assert.equal(box.id, 'com.tizzy3.surge.scripts');
  assert.equal(box.apps[0].id, 'com.tizzy3.surge.daily-signin');
  const app = box.apps[0];
  assert.equal(new Set(app.keys).size, app.keys.length);
  for (const setting of app.settings) assert.ok(app.keys.includes(setting.id));
  for (const key of ['QX_SIGNIN_HASHIQI_COOKIE', 'QX_SIGNIN_IMYAI_JWT', 'QX_SIGNIN_KINGDEE_COOKIE', 'QX_SIGNIN_PAKO_URL']) assert.ok(app.keys.includes(key));
});

test('scripts do not depend on QX runtime globals or clearTimeout', () => {
  assert.doesNotMatch(runner + capture, /\$(?:task|prefs|notify)\b|\bclearTimeout\(/);
});

test('real CryptoJS and pako load, cache and encrypt in a WebView-like runtime', { skip: !process.env.SURGE_TEST_VENDOR_DIR }, async () => {
  const vendorDir = process.env.SURGE_TEST_VENDOR_DIR;
  const cryptoSource = fs.readFileSync(path.join(vendorDir, 'crypto-js.min.js'), 'utf8');
  const pakoSource = fs.readFileSync(path.join(vendorDir, 'pako.min.js'), 'utf8');
  let downloads = 0;
  const env = runnerEnv({ crypto: webcrypto, $httpClient: { get: (options, callback) => {
    downloads += 1;
    const body = options.url.includes('crypto-js') ? cryptoSource : pakoSource;
    callback(null, { status: 200, headers: {} }, body);
  } } });
  await env.context.ensureCryptoJS();
  await env.context.ensurePako();
  const encrypted = env.context.encryptImyaiPayload({ fixture: true });
  assert.ok(encrypted.iv && encrypted.payload && encrypted.signature && encrypted.timestamp);
  const decrypted = vm.runInContext(`CryptoJS.AES.decrypt({ciphertext: CryptoJS.enc.Base64.parse(${JSON.stringify(encrypted.payload)})}, CryptoJS.enc.Base64.parse(config('IMYAI_AES_KEY_B64')), {iv: CryptoJS.enc.Base64.parse(${JSON.stringify(encrypted.iv)}), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7}).toString(CryptoJS.enc.Utf8)`, env.context);
  assert.equal(decrypted, '{"fixture":true}');
  const inflated = vm.runInContext("Array.from(pako.inflate(pako.deflate(new Uint8Array([1, 2, 3])))).join(',')", env.context);
  assert.equal(inflated, '1,2,3');
  assert.equal(downloads, 2);
  const fromCache = runnerEnv({ crypto: webcrypto }, Object.fromEntries(env.saved));
  await fromCache.context.ensureCryptoJS();
  await fromCache.context.ensurePako();
  assert.ok(fromCache.context.encryptImyaiPayload({ cached: true }).signature);
});

test('302 login redirects carry intermediate cookies and turn POST into GET', async () => {
  const calls = [];
  const jar = {};
  const env = runnerEnv({ $httpClient: {
    post: (options, callback) => {
      calls.push(options);
      callback(null, { status: 302, headers: { location: '/home', 'set-cookie': 'sid=logged-in; Path=/' } }, 'redirect');
    },
    get: (options, callback) => {
      calls.push(options);
      callback(null, { status: 200, headers: {} }, 'authenticated');
    },
  } });
  const result = await env.context.request({ url: 'https://fixture.invalid/login', method: 'POST', body: 'username=fixture', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, jar });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://fixture.invalid/home');
  assert.equal(calls[1].headers.Cookie, 'sid=logged-in');
  assert.equal(calls[1].body, undefined);
  assert.equal(calls[1].headers['Content-Type'], undefined);
  assert.equal(jar.sid, 'logged-in');
  assert.equal(result.body, 'authenticated');
});

test('307 redirects preserve POST body and update cookies before the next hop', async () => {
  const calls = [];
  const jar = { sid: 'old' };
  const env = runnerEnv({ $httpClient: { post: (options, callback) => {
    calls.push(options);
    if (calls.length === 1) callback(null, { status: 307, headers: { location: '/new', 'set-cookie': 'sid=new; Path=/' } }, '');
    else callback(null, { status: 200, headers: {} }, 'ok');
  } } });
  await env.context.request({ url: 'https://fixture.invalid/old', method: 'POST', body: 'fixture-body', jar });
  assert.equal(calls[1].body, 'fixture-body');
  assert.equal(calls[1].headers.Cookie, 'sid=new');
});

test('cross-origin redirects strip credentials and stop sharing the original cookie jar', async () => {
  const calls = [];
  const jar = { sid: 'private' };
  const env = runnerEnv({ $httpClient: { get: (options, callback) => {
    calls.push(options);
    if (calls.length === 1) callback(null, { status: 302, headers: { location: 'https://other.invalid/home' } }, '');
    else callback(null, { status: 200, headers: { 'set-cookie': 'other=value' } }, 'ok');
  } } });
  await env.context.request({ url: 'https://fixture.invalid/login', headers: { Authorization: 'Bearer private', 'X-CSRF-Token': 'private' }, jar });
  assert.equal(calls[1].headers.Authorization, undefined);
  assert.equal(calls[1].headers.Cookie, undefined);
  assert.equal(calls[1].headers['X-CSRF-Token'], undefined);
  assert.deepEqual(jar, { sid: 'private' });
});

test('redirect loops terminate and report a recognizable redirect error', async () => {
  let calls = 0;
  const env = runnerEnv({ $httpClient: { get: (_, callback) => {
    calls += 1;
    callback(null, { status: 302, headers: { location: '/again' } }, '');
  } } });
  await assert.rejects(env.context.requestOnce({ url: 'https://fixture.invalid/again', method: 'GET' }), /Too many redirects/);
  assert.equal(calls, 11);
});

test('redirects to non-HTTP URLs reject without executing or following them', async () => {
  const env = runnerEnv({ $httpClient: { get: (_, callback) => callback(null, { status: 302, headers: { location: 'javascript:fixture' } }, '') } });
  await assert.rejects(env.context.requestOnce({ url: 'https://fixture.invalid', method: 'GET' }), /Unsupported redirect protocol/);
});
