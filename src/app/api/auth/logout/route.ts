import { handle, ok } from '@/lib/server/http';
import { destroyCurrentSession } from '@/lib/server/session';

export const POST = handle(async () => {
  await destroyCurrentSession();
  return ok({ ok: true });
});
