import 'server-only';
import { db, withActor, type Actor, type Tx } from './db';
import { HttpError } from './http';
import { addDays, isValidDateStr, startOfWeek, todayIn, type DateStr } from '@/lib/shared/dates';
import { CATEGORIES, type AuditRow, type BoardData, type Category, type ManagedEntry, type PublicEntry, type UserRow } from '@/lib/shared/types';
import type { EntryInput } from '@/lib/shared/validation';

export const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Taipei';
export const today = () => todayIn(TIMEZONE);

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function toPublic(r: Row): PublicEntry {
  return {
    id: r.id,
    entryDate: r.entry_date,
    category: r.category,
    subject: r.subject,
    title: r.title,
    details: r.details,
    dueDate: r.due_date ?? null,
    priority: r.priority,
  };
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

function toManaged(r: Row): ManagedEntry {
  return {
    ...toPublic(r),
    version: r.version,
    createdAt: iso(r.created_at)!,
    createdByName: r.created_by_name ?? null,
    updatedAt: iso(r.updated_at)!,
    updatedByName: r.updated_by_name ?? null,
    deletedAt: iso(r.deleted_at),
    deletedByName: r.deleted_by_name ?? null,
  };
}

const MANAGED_SELECT = (sql: ReturnType<typeof db> | Tx) => sql`
  e.*, cu.display_name as created_by_name, uu.display_name as updated_by_name, du.display_name as deleted_by_name
  from app.entries e
  left join app.users cu on cu.id = e.created_by
  left join app.users uu on uu.id = e.updated_by
  left join app.users du on du.id = e.deleted_by`;

// ---------------------------------------------------------------------
// 公開看板
// ---------------------------------------------------------------------
export async function getBoard(date: DateStr): Promise<BoardData> {
  const sql = db();
  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);
  const upcomingEnd = addDays(date, 14);

  const [settingsRows, dayRows, weekRows, upcomingRows] = await Promise.all([
    sql`select class_title, announcement, announcement_updated_at, content_version from app.settings where id = 1`,
    sql`
      select * from app.entries
      where deleted_at is null
        and entry_date <= ${date}
        and ((due_date is null and entry_date = ${date}) or (due_date > ${date}))
      order by (priority = 'high') desc, due_date nulls last, created_at`,
    // count：當天要顯示的事項數；due：當天到期（要交、要考）的事項數，給週曆上色用
    sql`
      select d::date::text as day,
        (count(e.id) filter (where (e.due_date is null and e.entry_date = d::date) or e.due_date > d::date))::int as count,
        (count(e.id) filter (where e.due_date = d::date))::int as due
      from generate_series(${weekStart}::date, ${weekEnd}::date, interval '1 day') d
      left join app.entries e
        on e.deleted_at is null
        and e.entry_date <= d::date
      group by d order by d`,
    sql`
      select * from app.entries
      where deleted_at is null and due_date > ${date} and due_date <= ${upcomingEnd}
      order by due_date, (priority = 'high') desc, created_at
      limit 50`,
  ]);
  const s = settingsRows[0] ?? { class_title: '班級聯絡簿', announcement: '', announcement_updated_at: null, content_version: 0 };
  return {
    classTitle: s.class_title,
    announcement: s.announcement,
    announcementUpdatedAt: iso(s.announcement_updated_at),
    today: today(),
    date,
    entries: dayRows.map(toPublic),
    week: weekRows.map((r) => ({ date: r.day, count: r.count, due: r.due })),
    upcoming: upcomingRows.map(toPublic),
    version: String(s.content_version),
  };
}

export async function getContentVersion(): Promise<string> {
  const [r] = await db()`select content_version from app.settings where id = 1`;
  return String(r?.content_version ?? 0);
}

export async function getSettings() {
  const [r] = await db()`select class_title, announcement, announcement_updated_at, updated_at from app.settings where id = 1`;
  return { classTitle: r?.class_title ?? '班級聯絡簿', announcement: r?.announcement ?? '', updatedAt: iso(r?.updated_at) };
}

export async function updateSettings(actor: Actor, input: { classTitle: string; announcement: string }) {
  await withActor(actor, (tx) => tx`
    insert into app.settings (id, class_title, announcement) values (1, ${input.classTitle}, ${input.announcement})
    on conflict (id) do update set class_title = excluded.class_title, announcement = excluded.announcement`);
  return getSettings();
}

// ---------------------------------------------------------------------
// 事項管理
// ---------------------------------------------------------------------
export async function listEntries(opts: { from: DateStr; to: DateStr; q?: string; category?: Category }): Promise<ManagedEntry[]> {
  const sql = db();
  const q = opts.q?.trim().slice(0, 50);
  const like = q ? `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%` : null;
  const rows = await sql`
    select ${MANAGED_SELECT(sql)}
    where e.deleted_at is null
      and e.entry_date <= ${opts.to}
      and coalesce(e.due_date, e.entry_date) >= ${opts.from}
      ${opts.category ? sql`and e.category = ${opts.category}` : sql``}
      ${like ? sql`and (e.title ilike ${like} or e.subject ilike ${like} or e.details ilike ${like})` : sql``}
    order by e.entry_date desc, e.created_at desc
    limit 500`;
  return rows.map(toManaged);
}

