import 'server-only';
import { db, type Tx } from './db';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_ACCOUNT = 5; // 同一帳號 15 分鐘內錯 5 次就暫時鎖住
const MAX_FAILS_PER_IP = 20; // 同一個 IP 15 分鐘內錯 20 次（防止換帳號猜）

/** 存在資料庫裡，所以 Vercel 多台伺服器之間也會共用計數 */
export async function isLoginBlocked(username: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [row] = await db()`
    select
      count(*) filter (where username = ${username}) as by_user,
      count(*) filter (where ip = ${ip}) as by_ip
    from app.login_attempts
    where at > ${since} and not success and (username = ${username} or ip = ${ip})`;
  return Number(row?.by_user ?? 0) >= MAX_FAILS_PER_ACCOUNT || Number(row?.by_ip ?? 0) >= MAX_FAILS_PER_IP;
}

export async function recordLoginAttempt(username: string, ip: string, success: boolean): Promise<void> {
  await db()`insert into app.login_attempts (username, ip, success) values (${username.slice(0, 64)}, ${ip}, ${success})`;
  if (success) {
    // 成功登入後清掉這個帳號的失敗次數
    await db()`delete from app.login_attempts where username = ${username} and not success`;
  }
  if (Math.random() < 0.02) {
    await db()`delete from app.login_attempts where at < now() - interval '7 days'`;
  }
}

export type GuardResult<T> = { blocked: true } | { blocked: false; success: boolean; value: T };

/**
 * 原子限流：「先把這次登記為失敗，再做昂貴的驗證（scrypt）」，驗證成功才清掉這帳號的失敗紀錄。
 *
 * 關掉「先檢查次數、後記錄失敗」之間的競態窗口：數次數＋先登記這兩步在同一個短交易裡、
 * 持有同帳號與同 IP 的 advisory lock 完成，所以同時送來的請求一定會看到彼此已登記的嘗試，
 * 第 6 個之後一律 429。
 *
 * 鎖只包住這兩個很快的查詢；scrypt 在交易結束、鎖和連線都放掉之後才做。
 * 不然共用同一個對外 IP 的人（例如整間學校）會被排成一列、每人多等一次 scrypt，
 * 驗證期間還一直佔著連線池。
 */
export async function guardedAttempt<T>(
  username: string,
  ip: string,
  verify: () => Promise<{ success: boolean; value: T }>,
): Promise<GuardResult<T>> {
  const since = new Date(Date.now() - WINDOW_MS);
  const reserved = await db().begin(async (tx: Tx) => {
    // 1) 同一帳號、同一 IP 的請求在這裡排隊，但只排「數＋登記」這一小段（交易結束自動釋放）
    await tx`select pg_advisory_xact_lock(hashtextextended(${username}, 0))`;
    await tx`select pg_advisory_xact_lock(hashtextextended(${ip}, 1))`;

    // 2) 數這 15 分鐘的失敗次數
    const [c] = await tx`
      select
        count(*) filter (where username = ${username}) as by_user,
        count(*) filter (where ip = ${ip}) as by_ip
      from app.login_attempts
      where at > ${since} and not success and (username = ${username} or ip = ${ip})`;
    if (Number(c?.by_user ?? 0) >= MAX_FAILS_PER_ACCOUNT || Number(c?.by_ip ?? 0) >= MAX_FAILS_PER_IP) {
      return false;
    }

    // 3) 先把這次「當成失敗」寫進去——之後驗證成功再清掉
    await tx`insert into app.login_attempts (username, ip, success) values (${username.slice(0, 64)}, ${ip}, false)`;
    return true;
  });
  if (!reserved) return { blocked: true };

  // 4) 鎖和連線都放掉了，才做昂貴的驗證
  const { success, value } = await verify();

  if (success) {
    await db()`delete from app.login_attempts where username = ${username} and not success`;
    if (Math.random() < 0.02) await db()`delete from app.login_attempts where at < now() - interval '7 days'`;
  }
  return { blocked: false, success, value };
}
