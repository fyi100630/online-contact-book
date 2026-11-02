'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, errorText } from '@/lib/client/api';
import { addDays, deadline, formatShort, WEEKDAYS, weekday, type DateStr } from '@/lib/shared/dates';
import { CATEGORIES, CATEGORY_META, type Category, type ManagedEntry } from '@/lib/shared/types';
import { IconPlus, IconSearch, IconTrash } from '../icons';
import { Dialog, Empty, Field, Spinner, timeAgo, useToast } from '../ui';

type Range = 'recent' | 'past' | 'all';
const RANGE_LABEL: Record<Range, string> = { recent: '近期（前後一個月）', past: '過去三個月', all: '全部' };

function rangeDates(range: Range, today: DateStr): { from: DateStr; to: DateStr } {
  if (range === 'recent') return { from: addDays(today, -30), to: addDays(today, 60) };
  if (range === 'past') return { from: addDays(today, -90), to: today };
  return { from: '2000-01-01', to: '2100-12-31' };
}

type FormState = {
  entryDate: DateStr;
  category: Category;
  subject: string;
  title: string;
  details: string;
  dueDate: string;
  priority: 'normal' | 'high';
};

export function EntriesPage({ today }: { today: DateStr }) {
  const toast = useToast();
  const [entries, setEntries] = useState<ManagedEntry[] | null>(null);
  const [range, setRange] = useState<Range>('recent');
  const [category, setCategory] = useState<Category | ''>('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ManagedEntry | 'new' | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    const { from, to } = rangeDates(range, today);
    const params = new URLSearchParams({ from, to });
    if (category) params.set('category', category);
    if (query.trim()) params.set('q', query.trim());
    try {
      const data = await api<{ entries: ManagedEntry[] }>(`/api/entries?${params}`);
      setEntries(data.entries);
    } catch (e) {
      toast(errorText(e), 'error');
      setEntries([]);
    }
  }, [range, category, query, today, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">事項</h1>
          <p className="page-sub">新增、修改聯絡簿上的作業、考試、繳交與提醒</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><IconPlus /> 新增事項</button>
      </div>

      <div className="toolbar">
        <label className="search">
          <IconSearch />
          <span className="sr-only">搜尋</span>
          <input className="input" placeholder="搜尋內容、科目…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value as Category | '')} aria-label="類別">
          <option value="">所有類別</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
        </select>
        <select className="select" value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="時間範圍">
          {(Object.keys(RANGE_LABEL) as Range[]).map((r) => <option key={r} value={r}>{RANGE_LABEL[r]}</option>)}
        </select>
      </div>

      <div className="card">
        {entries === null ? (
          <div className="empty"><Spinner /></div>
        ) : entries.length === 0 ? (
          <Empty title="沒有符合的事項">
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing('new')}><IconPlus size="sm" /> 新增第一筆</button>
          </Empty>
        ) : (
          <div className="list">
            {entries.map((e) => {
              const dl = deadline(e.dueDate, today, e.category);
              return (
                <button key={e.id} className={`list-row cat-${e.category}`} onClick={() => setEditing(e)}>
                  <span className="list-date">
                    {formatShort(e.entryDate)}（{WEEKDAYS[weekday(e.entryDate)]}）
                    <small>{e.entryDate === today ? '今天登記' : e.entryDate.slice(0, 4)}</small>
                  </span>
                  <span className="list-main">
                    <span className="list-title">
                      {e.subject && `［${e.subject}］`}
                      {e.title}
                    </span>
                    <span className="list-meta">
                      <span className="badge badge-cat">{CATEGORY_META[e.category].short}</span>
                      {e.priority === 'high' && <span className="badge badge-danger">重要</span>}
                      {dl && <span className={`due due-${dl.tone}`}>{dl.label}</span>}
                      <span>{timeAgo(e.updatedAt)}由{e.updatedByName ?? '系統'}修改</span>
                    </span>
                  </span>
                  <span className="list-side muted">編輯</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog variant="drawer" open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? '新增事項' : '編輯事項'}>
        {editing !== null && (
          <EntryForm
            key={editing === 'new' ? 'new' : `${editing.id}:${editing.version}`}
            entry={editing === 'new' ? null : editing}
            today={today}
            onDone={(msg) => {
              setEditing(null);
              toast(msg);
              load();
            }}
            onConflict={(msg) => {
              setEditing(null);
              toast(msg, 'error');
              load();
            }}
          />
        )}
      </Dialog>
    </>
  );
}

function EntryForm({
  entry,
  today,
  onDone,
  onConflict,
}: {
  entry: ManagedEntry | null;
  today: DateStr;
  onDone: (msg: string) => void;
  onConflict: (msg: string) => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<FormState>(() =>
    entry
      ? {
          entryDate: entry.entryDate,
          category: entry.category,
          subject: entry.subject,
          title: entry.title,
          details: entry.details,
          dueDate: entry.dueDate ?? '',
          priority: entry.priority,
        }
      : { entryDate: today, category: 'homework', subject: '', title: '', details: '', dueDate: addDays(today, 1), priority: 'normal' },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((cur) => ({ ...cur, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return setError('請輸入內容');
    if (f.dueDate && f.dueDate < f.entryDate) return setError('截止日不能早於登記日');
    setBusy(true);
    setError('');
    const body = { ...f, dueDate: f.dueDate || null };
    try {
      if (entry) {
        await api(`/api/entries/${entry.id}`, { method: 'PATCH', body: { version: entry.version, entry: body } });
        onDone('已儲存');
      } else {
        await api('/api/entries', { method: 'POST', body });
        onDone('已新增');
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) return onConflict(err.message);
      setError(errorText(err));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!entry || !confirm(`確定要刪除「${entry.title}」嗎？\n刪除後會移到垃圾桶，管理員可以還原。`)) return;
    setBusy(true);
    try {
      await api(`/api/entries/${entry.id}`, { method: 'DELETE' });
      onDone('已移到垃圾桶');
    } catch (err) {
      toast(errorText(err), 'error');
      setBusy(false);
    }
  };

  const presets: [string, DateStr | ''][] = [
    ['明天', addDays(f.entryDate, 1)],
    ['後天', addDays(f.entryDate, 2)],
    ['一週後', addDays(f.entryDate, 7)],
    ['不設定', ''],
  ];

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="field">
        <span className="field-label">類別</span>
        <div className="segmented" role="group" aria-label="類別">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className={`cat-${c}`} aria-pressed={f.category === c} onClick={() => set('category', c)}>
              <span className="dot" /> {CATEGORY_META[c].short}
            </button>
          ))}
        </div>
      </div>
      <div className="form-grid">
        <Field label="登記日期">
          <input className="input" type="date" required value={f.entryDate} onChange={(e) => set('entryDate', e.target.value)} />
        </Field>
        <Field label="科目／單位">
          <input className="input" maxLength={30} placeholder="例如：數學" value={f.subject} onChange={(e) => set('subject', e.target.value)} />
        </Field>
      </div>
      <Field label="內容">
        <input className="input" maxLength={200} required placeholder="例如：習作 p.12～15" value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus={!entry} />
      </Field>
      <Field label="補充說明" hint="範圍、注意事項等（選填）">
        <textarea className="textarea" maxLength={2000} rows={3} value={f.details} onChange={(e) => set('details', e.target.value)} />
      </Field>
      <Field label="截止日" hint="有截止日：每天都會顯示，直到截止日前一天。沒有：只在登記日當天顯示。">
        <input className="input" type="date" min={f.entryDate} value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
      </Field>
      <div className="toolbar">
        {presets.map(([label, value]) => (
          <button key={label} type="button" className="chip" aria-pressed={f.dueDate === value} onClick={() => set('dueDate', value)}>
            {label}
          </button>
        ))}
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={f.priority === 'high'} onChange={(e) => set('priority', e.target.checked ? 'high' : 'normal')} />
        標為重要（排在最前面）
      </label>
      {entry && (
        <p className="field-hint">
          由 {entry.createdByName ?? '—'} 建立；最後由 {entry.updatedByName ?? '—'} 在 {timeAgo(entry.updatedAt)} 修改
        </p>
      )}
      <div className="form-actions">
        {entry && (
          <button type="button" className="btn btn-danger-ghost" onClick={remove} disabled={busy}><IconTrash size="sm" /> 刪除</button>
        )}
        <span className="spacer" />
        <button className="btn btn-primary" disabled={busy}>{busy ? '儲存中…' : entry ? '儲存' : '新增'}</button>
      </div>
    </form>
  );
}
