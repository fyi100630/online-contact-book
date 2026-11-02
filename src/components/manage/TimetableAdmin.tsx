'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from '@/lib/client/api';
import { WEEKDAYS } from '@/lib/shared/dates';
import { TIMETABLE_CELL_MAX, type InstallStats, type Timetable, type TimetableData } from '@/lib/shared/types';
import { WeekTable } from '../board/Timetable';
import { Empty, formatDateTime, Spinner, useToast } from '../ui';

const COMMON_SUBJECTS = [
  '國語文', '英語文', '數學', '物理', '化學', '生物', '地科', '歷史', '地理', '公民',
  '體育', '資訊', '美術', '音樂', '自習', '班會', '輔導', '社團活動', '團體活動', '彈性課程',
];

// =====================================================================
// 課表（管理員）
// =====================================================================
export function TimetablePage({ initial }: { initial: TimetableData | null }) {
  const toast = useToast();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<Timetable | null>(initial?.schedule ?? null);
  const [day, setDay] = useState(() => {
    const wd = new Date().getDay();
    return wd >= 1 && wd <= 5 ? wd - 1 : 0;
  });
  const [busy, setBusy] = useState(false);

  if (!draft || !saved) {
    return (
      <>
        <div className="page-head"><h1 className="page-title">課表</h1></div>
        <div className="alert alert-warn">資料庫還沒有課表。請到 Supabase 執行 db/migrations/001_timetable_installations.sql。</div>
      </>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.schedule);
  const setCell = (p: number, v: string) =>
    setDraft((cur) => cur!.map((periods, d) => (d === day ? periods.map((c, i) => (i === p ? v : c)) : periods)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await api<TimetableData>('/api/timetable', { method: 'PUT', body: { schedule: draft } });
      setSaved(t);
      setDraft(t.schedule);
      toast('課表已更新');
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
          <h1 className="page-title">課表</h1>
          <p className="page-sub">聯絡簿首頁和 App 會顯示當天的課。空白＝那一節沒有課。</p>
        </div>
      </div>
      <form className="card section-card stack-lg" onSubmit={save}>
        <div className="segmented tt-days" role="group" aria-label="選擇星期">
          {[0, 1, 2, 3, 4].map((d) => (
            <button key={d} type="button" aria-pressed={d === day} onClick={() => setDay(d)}>週{WEEKDAYS[d + 1]}</button>
          ))}
        </div>
        <div className="tt-edit">
          {draft[day]!.map((c, p) => (
            <label key={p} className="tt-row">
              <span className="field-label">第 {p + 1} 節</span>
              <input className="input" list="tt-subjects" maxLength={TIMETABLE_CELL_MAX} value={c} onChange={(e) => setCell(p, e.target.value)} />
            </label>
          ))}
        </div>
        <datalist id="tt-subjects">
          {COMMON_SUBJECTS.map((s) => <option key={s} value={s} />)}
        </datalist>
        <div className="form-actions">
          {saved.updatedAt && (
            <span className="field-hint">上次更新：{formatDateTime(saved.updatedAt)}{saved.updatedByName ? `，${saved.updatedByName}` : ''}</span>
          )}
          <span className="spacer" />
          {dirty && <button type="button" className="btn btn-ghost" onClick={() => setDraft(saved.schedule)}>復原</button>}
          <button className="btn btn-primary" disabled={busy || !dirty}>{busy ? '儲存中…' : '儲存'}</button>
        </div>
      </form>
      <div className="card section-card stack-lg gap-top">
        <h2 className="section-title">整週預覽</h2>
        <WeekTable timetable={draft} highlight={day + 1} />
      </div>
    </>
  );
}

// =====================================================================
// App 安裝統計（管理員）
// =====================================================================
export function InstallStatsPage() {
  const toast = useToast();
  const [stats, setStats] = useState<InstallStats | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats(await api<InstallStats>('/api/installations'));
    } catch (e) {
      setFailed(true);
      toast(errorText(e), 'error');
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">App 安裝統計</h1>
          <p className="page-sub">Android App 每次開啟會回報一組隨機的安裝 ID 和版本號，不包含任何個人資料。</p>
        </div>
      </div>
      {!stats ? (
        <div className="card">{failed ? <Empty title="讀取失敗" /> : <div className="empty"><Spinner /></div>}</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="card stat">
              <div className="stat-num">{stats.total}</div>
              <div className="stat-label">安裝過的裝置</div>
            </div>
            <div className="card stat">
              <div className="stat-num">{stats.active30d}</div>
              <div className="stat-label">30 天內有開過</div>
            </div>
          </div>
          <div className="card gap-top">
            {stats.versions.length === 0 ? (
              <Empty title="還沒有任何 App 回報" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>版本</th><th>裝置數</th><th>30 天內有開過</th></tr>
                  </thead>
                  <tbody>
                    {stats.versions.map((v) => (
                      <tr key={v.version}>
                        <td>v{v.version}</td>
                        <td>{v.total}</td>
                        <td>{v.active30d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
