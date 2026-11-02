'use client';

import { useState } from 'react';
import { api, errorText } from '@/lib/client/api';
import { Field } from '../ui';
import { IconAlert } from '../icons';

export function SetupForm() {
  const [form, setForm] = useState({ token: '', username: '', displayName: '', password: '', password2: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.password2) return setError('兩次輸入的密碼不一樣');
    setBusy(true);
    setError('');
    try {
      const { password2: _ignored, ...body } = form;
      await api('/api/setup', { method: 'POST', body });
      window.location.assign('/manage');
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      <div>
        <h2>建立第一位管理員</h2>
        <p className="muted">只需要做一次。設定碼是你在 Vercel 設定的 SETUP_TOKEN。</p>
      </div>
      {error && <div className="alert alert-danger" role="alert"><IconAlert /> {error}</div>}
      <Field label="設定碼（SETUP_TOKEN）">
        <input className="input" type="password" autoComplete="off" value={form.token} onChange={set('token')} />
      </Field>
      <Field label="帳號" hint="小寫英文、數字、. _ -，3～32 字">
        <input className="input" autoComplete="username" autoCapitalize="none" spellCheck={false} value={form.username} onChange={set('username')} />
      </Field>
      <Field label="顯示名稱" hint="修改紀錄會顯示這個名字">
        <input className="input" value={form.displayName} onChange={set('displayName')} maxLength={30} />
      </Field>
      <Field label="密碼" hint="至少 10 個字元">
        <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
      </Field>
      <Field label="再輸入一次密碼">
        <input className="input" type="password" autoComplete="new-password" value={form.password2} onChange={set('password2')} />
      </Field>
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? '建立中…' : '建立並登入'}</button>
    </form>
  );
}