async function getManaged(tx: Tx, id: string): Promise<ManagedEntry> {
  const [r] = await tx`select ${MANAGED_SELECT(tx)} where e.id = ${id}`;
  if (!r) throw new HttpError(404, '找不到這個事項');
  return toManaged(r);
}

export async function createEntry(actor: Actor, input: EntryInput): Promise<ManagedEntry> {
  return withActor(actor, async (tx) => {
    const [r] = await tx`
      insert into app.entries (entry_date, category, subject, title, details, due_date, priority)
      values (${input.entryDate}, ${input.category}, ${input.subject}, ${input.title}, ${input.details}, ${input.dueDate}, ${input.priority})
      returning id`;
    return getManaged(tx, r!.id);
  });
}

export async function updateEntry(actor: Actor, id: string, version: number, input: EntryInput): Promise<ManagedEntry> {
  return withActor(actor, async (tx) => {
    const res = await tx`
      update app.entries set
        entry_date = ${input.entryDate}, category = ${input.category}, subject = ${input.subject},
        title = ${input.title}, details = ${input.details}, due_date = ${input.dueDate}, priority = ${input.priority}
      where id = ${id} and version = ${version} and deleted_at is null
      returning id`;
    if (res.length === 0) {
      const [cur] = await tx`select deleted_at from app.entries where id = ${id}`;
      if (!cur || cur.deleted_at) throw new HttpError(409, '這個事項已經被刪除了', 'gone');
      throw new HttpError(409, '在你編輯的時候，有其他人修改了這個事項。已載入最新內容，請確認後再修改。', 'conflict');
    }
    return getManaged(tx, id);
  });
}

export async function trashEntry(actor: Actor, id: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const res = await tx`update app.entries set deleted_at = now() where id = ${id} and deleted_at is null returning id`;
    if (res.length === 0) throw new HttpError(404, '這個事項已經被刪除了', 'gone');
  });
}

export async function listTrash(): Promise<ManagedEntry[]> {
  const sql = db();
  const rows = await sql`select ${MANAGED_SELECT(sql)} where e.deleted_at is not null order by e.deleted_at desc limit 300`;
  return rows.map(toManaged);
}

export async function restoreEntry(actor: Actor, id: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const res = await tx`update app.entries set deleted_at = null where id = ${id} and deleted_at is not null returning id`;
    if (res.length === 0) throw new HttpError(404, '這個事項不在垃圾桶裡');
  });
}

// ---------------------------------------------------------------------
// 修改紀錄
// ---------------------------------------------------------------------
export async function listAudit(beforeId?: string): Promise<AuditRow[]> {
  const sql = db();
  const before = beforeId && /^\d{1,18}$/.test(beforeId) ? beforeId : null;
  const rows = await sql`
    select id::text, at, actor_name, entity, entity_id, action, before, after
    from app.audit_log
    ${before ? sql`where id < ${before}` : sql``}
    order by id desc limit 50`;
  return rows.map((r) => ({
    id: r.id,
    at: iso(r.at)!,
    actorName: r.actor_name,
    entity: r.entity,
    entityId: r.entity_id,
    action: r.action,
    before: r.before,
    after: r.after,
  }));
}

/** 把事項還原成某筆紀錄「修改前」的內容 */
export async function revertFromAudit(actor: Actor, auditId: string): Promise<void> {
  if (!/^\d{1,18}$/.test(auditId)) throw new HttpError(400, '格式錯誤');
  await withActor(actor, async (tx) => {
    const [log] = await tx`select entity, entity_id, action, before from app.audit_log where id = ${auditId}`;
    if (!log || log.entity !== 'entry' || !log.before || !['update', 'trash'].includes(log.action)) {
      throw new HttpError(400, '這筆紀錄無法還原');
    }
    const b = log.before as Row;
    if (!isValidDateStr(b.entry_date) || !CATEGORIES.includes(b.category)) throw new HttpError(400, '這筆紀錄無法還原');
    const res = await tx`
      update app.entries set
        entry_date = ${b.entry_date}, category = ${b.category}, subject = ${b.subject ?? ''}, title = ${b.title},
        details = ${b.details ?? ''}, due_date = ${b.due_date ?? null}, priority = ${b.priority ?? 'normal'}, deleted_at = null
      where id = ${log.entity_id}
      returning id`;
    if (res.length === 0) throw new HttpError(404, '找不到這個事項');
  });
}

// ---------------------------------------------------------------------
// 帳號
// ---------------------------------------------------------------------
function toUser(r: Row): UserRow {
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    isActive: r.is_active,
    mustChangePassword: r.must_change_password,
    lastLoginAt: iso(r.last_login_at),
    createdAt: iso(r.created_at)!,
  };
}

export async function listUsers(): Promise<UserRow[]> {
  const rows = await db()`select * from app.users order by is_active desc, role, created_at`;
  return rows.map(toUser);
}

export async function countUsers(): Promise<number> {
  const [r] = await db()`select count(*)::int as n from app.users`;
  return r?.n ?? 0;
}

