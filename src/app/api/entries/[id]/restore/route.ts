import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { HttpError, handle, ok } from '@/lib/server/http';
import { restoreEntry } from '@/lib/server/repo';

export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { actor } = await requireUser(req, { role: 'admin' });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, '找不到這個事項');
  await restoreEntry(actor, id);
  return ok({ ok: true });
});
