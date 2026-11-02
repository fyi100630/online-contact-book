-- =====================================================================
-- 盤點目前 Supabase 裡有什麼（只讀，不會修改任何東西）
-- 在 SQL Editor 執行，可以看到哪些資料表、policy、函式是之前留下來的。
-- =====================================================================

-- 1. public schema 的資料表與大約筆數
select c.relname as 資料表,
       case c.relkind when 'r' then '資料表' when 'v' then '檢視' when 'm' then '實體化檢視' else c.relkind::text end as 類型,
       c.reltuples::bigint as 約略筆數,
       c.relrowsecurity as 已啟用RLS
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
order by c.relname;

-- 2. 所有 RLS policy（重點看 roles 有 anon / public、cmd 不是 SELECT 的）
select tablename as 資料表, policyname as policy, cmd as 動作, roles, qual as using條件, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;

-- 3. public schema 的函式（舊版 RPC 例如 secure_update_contact_book）
select p.proname as 函式, pg_get_function_identity_arguments(p.oid) as 參數,
       case when p.prosecdef then 'SECURITY DEFINER' else '' end as 權限模式
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;

-- 4. trigger
select event_object_table as 資料表, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
order by 1, 2;

-- 5. anon（未登入訪客）對哪些資料表有寫入權限
select table_name as 資料表, string_agg(privilege_type, ', ') as anon權限
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon'
group by table_name
order by table_name;
