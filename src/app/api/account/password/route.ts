import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { clientIp, fail, handle, ok, readJson } from '@/lib/server/http';
import { hashPassword, verifyPassword } from '@/lib/server/password';
import { guardedAttempt } from '@/lib/server/ratelimit';
import { getPasswordHash, setPassword } from '@/lib/server/repo';
import { destroyUserSessions } from '@/lib/server/session';
import { changePasswordSchema } from '@/lib/shared/validation';

export const POST = handle(async (req: NextRequest) => {
  const { user, actor } = await requireUser(req, { allowMustChangePassword: true });
  const { currentPassword, newPassword } = await readJson(req, changePasswordSchema);
  const ip = clientIp(req);

  // 防止有人拿到已登入的裝置後，用這個 API 暴力猜目前密碼（和登入共用原子限流，修正同一個 F1 競態）
  const gate = await guardedAttempt(user.username, ip, async () => {
    const hash = await getPasswordHash(user.id);
    const success = !!hash && (await verifyPassword(currentPassword, hash));
    return { success, value: null };
  });
  if (gate.blocked === 'day') return fail(429, '今天密碼輸入錯誤太多次，已暫停。請找系統管理員解鎖。', 'locked');
  if (gate.blocked) return fail(429, '嘗試次數太多，請 15 分鐘後再試', 'rate_limited');
  if (!gate.success) return fail(400, '目前的密碼不正確', 'wrong_password');

  await setPassword(actor, user.id, await hashPassword(newPassword), false);
  await destroyUserSessions(user.id, true); // 其他裝置全部登出，保留目前這台
  return ok({ ok: true });
});
