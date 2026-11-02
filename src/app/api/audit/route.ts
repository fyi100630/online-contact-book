import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { handle, ok } from '@/lib/server/http';
import { listAudit } from '@/lib/server/repo';

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req, { role: 'admin' });
  return ok({ logs: await listAudit(req.nextUrl.searchParams.get('before') ?? undefined) });
});
