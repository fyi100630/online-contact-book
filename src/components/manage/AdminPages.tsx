'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorText } from '@/lib/client/api';
import { CATEGORY_META, ROLE_LABEL, type AuditRow, type Category, type ManagedEntry, type Role, type UserRow } from '@/lib/shared/types';
import { formatShort } from '@/lib/shared/dates';
import { IconCheck, IconCopy, IconEdit, IconKey, IconPlus, IconRestore, IconTrash, IconUser } from '../icons';
import { Linkify } from '../Linkify';
import { copyText, Dialog, Empty, Field, formatDateTime, Spinner, timeAgo, useToast } from '../ui';

// =====================================================================
// 公告
// =====================================================================
export function AnnouncementPage({ initial }: { initial: { classTitle: string; announcement: string; updatedAt: string | null } }) {
  const toast = useToast();
  const [classTitle, setClassTitle] = useState(initial.classTitle);
  const [announcement, setAnnouncement] = useState(initial.announcement);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = classTitle !== saved.classTitle || announcement !== saved.announcement;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const s = await api<typeof initial>('/api/settings', { method: 'PUT', body: { classTitle, announcement } });
      setSaved(s);
      setClassTitle(s.classTitle);
      setAnnouncement(s.announcement);
      toast('已發布');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">公告</h1>
          <p className="page-sub">顯示在聯絡簿最上方，所有人都看得到</p>
        </div>
      </div>
      <form className="card section-card stack-lg" onSubmit={save}>
        <Field label="班級名稱">
          <input className="input" maxLength={40} value={classTitle} onChange={(e) => setClassTitle(e.target.value)} />
        </Field>
        <Field label="公告內容" hint={`${announcement.length} / 2000 字。網址會自動變成連結。留空就不顯示公告。`}>
          <textarea className="textarea" rows={6} maxLength={2000} value={announcement} onChange={(e) => setAnnouncement(e.target.value)} />
        </Field>
        {announcement.trim() && (
          <div className="preview">
            <p className="field-label">預覽</p>
            <p className="notice-text"><Linkify text={announcement.trim()} /></p>
          </div>
        )}
        <div className="form-actions">
          {saved.updatedAt && <span className="field-hint">上次更新：{formatDateTime(saved.updatedAt)}</span>}
          <span className="spacer" />
          <button className="btn btn-primary" disabled={busy || !dirty}>{busy ? '發布中…' : '發布'}</button>
        </div>
      </form>
    </>
  );
}

