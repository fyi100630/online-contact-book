// 瀏覽器端唯一的資料通道：只呼叫同網域的 /api，不認識資料庫、也沒有任何金鑰。

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, '網路連線失敗，請檢查網路後再試', 'network');
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* 非 JSON 回應 */
  }
  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; code?: string };
    if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname.startsWith('/manage')) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    if (body.code === 'must_change_password' && typeof window !== 'undefined') {
      window.location.assign('/manage/account');
    }
    throw new ApiError(res.status, body.error || '發生錯誤，請稍後再試', body.code);
  }
  return data as T;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : '發生錯誤，請稍後再試');
