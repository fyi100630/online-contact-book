import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { HttpError, handle, ok, readJson } from '@/lib/server/http';
import { updateUser } from '@/lib/server/repo';
import { destroyUserSessions } from '@/lib/server/session';
import { updateUserSchema } from '@/lib/shared/validation';

export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { actor } = await requireUser(req, { role: 'admin' });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, '找不到這個帳號');
  const patch = await readJson(req, updateUserSchema);
  await updateUser(actor, id, patch);
  // 停用帳號時立刻踢掉它所有登入中的裝置
  if (patch.isActive === false) await destroyUserSessions(id);
  return ok({ ok: true });
});
