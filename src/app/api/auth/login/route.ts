import { after, type NextRequest } from 'next/server';
import { clientIp, fail, handle, ok, readJson } from '@/lib/server/http';
import { burnPasswordCheck, verifyPassword } from '@/lib/server/password';
import { guardedAttempt, recordLoginSuccess } from '@/lib/server/ratelimit';
import { notifyDayLocks, notifyIfSuspiciousLogin } from '@/lib/server/notify';
import { findUserForLogin, markLogin } from '@/lib/server/repo';
import { createSession } from '@/lib/server/session';
import { loginSchema } from '@/lib/shared/validation';

export const POST = handle(async (req: NextRequest) => {
  const { username, password } = await readJson(req, loginSchema);
  const ip = clientIp(req);

  // 先在鎖內把這次嘗試登記為失敗，再驗證密碼：
  // 並發請求無法在失敗被記錄前一起闖過限流（修正 F1 競態）。
  const gate = await guardedAttempt(username, ip, async () => {
    const user = await findUserForLogin(username);
    let valid = false;
    if (user) {
      valid = await verifyPassword(password, user.passwordHash);
    } else {
      await burnPasswordCheck(password); // 讓「帳號不存在」和「密碼錯誤」花一樣的時間
    }
    // 停用的帳號和密碼錯誤回應一模一樣，不透露帳號狀態
    const success = !!user && valid && user.isActive;
    return { success, value: success ? user!.id : null };
  });

  // 這一次剛好讓帳號或 IP 被鎖 24 小時 → 回應送出後通知管理員（Discord）
  if (gate.blocked === false && gate.justLocked.length > 0) {
    const kinds = gate.justLocked;
    after(() => notifyDayLocks(kinds, username, ip));
  }
  if (gate.blocked === 'day') return fail(429, '今天登入失敗太多次，已暫停登入。請找系統管理員解鎖。', 'locked');
  if (gate.blocked) return fail(429, '登入失敗次數太多，請 15 分鐘後再試', 'rate_limited');
  if (!gate.success || !gate.value) return fail(401, '帳號或密碼錯誤', 'invalid_credentials');

  await recordLoginSuccess(username, ip);
  await markLogin(gate.value);
  await createSession(gate.value, ip, req.headers.get('user-agent') ?? '');
  // 從國外、從試過很多帳號的 IP、或用程式登入成功 → 回應送出後通知管理員
  const seen = {
    username,
    ip,
    userAgent: req.headers.get('user-agent'),
    country: req.headers.get('x-vercel-ip-country'),
    city: req.headers.get('x-vercel-ip-city'),
  };
  after(() => notifyIfSuspiciousLogin(seen));
  return ok({ ok: true });
});
