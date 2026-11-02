import { handle, ok } from '@/lib/server/http';
import { getContentVersion } from '@/lib/server/repo';

export const GET = handle(async () => ok({ version: await getContentVersion() }));
