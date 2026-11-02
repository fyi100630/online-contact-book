-- =====================================================================
-- 從「舊的」Supabase 匯出課表，產生要在「新的」Supabase 執行的 SQL
-- ---------------------------------------------------------------------
-- 用法：
--   1. 舊的 Supabase 專案（網址含 bcddawmffqadxevuwegf）→ SQL Editor → 整份貼上執行。
--      只讀，不會修改舊資料庫。
--   2. 結果只有一格，是一行 `update app.timetable ...`，整格複製。
--   3. 新的 Supabase 專案 → SQL Editor → 貼上執行。
--      （要先跑過 db/migrations/001_timetable_installations.sql）
--
-- 舊 App 把課表存成 { "1": [第1~10節], ..., "5": [...] }，每格是「科目」或「科目|簡稱」。
-- 這裡會自動在 public 和 legacy_backup 裡找含有這種資料的欄位，
-- 只保留科目全名（新版只顯示全名），每格最多 10 個字。
-- =====================================================================

create or replace function pg_temp.cb_export_timetable() returns text
language plpgsql as $$
declare
  col record;
  v jsonb;
  found jsonb;
  source text;
  days jsonb := '[]'::jsonb;
  periods jsonb;
  cell text;
  tried text := '';
begin
  for col in
    select c.table_schema as s, c.table_name as t, c.column_name as c
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema in ('public', 'legacy_backup')
      and c.data_type in ('json', 'jsonb')
      and tb.table_type = 'BASE TABLE'
    -- 先找 public、名字像課表的欄位
    order by (c.table_schema = 'public') desc,
             (c.table_name ilike '%timetable%' or c.column_name in ('schedule', 'timetable')) desc,
             c.table_name, c.column_name
  loop
    begin
      execute format(
        'select x from (select (%1$I)::jsonb as x from %2$I.%3$I) q
          where jsonb_typeof(x) = ''object''
            and (x ? ''schedule'' or (x ? ''1'' and x ? ''5''))
          limit 1',
        col.c, col.s, col.t) into v;
    exception when others then
      v := null;
    end;
    tried := tried || format('%s.%s.%s ', col.s, col.t, col.c);
    if v is not null then
      found := case when v ? 'schedule' then v -> 'schedule' else v end;
      if jsonb_typeof(found) = 'object' and found ? '1' then
        source := format('%s.%s 的 %s 欄位', col.s, col.t, col.c);
        exit;
      end if;
      found := null;
    end if;
  end loop;

  if found is null then
    return '找不到課表。已檢查：' || tried;
  end if;

  for d in 1..5 loop
    periods := '[]'::jsonb;
    for p in 0..9 loop
      cell := coalesce(found -> d::text ->> p, '');
      cell := left(btrim(split_part(cell, '|', 1)), 10);
      periods := periods || to_jsonb(cell);
    end loop;
    days := days || jsonb_build_array(periods);
  end loop;

  return format('update app.timetable set schedule = %L::jsonb where id = 1;  -- 來源：舊資料庫 %s',
                days::text, source);
end $$;

select pg_temp.cb_export_timetable() as "複製這一格，到新的 Supabase 執行";
