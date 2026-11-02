import 'server-only';
import type { NextRequest } from 'next/server';
import type { Actor } from './db';
import { HttpError, clientIp } from './http';
import { getSessionUser } from './session';
import type { Role, SessionUser } from '@/lib/shared/types';

type Options = { role?: Role; allowMustChangePassword?: boolean };

/**
 * 每一個需要登入的 API 都要呼叫這個。權限只在伺服器端判斷，前端隱藏按鈕只是介面。
 */
export async function requireUser(req: NextRequest, opts: Options = {}): Promise<{ user: SessionUser; actor: Actor }> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, '請先登入', 'unauthenticated');
  if (user.mustChangePassword && !opts.allowMustChangePassword) {
    throw new HttpError(403, '請先修改密碼', 'must_change_password');
  }
  if (opts.role === 'admin' && user.role !== 'admin') {
    throw new HttpError(403, '只有管理員可以執行這個動作', 'forbidden');
  }
  return { user, actor: { id: user.id, name: user.displayName, ip: clientIp(req) } };
}
