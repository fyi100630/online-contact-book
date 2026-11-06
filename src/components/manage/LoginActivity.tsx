'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from '@/lib/client/api';
import { deviceLabel } from '@/lib/shared/device';
import { LOGIN_LIMITS, type LockState, type LoginActivity } from '@/lib/shared/types';
import { Empty, Spinner, formatDateTime, timeAgo, useToast } from '../ui';

const L = LOGIN_LIMITS;

function LockBadge({ lock }: { lock: LockState }) {
  if (lock === 'day') return <span className="badge badge-warn">鎖定 24 小時</span>;
  if (lock === 'short') return <span className="badge badge-warn">鎖定 15 分鐘</span>;
  return <span className="muted">—</span>;
}

export function LoginActivityPage() {
  const toast = useToast();
  const [data, setData] = useState<LoginActivity | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const sendTest = async () => {
    setTesting(true);
    try {
      await api('/api/notify/test', { method: 'POST' });
      toast('已送出，去 Discord 看看有沒有收到', 'ok');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setTesting(false);
    }
  };

  const load = useCallback(async () => {
    try {
      setData(await api<LoginActivity>('/api/login-activity'));
      setFailed(false);
    } catch (e) {
      setFailed(true);
      toast(errorText(e), 'error');
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const unlock = async (target: { username: string } | { ip: string }, label: string) => {
    const key = 'username' in target ? `u:${target.username}` : `i:${target.ip}`;
    setBusy(key);
    try {
      await api('/api/login-activity/unlock', { method: 'POST', body: target });
      toast(`已解鎖 ${label}`, 'ok');
      await load();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">登入紀錄</h1>
          <p className="page-sub">最近 7 天誰成功登入、從哪裡登入，以及登入失敗的帳號與來源。登入成功只會清掉「本人從同一個網路」打錯的紀錄。</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>重新整理</button>
      </div>

      {!data ? (
        <div className="card">{failed ? <Empty title="讀取失敗" /> : <div className="empty"><Spinner /></div>}</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="card stat">
              <div className="stat-num">{data.fails24h}</div>
              <div className="stat-label">24 小時內登入失敗</div>
            </div>
            <div className="card stat">
              <div className="stat-num">{data.accounts24h}</div>
              <div className="stat-label">被試過的帳號</div>
            </div>
            <div className="card stat">
              <div className="stat-num">{data.ips24h}</div>
              <div className="stat-label">來源 IP</div>
            </div>
            <div className="card stat">
              <div className="stat-num">{data.lockedAccounts + data.blockedIps}</div>
              <div className="stat-label">目前鎖定中（帳號 {data.lockedAccounts}、IP {data.blockedIps}）</div>
            </div>
          </div>

          <div className="notice gap-top">
            <div className="notice-row">
              <p className="notice-title">
                Discord 通知{' '}
                {data.notifyConfigured ? <span className="badge badge-primary">已設定</span> : <span className="badge">還沒設定</span>}
              </p>
              {data.notifyConfigured && (
                <button className="btn btn-secondary btn-sm" disabled={testing} onClick={sendTest}>
                  {testing ? '傳送中…' : '傳送測試通知'}
                </button>
              )}
            </div>
            <p className="notice-text">
              {data.notifyConfigured
                ? '有可疑的成功登入（國外 IP、試過很多帳號的 IP、用程式登入）、帳號或 IP 被鎖 24 小時、或有人成為管理員時，會傳訊息到你的 Discord 頻道。'
                : `設定方法：Discord 頻道設定 → 整合 → Webhook → 新 Webhook → 複製網址。
再到 Vercel 專案 → Settings → Environment Variables，新增 DISCORD_WEBHOOK_URL（值貼上網址，只勾 Production），存檔後 Redeploy。
這個網址等於頻道的發言權，不要貼給任何人。`}
            </p>
          </div>

          <h2 className="section-title gap-top">最近成功登入</h2>
          <div className="card table-wrap">
            {data.logins.length === 0 ? (
              <Empty title="最近 7 天沒有人登入" />
            ) : (
              <table className="table table-labeled">
                <thead>
                  <tr><th>帳號</th><th>時間</th><th>IP</th><th>裝置</th><th /></tr>
                </thead>
                <tbody>
                  {data.logins.map((g, i) => (
                    <tr key={`${g.at}-${g.username}-${i}`}>
                      <td>
                        <b>{g.displayName ?? g.username}</b> <span className="muted mono">{g.username}</span>
                      </td>
                      <td className="muted" data-label="時間" title={formatDateTime(g.at)}>{timeAgo(g.at)}</td>
                      <td data-label="IP">
                        {g.ip ? (
                          <a className="mono" href={`https://ipinfo.io/${encodeURIComponent(g.ip)}`} target="_blank" rel="noopener noreferrer">{g.ip}</a>
                        ) : (
                          <span className="muted">不明</span>
                        )}
                      </td>
                      <td className="muted" data-label="裝置" title={g.userAgent ?? undefined}>{deviceLabel(g.userAgent)}</td>
                      <td>{g.suspicious && <span className="badge badge-warn">這個 IP 也試過很多帳號</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 className="section-title gap-top">登入失敗：帳號</h2>
          <div className="card table-wrap">
            {data.accounts.length === 0 ? (
              <Empty title="最近 7 天沒有登入失敗" />
            ) : (
              <table className="table table-labeled">
                <thead>
                  <tr><th>帳號</th><th>24 小時</th><th>7 天</th><th>來源 IP 數</th><th>最近一次</th><th>狀態</th><th /></tr>
                </thead>
                <tbody>
                  {data.accounts.map((a) => (
                    <tr key={a.username}>
                      <td>
                        <b className="mono">{a.username}</b>
                        {!a.exists && <span className="muted">（沒有這個帳號）</span>}
                      </td>
                      <td data-label="24 小時失敗">{a.fails24h}</td>
                      <td data-label="7 天失敗">{a.fails7d}</td>
                      <td data-label="來源 IP">{a.ips}</td>
                      <td className="muted" data-label="最近失敗" title={formatDateTime(a.lastAt)}>{timeAgo(a.lastAt)}</td>
                      <td><LockBadge lock={a.lock} /></td>
                      <td>
                        {a.lock && (
                          <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => unlock({ username: a.username }, a.username)}>
                            解鎖
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 className="section-title gap-top">登入失敗：來源 IP</h2>
          <div className="card table-wrap">
            {data.ips.length === 0 ? (
              <Empty title="最近 7 天沒有登入失敗" />
            ) : (
              <table className="table table-labeled">
                <thead>
                  <tr><th>IP</th><th>24 小時</th><th>7 天</th><th>試過的帳號數</th><th>最近一次</th><th>狀態</th><th /></tr>
                </thead>
                <tbody>
                  {data.ips.map((r) => (
                    <tr key={r.ip}>
                      <td>
                        <a className="mono" href={`https://ipinfo.io/${encodeURIComponent(r.ip)}`} target="_blank" rel="noopener noreferrer">{r.ip}</a>
                      </td>
                      <td data-label="24 小時失敗">{r.fails24h}</td>
                      <td data-label="7 天失敗">{r.fails7d}</td>
                      <td data-label="試過帳號">{r.accounts}</td>
                      <td className="muted" data-label="最近失敗" title={formatDateTime(r.lastAt)}>{timeAgo(r.lastAt)}</td>
                      <td><LockBadge lock={r.lock} /></td>
                      <td>
                        {r.lock && (
                          <button className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => unlock({ ip: r.ip }, r.ip)}>
                            解鎖
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="notice gap-top">
            <p className="notice-title">規則</p>
            <p className="notice-text">
              {`同一個帳號：15 分鐘內錯 ${L.accountShort} 次暫停 15 分鐘；24 小時內錯 ${L.accountDay} 次暫停 24 小時。
同一個 IP：15 分鐘內錯 ${L.ipShort} 次暫停 15 分鐘；24 小時內錯 ${L.ipDay} 次暫停 24 小時。
學校、宿舍或同一家電信的人可能共用同一個 IP，被誤鎖時可以按「解鎖」。
點 IP 可以查它屬於哪家公司。要永久封鎖某個 IP（例如國外的雲端主機），到 Vercel 專案的 Firewall 加一條規則。`}
            </p>
          </div>
        </>
      )}
    </>
  );
}
