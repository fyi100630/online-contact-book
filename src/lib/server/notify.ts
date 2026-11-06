import 'server-only';
import { db } from './db';
import { deviceLabel, isScriptUA } from '@/lib/shared/device';
import { LOGIN_LIMITS } from '@/lib/shared/types';

// 出事時傳訊息到管理員的 Discord 頻道。
// 只要在 Vercel 設定環境變數 DISCORD_WEBHOOK_URL（Discord 頻道 → 整合 → Webhook 的網址）就會啟用；沒設就什麼都不做。
// 由 route 用 next/server 的 after() 在回應送出之後才呼叫，Discord 慢或失敗都不會拖慢、弄壞登入。

const webhookUrl = () => (process.env.DISCORD_WEBHOOK_URL ?? '').trim();

export function notifyConfigured(): boolean {
  return /^https?:\/\/\S+$/.test(webhookUrl());
}

/**
 * 帳號名稱、User-Agent 這些字串是攻擊者自己能填的，放進 Discord 前先處理：
 * 看不見或會改變排版的字元換成 ⍰（不直接刪掉，才看得出「這不是真的那個帳號」），
 * 反引號換掉、截短，再包成行內程式碼（裡面的連結、markdown 都不會生效）。
 * 送出時還加了 allowed_mentions: { parse: [] }，所以就算寫 @everyone 也不會標記任何人。
 */
function code(v: string | null | undefined, max = 64): string {
  const s = (v ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u2064\u206a-\u206f\ufeff]/g, '\u2370')
    .replace(/`/g, '\u02cb');
  if (!s) return '（空白）';
  return '`' + (s.length > max ? s.slice(0, max) + '…' : s) + '`';
}

const taipeiTime = (d = new Date()) =>
  new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);

/** 傳一則訊息到 Discord；回傳有沒有成功。不會丟例外，也不會把 webhook 網址寫進紀錄。 */
export async function sendDiscord(lines: string[]): Promise<boolean> {
  if (!notifyConfigured()) return false;
  try {
    const res = await fetch(webhookUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: lines.join('\n').slice(0, 1900), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error('[notify] discord responded', res.status);
    return res.ok;
  } catch (err) {
    console.error('[notify] discord failed', (err as Error)?.name);
    return false;
  }
}

export async function sendTestNotification(byName: string): Promise<boolean> {
  return sendDiscord([
    '✅ **測試通知**',
    `聯絡簿的 Discord 通知設定成功（由 ${code(byName, 30)} 在後台送出）。`,
    `時間：${taipeiTime()}`,
  ]);
}

function decodeHeader(v: string | null): string | null {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/**
 * 登入成功後檢查：從國外、從「最近試過很多帳號」的 IP、或用程式登入，就通知。
 * 國家來自 Vercel 加上的 x-vercel-ip-country（本機沒有這個標頭，就不判斷國家）。
 */
export async function notifyIfSuspiciousLogin(input: {
  username: string;
  ip: string;
  userAgent: string | null;
  country: string | null;
  city: string | null;
}): Promise<void> {
  const reasons: string[] = [];
  const country = input.country?.toUpperCase() ?? null;
  if (country && country !== 'TW') reasons.push(`IP 不在台灣（${country}）`);
  const [r] = await db()`
    select count(distinct username)::int as n from app.login_attempts
    where not success and ip = ${input.ip} and at > now() - interval '7 days'`;
  const tried = Number(r?.n ?? 0);
  if (tried >= 3) reasons.push(`這個 IP 最近 7 天也試過 ${tried} 個帳號`);
  if (isScriptUA(input.userAgent)) reasons.push('用程式登入，不是瀏覽器或 App');
  if (reasons.length === 0) return;

  const [u] = await db()`select display_name, role from app.users where username = ${input.username}`;
  const where = [country, decodeHeader(input.city)].filter(Boolean).join(' ');
  await sendDiscord([
    '🔴 **可疑的登入成功**',
    `帳號：${code(input.username)}${u ? `（${code(u.display_name, 30)}，${u.role === 'admin' ? '管理員' : '幹部'}）` : ''}`,
    `IP：${code(input.ip)}${where ? `（${code(where, 40)}）` : ''}`,
    `裝置：${deviceLabel(input.userAgent)}　${code(input.userAgent, 80)}`,
    `原因：${reasons.join('、')}`,
    `時間：${taipeiTime()}`,
    '→ 到後台「登入紀錄」確認。如果不是本人，到「帳號管理」停用這個帳號並重設密碼。',
  ]);
}

/** 帳號或 IP 剛被鎖 24 小時（每次被鎖只通知一次） */
export async function notifyDayLocks(kinds: ('account' | 'ip')[], username: string, ip: string): Promise<void> {
  for (const kind of kinds) {
    if (kind === 'account') {
      const [r] = await db()`
        select exists(select 1 from app.users where username = ${username}) as exists,
               (select count(distinct ip)::int from app.login_attempts
                where not success and username = ${username} and at > now() - interval '24 hours') as ips`;
      await sendDiscord([
        '🟠 **帳號被鎖 24 小時**',
        `帳號：${code(username)}（${r?.exists ? '真實帳號' : '沒有這個帳號'}）`,
        `24 小時內登入失敗 ${LOGIN_LIMITS.accountDay} 次，來自 ${Number(r?.ips ?? 0)} 個 IP，最後一次是 ${code(ip)}`,
        `時間：${taipeiTime()}`,
        r?.exists
          ? '→ 如果是同學自己忘記密碼，到後台「登入紀錄」解鎖（或在「帳號管理」重設密碼）。不是的話就讓它鎖著。'
          : '→ 有人在亂猜帳號，不用處理。',
      ]);
    } else {
      const [r] = await db()`
        select count(distinct username)::int as n from app.login_attempts
        where not success and ip = ${ip} and at > now() - interval '24 hours'`;
      await sendDiscord([
        '🟠 **IP 被鎖 24 小時**',
        `IP：${code(ip)}，24 小時內登入失敗 ${LOGIN_LIMITS.ipDay} 次，試過 ${Number(r?.n ?? 0)} 個帳號`,
        `時間：${taipeiTime()}`,
        '→ 如果是學校或家裡的網路被誤鎖，到後台「登入紀錄」解鎖；如果是國外的主機，可以到 Vercel Firewall 永久封鎖。',
      ]);
    }
  }
}

/** 有人得到管理員權限（新增管理員帳號，或把帳號改成管理員） */
export async function notifyAdminGranted(input: { userId: string; byName: string; how: 'created' | 'promoted' }): Promise<void> {
  const [u] = await db()`select username, display_name from app.users where id = ${input.userId}`;
  if (!u) return;
  await sendDiscord([
    '🛡 **有人成為管理員**',
    `${code(u.username)}（${code(u.display_name, 30)}）被 ${code(input.byName, 30)}${input.how === 'created' ? '建立為管理員' : '改成管理員'}`,
    `時間：${taipeiTime()}`,
    '→ 如果不是你做的，立刻到後台「帳號管理」停用這個帳號。',
  ]);
}
