-- =====================================================================
-- 舊版（v1）資料庫：備份 + 鎖定 + 讓 Android App 顯示「維護中」
-- ---------------------------------------------------------------------
-- 在「舊的」Supabase 專案 SQL Editor 整份執行（就是目前 Android App 與舊網頁連的那個）。
--
-- 這份腳本會依序做：
--   1. 把 contact_book / contact_book_logs / app_installations 完整複製到 legacy_backup schema
--      （legacy_backup 不會透過 API 對外開放，只有你在 SQL Editor 看得到）
--   2. 拿掉舊資料表上所有「寫入」用的 RLS policy，並收回 anon / authenticated 的寫入權限
--   3. 收回舊版 RPC 函式（secure_verify_password、secure_update_contact_book 等）的執行權限
--   4. 把 contact_book 的公告改成維護中訊息、清空事項，Android App 打開後只會看到維護公告
--
-- 可以重複執行。第一次執行的備份不會被覆蓋。
-- 執行後舊網頁與 Android App 都無法再寫入任何資料。
-- 如果新網頁網址不是 https://online-contact-book.vercel.app，請先修改第 4 段的 v_url。
-- 完整步驟見 docs/SETUP.md。
-- =====================================================================

create schema if not exists legacy_backup;
revoke all on schema legacy_backup from public, anon, authenticated;

-- 1. 備份 ---------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['contact_book', 'contact_book_logs', 'app_installations'] loop
    if to_regclass('public.' || t) is not null
       and to_regclass('legacy_backup.' || t) is null then
      execute format('create table legacy_backup.%I as table public.%I', t, t);
      raise notice '已備份 public.% → legacy_backup.%', t, t;
    end if;
  end loop;
end $$;

-- 舊版的 72 小時自動清除歷史紀錄 trigger 會把證據刪掉，先停用
do $$
begin
  if to_regclass('public.contact_book_logs') is not null then
    execute 'drop trigger if exists trigger_prune_contact_book_logs on public.contact_book_logs';
  end if;
end $$;

-- 2. 拿掉舊資料表的寫入 policy、收回寫入權限 -----------------------------
--    （public schema 裡的所有資料表，包含不知道誰建的雜項表。新版資料在 app schema，不受影響）
do $$
declare
  p record;
  t record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and cmd <> 'SELECT'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    raise notice '已移除 policy：%.%', p.tablename, p.policyname;
  end loop;

  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
  loop
    execute format('revoke insert, update, delete, truncate on public.%I from public, anon, authenticated', t.relname);
    raise notice '已收回寫入權限：public.%', t.relname;
  end loop;

  -- 歷史紀錄、安裝統計可能有學生資料，不再公開讀取
  if to_regclass('public.contact_book_logs') is not null then
    execute 'revoke select on public.contact_book_logs from public, anon, authenticated';
  end if;
  if to_regclass('public.app_installations') is not null then
    execute 'revoke select on public.app_installations from public, anon, authenticated';
  end if;
end $$;

-- 3. 收回舊版 RPC 函式的執行權限 -----------------------------------------
--    （public schema 裡所有不屬於 extension 的函式）
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    raise notice '已收回執行權限：%', f.sig;
  end loop;
end $$;

-- 4. 維護中公告（Android App 讀得到，但不能寫） ----------------------------
do $$
declare
  v_url text := 'https://online-contact-book.vercel.app';  -- ← 如果網址不同，請改這裡
begin
  if to_regclass('public.contact_book') is not null then
    update public.contact_book
    set announcement = '⚠️ App 版維護中，暫停使用。請改用網頁版聯絡簿：' || v_url,
        records = '[]'::jsonb,
        updated_at = now();
    raise notice 'contact_book 已切換為維護中公告';
  end if;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
-- 執行完後，請另外執行下面這段，確認備份內容（不會修改任何資料）：
--
--   select id, class_title, jsonb_array_length(records) as 事項數, updated_at
--   from legacy_backup.contact_book;
--
--   select id, created_at, editor_role, summary, jsonb_array_length(records) as 事項數
--   from legacy_backup.contact_book_logs
--   order by created_at desc;
--
-- 匯出成網頁可匯入的 JSON（把結果整格複製，存成 .json 檔）：
--
--   select jsonb_pretty(jsonb_build_object(
--     'classTitle', class_title,
--     'announcement', announcement,
--     'records', records))
--   from legacy_backup.contact_book where id = 'default';
--
-- 如果 contact_book 已經被清空，可以改從某一筆歷史紀錄匯出（把 <log id> 換掉）：
--
--   select jsonb_pretty(jsonb_build_object(
--     'classTitle', class_title,
--     'announcement', announcement,
--     'records', records))
--   from legacy_backup.contact_book_logs where id = '<log id>';
-- =====================================================================
