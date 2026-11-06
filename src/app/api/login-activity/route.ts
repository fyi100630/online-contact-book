import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { handle, ok } from '@/lib/server/http';
import { notifyConfigured } from '@/lib/server/notify';
import { getLoginActivity, getLoginActivitySummary } from '@/lib/server/ratelimit';

/** 管理員：最近的登入失敗情形。?summary=1 只回概況（後台首頁的警告用） */
export const GET = handle(async (req: NextRequest) => {
  await requireUser(req, { role: 'admin' });
  if (req.nextUrl.searchParams.get('summary') === '1') return ok(await getLoginActivitySummary());
  return ok({ ...(await getLoginActivity()), notifyConfigured: notifyConfigured() });
});
