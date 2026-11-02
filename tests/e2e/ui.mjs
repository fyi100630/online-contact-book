// 瀏覽器端到端測試：真正的伺服器 + 資料庫 + Chromium。
// 用法：BASE=http://localhost:3100 SETUP_TOKEN=... SHOTS=./shots node tests/e2e/ui.mjs
import { createRequire } from 'node:module';
// 使用環境裡已安裝的 Playwright（npm i -D playwright 也可以）
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const SHOTS = process.env.SHOTS ?? 'test-results';
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const results = [];
const problems = [];
function watch(page, label) {
  page.on('pageerror', (e) => problems.push(`[${label}] pageerror ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource.*(401|403|404|409|429)/.test(m.text())) problems.push(`[${label}] console ${m.text()}`);
  });
  page.on('dialog', (d) => d.accept());
}
async function step(name, fn) {
  try {
    await fn();
    results.push(`PASS ${name}`);
  } catch (e) {
    results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`);
  }
}

const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
await adminCtx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
const page = await adminCtx.newPage();
watch(page, 'admin');
let tempPw = '';

await step('empty board renders for visitors', async () => {
  await page.goto(BASE + '/');
  await page.getByText('這天沒有登記事項').waitFor();
  await page.screenshot({ path: `${SHOTS}/01-board-empty.png` });
});

await step('first-run setup creates admin and signs in', async () => {
  await page.goto(BASE + '/setup');
  await page.screenshot({ path: `${SHOTS}/02-setup.png` });
  const inputs = page.locator('form input');
  await inputs.nth(0).fill(process.env.SETUP_TOKEN);
  await inputs.nth(1).fill('boss');
  await inputs.nth(2).fill('王班長');
  await inputs.nth(3).fill('boss-password-123');
  await inputs.nth(4).fill('boss-password-123');
  await page.getByRole('button', { name: '建立並登入' }).click();
  await page.waitForURL('**/manage');
  await page.getByRole('heading', { name: '事項' }).waitFor();
});

const add = async (cat, subject, title, presetLabel, opts = {}) => {
  await page.getByRole('button', { name: '新增事項' }).click();
  const drawer = page.locator('dialog[open]');
  await drawer.getByRole('button', { name: cat, exact: true }).click();
  await drawer.getByPlaceholder('例如：數學').fill(subject);
  await drawer.getByPlaceholder('例如：習作 p.12～15').fill(title);
  if (opts.details) await drawer.locator('textarea').fill(opts.details);
  if (presetLabel) await drawer.getByRole('button', { name: presetLabel, exact: true }).click();
  if (opts.high) await drawer.getByLabel('標為重要').check();
  await drawer.getByRole('button', { name: '新增', exact: true }).click();
  await page.getByText(title).first().waitFor();
};

await step('admin adds entries via drawer', async () => {
  await add('作業', '國文', '習作 p.12～15', '明天');
  await page.screenshot({ path: `${SHOTS}/03-drawer-after.png` });
  await page.getByRole('button', { name: '新增事項' }).click();
  await page.screenshot({ path: `${SHOTS}/03b-drawer.png` });
  await page.keyboard.press('Escape');
  await add('考試', '數學', '第一次段考 ch1–3', '一週後', { details: '範圍：課本 p.1–60\n帶計算機', high: true });
  await add('繳交', '', '家長同意書', '後天');
  await add('提醒', '', '明天穿運動服', '不設定');
});

await step('announcement publish with preview', async () => {
  await page.getByRole('link', { name: '公告' }).click();
  await page.locator('textarea').fill('段考週請早點休息！\n考試範圍：https://example.com/range');
  await page.getByText('預覽').waitFor();
  await page.getByRole('button', { name: '發布' }).click();
  await page.getByText('已發布').waitFor();
});

await step('admin creates an editor and sees one-time password', async () => {
  await page.getByRole('link', { name: '帳號管理' }).click();
  await page.getByRole('button', { name: '新增帳號' }).click();
  const d = page.locator('dialog[open]');
  await d.getByLabel('顯示名稱').fill('學藝股長 小美');
  await d.getByLabel('登入帳號').fill('amy');
  await d.getByRole('button', { name: '建立帳號' }).click();
  await page.getByText('這組密碼只會顯示這一次').waitFor();
  tempPw = (await page.locator('.secret code').textContent()).trim();
  if (!/^\w{4}-\w{4}-\w{4}$/.test(tempPw)) throw new Error('bad temp pw ' + tempPw);
  await page.screenshot({ path: `${SHOTS}/04-temp-password.png` });
  await page.getByRole('button', { name: '我已經記下來了' }).click();
  await page.getByText('等待首次登入').waitFor();
  await page.screenshot({ path: `${SHOTS}/05-users.png` });
});

