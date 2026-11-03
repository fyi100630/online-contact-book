import type { NextRequest } from 'next/server';
import { clientIp, fail, handle, ok, readJson } from '@/lib/server/http';
import { burnPasswordCheck, verifyPassword } from '@/lib/server/password';
import { guardedAttempt } from '@/lib/server/ratelimit';
import { findUserForLogin, markLogin } from '@/lib/server/repo';
import { createSession } from '@/lib/server/session';
import { loginSchema } from '@/lib/shared/validation';

export const POST = handle(async (req: NextRequest) => {
  const { username, password } = await readJson(req, loginSchema);
  const ip = clientIp(req);

  // 限流、記錄失敗、scrypt 驗證全部在同一個交易、同一把 advisory lock 內完成，
  // 並發請求無法在失敗被記錄前一起闖過限流（修正 F1 競態）。
  const gate = await guardedAttempt(username, ip, async (tx) => {
    const user = await findUserForLogin(username, tx);
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

  if (gate.blocked) return fail(429, '登入失敗次數太多，請 15 分鐘後再試', 'rate_limited');
  if (!gate.success || !gate.value) return fail(401, '帳號或密碼錯誤', 'invalid_credentials');

  await markLogin(gate.value);
  await createSession(gate.value, ip, req.headers.get('user-agent') ?? '');
  return ok({ ok: true });
});
