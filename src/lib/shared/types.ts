import type { DateStr } from './dates';

export const CATEGORIES = ['homework', 'exam', 'submission', 'reminder'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_META: Record<Category, { label: string; short: string }> = {
  homework: { label: '作業', short: '作業' },
  exam: { label: '考試・評量', short: '考試' },
  submission: { label: '繳交', short: '繳交' },
  reminder: { label: '提醒', short: '提醒' },
};

export type Role = 'admin' | 'editor';
export const ROLE_LABEL: Record<Role, string> = { admin: '管理員', editor: '幹部' };

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

/** 幹部後台看到的事項（多了版本與編輯者資訊） */
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
  upcoming: PublicEntry[];
  version: string;
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
  entity: 'entry' | 'settings' | 'user';
  entityId: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};
