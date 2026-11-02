import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { firstError } from '@/lib/shared/validation';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

export function ok<T>(data: T, init?: { status?: number; headers?: Record<string, string> }) {
  return NextResponse.json(data, { status: init?.status ?? 200, headers: { ...NO_STORE, ...init?.headers } });
}

export function fail(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status, headers: NO_STORE });
}

/** 讀 JSON body，限制大小並用 zod 驗證 */
export async function readJson<S extends z.ZodType>(req: NextRequest, schema: S, maxBytes = 16 * 1024): Promise<z.output<S>> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) throw new HttpError(415, '格式錯誤');
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new HttpError(413, '資料太大');
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) throw new HttpError(413, '資料太大');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400, '格式錯誤');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, firstError(parsed.error), 'validation');
  return parsed.data;
}

export function clientIp(req: Request): string {
  // Vercel 會把真正的來源 IP 放在 x-real-ip / x-forwarded-for 第一個
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim().slice(0, 64);
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim().slice(0, 64);
  return 'unknown';
}

/** 把任何例外轉成安全的回應：不洩漏堆疊或資料庫錯誤細節 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message, err.code);
      const pgCode = (err as { code?: string })?.code;
      const pgMsg = (err as { message?: string })?.message;
      if (pgCode === 'P0001' && pgMsg === 'LAST_ADMIN') return fail(409, '至少要保留一位啟用中的管理員', 'last_admin');
      if (pgCode === '23505') return fail(409, '資料重複', 'duplicate');
      if (pgCode === '23514') return fail(400, '資料格式不正確', 'validation');
      console.error('[api] unexpected error', err);
      return fail(500, '伺服器發生錯誤，請稍後再試');
    }
  };
}
