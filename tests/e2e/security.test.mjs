// API 安全測試：對真正啟動的伺服器 + 資料庫發請求。
// 用法：先 next start，然後 BASE=http://localhost:3100 SETUP_TOKEN=... node --test tests/e2e/security.test.mjs
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import postgres from 'postgres';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const ORIGIN = new URL(BASE).origin;

class Client {
  cookie = '';
  async req(path, { method = 'GET', body, origin = ORIGIN, headers = {} } = {}) {
    const h = { ...headers };
    if (body !== undefined) h['content-type'] = 'application/json';
    if (origin) h.origin = origin;
    if (this.cookie) h.cookie = this.cookie;
    const res = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) {
      const m = /((?:__Host-)?cb_sid)=([^;]*)/.exec(set);
      if (m) this.cookie = m[2] ? `${m[1]}=${m[2]}` : '';
    }
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json, headers: res.headers, setCookie: set };
  }
}

const admin = new Client();
const anon = new Client();
let editorPw, editorId, entry;
const TOKEN = process.env.SETUP_TOKEN;

test('setup: wrong token rejected, right token creates first admin', async () => {
  const bad = await admin.req('/api/setup', { method: 'POST', body: { token: 'nope', username: 'boss', displayName: '班長', password: 'boss-password-123' } });
  assert.equal(bad.status, 403);
  const good = await admin.req('/api/setup', { method: 'POST', body: { token: TOKEN, username: 'boss', displayName: '班長', password: 'boss-password-123' } });
  assert.equal(good.status, 201);
  assert.match(good.setCookie, /HttpOnly/i);
  assert.match(good.setCookie, /SameSite=Strict/i);
  assert.ok(admin.cookie);
});

test('setup: permanently disabled once a user exists', async () => {
  const again = await anon.req('/api/setup', { method: 'POST', body: { token: TOKEN, username: 'evil', displayName: 'x', password: 'evil-password-123' } });
  assert.equal(again.status, 404);
  const page = await fetch(BASE + '/setup');
  assert.equal(page.status, 404);
});

test('anonymous: can read board, cannot touch anything else', async () => {
  const board = await anon.req('/api/board');
  assert.equal(board.status, 200);
  assert.ok(Array.isArray(board.json.entries));
  for (const [path, method, body] of [
    ['/api/entries', 'GET'],
    ['/api/entries', 'POST', { entryDate: '2026-11-02', category: 'homework', title: 'x' }],
    ['/api/settings', 'PUT', { classTitle: 'x', announcement: 'x' }],
    ['/api/users', 'GET'],
    ['/api/audit', 'GET'],
    ['/api/trash', 'GET'],
    ['/api/export', 'GET'],
    ['/api/installations', 'GET'],
    ['/api/timetable', 'PUT', { schedule: [] }],
  ]) {
    const r = await anon.req(path, { method, body });
    assert.equal(r.status, 401, `${method} ${path} should be 401, got ${r.status}`);
  }
});

test('public board payload exposes no account information', async () => {
  const r = await anon.req('/api/board');
  const text = JSON.stringify(r.json);
  for (const k of ['created_by', 'updated_by', 'createdBy', 'username', 'password', 'actor']) assert.ok(!text.includes(k), `leaks ${k}`);
});