await step('public board shows entries, announcement, week strip', async () => {
  await page.goto(BASE + '/');
  await page.locator('.rows').getByText('習作 p.12～15').waitFor();
  await page.locator('.rows').getByText('第一次段考 ch1–3').waitFor();
  await page.locator('.notice a[href="https://example.com/range"]').waitFor();
  await page.getByText('明天交').first().waitFor();
  await page.screenshot({ path: `${SHOTS}/06-board.png`, fullPage: true });
});

await step('board filter chips and day navigation', async () => {
  await page.locator('.filters').getByRole('button', { name: /考試/ }).click();
  if (await page.locator('.rows').getByText('習作 p.12～15').count()) throw new Error('filter did not hide homework');
  await page.locator('.filters').getByRole('button', { name: /全部/ }).click();
  await page.locator('.week .day').nth(6).click();
  await page.waitForURL(/\?d=/);
  await page.getByRole('button', { name: '回到今天' }).click();
  await page.locator('.rows').getByText('明天穿運動服').waitFor();
});

// ----- editor -----
const edCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const ed = await edCtx.newPage();
watch(ed, 'editor');

await step('editor first login is forced to change password', async () => {
  await ed.goto(BASE + '/login');
  await ed.screenshot({ path: `${SHOTS}/07-login.png` });
  await ed.getByLabel('帳號').fill('amy');
  await ed.getByLabel('密碼').fill('wrong-password');
  await ed.getByRole('button', { name: '登入' }).click();
  await ed.getByText('帳號或密碼錯誤').waitFor();
  await ed.getByLabel('密碼').fill(tempPw);
  await ed.getByRole('button', { name: '登入' }).click();
  await ed.waitForURL('**/manage/account');
  await ed.getByText('臨時密碼。請先設定').waitFor();
  await ed.goto(BASE + '/manage/users');
  await ed.waitForURL('**/manage/account');
  await ed.getByLabel('臨時密碼').fill(tempPw);
  await ed.getByLabel('新密碼', { exact: true }).fill('blue-river-stone-42');
  await ed.getByLabel('再輸入一次新密碼').fill('blue-river-stone-42');
  await ed.getByRole('button', { name: '更新密碼' }).click();
  await ed.waitForURL('**/manage');
});

await step('editor has no admin pages', async () => {
  if (await ed.getByRole('link', { name: '帳號管理' }).count()) throw new Error('admin nav visible');
  const r = await ed.goto(BASE + '/manage/users');
  if (r.status() !== 404) throw new Error('admin page status ' + r.status());
  await ed.goto(BASE + '/manage');
});

await step('editor edits and deletes', async () => {
  await ed.getByRole('button', { name: /家長同意書/ }).click();
  const d = ed.locator('dialog[open]');
  await d.getByPlaceholder('例如：習作 p.12～15').fill('家長同意書（簽名）');
  await d.getByRole('button', { name: '儲存' }).click();
  await ed.getByText('家長同意書（簽名）').waitFor();
  await ed.getByRole('button', { name: /明天穿運動服/ }).click();
  await ed.locator('dialog[open]').getByRole('button', { name: '刪除' }).click();
  await ed.getByText('已移到垃圾桶').waitFor();
  await ed.screenshot({ path: `${SHOTS}/08-editor-entries.png` });
});

await step('conflict: stale edit is refused, not overwritten', async () => {
  await page.goto(BASE + '/manage');
  await page.getByRole('button', { name: /習作 p\.12/ }).click();      // admin opens v1
  await ed.reload();
  await ed.getByRole('button', { name: /習作 p\.12/ }).click();         // editor saves v2
  await ed.locator('dialog[open]').getByPlaceholder('例如：習作 p.12～15').fill('習作 p.12～20');
  await ed.locator('dialog[open]').getByRole('button', { name: '儲存' }).click();
  await ed.getByText('習作 p.12～20').waitFor();
  await page.locator('dialog[open]').getByPlaceholder('例如：習作 p.12～15').fill('admin stale overwrite');
  await page.locator('dialog[open]').getByRole('button', { name: '儲存' }).click();
  await page.getByText('有其他人修改了這個事項').waitFor();
  await page.getByText('習作 p.12～20').waitFor();
});

await step('admin: trash restore, activity log, revert', async () => {
  await page.getByRole('link', { name: '垃圾桶' }).click();
  await page.getByText('明天穿運動服').waitFor();
  await page.getByRole('button', { name: '還原' }).click();
  await page.getByText('已還原「明天穿運動服」').waitFor();
  await page.getByRole('link', { name: '修改紀錄' }).click();
  await page.getByText('學藝股長 小美').first().waitFor();
  await page.locator('.diff').first().waitFor();
  await page.screenshot({ path: `${SHOTS}/09-activity.png`, fullPage: true });
});

