import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { Shell } from '@/components/manage/Shell';
import { getSettings } from '@/lib/server/repo';
import { getSessionUser } from '@/lib/server/session';

export const metadata: Metadata = { title: '管理後台' };

export default async function ManageLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get('x-pathname') ?? '/manage';
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(pathname)}`);
  if (user.mustChangePassword && pathname !== '/manage/account') redirect('/manage/account');
  const { classTitle } = await getSettings();
  return (
    <Shell user={user} classTitle={classTitle}>
      {children}
    </Shell>
  );
}
