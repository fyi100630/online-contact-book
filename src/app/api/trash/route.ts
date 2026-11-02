import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { handle, ok } from '@/lib/server/http';
import { listTrash } from '@/lib/server/repo';

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req, { role: 'admin' });
  return ok({ entries: await listTrash() });
});
