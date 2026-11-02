'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/client/api';
import { ROLE_LABEL, type SessionUser } from '@/lib/shared/types';
import {
  IconBook, IconDatabase, IconExternal, IconHistory, IconList, IconLogout, IconMegaphone, IconMenu, IconTrash, IconUser, IconUsers,
} from '../icons';

type NavItem = { href: string; label: string; icon: ReactNode; admin?: boolean };
const NAV: NavItem[] = [
  { href: '/manage', label: '事項', icon: <IconList /> },
  { href: '/manage/announcement', label: '公告', icon: <IconMegaphone />, admin: true },
  { href: '/manage/users', label: '帳號管理', icon: <IconUsers />, admin: true },
  { href: '/manage/activity', label: '修改紀錄', icon: <IconHistory />, admin: true },
  { href: '/manage/trash', label: '垃圾桶', icon: <IconTrash />, admin: true },
  { href: '/manage/data', label: '備份與匯入', icon: <IconDatabase />, admin: true },
];

export function Shell({ user, classTitle, children }: { user: SessionUser; classTitle: string; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/');
    }
  };

  const locked = user.mustChangePassword;
  const items = NAV.filter((n) => !n.admin || user.role === 'admin');
  const link = (n: NavItem) => (
    <Link key={n.href} href={n.href} className="nav-link" aria-current={pathname === n.href ? 'page' : undefined} onClick={() => setOpen(false)}>
      {n.icon} {n.label}
    </Link>
  );

  return (
    <div className="shell">
      <div className="mobile-bar">
        <button className="btn btn-ghost btn-icon" onClick={() => setOpen(true)} aria-label="開啟選單"><IconMenu /></button>
        <span className="brand-name">{classTitle}</span>
      </div>
      {open && <button className="sidebar-scrim" aria-label="關閉選單" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? ' is-open' : ''}`} aria-label="管理選單">
        <Link href="/" className="brand">
          <span className="brand-mark"><IconBook /></span>
          <span>
            <span className="brand-name">{classTitle}</span>
            <span className="brand-sub"><br />管理後台</span>
          </span>
        </Link>
        {!locked && (
          <>
            <p className="nav-label">內容</p>
            {items.filter((n) => !n.admin || n.href === '/manage/announcement').map(link)}
            {user.role === 'admin' && <p className="nav-label">管理</p>}
            {items.filter((n) => n.admin && n.href !== '/manage/announcement').map(link)}
          </>
        )}
        <p className="nav-label">個人</p>
        {link({ href: '/manage/account', label: '我的帳號', icon: <IconUser /> })}
        <Link href="/" className="nav-link"><IconExternal /> 查看聯絡簿</Link>
        <div className="sidebar-foot">
          <div className="me">
            <span className="me-name">{user.displayName}</span>
            <span className="me-role">{user.username}，{ROLE_LABEL[user.role]}</span>
          </div>
          <button className="nav-link btn-ghost" onClick={logout}><IconLogout /> 登出</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