// =====================================================================
// 帳號管理
// =====================================================================
export function UsersPage({ meId }: { meId: string }) {
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<{ username: string; password: string; title: string } | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers((await api<{ users: UserRow[] }>('/api/users')).users);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const patch = async (u: UserRow, body: Partial<Pick<UserRow, 'role' | 'isActive' | 'displayName'>>, msg: string) => {
    if (body.isActive === false && !confirm(`確定要停用「${u.displayName}」嗎？\n停用後會立刻登出，而且無法再登入。`)) return;
    try {
      await api(`/api/users/${u.id}`, { method: 'PATCH', body });
      toast(msg);
      load();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  const reset = async (u: UserRow) => {
    if (!confirm(`要重設「${u.displayName}」的密碼嗎？\n對方目前的登入會被登出，並需要用新的臨時密碼登入。`)) return;
    try {
      const { tempPassword } = await api<{ tempPassword: string }>(`/api/users/${u.id}/reset-password`, { method: 'POST' });
      setSecret({ username: u.username, password: tempPassword, title: '密碼已重設' });
      load();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">帳號管理</h1>
          <p className="page-sub">只有這裡建立的帳號可以登入編輯</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}><IconPlus /> 新增帳號</button>
      </div>

      <div className="card table-wrap">
        {users === null ? (
          <div className="empty"><Spinner /></div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>名稱</th><th>帳號</th><th>角色</th><th>狀態</th><th>最後登入</th><th /></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.isActive ? '' : 'is-off'}>
                  <td>
                    <b>{u.displayName}</b>
                    {u.id === meId && <span className="muted">（你）</span>}
                  </td>
                  <td>{u.username}</td>
                  <td>
                    <select className="select" value={u.role} aria-label="角色" onChange={(e) => patch(u, { role: e.target.value as Role }, '角色已更新')}>
                      <option value="editor">{ROLE_LABEL.editor}</option>
                      <option value="admin">{ROLE_LABEL.admin}</option>
                    </select>
                  </td>
                  <td>
                    {!u.isActive ? (
                      <span className="badge">已停用</span>
                    ) : u.mustChangePassword ? (
                      <span className="badge badge-warn">等待首次登入</span>
                    ) : (
                      <span className="badge badge-ok">使用中</span>
                    )}
                  </td>
                  <td className="muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : '從未'}</td>
                  <td>
                    <div className="list-side">
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)} aria-label={`修改 ${u.displayName} 的名稱`}><IconEdit size="sm" /></button>
                      {u.id !== meId && u.isActive && <button className="btn btn-ghost btn-sm" onClick={() => reset(u)}><IconKey size="sm" /> 重設密碼</button>}
                      {u.id !== meId && (u.isActive ? (
                        <button className="btn btn-danger-ghost btn-sm" onClick={() => patch(u, { isActive: false }, '已停用')}>停用</button>
                      ) : (
                        <button className="btn btn-secondary btn-sm" onClick={() => patch(u, { isActive: true }, '已重新啟用')}>啟用</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={creating} onClose={() => setCreating(false)} title="新增帳號">
        {creating && (
          <CreateUserForm
            onCreated={(username, password) => {
              setCreating(false);
              setSecret({ username, password, title: '帳號已建立' });
              load();
            }}
          />
        )}
      </Dialog>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title="修改顯示名稱">
        {editing && (
          <RenameForm
            user={editing}
            onSave={async (displayName) => {
              await patch(editing, { displayName }, '名稱已更新');
              setEditing(null);
            }}
          />
        )}
      </Dialog>

      <Dialog open={secret !== null} onClose={() => setSecret(null)} title={secret?.title ?? ''}>
        {secret && <SecretView username={secret.username} password={secret.password} onClose={() => setSecret(null)} />}
      </Dialog>
    </>
  );
}

function CreateUserForm({ onCreated }: { onCreated: (username: string, password: string) => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<{ user: UserRow; tempPassword: string }>('/api/users', { method: 'POST', body: { username, displayName, role } });
      onCreated(res.user.username, res.tempPassword);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <Field label="顯示名稱" hint="例如：學藝股長 王小美">
        <input className="input" maxLength={30} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus />
      </Field>
      <Field label="登入帳號" hint="小寫英文、數字、. _ -，3～32 字，建立後不能修改">
        <input className="input" autoCapitalize="none" spellCheck={false} maxLength={32} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
      </Field>
      <Field label="角色">
        <select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="editor">幹部與小老師：可以新增、修改、刪除事項</option>
          <option value="admin">管理員：另外可以管理帳號、公告、紀錄與還原</option>
        </select>
      </Field>
      <div className="alert alert-info">密碼會由系統隨機產生，對方第一次登入後必須改成自己的密碼。</div>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={busy}>{busy ? '建立中…' : '建立帳號'}</button>
      </div>
    </form>
  );
}

function RenameForm({ user, onSave }: { user: UserRow; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(user.displayName);
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(name);
      }}
    >
      <Field label="顯示名稱">
        <input className="input" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={!name.trim()}>儲存</button>
      </div>
    </form>
  );
}

function SecretView({ username, password, onClose }: { username: string; password: string; onClose: () => void }) {
  const toast = useToast();
  const copy = async () => {
    toast((await copyText(`帳號：${username}\n臨時密碼：${password}`)) ? '已複製' : '複製失敗，請手動抄寫', 'ok');
  };
  return (
    <div className="form-stack">
      <div className="alert alert-warn">這組密碼只會顯示這一次。請私下交給本人（不要貼在群組），對方登入後會被要求改密碼。</div>
      <dl className="kv">
        <dt>帳號</dt>
        <dd>{username}</dd>
      </dl>
      <div className="secret">
        <code>{password}</code>
        <button className="btn btn-secondary btn-sm" onClick={copy}><IconCopy size="sm" /> 複製</button>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" onClick={onClose}><IconCheck size="sm" /> 我已經記下來了</button>
      </div>
    </div>
  );
}

// =====================================================================
// 修改紀錄
// =====================================================================
const ACTION_TEXT: Record<string, string> = {
  create: '新增了',
  update: '修改了',
  trash: '刪除了',
  restore: '還原了',
  password_reset: '重設了密碼：',
  password_change: '修改了自己的密碼',
};
const FIELD_LABEL: Record<string, string> = {
  entry_date: '日期', category: '類別', subject: '科目', title: '內容', details: '說明', due_date: '截止日', priority: '重要',
  class_title: '班級名稱', announcement: '公告', display_name: '名稱', role: '角色', is_active: '啟用', must_change_password: '需改密碼',
};

function describe(log: AuditRow): string {
  const d = (log.after ?? log.before ?? {}) as Record<string, unknown>;
  if (log.entity === 'entry') {
    const cat = CATEGORY_META[d.category as Category]?.short ?? '事項';
    return `${cat}「${d.subject ? `［${d.subject}］` : ''}${String(d.title ?? '')}」（${formatShort(String(d.entry_date ?? '2000-01-01'))}）`;
  }
  if (log.entity === 'settings') return '公告／班級名稱';
  if (log.entity === 'timetable') return '課表';
  if (log.action === 'password_change') return '';
  return `帳號 ${String(d.display_name ?? '')}（${String(d.username ?? '')}）`;
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '（空）';
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (v === 'high') return '重要';
  if (v === 'normal') return '一般';
  if (typeof v === 'string' && v in CATEGORY_META) return CATEGORY_META[v as Category].short;
  if (v === 'admin' || v === 'editor') return ROLE_LABEL[v];
  return String(v);
}

export function ActivityPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditRow[] | null>(null);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(
    async (before?: string) => {
      setBusy(true);
      try {
        const { logs: page } = await api<{ logs: AuditRow[] }>(`/api/audit${before ? `?before=${before}` : ''}`);
        setLogs((cur) => (before && cur ? [...cur, ...page] : page));
        setMore(page.length === 50);
      } catch (e) {
        toast(errorText(e), 'error');
        setLogs((cur) => cur ?? []);
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    load();
  }, [load]);

  const revert = async (log: AuditRow) => {
    if (!confirm(`把這個事項還原成 ${formatDateTime(log.at)} 修改前的樣子？`)) return;
    try {
      await api(`/api/audit/${log.id}/revert`, { method: 'POST' });
      toast('已還原');
      load();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">修改紀錄</h1>
          <p className="page-sub">所有變更都由資料庫自動記錄，任何人（包括管理員）都無法修改或刪除</p>
        </div>
      </div>
      <div className="card">
        {logs === null ? (
          <div className="empty"><Spinner /></div>
        ) : logs.length === 0 ? (
          <Empty title="還沒有任何紀錄" />
        ) : (
          <ul className="feed">
            {logs.map((log) => {
              const iconCls = log.action.startsWith('password') ? 'act-password' : `act-${log.action}`;
              const changes =
                log.action === 'update' && log.before && log.after
                  ? Object.keys(FIELD_LABEL).filter((k) => k in log.after! && JSON.stringify(log.before![k]) !== JSON.stringify(log.after![k]))
                  : [];
              return (
                <li key={log.id} className="feed-item">
                  <span className={`feed-icon ${iconCls}`}>
                    {log.action === 'trash' ? <IconTrash size="sm" /> : log.action === 'restore' ? <IconRestore size="sm" /> : log.action.startsWith('password') ? <IconKey size="sm" /> : log.entity === 'user' ? <IconUser size="sm" /> : log.action === 'create' ? <IconPlus size="sm" /> : <IconEdit size="sm" />}
                  </span>
                  <div>
                    <p className="feed-text"><b>{log.actorName}</b> {ACTION_TEXT[log.action] ?? log.action} {describe(log)}</p>
                    <p className="feed-meta">
                      <span title={formatDateTime(log.at)}>{formatDateTime(log.at)}（{timeAgo(log.at)}）</span>
                      {log.entity === 'entry' && (log.action === 'update' || log.action === 'trash') && (
                        <button className="btn btn-ghost btn-sm" onClick={() => revert(log)}><IconRestore size="sm" /> 還原成修改前</button>
                      )}
                    </p>
                    {changes.length > 0 && (
                      <div className="diff">
                        {changes.map((k) => (
                          <div key={k} className="diff-row">
                            <span className="diff-key">{FIELD_LABEL[k]}</span>
                            <span><span className="diff-old">{show(log.before![k])}</span> → <span className="diff-new">{show(log.after![k])}</span></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {logs && logs.length > 0 && more && (
        <div className="form-actions">
          <button className="btn btn-secondary" disabled={busy} onClick={() => load(logs[logs.length - 1]!.id)}>載入更早的紀錄</button>
        </div>
      )}
    </>
  );
}

// =====================================================================
// 垃圾桶
// =====================================================================
export function TrashPage() {
  const toast = useToast();
  const [entries, setEntries] = useState<ManagedEntry[] | null>(null);
  const load = useCallback(async () => {
    try {
      setEntries((await api<{ entries: ManagedEntry[] }>('/api/trash')).entries);
    } catch (e) {
      toast(errorText(e), 'error');
      setEntries([]);
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const restore = async (e: ManagedEntry) => {
    try {
      await api(`/api/entries/${e.id}/restore`, { method: 'POST' });
      toast(`已還原「${e.title}」`);
      setEntries((cur) => cur?.filter((x) => x.id !== e.id) ?? null);
    } catch (err) {
      toast(errorText(err), 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">垃圾桶</h1>
          <p className="page-sub">被刪除的事項會一直留在這裡，不會被永久刪除</p>
        </div>
      </div>
      <div className="card">
        {entries === null ? (
          <div className="empty"><Spinner /></div>
        ) : entries.length === 0 ? (
          <Empty title="垃圾桶是空的" />
        ) : (
          <div className="list">
            {entries.map((e) => (
              <div key={e.id} className={`list-row cat-${e.category}`}>
                <span className="list-date">{formatShort(e.entryDate)}<small>{e.entryDate.slice(0, 4)}</small></span>
                <span className="list-main">
                  <span className="list-title">{e.subject && `［${e.subject}］`}{e.title}</span>
                  <span className="list-meta">
                    <span className="badge badge-cat">{CATEGORY_META[e.category].short}</span>
                    <span>{e.deletedByName ?? '—'} 刪除於 {formatDateTime(e.deletedAt)}</span>
                  </span>
                </span>
                <span className="list-side">
                  <button className="btn btn-secondary btn-sm" onClick={() => restore(e)}><IconRestore size="sm" /> 還原</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// =====================================================================
// 備份與匯入
// =====================================================================
type ImportPreview = { valid: number; skipped: number; classTitle: string; announcement: string };

export function DataPage() {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; data: unknown } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [applySettings, setApplySettings] = useState(false);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    try {
      const res = await fetch('/api/export', { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) throw new Error('下載失敗');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'contact-book.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    setPreview(null);
    setFile(null);
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast('檔案太大（上限 8 MB）', 'error');
    try {
      const data = JSON.parse(await f.text());
      setBusy(true);
      const p = await api<ImportPreview>('/api/import', { method: 'POST', body: { data, dryRun: true } });
      setFile({ name: f.name, data });
      setPreview(p);
    } catch (err) {
      toast(err instanceof SyntaxError ? '這不是有效的 JSON 檔案' : errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await api<{ inserted: number; duplicates: number; skipped: number }>('/api/import', {
        method: 'POST',
        body: { data: file.data, applySettings },
      });
      toast(`匯入完成：新增 ${r.inserted} 筆${r.duplicates ? `，${r.duplicates} 筆先前已匯入` : ''}`);
      setFile(null);
      setPreview(null);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">備份與匯入</h1>
          <p className="page-sub">定期下載備份，或把舊版聯絡簿的資料搬進來</p>
        </div>
      </div>
      <section className="card section-card">
        <h2 className="section-title">下載備份</h2>
        <p className="muted">下載目前所有事項與公告（JSON 格式）。建議每個月備份一次。</p>
        <div><button className="btn btn-secondary" onClick={download}>下載 JSON 備份</button></div>
      </section>
      <section className="card section-card">
        <h2 className="section-title">匯入資料</h2>
        <p className="muted">支援舊版網頁的備份檔、舊資料庫匯出的 JSON，以及這裡下載的備份。重複匯入同一份檔案不會產生重複的事項。</p>
        <div><input type="file" accept="application/json,.json" onChange={pick} disabled={busy} aria-label="選擇 JSON 檔案" /></div>
        {preview && file && (
          <div className="form-stack">
            <div className="alert alert-info">
              「{file.name}」可以匯入 <b>{preview.valid}</b> 筆事項{preview.skipped > 0 && `，${preview.skipped} 筆格式不正確會略過`}。
            </div>
            {(preview.classTitle || preview.announcement) && (
              <label className="checkbox">
                <input type="checkbox" checked={applySettings} onChange={(e) => setApplySettings(e.target.checked)} />
                同時套用檔案裡的班級名稱「{preview.classTitle}」和公告
              </label>
            )}
            <div><button className="btn btn-primary" onClick={run} disabled={busy || preview.valid === 0}>開始匯入</button></div>
          </div>
        )}
      </section>
    </>
  );
}
