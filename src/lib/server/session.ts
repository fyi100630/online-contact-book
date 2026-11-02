import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { db } from './db';
import type { SessionUser } from '@/lib/shared/types';

const IS_PROD = process.env.NODE_ENV === 'production';
// __Host- 前綴：瀏覽器強制要求 Secure、Path=/、不能指定 Domain，防止子網域竄改
export const SESSION_COOKIE = IS_PROD ? '__Host-cb_sid' : 'cb_sid';

const ABSOLUTE_TTL_MS = 30 * 24 * 3600 * 1000; // 最長 30 天一定要重新登入
const IDLE_TTL_MS = 7 * 24 * 3600 * 1000; // 7 天沒用就失效
const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export async function createSession(userId: string, ip: string, userAgent: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ABSOLUTE_TTL_MS);
  await db()`
    insert into app.sessions (token_hash, user_id, expires_at, ip, user_agent)
    values (${hashToken(token)}, ${userId}, ${expiresAt}, ${ip}, ${userAgent.slice(0, 300)})`;
  // 順便清掉過期的 session
  if (Math.random() < 0.05) await db()`delete from app.sessions where expires_at < now()`;

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, // JavaScript 讀不到，XSS 也偷不走
    secure: IS_PROD,
    sameSite: 'strict', // 其他網站無法帶著這個 cookie 發請求（防 CSRF）
    path: '/',
    expires: expiresAt,
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db()`delete from app.sessions where token_hash = ${hashToken(token)}`;
  jar.delete(SESSION_COOKIE);
}

/** 刪除某帳號的所有 session（改密碼、停用、重設密碼時） */
export async function destroyUserSessions(userId: string, keepCurrent = false): Promise<void> {
  if (keepCurrent) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) {
      await db()`delete from app.sessions where user_id = ${userId} and token_hash <> ${hashToken(token)}`;
      return;
    }
  }
  await db()`delete from app.sessions where user_id = ${userId}`;
}

/** 目前登入的帳號（同一個 request 內只查一次資料庫） */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const tokenHash = hashToken(token);
  const idleCutoff = new Date(Date.now() - IDLE_TTL_MS);
  const rows = await db()`
    select u.id, u.username, u.display_name, u.role, u.must_change_password, s.last_seen_at
    from app.sessions s
    join app.users u on u.id = s.user_id
    where s.token_hash = ${tokenHash}
      and s.expires_at > now()
      and s.last_seen_at > ${idleCutoff}
      and u.is_active`;
  const row = rows[0];
  if (!row) return null;
  if (Date.now() - new Date(row.last_seen_at).getTime() > TOUCH_INTERVAL_MS) {
    await db()`update app.sessions set last_seen_at = now() where token_hash = ${tokenHash}`;
  }
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    mustChangePassword: row.must_change_password,
  };
});
