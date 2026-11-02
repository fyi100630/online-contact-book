-- =====================================================================
-- 001：課表＋App 安裝統計
-- ---------------------------------------------------------------------
-- 給「已經跑過 db/schema.sql 的新資料庫」用。在 Supabase SQL Editor 整份執行，
-- 可以重複執行。（db/schema.sql 也已經包含這些，新建資料庫不用另外跑。）
-- =====================================================================

-- ---------------------------------------------------------------------
-- 課表（只有一列）：schedule = 週一到週五 × 第 1～10 節，例如
--   [["國語文","英語文",...10 個], [...週二], [...週三], [...週四], [...週五]]
-- 空字串＝那一節沒排課。只有管理員能改（伺服器端檢查）。
-- ---------------------------------------------------------------------
create table if not exists app.timetable (
  id         int primary key default 1 check (id = 1),
  schedule   jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users (id) on delete set null,
  constraint timetable_shape check (
    jsonb_typeof(schedule) = 'array' and jsonb_array_length(schedule) = 5
  )
);

-- 預設值：舊 App 內建的 411 班課表，之後到後台「課表」修改
insert into app.timetable (id, schedule) values (1, '[
  ["國語文","英語文","數學","物理","化學","生物","歷史","地理","公民","自習"],
  ["數學","國語文","英語文","體育","資訊","美術","音樂","理化","輔導","自習"],
  ["英語文","數學","國語文","歷史","地理","體育","班會","團體活動","自習","自習"],
  ["國語文","物理","化學","英語文","數學","公民","體育","地科","輔導","自習"],
  ["數學","英語文","國語文","體育","生物","歷史","社團活動","彈性課程","自習","自習"]
]'::jsonb) on conflict (id) do nothing;

create or replace function app.timetable_before_update() returns trigger
language plpgsql as $$
begin
  new.id := old.id;
  new.updated_at := now();
  new.updated_by := app.current_actor_id();
  return new;
end $$;

drop trigger if exists timetable_before_update on app.timetable;
create trigger timetable_before_update before update on app.timetable
for each row execute function app.timetable_before_update();

-- 課表變動也要讓聯絡簿畫面重新整理
drop trigger if exists timetable_bump_version on app.timetable;
create trigger timetable_bump_version after update on app.timetable
for each statement execute function app.bump_content_version();

-- 修改紀錄：加上 timetable
create or replace function app.write_audit() returns trigger
language plpgsql security definer set search_path = app, pg_temp as $$
declare
  v_entity text;
  v_action text;
  v_before jsonb;
  v_after  jsonb;
  v_ignore text[];
begin
  v_entity := case tg_table_name
    when 'entries' then 'entry'
    when 'settings' then 'settings'
    when 'timetable' then 'timetable'
    else 'user' end;
  v_ignore := array['updated_at', 'updated_by', 'version', 'content_version', 'last_login_at', 'password_changed_at'];

  if tg_op = 'INSERT' then
    v_action := 'create';
    v_after := to_jsonb(new) - 'password_hash';
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    if (v_before ->> 'password_hash') is distinct from (v_after ->> 'password_hash') then
      v_action := case when app.current_actor_id()::text = v_after ->> 'id' then 'password_change' else 'password_reset' end;
    elsif (v_before - v_ignore - 'password_hash') = (v_after - v_ignore - 'password_hash') then
      return null;  -- 只有系統欄位變動，不記錄
    elsif tg_table_name = 'entries' and v_before ->> 'deleted_at' is null and v_after ->> 'deleted_at' is not null then
      v_action := 'trash';
    elsif tg_table_name = 'entries' and v_before ->> 'deleted_at' is not null and v_after ->> 'deleted_at' is null then
      v_action := 'restore';
    else
      v_action := 'update';
    end if;
    v_before := v_before - 'password_hash';
    v_after := v_after - 'password_hash';
  else
    v_action := 'delete';
    v_before := to_jsonb(old) - 'password_hash';
  end if;

  insert into app.audit_log (actor_id, actor_name, ip, entity, entity_id, action, before, after)
  values (
    app.current_actor_id(),
    coalesce(nullif(current_setting('app.actor_name', true), ''), '系統'),
    nullif(current_setting('app.actor_ip', true), ''),
    v_entity,
    coalesce(v_after ->> 'id', v_before ->> 'id'),
    v_action,
    v_before,
    v_after
  );
  return null;
end $$;

drop trigger if exists timetable_audit on app.timetable;
create trigger timetable_audit after update on app.timetable
for each row execute function app.write_audit();

-- ---------------------------------------------------------------------
-- App 安裝統計：只存 App 自己產生的隨機安裝 ID（UUID）和版本，
-- 不存 IP、裝置型號或任何個人資料。
-- ---------------------------------------------------------------------
create table if not exists app.app_installations (
  install_id    uuid primary key,
  app_version   text not null check (app_version ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'),
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index if not exists app_installations_seen_idx on app.app_installations (last_seen_at);

-- ---------------------------------------------------------------------
-- 權限
-- ---------------------------------------------------------------------
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on app.timetable from %I', r);
      execute format('revoke all on app.app_installations from %I', r);
    end if;
  end loop;
end $$;

grant select, update         on app.timetable         to contactbook_app;
grant select, insert, update on app.app_installations to contactbook_app;
