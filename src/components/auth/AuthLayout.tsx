import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconBook } from '../icons';

/** 登入、初次設定共用：畫面正中間一個框，只寫「管理後台」 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark"><IconBook /></span>
          <h1>管理後台</h1>
        </div>
        {children}
      </div>
      <Link href="/" className="auth-back">回到聯絡簿</Link>
    </main>
  );
}
