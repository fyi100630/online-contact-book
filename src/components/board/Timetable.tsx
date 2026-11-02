'use client';

import { useState } from 'react';
import { WEEKDAYS } from '@/lib/shared/dates';
import { classesOn, TIMETABLE_PERIODS, type Timetable } from '@/lib/shared/types';
import { Dialog } from '../ui';

/** 聯絡簿首頁：選中那天的課（低調的一行一行），旁邊可以打開整週課表 */
export function DayClasses({ timetable, wd }: { timetable: Timetable; wd: number }) {
  const [open, setOpen] = useState(false);
  const classes = classesOn(timetable, wd);
  // 最後面連續的空堂不顯示
  let last = classes ? classes.length : 0;
  while (classes && last > 0 && !classes[last - 1]) last--;

  return (
    <section className="classes" aria-labelledby="classes-title">
      <div className="classes-head">
        <h2 id="classes-title" className="classes-title">課表</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>整週</button>
      </div>
      {!classes || last === 0 ? (
        <p className="classes-none">{classes ? '這天沒有排課' : '週末沒有課'}</p>
      ) : (
        <ol className="classes-list">
          {classes.slice(0, last).map((c, i) => (
            <li key={i} className={c ? undefined : 'is-empty'}>
              <span className="classes-no">{i + 1}</span>
              <span className="classes-name">{c || '—'}</span>
            </li>
          ))}
        </ol>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="整週課表">
        <WeekTable timetable={timetable} highlight={wd} />
      </Dialog>
    </section>
  );
}

export function WeekTable({ timetable, highlight }: { timetable: Timetable; highlight?: number }) {
  return (
    <div className="tt-wrap">
      <table className="tt">
        <thead>
          <tr>
            <th scope="col" className="tt-no">節</th>
            {[1, 2, 3, 4, 5].map((d) => (
              <th key={d} scope="col" className={d === highlight ? 'is-on' : undefined}>週{WEEKDAYS[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: TIMETABLE_PERIODS }, (_, p) => (
            <tr key={p}>
              <th scope="row" className="tt-no">{p + 1}</th>
              {[0, 1, 2, 3, 4].map((d) => (
                <td key={d} className={d + 1 === highlight ? 'is-on' : undefined}>{timetable[d]?.[p] || ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
