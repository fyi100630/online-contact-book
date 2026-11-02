import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { handle, ok, readJson } from '@/lib/server/http';
import { getSettings, updateSettings } from '@/lib/server/repo';
import { settingsSchema } from '@/lib/shared/validation';

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  return ok(await getSettings());
});

export const PUT = handle(async (req: NextRequest) => {
  const { actor } = await requireUser(req, { role: 'admin' });
  const input = await readJson(req, settingsSchema);
  return ok(await updateSettings(actor, input));
});
