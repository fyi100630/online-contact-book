import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui';
import './globals.css';

export const metadata: Metadata = {
  title: { default: '班級聯絡簿', template: '%s・班級聯絡簿' },
  description: '班級作業、考試、繳交與提醒事項',
  robots: { index: false, follow: false },
  referrer: 'same-origin',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f3ee' },
    { media: '(prefers-color-scheme: dark)', color: '#121418' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // 讀 headers 讓每一頁都動態產生，Next.js 才能在每次請求套用新的 CSP nonce
  await headers();
  return (
    <html lang="zh-Hant-TW">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
