import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { handle, ok, readJson } from '@/lib/server/http';
import { getInstallStats, reportInstallation } from '@/lib/server/repo';
import { installationSchema } from '@/lib/shared/validation';

/** Android App 開啟時回報：隨機安裝 ID＋版本號。不需要登入、不記錄 IP。 */
export const POST = handle(async (req: NextRequest) => {
  const { installId, appVersion } = await readJson(req, installationSchema, 1024);
  await reportInstallation(installId, appVersion);
  return ok({ ok: true });
});

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req, { role: 'admin' });
  return ok(await getInstallStats());
});
