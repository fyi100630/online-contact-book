import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { handle, ok } from '@/lib/server/http';
import { revertFromAudit } from '@/lib/server/repo';

export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { actor } = await requireUser(req, { role: 'admin' });
  await revertFromAudit(actor, (await ctx.params).id);
  return ok({ ok: true });
});
