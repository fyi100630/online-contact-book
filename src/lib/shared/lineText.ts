import { deadline, formatFull, type DateStr } from './dates';
import { CATEGORIES, CATEGORY_META, type PublicEntry } from './types';

/** 產生可以直接貼到 LINE 群組的文字 */
export function buildLineText(opts: { classTitle: string; announcement: string; date: DateStr; entries: PublicEntry[]; url: string }): string {
  const lines = [`📅【${opts.classTitle}】聯絡簿`, `${formatFull(opts.date)}`];
  if (opts.announcement) lines.push('', '📢 公告', opts.announcement);
  for (const cat of CATEGORIES) {
    const list = opts.entries.filter((e) => e.category === cat);
    if (!list.length) continue;
    const meta = CATEGORY_META[cat];
    lines.push('', `${meta.emoji} ${meta.lineTitle}`);
    list.forEach((e, i) => {
      const dl = deadline(e.dueDate, opts.date);
      const subject = e.subject ? `［${e.subject}］` : '';
      const high = e.priority === 'high' ? '⭐ ' : '';
      lines.push(`${i + 1}. ${high}${subject}${e.title}${dl ? `（${dl.label}）` : ''}`);
      if (e.details) lines.push(`   ↳ ${e.details.replace(/\n/g, '\n     ')}`);
    });
  }
  if (!opts.entries.length) lines.push('', '今天沒有登記事項 🎉');
  lines.push('', `🔗 ${opts.url}`);
  return lines.join('\n');
}
