import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { HttpError, handle, ok, readJson } from '@/lib/server/http';
import { getTimetable, updateTimetable } from '@/lib/server/repo';
import { timetableSchema } from '@/lib/shared/validation';

// 課表本身是公開的（聯絡簿首頁也會顯示），但「誰改的」只給登入的人看
export const GET = handle(async () => {
  const t = await getTimetable();
  if (!t) throw new HttpError(404, '還沒有設定課表');
  return ok({ schedule: t.schedule, updatedAt: t.updatedAt });
});

export const PUT = handle(async (req: NextRequest) => {
  const { actor } = await requireUser(req, { role: 'admin' });
  const { schedule } = await readJson(req, timetableSchema);
  return ok(await updateTimetable(actor, schedule));
});
