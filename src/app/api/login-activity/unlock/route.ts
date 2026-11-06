import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { handle, ok, readJson } from '@/lib/server/http';
import { clearLoginFailures } from '@/lib/server/ratelimit';
import { unlockSchema } from '@/lib/shared/validation';

/** 管理員：清掉某個帳號或某個 IP 的登入失敗紀錄，立刻解除鎖定 */
export const POST = handle(async (req: NextRequest) => {
  await requireUser(req, { role: 'admin' });
  const target = await readJson(req, unlockSchema);
  return ok({ cleared: await clearLoginFailures(target) });
});
