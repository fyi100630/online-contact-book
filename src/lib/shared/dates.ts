// 日期一律用 'YYYY-MM-DD' 字串表示（不含時區），避免跨時區位移。
// 這個檔案前後端共用，不能 import 任何伺服器端模組。

export type DateStr = string;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

export function isValidDateStr(s: unknown): s is DateStr {
  if (typeof s !== 'string') return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function toUtc(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(d: Date): DateStr {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = toUtc(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

export function daysBetween(from: DateStr, to: DateStr): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

export function weekday(s: DateStr): number {
  return toUtc(s).getUTCDay();
}

/** 該週的星期一 */
export function startOfWeek(s: DateStr): DateStr {
  const wd = weekday(s);
  return addDays(s, wd === 0 ? -6 : 1 - wd);
}

export function todayIn(timeZone: string): DateStr {
  // en-CA 的日期格式剛好是 YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function formatLong(s: DateStr): string {
  const d = toUtc(s);
  return `${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日（${WEEKDAYS[d.getUTCDay()]}）`;
}

export function formatFull(s: DateStr): string {
  const d = toUtc(s);
  return `${d.getUTCFullYear()} 年 ${formatLong(s)}`;
}

export function formatShort(s: DateStr): string {
  const d = toUtc(s);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/**
 * 事項在某一天是否要顯示：
 *  - 有截止日：從登記日起，一直顯示到截止日「前一天」（截止日當天就是要交了）
 *  - 沒有截止日：只在登記日當天顯示
 */
export function isActiveOn(e: { entryDate: DateStr; dueDate: DateStr | null }, day: DateStr): boolean {
  if (e.dueDate) return day >= e.entryDate && day < e.dueDate;
  return day === e.entryDate;
}

export type DeadlineTone = 'today' | 'tomorrow' | 'soon' | 'later' | 'past';

/** 依類別決定動詞：作業、繳交是「交」，考試是「考」，提醒是「截止」 */
function dueVerb(category?: string): string {
  if (category === 'exam') return '考';
  if (category === 'homework' || category === 'submission') return '交';
  return '截止';
}

/**
 * 截止日的說法，盡量用口語：「明天交」「週三考」「11/20 交」
 * day 是目前看的那一天。
 */
export function deadline(
  dueDate: DateStr | null,
  day: DateStr,
  category?: string,
): { tone: DeadlineTone; label: string; days: number } | null {
  if (!dueDate) return null;
  const days = daysBetween(day, dueDate);
  const verb = dueVerb(category);
  if (days < 0) return { tone: 'past', label: `${formatShort(dueDate)} 已${verb === '截止' ? '截止' : '過'}`, days };
  if (days === 0) return { tone: 'today', label: `今天${verb}`, days };
  if (days === 1) return { tone: 'tomorrow', label: `明天${verb}`, days };
  if (days <= 6) return { tone: days <= 3 ? 'soon' : 'later', label: `週${WEEKDAYS[weekday(dueDate)]}${verb}`, days };
  return { tone: 'later', label: `${formatShort(dueDate)} ${verb}`, days };
}