test('CSRF: cross-origin and origin-less writes are rejected', async () => {
  const evil = await admin.req('/api/settings', { method: 'PUT', body: { classTitle: 'pwned', announcement: '' }, origin: 'https://evil.example' });
  assert.equal(evil.status, 403);
  const none = await admin.req('/api/settings', { method: 'PUT', body: { classTitle: 'pwned', announcement: '' }, origin: null });
  assert.equal(none.status, 403);
  const site = await admin.req('/api/settings', { method: 'PUT', body: { classTitle: 'pwned', announcement: '' }, headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(site.status, 403);
});

test('non-JSON bodies and oversized bodies are rejected', async () => {
  const res = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' }, body: 'username=boss&password=x' });
  assert.equal(res.status, 415);
  const big = await anon.req('/api/auth/login', { method: 'POST', body: { username: 'boss', password: 'x'.repeat(20000) } });
  assert.equal(big.status, 413);
});

test('admin creates editor; server generates temp password shown once', async () => {
  const r = await admin.req('/api/users', { method: 'POST', body: { username: 'amy', displayName: '學藝', role: 'editor' } });
  assert.equal(r.status, 201);
  assert.match(r.json.tempPassword, /^[\w]{4}-[\w]{4}-[\w]{4}$/);
  assert.ok(!('passwordHash' in r.json.user) && !JSON.stringify(r.json.user).includes('scrypt'));
  editorPw = r.json.tempPassword;
  editorId = r.json.user.id;
  const list = await admin.req('/api/users');
  assert.ok(!JSON.stringify(list.json).includes('scrypt'), 'user list must not include hashes');
});

const editor = new Client();
test('editor must change temp password before doing anything', async () => {
  const login = await editor.req('/api/auth/login', { method: 'POST', body: { username: 'AMY', password: editorPw } });
  assert.equal(login.status, 200);
  const blocked = await editor.req('/api/entries');
  assert.equal(blocked.status, 403);
  assert.equal(blocked.json.code, 'must_change_password');
  const empty = await editor.req('/api/account/password', { method: 'POST', body: { currentPassword: editorPw, newPassword: '' } });
  assert.equal(empty.status, 400);
  const tooLong = await editor.req('/api/account/password', { method: 'POST', body: { currentPassword: editorPw, newPassword: 'x'.repeat(129) } });
  assert.equal(tooLong.status, 400);
  const ok = await editor.req('/api/account/password', { method: 'POST', body: { currentPassword: editorPw, newPassword: 'blue-river-stone-42' } });
  assert.equal(ok.status, 200);
  const now = await editor.req('/api/entries');
  assert.equal(now.status, 200);
});

test('editor: CRUD entries, optimistic locking, no admin powers', async () => {
  const c = await editor.req('/api/entries', { method: 'POST', body: { entryDate: '2026-11-02', category: 'exam', subject: '數學', title: '<script>alert(1)</script>小考', dueDate: '2026-11-05' } });
  assert.equal(c.status, 201);
  entry = c.json.entry;
  assert.equal(entry.version, 1);
  assert.equal(entry.createdByName, '學藝');
  const u1 = await editor.req(`/api/entries/${entry.id}`, { method: 'PATCH', body: { version: 1, entry: { entryDate: '2026-11-02', category: 'exam', subject: '數學', title: '小考 ch1', dueDate: '2026-11-05' } } });
  assert.equal(u1.status, 200);
  assert.equal(u1.json.entry.version, 2);
  const stale = await admin.req(`/api/entries/${entry.id}`, { method: 'PATCH', body: { version: 1, entry: { entryDate: '2026-11-02', category: 'exam', title: '舊版本覆蓋' } } });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.code, 'conflict');
  const badDue = await editor.req('/api/entries', { method: 'POST', body: { entryDate: '2026-11-05', category: 'exam', title: 'x', dueDate: '2026-11-01' } });
  assert.equal(badDue.status, 400);
  const extra = await editor.req('/api/entries', { method: 'POST', body: { entryDate: '2026-11-05', category: 'exam', title: 'x', createdBy: 'someone' } });
  assert.equal(extra.status, 400, 'unknown fields must be rejected');
  for (const [path, method, body] of [
    ['/api/users', 'GET'], ['/api/audit', 'GET'], ['/api/trash', 'GET'], ['/api/export', 'GET'],
    ['/api/settings', 'PUT', { classTitle: 'x', announcement: '' }],
    [`/api/users/${editorId}`, 'PATCH', { role: 'admin' }],
    [`/api/entries/${entry.id}/restore`, 'POST'],
    ['/api/installations', 'GET'],
    ['/api/timetable', 'PUT', { schedule: Array.from({ length: 5 }, () => Array(10).fill('自習')) }],
  ]) {
    const r = await editor.req(path, { method, body });
    assert.equal(r.status, 403, `editor ${method} ${path} should be 403, got ${r.status}`);
  }
  const del = await editor.req(`/api/entries/${entry.id}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
});

test('only admins can change display names', async () => {
  const self = await editor.req('/api/account', { method: 'PATCH', body: { displayName: '自己改的名字' } });
  assert.equal(self.status, 405, 'self-service rename endpoint must not exist');
  const viaUsers = await editor.req(`/api/users/${editorId}`, { method: 'PATCH', body: { displayName: '自己改的名字' } });
  assert.equal(viaUsers.status, 403);
  const byAdmin = await admin.req(`/api/users/${editorId}`, { method: 'PATCH', body: { displayName: '學藝' } });
  assert.equal(byAdmin.status, 200);
  const me = await editor.req('/api/account');
  assert.equal(me.json.user.displayName, '學藝');
});

test('admin: trash restore + audit log records everything without secrets', async () => {
  const trash = await admin.req('/api/trash');
  assert.equal(trash.json.entries[0].id, entry.id);
  assert.equal(trash.json.entries[0].deletedByName, '學藝');
  const r = await admin.req(`/api/entries/${entry.id}/restore`, { method: 'POST' });
  assert.equal(r.status, 200);
  const audit = await admin.req('/api/audit');
  const actions = audit.json.logs.map((l) => `${l.actorName}:${l.entity}:${l.action}`);
  for (const a of ['班長:entry:restore', '學藝:entry:trash', '學藝:entry:update', '學藝:entry:create', '學藝:user:password_change', '班長:user:create']) {
    assert.ok(actions.includes(a), `missing audit ${a}; got ${actions.join(', ')}`);
  }
  assert.ok(!JSON.stringify(audit.json).includes('scrypt'), 'audit must not contain password hashes');
  const upd = audit.json.logs.find((l) => l.action === 'update' && l.entity === 'entry');
  const rv = await admin.req(`/api/audit/${upd.id}/revert`, { method: 'POST' });
  assert.equal(rv.status, 200);
  const board = await anon.req('/api/board?date=2026-11-03');
  assert.ok(board.json.entries.some((e) => e.title.includes('<script>')), 'reverted to pre-update title');
});

test('timetable: public read, admin-only write, strict shape, audited', async () => {
  const pub = await anon.req('/api/timetable');
  assert.equal(pub.status, 200);
  assert.equal(pub.json.schedule.length, 5);
  assert.ok(pub.json.schedule.every((d) => d.length === 10));
  assert.ok(!('updatedByName' in pub.json), 'public timetable must not reveal who edited it');
  const board = await anon.req('/api/board?date=2026-11-02');
  assert.deepEqual(board.json.timetable, pub.json.schedule, 'board carries the timetable');

  const next = pub.json.schedule.map((d) => [...d]);
  next[0][0] = '健康與護理';
  for (const bad of [
    { schedule: next.slice(0, 4) },
    { schedule: next.map((d) => d.slice(0, 9)) },
    { schedule: next.map((d, i) => (i === 0 ? ['x'.repeat(11), ...d.slice(1)] : d)) },
    { schedule: next, extra: true },
  ]) {
    assert.equal((await admin.req('/api/timetable', { method: 'PUT', body: bad })).status, 400);
  }
  const before = (await anon.req('/api/version')).json.version;
  const r = await admin.req('/api/timetable', { method: 'PUT', body: { schedule: next } });
  assert.equal(r.status, 200);
  assert.equal(r.json.schedule[0][0], '健康與護理');
  assert.equal(r.json.updatedByName, '班長');
  assert.notEqual((await anon.req('/api/version')).json.version, before, 'timetable change bumps content version');
  const audit = await admin.req('/api/audit');
  assert.ok(audit.json.logs.some((l) => l.entity === 'timetable' && l.action === 'update' && l.actorName === '班長'));
});

test('installations: anonymous report (validated), admin-only stats', async () => {
  const id = crypto.randomUUID();
  assert.equal((await anon.req('/api/installations', { method: 'POST', body: { installId: id, appVersion: '3.0.0' } })).status, 200);
  assert.equal((await anon.req('/api/installations', { method: 'POST', body: { installId: id, appVersion: '3.0.1' } })).status, 200);
  assert.equal((await anon.req('/api/installations', { method: 'POST', body: { installId: crypto.randomUUID(), appVersion: '3.0.0' } })).status, 200);
  for (const bad of [
    { installId: 'not-a-uuid', appVersion: '3.0.0' },
    { installId: id, appVersion: '3.0.0; drop table' },
    { installId: id, appVersion: '3.0.0', model: 'Pixel' },
  ]) {
    assert.equal((await anon.req('/api/installations', { method: 'POST', body: bad })).status, 400);
  }
  const noOrigin = await anon.req('/api/installations', { method: 'POST', body: { installId: id, appVersion: '3.0.0' }, origin: null });
  assert.equal(noOrigin.status, 403, 'native app must send Origin like the web');
  const stats = await admin.req('/api/installations');
  assert.equal(stats.status, 200);
  assert.equal(stats.json.total, 2);
  assert.equal(stats.json.active30d, 2);
  assert.deepEqual(stats.json.versions.map((v) => [v.version, v.total]), [['3.0.1', 1], ['3.0.0', 1]]);
});

test('last admin cannot be demoted or deactivated', async () => {
  const users = (await admin.req('/api/users')).json.users;
  const me = users.find((u) => u.username === 'boss');
  const r = await admin.req(`/api/users/${me.id}`, { method: 'PATCH', body: { role: 'editor' } });
  assert.equal(r.status, 409);
});

test('deactivating a user kills their sessions immediately', async () => {
  const r = await admin.req(`/api/users/${editorId}`, { method: 'PATCH', body: { isActive: false } });
  assert.equal(r.status, 200);
  const after = await editor.req('/api/entries');
  assert.equal(after.status, 401);
  const relog = await new Client().req('/api/auth/login', { method: 'POST', body: { username: 'amy', password: 'blue-river-stone-42' } });
  assert.equal(relog.status, 401, 'deactivated account gets the same error as a wrong password');
  await admin.req(`/api/users/${editorId}`, { method: 'PATCH', body: { isActive: true } });
});

test('reset password: old sessions die, temp password forces change', async () => {
  const e2 = new Client();
  assert.equal((await e2.req('/api/auth/login', { method: 'POST', body: { username: 'amy', password: 'blue-river-stone-42' } })).status, 200);
  const r = await admin.req(`/api/users/${editorId}/reset-password`, { method: 'POST' });
  assert.equal(r.status, 200);
  assert.equal((await e2.req('/api/entries')).status, 401);
  assert.equal((await e2.req('/api/auth/login', { method: 'POST', body: { username: 'amy', password: r.json.tempPassword } })).status, 200);
  assert.equal((await e2.req('/api/entries')).json.code, 'must_change_password');
});

test('logout invalidates the session server-side (stolen cookie is useless)', async () => {
  const c = new Client();
  await c.req('/api/auth/login', { method: 'POST', body: { username: 'boss', password: 'boss-password-123' } });
  const stolen = c.cookie;
  await c.req('/api/auth/logout', { method: 'POST' });
  const replay = new Client();
  replay.cookie = stolen;
  assert.equal((await replay.req('/api/users')).status, 401);
});

test('forged / garbage session cookies are rejected', async () => {
  const f = new Client();
  f.cookie = 'cb_sid=' + 'A'.repeat(43);
  assert.equal((await f.req('/api/users')).status, 401);
  f.cookie = "cb_sid=' or 1=1 --";
  assert.equal((await f.req('/api/users')).status, 401);
});

test('SQL injection attempts in search and ids are harmless', async () => {
  const r = await admin.req(`/api/entries?q=${encodeURIComponent("%' or 1=1; drop table app.entries; --")}&from=2000-01-01&to=2100-01-01`);
  assert.equal(r.status, 200);
  assert.equal(r.json.entries.length, 0);
  const bad = await admin.req(`/api/entries/${encodeURIComponent("1' or '1'='1")}`, { method: 'DELETE' });
  assert.equal(bad.status, 404);
  const audit = await admin.req(`/api/audit?before=${encodeURIComponent('1 or 1=1')}`);
  assert.equal(audit.status, 200);
  assert.equal((await anon.req('/api/board')).status, 200, 'tables still exist');
});

test('brute force: account locks after 5 failures (same response for unknown users)', async () => {
  const c = new Client();
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    statuses.push((await c.req('/api/auth/login', { method: 'POST', body: { username: 'boss', password: 'wrong-' + i } })).status);
  }
  assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429]);
  const right = await c.req('/api/auth/login', { method: 'POST', body: { username: 'boss', password: 'boss-password-123' } });
  assert.equal(right.status, 429, 'even the right password is refused while locked');
  const ghost = await c.req('/api/auth/login', { method: 'POST', body: { username: 'nobody', password: 'x' } });
  assert.equal(ghost.status, 401);
  assert.equal(ghost.json.error, '帳號或密碼錯誤');
});

test('brute force cannot be bypassed by firing guesses in parallel (F1 race)', async () => {
  // 同時送一大批錯誤登入：若限流有競態，它們會在任何失敗被記錄前全部闖過（全部 401）。
  // 修好之後，同帳號的嘗試被 advisory lock 排成一列，最多 5 個得到 401，其餘一律 429。
  const user = 'race-ghost-' + Date.now();
  const results = await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      new Client().req('/api/auth/login', { method: 'POST', body: { username: user, password: 'nope-' + i } }),
    ),
  );
  const statuses = results.map((r) => r.status);
  const got401 = statuses.filter((s) => s === 401).length;
  const got429 = statuses.filter((s) => s === 429).length;
  assert.ok(got401 <= 5, `並發錯誤登入最多 5 個可得到 401，實際 ${got401} —— 競態未修補`);
  assert.ok(got429 >= 25, `其餘應被限流擋下（429），實際 429 = ${got429}`);
  assert.equal(got401 + got429, 30, `回應應只有 401/429，實際 = ${statuses.join(',')}`);
});

test('security headers on pages and API', async () => {
  const page = await fetch(BASE + '/');
  const csp = page.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.ok(!csp.includes('unsafe-eval'));
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(page.headers.get('x-powered-by'), null);
  const html = await page.text();
  const nonce = /'nonce-([^']+)'/.exec(csp)[1];
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
  assert.ok(scripts.length > 0);
  for (const attrs of scripts) assert.ok(attrs.includes(`nonce="${nonce}"`), `script without nonce: ${attrs}`);
  const api = await fetch(BASE + '/api/board');
  assert.match(api.headers.get('cache-control'), /no-store/);
  const page2 = await fetch(BASE + '/');
  assert.notEqual(page2.headers.get('content-security-policy'), csp, 'nonce must change per request');
});

// ---- 24 小時鎖定與後台「登入紀錄」----
// 要有「幾個小時前」的失敗紀錄，HTTP 做不出來，所以直接用網站的資料庫帳號寫入（CI 有 DATABASE_URL）。
const DB_URL = process.env.DATABASE_URL;
const sql = DB_URL ? postgres(DB_URL, { ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require', max: 1, onnotice: () => {} }) : null;
after(() => sql?.end());
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000);
const loginFrom = (ip, username, password) =>
  new Client().req('/api/auth/login', { method: 'POST', body: { username, password }, headers: { 'x-real-ip': ip } });

test('login activity is admin-only', async () => {
  assert.equal((await anon.req('/api/login-activity')).status, 401);
  assert.equal((await anon.req('/api/login-activity?summary=1')).status, 401);
  assert.equal((await anon.req('/api/login-activity/unlock', { method: 'POST', body: { ip: '1.2.3.4' } })).status, 401);
});

test('24h lock: 20 failures in a day lock an account until an admin unlocks it', { skip: !sql }, async () => {
  const u = 'daylock-' + Date.now();
  await sql`insert into app.login_attempts (username, ip, success, at)
            select ${u}, '198.51.100.20', false, ${hoursAgo(2)} from generate_series(1, 20)`;
  const locked = await loginFrom('198.51.100.21', u, 'x');
  assert.equal(locked.status, 429);
  assert.equal(locked.json.code, 'locked', 'a slow bot spread over hours is still stopped');

  const act = await admin.req('/api/login-activity');
  assert.equal(act.status, 200);
  const row = act.json.accounts.find((a) => a.username === u);
  assert.equal(row.lock, 'day');
  assert.equal(row.exists, false);
  assert.equal(row.fails24h, 20);
  assert.ok((await admin.req('/api/login-activity?summary=1')).json.lockedAccounts >= 1);

  const un = await admin.req('/api/login-activity/unlock', { method: 'POST', body: { username: u } });
  assert.equal(un.status, 200);
  assert.equal(un.json.cleared, 20);
  assert.equal((await loginFrom('198.51.100.21', u, 'x')).status, 401, 'unlocked: back to a normal wrong-password answer');
});

test('24h IP block: 100 failures from one IP block it until an admin unlocks it', { skip: !sql }, async () => {
  const ip = '198.51.100.30';
  await sql`insert into app.login_attempts (username, ip, success, at)
            select 'bot-' || g, ${ip}, false, ${hoursAgo(3)} from generate_series(1, 100) g`;
  const blocked = await loginFrom(ip, 'someone-' + Date.now(), 'x');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.json.code, 'locked');

  const row = (await admin.req('/api/login-activity')).json.ips.find((r) => r.ip === ip);
  assert.equal(row.lock, 'day');
  assert.equal(row.accounts, 100);

  const un = await admin.req('/api/login-activity/unlock', { method: 'POST', body: { ip } });
  assert.equal(un.json.cleared, 100);
  assert.equal((await loginFrom(ip, 'someone-' + Date.now(), 'x')).status, 401);
});

test('a successful login only clears failures from the same network', { skip: !sql }, async () => {
  const u = 'keep-' + Date.now();
  const created = await admin.req('/api/users', { method: 'POST', body: { username: u, displayName: '測試', role: 'editor' } });
  assert.equal(created.status, 201);
  // 別的地方（例如機器人）一小時前對這個帳號試了 3 次
  await sql`insert into app.login_attempts (username, ip, success, at)
            select ${u}, '198.51.100.40', false, ${hoursAgo(1)} from generate_series(1, 3)`;
  // 本人自己打錯一次，然後打對
  assert.equal((await loginFrom('198.51.100.41', u, 'wrong')).status, 401);
  assert.equal((await loginFrom('198.51.100.41', u, created.json.tempPassword)).status, 200);

  const left = await sql`select ip, count(*)::int as n from app.login_attempts
                         where username = ${u} and not success group by ip order by ip`;
  assert.deepEqual(left.map((r) => [r.ip, r.n]), [['198.51.100.40', 3]], 'own typo cleared, the other network still counts');
});

test('admins see recent successful logins with IP, device and a warning for bot-like IPs', { skip: !sql }, async () => {
  const u = 'ok-' + Date.now();
  const created = await admin.req('/api/users', { method: 'POST', body: { username: u, displayName: '登入測試', role: 'editor' } });
  const pw = created.json.tempPassword;
  const app = (ip) => new Client().req('/api/auth/login', { method: 'POST', body: { username: u, password: pw }, headers: { 'x-real-ip': ip, 'user-agent': 'ContactBookAndroid/9.9.9' } });

  assert.equal((await app('198.51.100.50')).status, 200);
  // 從一個試過很多帳號的 IP 登入成功 → 要被標出來
  await sql`insert into app.login_attempts (username, ip, success, at)
            select 'guess-' || g, '198.51.100.51', false, ${hoursAgo(1)} from generate_series(1, 3) g`;
  assert.equal((await app('198.51.100.51')).status, 200);

  const logins = (await admin.req('/api/login-activity')).json.logins.filter((g) => g.username === u);
  const at50 = logins.filter((g) => g.ip === '198.51.100.50');
  assert.equal(at50.length, 1, 'one login shows once (attempt record and session are merged)');
  assert.equal(at50[0].userAgent, 'ContactBookAndroid/9.9.9');
  assert.equal(at50[0].displayName, '登入測試');
  assert.equal(at50[0].suspicious, false);
  assert.equal(logins.find((g) => g.ip === '198.51.100.51')?.suspicious, true);
});
