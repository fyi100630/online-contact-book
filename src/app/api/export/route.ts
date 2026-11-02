import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { handle, ok } from '@/lib/server/http';
import { exportAll, today } from '@/lib/server/repo';

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req, { role: 'admin' });
  const data = await exportAll();
  return ok(data, {
    headers: { 'Content-Disposition': `attachment; filename="contact-book-${today()}.json"` },
  });
});
