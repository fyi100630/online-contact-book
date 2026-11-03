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
 * 原子限流：把同帳號、同 IP 的所有嘗試用 advisory lock 排成一列，
 * 「先把這次登記為失敗，再做昂貴的驗證（scrypt）」，驗證成功才清掉這帳號的失敗紀錄。
 *
 * 這樣就關掉了「先檢查次數、後記錄失敗」之間的競態窗口：
 * 以前同時送 N 個請求會在任何失敗被寫入前全部通過檢查，鎖定形同虛設；
 * 現在每個請求都得先拿到鎖、看到前一次已登記的失敗，第 6 個之後一律 429。
 */
export async function guardedAttempt<T>(
  username: string,
  ip: string,
  verify: (tx: Tx) => Promise<{ success: boolean; value: T }>,
): Promise<GuardResult<T>> {
  const since = new Date(Date.now() - WINDOW_MS);
  const result = await db().begin(async (tx) => {
    // 1) 序列化：同一帳號、同一 IP 的並發請求在這裡排隊（交易結束自動釋放）
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
      return { blocked: true } as GuardResult<T>;
    }

    // 3) 先把這次「當成失敗」寫進去——之後驗證成功再清掉
    await tx`insert into app.login_attempts (username, ip, success) values (${username.slice(0, 64)}, ${ip}, false)`;

    // 4) 現在才做昂貴的驗證（放在鎖內，讓同帳號的嘗試真正一個一個來）
    const { success, value } = await verify(tx);

    if (success) {
      await tx`delete from app.login_attempts where username = ${username} and not success`;
      if (Math.random() < 0.02) await tx`delete from app.login_attempts where at < now() - interval '7 days'`;
    }
    return { blocked: false, success, value } as GuardResult<T>;
  });
  return result as GuardResult<T>;
}
