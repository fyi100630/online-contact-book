import 'server-only';
import { db, type Tx } from './db';
import { LOGIN_LIMITS, type LockState, type LoginActivity, type LoginActivitySummary, type LoginSuccess } from '@/lib/shared/types';

const SHORT_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const n = (v: unknown) => Number(v ?? 0);

/** 依失敗次數判斷鎖定狀態：24 小時的上限優先（要等滿 24 小時或管理員解鎖） */
function lockOf(short: number, day: number, kind: 'account' | 'ip'): LockState {
  const L = LOGIN_LIMITS;
  if (day >= (kind === 'account' ? L.accountDay : L.ipDay)) return 'day';
  if (short >= (kind === 'account' ? L.accountShort : L.ipShort)) return 'short';
  return null;
}

/** 存在資料庫裡，所以 Vercel 多台伺服器之間也會共用計數（只用在初次設定 /api/setup） */
export async function isLoginBlocked(username: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - SHORT_MS);
  const [row] = await db()`
    select
      count(*) filter (where username = ${username}) as by_user,
      count(*) filter (where ip = ${ip}) as by_ip
    from app.login_attempts
    where at > ${since} and not success and (username = ${username} or ip = ${ip})`;
  return n(row?.by_user) >= LOGIN_LIMITS.accountShort || n(row?.by_ip) >= LOGIN_LIMITS.ipShort;
}

export async function recordLoginAttempt(username: string, ip: string, success: boolean): Promise<void> {
  await db()`insert into app.login_attempts (username, ip, success) values (${username.slice(0, 64)}, ${ip}, ${success})`;
  if (success) {
    await db()`delete from app.login_attempts where username = ${username} and ip = ${ip} and not success`;
  }
  if (Math.random() < 0.02) {
    await db()`delete from app.login_attempts where at < now() - interval '7 days'`;
  }
}

/** 記一筆成功登入（後台「最近成功登入」用；不影響失敗次數的計算，7 天後自動清掉） */
export async function recordLoginSuccess(username: string, ip: string): Promise<void> {
  await db()`insert into app.login_attempts (username, ip, success) values (${username.slice(0, 64)}, ${ip}, true)`;
}

export type GuardResult<T> =
  | { blocked: 'short' | 'day' }
  /** justLocked：這一次失敗剛好讓帳號或 IP 達到 24 小時上限（只在達到的那一次出現，用來發通知） */
  | { blocked: false; success: boolean; value: T; justLocked: ('account' | 'ip')[] };

/**
 * 原子限流：「先把這次登記為失敗，再做昂貴的驗證（scrypt）」，驗證成功才清掉失敗紀錄。
 *
 * 關掉「先檢查次數、後記錄失敗」之間的競態窗口：數次數＋先登記這兩步在同一個短交易裡、
 * 持有同帳號與同 IP 的 advisory lock 完成，所以同時送來的請求一定會看到彼此已登記的嘗試，
 * 超過上限的一律 429。
 *
 * 鎖只包住這兩個很快的查詢；scrypt 在交易結束、鎖和連線都放掉之後才做。
 * 不然共用同一個對外 IP 的人（例如整間學校）會被排成一列、每人多等一次 scrypt，
 * 驗證期間還一直佔著連線池。
 *
 * 兩層上限（數字見 LOGIN_LIMITS）：15 分鐘的短鎖擋手動亂試；24 小時的長鎖擋慢慢試的機器人，
 * 要等最舊的失敗滿 24 小時或管理員在後台「登入紀錄」解鎖。
 *
 * 驗證成功時只清掉「這個帳號從這個 IP」的失敗：本人自己打錯的會歸零，
 * 別的地方（例如機器人）對這個帳號的嘗試仍留著、繼續計數，也留在後台給管理員看。
 */
