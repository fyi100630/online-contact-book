import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { handle, ok, readJson } from '@/lib/server/http';
import { updateUser } from '@/lib/server/repo';
import { displayNameSchema } from '@/lib/shared/validation';

export const GET = handle(async (req: NextRequest) => {
  const { user } = await requireUser(req, { allowMustChangePassword: true });
  return ok({ user });
});

export const PATCH = handle(async (req: NextRequest) => {
  const { user, actor } = await requireUser(req);
  const { displayName } = await readJson(req, z.object({ displayName: displayNameSchema }).strict());
  await updateUser(actor, user.id, { displayName });
  return ok({ ok: true });
});
