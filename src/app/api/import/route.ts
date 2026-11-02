import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/server/auth';
import { handle, ok, readJson } from '@/lib/server/http';
import { getSettings, importEntries, normalizeLegacyRecords, updateSettings } from '@/lib/server/repo';
import { legacyImportSchema } from '@/lib/shared/validation';

const bodySchema = z.object({
  data: legacyImportSchema,
  applySettings: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});

export const POST = handle(async (req: NextRequest) => {
  const { actor } = await requireUser(req, { role: 'admin' });
  const { data, applySettings, dryRun } = await readJson(req, bodySchema, 8 * 1024 * 1024);
  const { rows, skipped } = normalizeLegacyRecords(data.records);
  if (dryRun) return ok({ valid: rows.length, skipped, classTitle: data.classTitle ?? '', announcement: data.announcement ?? '' });

  const inserted = await importEntries(actor, rows);
  if (applySettings) {
    const cur = await getSettings();
    const announcement = (data.announcement ?? '').includes('維護中') ? cur.announcement : (data.announcement ?? '').slice(0, 2000);
    await updateSettings(actor, { classTitle: (data.classTitle || cur.classTitle).slice(0, 40), announcement });
  }
  return ok({ inserted, duplicates: rows.length - inserted, skipped });
});
