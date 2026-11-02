'use client';

import { useState } from 'react';
import { api, errorText } from '@/lib/client/api';
import { Field } from '../ui';
import { IconAlert } from '../icons';

function safeNext(next: string | null): string {
  // 只允許站內路徑，避免被當成跳轉到釣魚網站的跳板（open redirect）
  if (next && next.startsWith('/manage') && !next.startsWith('//')) return next;
  return '/manage';
}

export function LoginForm({ next }: { next: string | null }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError('請輸入帳號和密碼');
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/login', { method: 'POST', body: { username, password } });
      window.location.assign(safeNext(next));
    } catch (err) {
      setError(errorText(err));
      setPassword('');
      setBusy(false);
    }
  };

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      <div>
        <h2>登入</h2>
        <p className="muted">使用管理員給你的帳號密碼</p>
      </div>
      {error && <div className="alert alert-danger" role="alert"><IconAlert /> {error}</div>}
      <Field label="帳號">
        <input className="input" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false}
          value={username} onChange={(e) => setUsername(e.target.value)} autoFocus maxLength={64} />
      </Field>
      <Field label="密碼">
        <input className="input" name="password" type="password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} maxLength={256} />
      </Field>
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? '登入中…' : '登入'}</button>
      <p className="field-hint">忘記密碼請找管理員重設。連續輸錯 5 次會暫停 15 分鐘。</p>
    </form>
  );
}
