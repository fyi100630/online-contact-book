import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { clientIp, fail, handle, ok, readJson } from '@/lib/server/http';
import { hashPassword } from '@/lib/server/password';
import { isLoginBlocked, recordLoginAttempt } from '@/lib/server/ratelimit';
import { countUsers, createUser } from '@/lib/server/repo';
import { createSession } from '@/lib/server/session';
import { setupSchema } from '@/lib/shared/validation';

const sha = (s: string) => createHash('sha256').update(s).digest();

/**
 * 建立第一位管理員。只有在：
 *   1. 資料庫裡還沒有任何帳號，而且
 *   2. 輸入的設定碼和伺服器環境變數 SETUP_TOKEN 相同（至少 24 字元）
 * 時才會成功。建立完成後這個 API 就永久失效。
 */
export const POST = handle(async (req: NextRequest) => {
  const expected = process.env.SETUP_TOKEN ?? '';
  if (expected.length < 24) return fail(404, 'Not found');
  if ((await countUsers()) > 0) return fail(404, 'Not found');

  const ip = clientIp(req);
  if (await isLoginBlocked('__setup__', ip)) return fail(429, '嘗試次數太多，請 15 分鐘後再試');

  const input = await readJson(req, setupSchema);
  if (!timingSafeEqual(sha(input.token), sha(expected))) {
    await recordLoginAttempt('__setup__', ip, false);
    return fail(403, '設定碼不正確');
  }

  const user = await createUser(null, {
    username: input.username,
    displayName: input.displayName,
    role: 'admin',
    passwordHash: await hashPassword(input.password),
    mustChangePassword: false,
  });
  await recordLoginAttempt('__setup__', ip, true);
  await createSession(user.id, ip, req.headers.get('user-agent') ?? '');
  return ok({ ok: true }, { status: 201 });
});
