import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { LoginForm } from '@/components/auth/LoginForm';
import { getSessionUser } from '@/lib/server/session';

export const metadata: Metadata = { title: '幹部登入' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await getSessionUser().catch(() => null)) redirect('/manage');
  const sp = await searchParams;
  return (
    <AuthLayout>
      <LoginForm next={typeof sp.next === 'string' ? sp.next : null} />
    </AuthLayout>
  );
}
