import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { fail, handle, ok } from '@/lib/server/http';
import { notifyConfigured, sendTestNotification } from '@/lib/server/notify';

/** 管理員：傳一則測試訊息到 Discord，確認通知設定正確 */
export const POST = handle(async (req: NextRequest) => {
  const { user } = await requireUser(req, { role: 'admin' });
  if (!notifyConfigured()) return fail(400, '還沒設定 Discord 通知（Vercel 環境變數 DISCORD_WEBHOOK_URL）', 'not_configured');
  if (!(await sendTestNotification(user.displayName))) return fail(502, 'Discord 沒有收到，請確認 webhook 網址是否正確、頻道是否還在', 'send_failed');
  return ok({ ok: true });
});
