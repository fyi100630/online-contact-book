import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from './session';
import type { SessionUser } from '@/lib/shared/types';

/** 頁面層級的權限檢查（API 另外各自檢查，這裡只決定要不要顯示頁面） */
export async function pageUser(role?: 'admin'): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (role === 'admin' && user.role !== 'admin') notFound();
  return user;
}
