import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { HttpError, handle, ok, readJson } from '@/lib/server/http';
import { trashEntry, updateEntry } from '@/lib/server/repo';
import { entryUpdateSchema } from '@/lib/shared/validation';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function entryId(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) throw new HttpError(404, '找不到這個事項');
  return id;
}

export const PATCH = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { actor } = await requireUser(req);
  const id = await entryId(ctx);
  const { version, entry } = await readJson(req, entryUpdateSchema);
  return ok({ entry: await updateEntry(actor, id, version, entry) });
});

// 刪除 = 移到垃圾桶（資料庫層面也不允許真正刪除）
export const DELETE = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { actor } = await requireUser(req);
  await trashEntry(actor, await entryId(ctx));
  return ok({ ok: true });
});
