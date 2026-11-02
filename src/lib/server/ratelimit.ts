import 'server-only';
import { db } from './db';

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
