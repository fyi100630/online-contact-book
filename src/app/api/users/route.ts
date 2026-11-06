import { after, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { handle, ok, readJson } from '@/lib/server/http';
import { notifyAdminGranted } from '@/lib/server/notify';
import { generateTempPassword, hashPassword } from '@/lib/server/password';
import { createUser, listUsers } from '@/lib/server/repo';
import { createUserSchema } from '@/lib/shared/validation';

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req, { role: 'admin' });
  return ok({ users: await listUsers() });
});

/** 建立帳號：密碼由伺服器隨機產生，只回傳這一次，對方第一次登入必須改密碼 */
export const POST = handle(async (req: NextRequest) => {
  const { actor } = await requireUser(req, { role: 'admin' });
  const input = await readJson(req, createUserSchema);
  const tempPassword = generateTempPassword();
  const user = await createUser(actor, { ...input, passwordHash: await hashPassword(tempPassword), mustChangePassword: true });
  if (user.role === 'admin') after(() => notifyAdminGranted({ userId: user.id, byName: actor.name, how: 'created' }));
  return ok({ user, tempPassword }, { status: 201 });
});
