'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, errorText } from '@/lib/client/api';
import { addDays, daysBetween, deadline, formatLong, formatShort, WEEKDAYS, weekday, type DateStr } from '@/lib/shared/dates';
import { CATEGORIES, CATEGORY_META, type BoardData, type Category, type PublicEntry } from '@/lib/shared/types';
import {
  IconBook,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconMegaphone,
} from '../icons';
import { Linkify } from '../Linkify';
import { timeAgo, useToast } from '../ui';

const POLL_MS = 60_000;

export function Board({ initial, signedIn }: { initial: BoardData; signedIn: boolean }) {
  const [board, setBoard] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const toast = useToast();
  const reqId = useRef(0);

  const load = useCallback(
    async (date: DateStr, opts: { silent?: boolean } = {}) => {
      const id = ++reqId.current;
      if (!opts.silent) setLoading(true);
      try {
        const data = await api<BoardData>(`/api/board?date=${date}`);
        if (id === reqId.current) setBoard(data);
      } catch (e) {
        if (!opts.silent) toast(errorText(e), 'error');
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [toast],
  );

  const goTo = useCallback(
    (date: DateStr) => {
      const url = date === board.today ? '/' : `/?d=${date}`;
      window.history.replaceState(null, '', url);
      setBoard((b) => ({ ...b, date }));
      load(date);
    },
    [board.today, load],
  );

  // 有人更新內容時自動重新整理（每分鐘檢查一次版本號，切回分頁時也檢查）
  const versionRef = useRef(board.version);
  const dateRef = useRef(board.date);
  versionRef.current = board.version;
  dateRef.current = board.date;
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const { version } = await api<{ version: string }>('/api/version');
        if (version !== versionRef.current) load(dateRef.current, { silent: true });
      } catch {
        /* 下次再試 */
      }
    };
    const timer = setInterval(check, POLL_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Category, number> = { homework: 0, exam: 0, submission: 0, reminder: 0 };
    for (const e of board.entries) c[e.category]++;
    return c;
  }, [board.entries]);

  const shown = filter === 'all' ? board.entries : board.entries.filter((e) => e.category === filter);
  const isToday = board.date === board.today;
  const offset = daysBetween(board.today, board.date);
  const relative = isToday ? '今天' : offset === 1 ? '明天' : offset === -1 ? '昨天' : offset > 0 ? `${offset} 天後` : `${-offset} 天前`;

  return (
    <>
      <header className="board-top">
        <div className="board-top-inner">
          <Link href="/" className="brand" onClick={(e) => { e.preventDefault(); goTo(board.today); }}>
            <span className="brand-mark"><IconBook /></span>
            <span>
              <span className="brand-name">{board.classTitle}</span>
              <span className="brand-sub hide-sm"> ・ 聯絡簿</span>
            </span>
          </Link>
          <div className="board-top-actions">
            {signedIn ? (
              <Link href="/manage" className="btn btn-shell-solid btn-sm">管理後台</Link>
            ) : (
              <Link href="/login" className="btn btn-shell btn-sm">幹部登入</Link>
            )}
          </div>
        </div>
      </header>

      <main className="board">
        <section className="date-head" aria-live="polite">
          <div className="date-heading">
            <h1 className="date-title">{formatLong(board.date)}</h1>
            <span className={`badge${isToday ? ' badge-primary' : ''}`}>
              {board.date.slice(0, 4) !== board.today.slice(0, 4) && `${board.date.slice(0, 4)} 年・`}
              {relative}
            </span>
            <span className="spinner-slot">{loading && <span className="spinner" role="status" aria-label="載入中" />}</span>
          </div>
          <div className="date-actions">
            {!isToday && (
              <button className="btn btn-secondary btn-sm" onClick={() => goTo(board.today)}>回到今天</button>
            )}
            <span className="date-picker btn btn-secondary btn-sm">
              <IconCalendar size="sm" /> 選日期
              <input
                type="date"
                aria-label="選擇日期"
                value={board.date}
                onChange={(e) => e.target.value && goTo(e.target.value)}
              />
            </span>
          </div>
        </section>

        <WeekStrip board={board} onPick={goTo} />

        {board.announcement && (
          <section className="notice" aria-label="公告">
            <span className="notice-icon"><IconMegaphone /></span>
            <div className="notice-body">
              <h2 className="notice-title">公告</h2>
              <p className="notice-text"><Linkify text={board.announcement} /></p>
              {board.announcementUpdatedAt && <p className="notice-meta">更新於 {timeAgo(board.announcementUpdatedAt)}</p>}
            </div>
          </section>
        )}

        <div className="board-grid">
          <section aria-label="當天事項">
            <div className="filters" role="toolbar" aria-label="篩選類別">
              <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                全部 <span className="chip-count">{board.entries.length}</span>
              </button>
              {CATEGORIES.map((c) => (
                <button key={c} className={`chip cat-${c}`} aria-pressed={filter === c} onClick={() => setFilter(c)}>
                  <span className="dot" /> {CATEGORY_META[c].short} <span className="chip-count">{counts[c]}</span>
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <div className="card">
                <div className="empty">
                  <p className="empty-title">{filter === 'all' ? '這天沒有登記事項' : `這天沒有${CATEGORY_META[filter].short}`}</p>
                  <p>可以用上方的日期切換看看其他天</p>
                </div>
              </div>
            ) : filter === 'all' ? (
              CATEGORIES.filter((c) => counts[c] > 0).map((c) => (
                <div key={c} className={`group cat-${c}`}>
                  <h2 className="group-head"><span className="dot" />{CATEGORY_META[c].label}<span className="line" /></h2>
                  <ul className="items">
                    {shown.filter((e) => e.category === c).map((e) => <EntryCard key={e.id} entry={e} day={board.date} />)}
                  </ul>
                </div>
              ))
            ) : (
              <ul className="items">
                {shown.map((e) => <EntryCard key={e.id} entry={e} day={board.date} />)}
              </ul>
            )}
          </section>

          <aside className="side">
            <Upcoming board={board} onPick={goTo} />
          </aside>
        </div>

        <footer className="board-foot">資料每分鐘自動更新</footer>
      </main>
    </>
  );
}