export async function guardedAttempt<T>(
  username: string,
  ip: string,
  verify: () => Promise<{ success: boolean; value: T }>,
): Promise<GuardResult<T>> {
  const shortSince = new Date(Date.now() - SHORT_MS);
  const daySince = new Date(Date.now() - DAY_MS);
  const gate = await db().begin(async (tx: Tx) => {
    // 1) 同一帳號、同一 IP 的請求在這裡排隊，但只排「數＋登記」這一小段（交易結束自動釋放）
    await tx`select pg_advisory_xact_lock(hashtextextended(${username}, 0))`;
    await tx`select pg_advisory_xact_lock(hashtextextended(${ip}, 1))`;

    // 2) 數 15 分鐘與 24 小時內的失敗次數
    const [c] = await tx`
      select
        count(*) filter (where username = ${username} and at > ${shortSince}) as user_short,
        count(*) filter (where ip = ${ip} and at > ${shortSince}) as ip_short,
        count(*) filter (where username = ${username}) as user_day,
        count(*) filter (where ip = ${ip}) as ip_day
      from app.login_attempts
      where at > ${daySince} and not success and (username = ${username} or ip = ${ip})`;
    const userLock = lockOf(n(c?.user_short), n(c?.user_day), 'account');
    const ipLock = lockOf(n(c?.ip_short), n(c?.ip_day), 'ip');
    if (userLock === 'day' || ipLock === 'day') return { lock: 'day' as const, reached: [] };
    if (userLock || ipLock) return { lock: 'short' as const, reached: [] };

    // 3) 先把這次「當成失敗」寫進去——之後驗證成功再清掉
    await tx`insert into app.login_attempts (username, ip, success) values (${username.slice(0, 64)}, ${ip}, false)`;
    // 這一筆剛好補到 24 小時上限的話，記下來（失敗才算，驗證成功就不是被鎖）
    const reached: ('account' | 'ip')[] = [];
    if (n(c?.user_day) + 1 === LOGIN_LIMITS.accountDay) reached.push('account');
    if (n(c?.ip_day) + 1 === LOGIN_LIMITS.ipDay) reached.push('ip');
    return { lock: null, reached };
  });
  if (gate.lock) return { blocked: gate.lock };

  // 4) 鎖和連線都放掉了，才做昂貴的驗證
  const { success, value } = await verify();

  if (success) {
    await db()`delete from app.login_attempts where username = ${username} and ip = ${ip} and not success`;
    if (Math.random() < 0.02) await db()`delete from app.login_attempts where at < now() - interval '7 days'`;
  }
  return { blocked: false, success, value, justLocked: success ? [] : gate.reached };
}

