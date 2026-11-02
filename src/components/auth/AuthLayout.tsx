import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconBook, IconChevronLeft, IconHistory, IconRestore, IconShield } from '../icons';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="brand">
          <span className="brand-mark"><IconBook /></span>
        </div>
        <div>
          <h1>幹部專區</h1>
          <p>登入後可以登記作業、考試、繳交與提醒事項。帳號由管理員建立，請勿借給他人使用。</p>
        </div>
        <ul className="auth-points">
          <li><IconShield /> 每個人都有自己的帳號</li>
          <li><IconHistory /> 每一次修改都會留下紀錄</li>
          <li><IconRestore /> 刪掉的內容可以還原</li>
        </ul>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <Link href="/" className="auth-back"><IconChevronLeft size="sm" /> 回到聯絡簿</Link>
          {children}
        </div>
      </main>
    </div>
  );
}
