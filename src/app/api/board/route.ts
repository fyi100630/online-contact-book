import type { NextRequest } from 'next/server';
import { handle, ok } from '@/lib/server/http';
import { getBoard, today } from '@/lib/server/repo';
import { isValidDateStr } from '@/lib/shared/dates';

export const GET = handle(async (req: NextRequest) => {
  const d = req.nextUrl.searchParams.get('date');
  const date = d && isValidDateStr(d) ? d : today();
  return ok(await getBoard(date));
});
