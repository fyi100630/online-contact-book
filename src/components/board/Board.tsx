'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, errorText } from '@/lib/client/api';
import { addDays, daysBetween, deadline, formatLong, formatShort, WEEKDAYS, weekday, type DateStr } from '@/lib/shared/dates';
import { CATEGORIES, CATEGORY_META, type BoardData, type Category, type PublicEntry } from '@/lib/shared/types';
import { IconBook, IconCalendar, IconChevronLeft, IconChevronRight } from '../icons';
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
  const [, month, dayOfMonth] = board.date.split('-').map(Number) as [number, number, number];
  const otherYear = board.date.slice(0, 4) !== board.today.slice(0, 4);
  const relative =
    isToday ? null : offset === 1 ? '明天' : offset === -1 ? '昨天' : offset > 0 ? `${offset} 天後` : `${-offset} 天前`;

  return (
    <>
      <header className="board-top">
        <div className="board-top-inner">
          <Link href="/" className="brand" onClick={(e) => { e.preventDefault(); goTo(board.today); }}>
            <span className="brand-mark"><IconBook /></span>
            <span className="brand-name">{board.classTitle}</span>
          </Link>
          {signedIn ? (
            <Link href="/manage" className="btn btn-primary btn-sm">管理後台</Link>
          ) : (
            <Link href="/login" className="btn btn-secondary btn-sm">幹部登入</Link>
          )}
        </div>
      </header>

      <main className="board">
        <section className="hero" aria-live="polite">
          <h1 className="hero-date">
            <span className="hero-day">{dayOfMonth}</span>
            <span className="hero-meta">
              <span className="hero-month">{otherYear && `${board.date.slice(0, 4)} 年 `}{month} 月</span>
              <span className="hero-wd">週{WEEKDAYS[weekday(board.date)]}</span>
            </span>
          </h1>
          {isToday ? <span className="seal" aria-label="今天">今日</span> : <span className="hero-rel">{relative}</span>}
          <span className="spinner-slot">{loading && <span className="spinner" role="status" aria-label="載入中" />}</span>
          <div className="hero-actions">
            {!isToday && <button className="btn btn-secondary btn-sm" onClick={() => goTo(board.today)}>回到今天</button>}
            <span className="date-picker btn btn-secondary btn-sm">
              <IconCalendar size="sm" /> 選日期
              <input type="date" aria-label="選擇日期" value={board.date} onChange={(e) => e.target.value && goTo(e.target.value)} />
            </span>
          </div>
        </section>

        <WeekStrip board={board} onPick={goTo} />

        {board.announcement && (
          <section className="notice" aria-labelledby="notice-title">
            <h2 id="notice-title" className="notice-title">公告</h2>
            <p className="notice-text"><Linkify text={board.announcement} /></p>
            {board.announcementUpdatedAt && <p className="notice-meta">{timeAgo(board.announcementUpdatedAt)}更新</p>}
          </section>
        )}

        <div className="board-grid">
          <section aria-label="當天事項">
            <div className="filters" role="toolbar" aria-label="篩選類別">
              <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
                全部 <span className="chip-count">{board.entries.length}</span>
              </button>
              {CATEGORIES.map((c) => (
                <button key={c} className="chip" aria-pressed={filter === c} onClick={() => setFilter(c)}>
                  {CATEGORY_META[c].short} <span className="chip-count">{counts[c]}</span>
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <div className="empty">
                <p className="empty-title">{filter === 'all' ? '這天沒有登記事項' : `這天沒有${CATEGORY_META[filter].short}`}</p>
                <p>用上面的週曆看看其他天</p>
              </div>
            ) : (
              (filter === 'all' ? CATEGORIES.filter((c) => counts[c] > 0) : [filter]).map((c) => (
                <section key={c} className="sheet" aria-labelledby={`sheet-${c}`}>
                  <h2 id={`sheet-${c}`} className="sheet-head">
                    {CATEGORY_META[c].label}
                    <span className="sheet-count">{shown.filter((e) => e.category === c).length}</span>
                  </h2>
                  <ul className="rows">
                    {shown.filter((e) => e.category === c).map((e) => <EntryRow key={e.id} entry={e} day={board.date} />)}
                  </ul>
                </section>
              ))
            )}
          </section>

          <aside className="side">
            <Upcoming board={board} onPick={goTo} />
          </aside>
        </div>
      </main>
    </>
  );
}

function WeekStrip({ board, onPick }: { board: BoardData; onPick: (d: DateStr) => void }) {
  const first = board.week[0]?.date ?? board.date;
  return (
    <nav className="week" aria-label="選擇日期">
      <button className="week-nav" onClick={() => onPick(addDays(first, -7))} aria-label="上一週"><IconChevronLeft /></button>
      <ol className="week-days">
        {board.week.map(({ date, count }) => {
          const wd = weekday(date);
          const cls = ['day', wd === 0 || wd === 6 ? 'is-weekend' : '', date === board.today ? 'is-today' : ''].join(' ');
          return (
            <li key={date}>
              <button
                className={cls}
                aria-current={date === board.date ? 'date' : undefined}
                onClick={() => onPick(date)}
                aria-label={`${formatLong(date)}，${count} 項`}
              >
                <span className="day-wd">週{WEEKDAYS[wd]}</span>
                <span className="day-num">{Number(date.slice(8))}</span>
                <span className="day-has" aria-hidden="true">{count > 0 ? count : ''}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <button className="week-nav" onClick={() => onPick(addDays(first, 7))} aria-label="下一週"><IconChevronRight /></button>
    </nav>
  );
}

function EntryRow({ entry, day }: { entry: PublicEntry; day: DateStr }) {
  const dl = deadline(entry.dueDate, day, entry.category);
  return (
    <li className="row">
      <span className="row-subject">{entry.subject}</span>
      <div className="row-main">
        <p className="row-title">
          {entry.priority === 'high' && <span className="row-flag">重要</span>}
          {entry.title}
        </p>
        {entry.details && <p className="row-details">{entry.details}</p>}
        {entry.entryDate !== day && <p className="row-since">{formatShort(entry.entryDate)} 登記</p>}
      </div>
      {dl && <span className={`row-due due-${dl.tone}`}>{dl.label}</span>}
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
    <section className="upcoming" aria-labelledby="upcoming-title">
      <h2 id="upcoming-title" className="upcoming-title">接下來兩週</h2>
      {groups.length === 0 ? (
        <p className="muted">兩週內沒有要交或要考的</p>
      ) : (
        <ol className="upcoming-list">
          {groups.map(([due, list]) => {
            const days = daysBetween(board.date, due);
            return (
              <li key={due} className="upcoming-day">
                <button className="upcoming-date" onClick={() => onPick(addDays(due, -1))} title="看前一天要準備的事">
                  <span className={days <= 1 ? 'is-urgent' : undefined}>{days === 1 ? '明天' : formatLong(due)}</span>
                </button>
                <ul>
                  {list.map((e) => (
                    <li key={e.id} className="upcoming-item">
                      {e.subject && <span className="upcoming-subject">{e.subject}</span>}
                      {e.title}
                      <span className="upcoming-kind">{CATEGORY_META[e.category].short}</span>
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