/** 後台：最近 24 小時的概況（後台首頁的警告用） */
export async function getLoginActivitySummary(): Promise<LoginActivitySummary> {
  const shortSince = new Date(Date.now() - SHORT_MS);
  const daySince = new Date(Date.now() - DAY_MS);
  const [s] = await db()`
    with f as (
      select username, ip, at from app.login_attempts where not success and at > ${daySince}
    ),
    a as (
      select count(*) filter (where at > ${shortSince}) as s, count(*) as d from f group by username
    ),
    i as (
      select count(*) filter (where at > ${shortSince}) as s, count(*) as d from f group by ip
    )
    select
      (select count(*) from f) as fails,
      (select count(distinct username) from f) as accounts,
      (select count(distinct ip) from f) as ips,
      (select count(*) from a where s >= ${LOGIN_LIMITS.accountShort} or d >= ${LOGIN_LIMITS.accountDay}) as locked_accounts,
      (select count(*) from i where s >= ${LOGIN_LIMITS.ipShort} or d >= ${LOGIN_LIMITS.ipDay}) as blocked_ips`;
  return {
    fails24h: n(s?.fails),
    accounts24h: n(s?.accounts),
    ips24h: n(s?.ips),
    lockedAccounts: n(s?.locked_accounts),
    blockedIps: n(s?.blocked_ips),
  };
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

/** 後台「登入紀錄」：最近 7 天每個帳號、每個 IP 的失敗情形 */
export async function getLoginActivity(): Promise<Omit<LoginActivity, 'notifyConfigured'>> {
  const sql = db();
  const shortSince = new Date(Date.now() - SHORT_MS);
  const daySince = new Date(Date.now() - DAY_MS);
  const weekSince = new Date(Date.now() - WEEK_MS);
  const [summary, logins, accounts, ips] = await Promise.all([
    getLoginActivitySummary(),
    getRecentLogins(weekSince),
    sql`
      select f.username, bool_or(u.id is not null) as exists,
             count(*) as fails, count(*) filter (where f.at > ${daySince}) as fails_day,
             count(*) filter (where f.at > ${shortSince}) as fails_short,
             count(distinct f.ip) as ips, max(f.at) as last_at
      from app.login_attempts f
      left join app.users u on u.username = f.username
      where not f.success and f.at > ${weekSince}
      group by f.username
      order by fails_day desc, fails desc, last_at desc
      limit 100`,
    sql`
      select ip, count(*) as fails, count(*) filter (where at > ${daySince}) as fails_day,
             count(*) filter (where at > ${shortSince}) as fails_short,
             count(distinct username) as accounts, max(at) as last_at
      from app.login_attempts
      where not success and at > ${weekSince}
      group by ip
      order by fails_day desc, fails desc, last_at desc
      limit 100`,
  ]);
  return {
    ...summary,
    logins,
    accounts: accounts.map((r) => ({
      username: r.username,
      exists: Boolean(r.exists),
      fails7d: n(r.fails),
      fails24h: n(r.fails_day),
      ips: n(r.ips),
      lastAt: iso(r.last_at),
      lock: lockOf(n(r.fails_short), n(r.fails_day), 'account'),
    })),
    ips: ips.map((r) => ({
      ip: r.ip,
      fails7d: n(r.fails),
      fails24h: n(r.fails_day),
      accounts: n(r.accounts),
      lastAt: iso(r.last_at),
      lock: lockOf(n(r.fails_short), n(r.fails_day), 'ip'),
    })),
  };
}

/**
 * 最近成功登入。兩個來源合併、去掉重複：
 * - login_attempts 裡的成功紀錄（每次登入都會記，保留 7 天）
 * - sessions（登入時建立，含裝置資訊；2026/11/3～11/6 這段期間登入成功沒有寫進 login_attempts，靠它補上）
 * 同一個帳號從同一個 IP、前後一分鐘內的兩筆視為同一次登入。
 */
async function getRecentLogins(since: Date): Promise<LoginSuccess[]> {
  const rows = await db()`
    with ok as (
      select a.at, a.username, a.ip from app.login_attempts a
      where a.success and a.at > ${since} and a.username <> '__setup__'
    ),
    sess as (
      select s.created_at as at, u.username, s.ip, s.user_agent
      from app.sessions s join app.users u on u.id = s.user_id
      where s.created_at > ${since}
    ),
    merged as (
      select ok.at, ok.username, ok.ip,
             (select s.user_agent from sess s
              where s.username = ok.username and s.ip = ok.ip
                and s.at between ok.at - interval '1 minute' and ok.at + interval '1 minute'
              order by abs(extract(epoch from s.at - ok.at)) limit 1) as user_agent
      from ok
      union all
      select s.at, s.username, s.ip, s.user_agent from sess s
      where not exists (
        select 1 from ok
        where ok.username = s.username and ok.ip = s.ip
          and ok.at between s.at - interval '1 minute' and s.at + interval '1 minute')
    ),
    botlike as (
      select ip from app.login_attempts
      where not success and at > ${since}
      group by ip having count(distinct username) >= 3
    )
    select m.at, m.username, u.display_name, m.ip, m.user_agent,
           coalesce(m.ip in (select ip from botlike), false) as suspicious
    from merged m left join app.users u on u.username = m.username
    order by m.at desc
    limit 100`;
  return rows.map((r) => ({
    at: iso(r.at),
    username: r.username,
    displayName: r.display_name ?? null,
    ip: r.ip ?? null,
    userAgent: r.user_agent || null,
    suspicious: Boolean(r.suspicious),
  }));
}

/** 後台解鎖：清掉某個帳號或某個 IP 的失敗紀錄，回傳清掉幾筆 */
export async function clearLoginFailures(target: { username: string } | { ip: string }): Promise<number> {
  const rows =
    'username' in target
      ? await db()`delete from app.login_attempts where not success and username = ${target.username} returning id`
      : await db()`delete from app.login_attempts where not success and ip = ${target.ip} returning id`;
  return rows.length;
}
