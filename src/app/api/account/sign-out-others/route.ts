import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { handle, ok } from '@/lib/server/http';
import { destroyUserSessions } from '@/lib/server/session';

export const POST = handle(async (req: NextRequest) => {
  const { user } = await requireUser(req, { allowMustChangePassword: true });
  await destroyUserSessions(user.id, true);
  return ok({ ok: true });
});
