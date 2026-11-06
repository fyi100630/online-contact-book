import { z } from 'zod';
import { isValidDateStr } from './dates';
import { CATEGORIES, TIMETABLE_CELL_MAX, TIMETABLE_DAYS, TIMETABLE_PERIODS } from './types';

const dateStr = z.string().refine(isValidDateStr, '日期格式不正確');
const trimmed = (max: number) => z.string().trim().max(max, `最多 ${max} 個字`);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,31}$/, '帳號只能用小寫英文、數字和 . _ -，長度 3～32 字，開頭要是英文或數字');

// 密碼不限制字元種類與最短長度，只要求不能是空的，並設定上限避免超長輸入。
export const passwordSchema = z
  .string()
  .min(1, '請輸入密碼')
  .max(128, '密碼最多 128 個字元');

export const displayNameSchema = trimmed(30).min(1, '請輸入名稱');

export const entryInputSchema = z
  .object({
    entryDate: dateStr,
    category: z.enum(CATEGORIES),
    subject: trimmed(30).default(''),
    title: trimmed(200).min(1, '請輸入內容'),
    details: trimmed(2000).default(''),
    dueDate: dateStr.nullable().default(null),
    priority: z.enum(['normal', 'high']).default('normal'),
  })
  .strict()
  .refine((v) => !v.dueDate || v.dueDate >= v.entryDate, { message: '截止日不能早於登記日', path: ['dueDate'] });
export type EntryInput = z.infer<typeof entryInputSchema>;

export const entryUpdateSchema = z
  .object({
    version: z.number().int().positive(),
    entry: entryInputSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    username: z.string().trim().toLowerCase().min(1).max(64),
    password: z.string().min(1).max(256),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((v) => v.currentPassword !== v.newPassword, { message: '新密碼不能和目前的密碼相同', path: ['newPassword'] });

export const settingsSchema = z
  .object({
    classTitle: trimmed(40).min(1, '請輸入班級名稱'),
    announcement: z.string().max(2000, '公告最多 2000 字').transform((s) => s.trim()),
  })
  .strict();

export const createUserSchema = z
  .object({
    username: usernameSchema,
    displayName: displayNameSchema,
    role: z.enum(['admin', 'editor']),
  })
  .strict();

export const updateUserSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    role: z.enum(['admin', 'editor']).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const setupSchema = z
  .object({
    token: z.string().min(1).max(512),
    username: usernameSchema,
    displayName: displayNameSchema,
    password: passwordSchema,
  })
  .strict();

export const timetableSchema = z
  .object({
    schedule: z
      .array(
        z
          .array(z.string().trim().max(TIMETABLE_CELL_MAX, `每一節的科目最多 ${TIMETABLE_CELL_MAX} 個字`))
          .length(TIMETABLE_PERIODS, `每天要有 ${TIMETABLE_PERIODS} 節`),
      )
      .length(TIMETABLE_DAYS, `課表要有週一到週五 ${TIMETABLE_DAYS} 天`),
  })
  .strict();

export const APP_VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
export const installationSchema = z
  .object({
    installId: z.uuid('安裝 ID 格式不正確'),
    appVersion: z.string().regex(APP_VERSION_RE, '版本格式不正確'),
  })
  .strict();

/** 舊版網頁匯出的 JSON（或 v3 匯出的 JSON） */
export const legacyImportSchema = z.object({
  classTitle: z.string().max(200).optional(),
  announcement: z.string().max(5000).optional(),
  records: z.array(z.record(z.string(), z.unknown())).max(20000),
});

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? '資料格式不正確';
}

/** 管理員解除登入鎖定：指定帳號或 IP 其中一個 */
export const unlockSchema = z.union([
  z.object({ username: z.string().trim().toLowerCase().min(1).max(64) }).strict(),
  z.object({ ip: z.string().trim().min(1).max(64) }).strict(),
]);