export async function findUserForLogin(username: string) {
  const [r] = await db()`select id, password_hash, is_active from app.users where username = ${username}`;
  return r ? { id: r.id as string, passwordHash: r.password_hash as string, isActive: r.is_active as boolean } : null;
}

export async function getPasswordHash(userId: string): Promise<string | null> {
  const [r] = await db()`select password_hash from app.users where id = ${userId} and is_active`;
  return r?.password_hash ?? null;
}

export async function markLogin(userId: string): Promise<void> {
  await db()`update app.users set last_login_at = now() where id = ${userId}`;
}

export async function createUser(
  actor: Actor | null,
  input: { username: string; displayName: string; role: 'admin' | 'editor'; passwordHash: string; mustChangePassword: boolean },
): Promise<UserRow> {
  return withActor(actor, async (tx) => {
    const [r] = await tx`
      insert into app.users (username, display_name, role, password_hash, must_change_password)
      values (${input.username}, ${input.displayName}, ${input.role}, ${input.passwordHash}, ${input.mustChangePassword})
      returning *`;
    return toUser(r!);
  });
}

export async function updateUser(actor: Actor, id: string, patch: { displayName?: string; role?: 'admin' | 'editor'; isActive?: boolean }) {
  await withActor(actor, async (tx) => {
    const res = await tx`
      update app.users set
        display_name = coalesce(${patch.displayName ?? null}, display_name),
        role = coalesce(${patch.role ?? null}, role),
        is_active = coalesce(${patch.isActive ?? null}, is_active)
      where id = ${id}
      returning id`;
    if (res.length === 0) throw new HttpError(404, '找不到這個帳號');
  });
}

export async function setPassword(actor: Actor, userId: string, passwordHash: string, mustChange: boolean): Promise<void> {
  await withActor(actor, async (tx) => {
    const res = await tx`
      update app.users set password_hash = ${passwordHash}, must_change_password = ${mustChange}
      where id = ${userId} returning id`;
    if (res.length === 0) throw new HttpError(404, '找不到這個帳號');
  });
}

// ---------------------------------------------------------------------
// 匯入 / 匯出
// ---------------------------------------------------------------------
export async function exportAll() {
  const [settings, entries] = await Promise.all([
    getSettings(),
    db()`select * from app.entries where deleted_at is null order by entry_date, created_at`,
  ]);
  return {
    format: 'online-contact-book/v3',
    exportedAt: new Date().toISOString(),
    classTitle: settings.classTitle,
    announcement: settings.announcement,
    records: entries.map((r) => ({
      id: r.legacy_id ?? r.id,
      date: r.entry_date,
      category: r.category,
      subject: r.subject,
      title: r.title,
      details: r.details,
      dueDate: r.due_date ?? '',
      priority: r.priority,
    })),
  };
}

export type ImportRow = {
  legacyId: string;
  entryDate: DateStr;
  category: Category;
  subject: string;
  title: string;
  details: string;
  dueDate: DateStr | null;
  priority: 'normal' | 'high';
};

/** 把舊版的 records 轉成可以匯入的格式，格式不對的略過 */
export function normalizeLegacyRecords(records: Record<string, unknown>[]): { rows: ImportRow[]; skipped: number } {
  const rows: ImportRow[] = [];
  let skipped = 0;
  const seen = new Set<string>();
  records.forEach((r, i) => {
    const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
    const title = str(r.title).trim().slice(0, 200);
    const entryDate = str(r.date ?? r.entryDate ?? r.entry_date);
    let dueDate: string | null = str(r.dueDate ?? r.due_date) || null;
    if (!title || !isValidDateStr(entryDate) || (dueDate && !isValidDateStr(dueDate))) {
      skipped++;
      return;
    }
    if (dueDate && dueDate < entryDate) dueDate = null;
    const category = (CATEGORIES as readonly string[]).includes(str(r.category)) ? (str(r.category) as Category) : 'homework';
    const legacyId = (str(r.id) || `import:${entryDate}:${i}:${title}`).slice(0, 200);
    if (seen.has(legacyId)) {
      skipped++;
      return;
    }
    seen.add(legacyId);
    rows.push({
      legacyId,
      entryDate,
      category,
      subject: str(r.subject).trim().slice(0, 30),
      title,
      details: str(r.details).trim().slice(0, 2000),
      dueDate,
      priority: str(r.priority) === 'high' ? 'high' : 'normal',
    });
  });
  return { rows, skipped };
}

export async function importEntries(actor: Actor, rows: ImportRow[]): Promise<number> {
  return withActor(actor, async (tx) => {
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r) => ({
        legacy_id: r.legacyId,
        entry_date: r.entryDate,
        category: r.category,
        subject: r.subject,
        title: r.title,
        details: r.details,
        due_date: r.dueDate,
        priority: r.priority,
      }));
      const res = await tx`
        insert into app.entries ${tx(chunk, 'legacy_id', 'entry_date', 'category', 'subject', 'title', 'details', 'due_date', 'priority')}
        on conflict (legacy_id) do nothing
        returning id`;
      inserted += res.length;
    }
    return inserted;
  });
}
