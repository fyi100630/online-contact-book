import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { HttpError, handle, ok } from '@/lib/server/http';
import { generateTempPassword, hashPassword } from '@/lib/server/password';
import { setPassword } from '@/lib/server/repo';
import { destroyUserSessions } from '@/lib/server/session';

export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { actor, user } = await requireUser(req, { role: 'admin' });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, '找不到這個帳號');
  if (id === user.id) throw new HttpError(400, '要改自己的密碼請到「我的帳號」');
  const tempPassword = generateTempPassword();
  await setPassword(actor, id, await hashPassword(tempPassword), true);
  await destroyUserSessions(id);
  return ok({ tempPassword });
});
