'use client';

import { useState } from 'react';
import { api, errorText } from '@/lib/client/api';
import { ROLE_LABEL, type SessionUser } from '@/lib/shared/types';
import { IconAlert, IconShield } from '../icons';
import { Field, useToast } from '../ui';

export function AccountPage({ user }: { user: SessionUser }) {
  const toast = useToast();
  const forced = user.mustChangePassword;
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [busy, setBusy] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (pw.next.length === 0) return setPwError('請輸入新密碼');
    if (pw.next !== pw.confirm) return setPwError('兩次輸入的新密碼不一樣');
    setBusy(true);
    try {
      await api('/api/account/password', { method: 'POST', body: { currentPassword: pw.current, newPassword: pw.next } });
      setPw({ current: '', next: '', confirm: '' });
      if (forced) {
        window.location.assign('/manage');
        return;
      }
      toast('密碼已更新，其他裝置已登出');
    } catch (err) {
      setPwError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const signOutOthers = async () => {
    try {
      await api('/api/account/sign-out-others', { method: 'POST' });
      toast('其他裝置都已登出');
    } catch (err) {
      toast(errorText(err), 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">我的帳號</h1>
          <p className="page-sub">{user.displayName}（帳號 {user.username}，{ROLE_LABEL[user.role]}）</p>
        </div>
      </div>
      <div className="stack-lg">
        {forced && (
          <div className="alert alert-warn" role="alert">
            <IconAlert /> 你正在使用管理員給的臨時密碼。請先設定自己的新密碼，才能開始使用。
          </div>
        )}

        <form className="card section-card" onSubmit={changePassword} noValidate>
          <h2 className="section-title">{forced ? '設定新密碼' : '修改密碼'}</h2>
          <input type="text" name="username" autoComplete="username" value={user.username} readOnly hidden />
          {pwError && <div className="alert alert-danger" role="alert">{pwError}</div>}
          <Field label={forced ? '臨時密碼' : '目前的密碼'}>
            <input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </Field>
          <Field label="新密碼" hint="最多 128 個字元，數字、英文或符號都可以">
            <input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Field>
          <Field label="再輸入一次新密碼">
            <input className="input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          </Field>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>{busy ? '更新中…' : '更新密碼'}</button>
          </div>
        </form>

        {!forced && (
          <>
            <section className="card section-card">
              <h2 className="section-title">登入中的裝置</h2>
              <p className="muted">如果曾經在別人的手機或公用電腦登入，可以把其他裝置全部登出。</p>
              <div><button className="btn btn-secondary" onClick={signOutOthers}><IconShield size="sm" /> 登出其他所有裝置</button></div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
