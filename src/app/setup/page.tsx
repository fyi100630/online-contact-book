import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { SetupForm } from '@/components/auth/SetupForm';
import { countUsers } from '@/lib/server/repo';

export const metadata: Metadata = { title: '初次設定' };

export default async function SetupPage() {
  // 已經有帳號，或沒有設定 SETUP_TOKEN：這一頁就不存在
  if ((process.env.SETUP_TOKEN ?? '').length < 24) notFound();
  if ((await countUsers()) > 0) notFound();
  return (
    <AuthLayout>
      <SetupForm />
    </AuthLayout>
  );
}