await step('backup download + legacy import (idempotent)', async () => {
  await page.getByRole('link', { name: '備份與匯入' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '下載 JSON 備份' }).click()]);
  const json = JSON.parse(await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8'));
  if (json.records.length < 4) throw new Error('export too small');
  const legacy = { classTitle: '411班級聯絡簿', announcement: '⚠️ App 版維護中', records: [
    { id: 'rec-1', date: '2026-10-20', category: 'exam', subject: '英文', title: '單字考 L1', dueDate: '2026-10-25' },
    { id: 'rec-2', date: 'not-a-date', title: 'bad' },
  ] };
  writeFileSync(`${SHOTS}/legacy.json`, JSON.stringify(legacy));
  await page.setInputFiles('input[type=file]', `${SHOTS}/legacy.json`);
  await page.getByText('格式不正確會略過').waitFor();
  await page.getByRole('button', { name: '開始匯入' }).click();
  await page.getByText('匯入完成：新增 1 筆').waitFor();
  await page.setInputFiles('input[type=file]', `${SHOTS}/legacy.json`);
  await page.getByRole('button', { name: '開始匯入' }).click();
  await page.getByText('1 筆先前已匯入').waitFor();
});

await step('admin edits timetable; board shows the day and the full week', async () => {
  await page.goto(BASE + '/manage/timetable');
  await page.getByRole('heading', { name: '課表' }).waitFor();
  await page.getByRole('button', { name: '週一' }).click();
  const first = page.getByLabel('第 1 節');
  await first.fill('健康與護理');
  await page.getByRole('button', { name: '儲存' }).click();
  await page.getByText('課表已更新').waitFor();
  await page.screenshot({ path: `${SHOTS}/14-timetable-admin.png`, fullPage: true });
  await page.goto(BASE + '/?d=2026-11-02'); // 週一
  await page.locator('.classes-list').getByText('健康與護理').waitFor();
  await page.getByRole('button', { name: '整週' }).click();
  await page.locator('dialog[open] .tt').getByText('健康與護理').waitFor();
  await page.screenshot({ path: `${SHOTS}/15-timetable-week.png` });
  await page.keyboard.press('Escape');
  await page.goto(BASE + '/?d=2026-11-07'); // 週六
  await page.getByText('週末沒有課').waitFor();
});

await step('admin sees app install stats', async () => {
  await page.goto(BASE + '/manage/app');
  await page.getByText('安裝過的裝置').waitFor();
  await page.screenshot({ path: `${SHOTS}/16-install-stats.png` });
});

await step('mobile layouts', async () => {
  const m = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  watch(mp, 'mobile');
  await mp.goto(BASE + '/');
  await mp.locator('.rows').getByText('習作 p.12～20').waitFor();
  await mp.screenshot({ path: `${SHOTS}/10-mobile-board.png`, fullPage: true });
  const over = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (over) throw new Error('horizontal overflow on mobile board');
  await mp.goto(BASE + '/login');
  await mp.getByLabel('帳號').fill('boss');
  await mp.getByLabel('密碼').fill('boss-password-123');
  await mp.getByRole('button', { name: '登入' }).click();
  await mp.waitForURL('**/manage');
  await mp.getByRole('button', { name: '開啟選單' }).click();
  await mp.screenshot({ path: `${SHOTS}/11-mobile-menu.png` });
  await mp.getByRole('link', { name: '事項' }).click();
  await mp.getByRole('button', { name: '新增事項' }).click();
  await mp.screenshot({ path: `${SHOTS}/12-mobile-drawer.png` });
  const over2 = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (over2) throw new Error('horizontal overflow on mobile manage');
  await m.close();
});

await step('dark mode renders', async () => {
  const d = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
  const dp = await d.newPage();
  watch(dp, 'dark');
  await dp.goto(BASE + '/');
  await dp.locator('.rows').getByText('習作 p.12～20').waitFor();
  await dp.screenshot({ path: `${SHOTS}/13-dark.png`, fullPage: true });
  await d.close();
});

await step('logout', async () => {
  await page.getByRole('button', { name: '登出' }).click();
  await page.waitForURL(BASE + '/');
  const r = await page.goto(BASE + '/manage');
  if (!page.url().includes('/login')) throw new Error('not redirected to login: ' + page.url());
});

await browser.close();
console.log(results.join('\n'));
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'no console errors / CSP violations');