function WeekStrip({ board, onPick }: { board: BoardData; onPick: (d: DateStr) => void }) {
  const first = board.week[0]?.date ?? board.date;
  return (
    <nav className="week" aria-label="選擇日期">
      <button className="week-nav" onClick={() => onPick(addDays(first, -7))} aria-label="上一週"><IconChevronLeft /></button>
      {board.week.map(({ date, count, due }) => {
        const wd = weekday(date);
        const cls = [
          'day',
          `heat-${Math.min(due, 3)}`,
          wd === 0 || wd === 6 ? 'is-weekend' : '',
          date === board.today ? 'is-today' : '',
        ].join(' ');
        return (
          <button
            key={date}
            className={cls}
            aria-current={date === board.date ? 'date' : undefined}
            onClick={() => onPick(date)}
            aria-label={`${formatLong(date)}，${due} 項到期，${count} 項事項`}
          >
            <span className="day-wd">{date === board.today ? '今天' : `週${WEEKDAYS[wd]}`}</span>
            <span className="day-num">{Number(date.slice(8))}</span>
            <span className="day-due" aria-hidden="true">{due > 0 ? `${due} 件到期` : ''}</span>
          </button>
        );
      })}
      <button className="week-nav" onClick={() => onPick(addDays(first, 7))} aria-label="下一週"><IconChevronRight /></button>
      <p className="week-legend">
        <span className="heat-scale" aria-hidden="true"><i className="heat-1" /><i className="heat-2" /><i className="heat-3" /></span>
        顏色越深，當天要交、要考的越多
      </p>
    </nav>
  );
}

function EntryCard({ entry, day }: { entry: PublicEntry; day: DateStr }) {
  const dl = deadline(entry.dueDate, day);
  return (
    <li className={`item cat-${entry.category}${entry.priority === 'high' ? ' is-high' : ''}`}>
      <div className="item-top">
        <span className="badge badge-cat">{CATEGORY_META[entry.category].short}</span>
        {entry.subject && <span className="item-subject">{entry.subject}</span>}
        {entry.priority === 'high' && <span className="badge badge-danger">重要</span>}
      </div>
      <p className="item-title">{entry.title}</p>
      {entry.details && <p className="item-details">{entry.details}</p>}
      {(dl || entry.entryDate !== day) && (
        <div className="item-foot">
          {dl && <span className={`due due-${dl.tone}`}><IconClock size="sm" />{dl.label}</span>}
          {entry.entryDate !== day && <span className="since">{formatShort(entry.entryDate)} 登記</span>}
        </div>
      )}
    </li>
  );
}

function Upcoming({ board, onPick }: { board: BoardData; onPick: (d: DateStr) => void }) {
  const groups = useMemo(() => {
    const map = new Map<DateStr, PublicEntry[]>();
    for (const e of board.upcoming) {
      if (!e.dueDate) continue;
      const list = map.get(e.dueDate) ?? [];
      list.push(e);
      map.set(e.dueDate, list);
    }
    return [...map.entries()];
  }, [board.upcoming]);

  return (
    <section className="card panel" aria-label="接下來的截止日">
      <h2 className="panel-title"><IconClock /> 接下來兩週截止</h2>
      {groups.length === 0 ? (
        <p className="muted">兩週內沒有要截止的事項</p>
      ) : (
        <ol className="timeline">
          {groups.map(([due, list]) => {
            const days = daysBetween(board.date, due);
            return (
              <li key={due}>
                <div className="tl-day-head">
                  <button className="btn btn-ghost btn-sm" onClick={() => onPick(addDays(due, -1))} title="看截止前一天">
                    {formatLong(due)}
                  </button>
                  <span className={`badge ${days <= 1 ? 'badge-danger' : days <= 3 ? 'badge-warn' : ''}`}>
                    {days === 1 ? '明天' : `${days} 天後`}
                  </span>
                </div>
                <ul className="tl-items">
                  {list.map((e) => (
                    <li key={e.id} className={`tl-item cat-${e.category}`}>
                      <span className="dot" />
                      <span className="tl-item-text">
                        {e.subject && <b>{e.subject}</b>}
                        {e.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
