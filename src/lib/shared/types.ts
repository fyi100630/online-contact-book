import type { DateStr } from './dates';

export const CATEGORIES = ['homework', 'exam', 'submission', 'reminder'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_META: Record<Category, { label: string; short: string }> = {
  homework: { label: '作業', short: '作業' },
  exam: { label: '考試、評量', short: '考試' },
  submission: { label: '繳交', short: '繳交' },
  reminder: { label: '提醒', short: '提醒' },
};

export type Role = 'admin' | 'editor';
export const ROLE_LABEL: Record<Role, string> = { admin: '管理員', editor: '幹部與小老師' };

/** 公開看得到的事項欄位（不含任何帳號資訊） */
export type PublicEntry = {
  id: string;
  entryDate: DateStr;
  category: Category;
  subject: string;
  title: string;
  details: string;
  dueDate: DateStr | null;
  priority: 'normal' | 'high';
};

/** 幹部與小老師在後台看到的事項（多了版本與編輯者資訊） */
export type ManagedEntry = PublicEntry & {
  version: number;
  createdAt: string;
  createdByName: string | null;
  updatedAt: string;
  updatedByName: string | null;
  deletedAt?: string | null;
  deletedByName?: string | null;
};

export type BoardData = {
  classTitle: string;
  announcement: string;
  announcementUpdatedAt: string | null;
  today: DateStr;
  date: DateStr;
  entries: PublicEntry[];
  week: { date: DateStr; count: number }[];
  /** 週一到週五 × 第 1～10 節；還沒設定課表（或資料庫還沒升級）時是 null */
  timetable: Timetable | null;
  version: string;
};

/** 課表：schedule[0] 是週一，schedule[0][0] 是週一第 1 節。空字串＝沒排課 */
export type Timetable = string[][];
export const TIMETABLE_DAYS = 5;
export const TIMETABLE_PERIODS = 10;
export const TIMETABLE_CELL_MAX = 10;

/** 某天（YYYY-MM-DD 的 weekday 0=日）的課；週末回傳 null */
export function classesOn(timetable: Timetable | null, wd: number): string[] | null {
  if (!timetable || wd < 1 || wd > 5) return null;
  return timetable[wd - 1] ?? null;
}

export type TimetableData = { schedule: Timetable; updatedAt: string | null; updatedByName: string | null };

export type InstallStats = {
  total: number;
  active30d: number;
  versions: { version: string; total: number; active30d: number }[];
};

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
};

export type UserRow = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type AuditRow = {
  id: string;
  at: string;
  actorName: string;
  entity: 'entry' | 'settings' | 'user' | 'timetable';
  entityId: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

/** 登入限流的門檻（伺服器判斷與後台說明共用同一份數字） */
export const LOGIN_LIMITS = {
  /** 同一帳號 15 分鐘內錯幾次就暫停 15 分鐘 */
  accountShort: 5,
  /** 同一個 IP 15 分鐘內錯幾次就暫停 15 分鐘 */
  ipShort: 20,
  /** 同一帳號 24 小時內錯幾次就暫停到失敗紀錄滿 24 小時（或管理員解鎖） */
  accountDay: 20,
  /** 同一個 IP 24 小時內錯幾次就暫停到失敗紀錄滿 24 小時（或管理員解鎖） */
  ipDay: 100,
} as const;

/** 目前的鎖定狀態：day＝24 小時鎖定、short＝15 分鐘鎖定 */
export type LockState = 'day' | 'short' | null;

export type LoginActivityAccount = {
  username: string;
  /** 這個帳號名稱是否真的存在（機器人常亂猜不存在的帳號） */
  exists: boolean;
  fails7d: number;
  fails24h: number;
  /** 從幾個不同的 IP 試過 */
  ips: number;
  lastAt: string;
  lock: LockState;
};

export type LoginActivityIp = {
  ip: string;
  fails7d: number;
  fails24h: number;
  /** 試過幾個不同的帳號 */
  accounts: number;
  lastAt: string;
  lock: LockState;
};

export type LoginActivitySummary = {
  fails24h: number;
  accounts24h: number;
  ips24h: number;
  lockedAccounts: number;
  blockedIps: number;
};

export type LoginSuccess = {
  at: string;
  username: string;
  displayName: string | null;
  ip: string | null;
  /** 登入時的 User-Agent（瀏覽器或 App 自報的裝置），不知道時是 null */
  userAgent: string | null;
  /** 這個 IP 最近 7 天也試過 3 個以上不同帳號且失敗（像機器人），值得注意 */
  suspicious: boolean;
};

export type LoginActivity = LoginActivitySummary & {
  /** 最近 7 天成功登入（新的在前） */
  logins: LoginSuccess[];
  /** 伺服器有沒有設定 Discord 通知（DISCORD_WEBHOOK_URL） */
  notifyConfigured: boolean;
  accounts: LoginActivityAccount[];
  ips: LoginActivityIp[];
};
