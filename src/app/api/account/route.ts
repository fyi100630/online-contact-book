import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { handle, ok } from '@/lib/server/http';

// 顯示名稱只能由管理員在「帳號管理」修改（/api/users/[id]），這裡不提供自己改名。
export const GET = handle(async (req: NextRequest) => {
  const { user } = await requireUser(req, { allowMustChangePassword: true });
  return ok({ user });
});
