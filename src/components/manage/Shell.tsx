'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/client/api';
import { ROLE_LABEL, type LoginActivitySummary, type SessionUser } from '@/lib/shared/types';
import {
  IconAlert, IconBook, IconDatabase, IconExternal, IconGrid, IconHistory, IconList, IconLogout, IconMegaphone, IconMenu, IconPhone, IconShield, IconTrash, IconUser, IconUsers,
} from '../icons';

/** 24 小時內登入失敗超過這個數字，後台首頁就提醒管理員 */
const LOGIN_FAIL_WARN = 30;

type NavItem = { href: string; label: string; icon: ReactNode; admin?: boolean };
const NAV: NavItem[] = [
  { href: '/manage', label: '事項', icon: <IconList /> },
  { href: '/manage/announcement', label: '公告', icon: <IconMegaphone />, admin: true },
  { href: '/manage/timetable', label: '課表', icon: <IconGrid />, admin: true },
  { href: '/manage/users', label: '帳號管理', icon: <IconUsers />, admin: true },
  { href: '/manage/activity', label: '修改紀錄', icon: <IconHistory />, admin: true },
  { href: '/manage/trash', label: '垃圾桶', icon: <IconTrash />, admin: true },
  { href: '/manage/data', label: '備份與匯入', icon: <IconDatabase />, admin: true },
  { href: '/manage/app', label: 'App 安裝統計', icon: <IconPhone />, admin: true },
  { href: '/manage/security', label: '登入紀錄', icon: <IconShield />, admin: true },
];

/** 放在「內容」區的管理員項目 */
const CONTENT_ADMIN = new Set(['/manage/announcement', '/manage/timetable']);

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

  // 管理員進後台首頁時，看一下最近 24 小時有沒有異常的登入失敗
  const [loginWarn, setLoginWarn] = useState<LoginActivitySummary | null>(null);
  const isAdminHome = user.role === 'admin' && !locked && pathname === '/manage';
  useEffect(() => {
    if (!isAdminHome) return;
    let alive = true;
    api<LoginActivitySummary>('/api/login-activity?summary=1')
      .then((s) => {
        if (alive) setLoginWarn(s.lockedAccounts > 0 || s.blockedIps > 0 || s.fails24h >= LOGIN_FAIL_WARN ? s : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isAdminHome]);
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
            {items.filter((n) => !n.admin || CONTENT_ADMIN.has(n.href)).map(link)}
            {user.role === 'admin' && <p className="nav-label">管理</p>}
            {items.filter((n) => n.admin && !CONTENT_ADMIN.has(n.href)).map(link)}
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
      <main className="main">
        {isAdminHome && loginWarn && (
          <div className="alert alert-warn alert-banner" role="status">
            <IconAlert />
            <span>
              過去 24 小時有 {loginWarn.fails24h} 次登入失敗
              {loginWarn.lockedAccounts + loginWarn.blockedIps > 0 && `，${loginWarn.lockedAccounts} 個帳號、${loginWarn.blockedIps} 個 IP 被鎖定`}
              。<Link href="/manage/security">查看登入紀錄</Link>
            </span>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
