import 'server-only';
import postgres from 'postgres';

type Sql = ReturnType<typeof postgres>;
export type Tx = postgres.TransactionSql;

const globalForDb = globalThis as unknown as { __cbSql?: Sql };

export function db(): Sql {
  if (globalForDb.__cbSql) return globalForDb.__cbSql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = postgres(url, {
    // Supabase 的 transaction pooler（port 6543）不支援 prepared statements
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require',
    // date 欄位保持 'YYYY-MM-DD' 字串，不要轉成 JS Date（會有時區位移）
    types: {
      date: {
        to: 1082,
        from: [1082],
        serialize: (x: string) => x,
        parse: (x: string) => x,
      },
    },
    onnotice: () => {},
  });
  globalForDb.__cbSql = sql;
  return sql;
}

export type Actor = { id: string; name: string; ip: string };

/**
 * 在交易中執行，並告訴資料庫「是誰在操作」，讓 trigger 寫入修改紀錄。
 * set_config 的第三個參數 true = 只在這個交易有效，不會汙染連線池裡的其他請求。
 */
export async function withActor<T>(actor: Actor | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const result = await db().begin(async (tx) => {
    if (actor) {
      await tx`select
        set_config('app.actor_id', ${actor.id}, true),
        set_config('app.actor_name', ${actor.name}, true),
        set_config('app.actor_ip', ${actor.ip}, true)`;
    }
    return fn(tx);
  });
  return result as T;
}
