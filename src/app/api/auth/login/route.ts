import type { NextRequest } from 'next/server';
import { clientIp, fail, handle, ok, readJson } from '@/lib/server/http';
import { burnPasswordCheck, verifyPassword } from '@/lib/server/password';
import { isLoginBlocked, recordLoginAttempt } from '@/lib/server/ratelimit';
import { findUserForLogin, markLogin } from '@/lib/server/repo';
import { createSession } from '@/lib/server/session';
import { loginSchema } from '@/lib/shared/validation';

export const POST = handle(async (req: NextRequest) => {
  const { username, password } = await readJson(req, loginSchema);
  const ip = clientIp(req);

  if (await isLoginBlocked(username, ip)) {
    return fail(429, '登入失敗次數太多，請 15 分鐘後再試', 'rate_limited');
  }

  const user = await findUserForLogin(username);
  let valid = false;
  if (user) {
    valid = await verifyPassword(password, user.passwordHash);
  } else {
    await burnPasswordCheck(password); // 讓「帳號不存在」和「密碼錯誤」花一樣的時間
  }

  // 停用的帳號和密碼錯誤回應一模一樣，不透露帳號狀態
  if (!user || !valid || !user.isActive) {
    await recordLoginAttempt(username, ip, false);
    return fail(401, '帳號或密碼錯誤', 'invalid_credentials');
  }

  await recordLoginAttempt(username, ip, true);
  await markLogin(user.id);
  await createSession(user.id, ip, req.headers.get('user-agent') ?? '');
  return ok({ ok: true });
});
