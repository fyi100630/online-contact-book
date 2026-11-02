import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { handle, ok, readJson } from '@/lib/server/http';
import { createEntry, listEntries, today } from '@/lib/server/repo';
import { addDays, isValidDateStr } from '@/lib/shared/dates';
import { CATEGORIES, type Category } from '@/lib/shared/types';
import { entryInputSchema } from '@/lib/shared/validation';

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  const p = req.nextUrl.searchParams;
  const t = today();
  const from = isValidDateStr(p.get('from')) ? p.get('from')! : addDays(t, -14);
  const to = isValidDateStr(p.get('to')) ? p.get('to')! : addDays(t, 60);
  const cat = p.get('category');
  const category = cat && (CATEGORIES as readonly string[]).includes(cat) ? (cat as Category) : undefined;
  return ok({ entries: await listEntries({ from, to, q: p.get('q') ?? undefined, category }) });
});

export const POST = handle(async (req: NextRequest) => {
  const { actor } = await requireUser(req);
  const input = await readJson(req, entryInputSchema);
  return ok({ entry: await createEntry(actor, input) }, { status: 201 });
});
