-- =====================================================================
-- 線上班級聯絡簿 v3 資料庫結構
-- ---------------------------------------------------------------------
-- 在 Supabase SQL Editor（或任何 PostgreSQL 14+）整份執行。可重複執行。
--
-- 安全設計：
--   * 所有資料放在獨立的 app schema。Supabase 的 anon / authenticated 角色
--     （也就是公開的 API 金鑰）對這個 schema 完全沒有權限，連讀都不行。
--   * 網站伺服器用專屬的 contactbook_app 角色連線，只有最低限度的權限：
--       - 不能刪除任何事項（只能標記為刪除＝垃圾桶）
--       - 不能寫入或修改修改紀錄（只能由資料庫 trigger 寫入）
--   * 修改紀錄不會記錄密碼雜湊。
-- =====================================================================

create schema if not exists app;
revoke all on schema app from public;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on schema app from %I', r);
      execute format('revoke all on all tables in schema app from %I', r);
      execute format('revoke all on all functions in schema app from %I', r);
      execute format('alter default privileges in schema app revoke all on tables from %I', r);
      execute format('alter default privileges in schema app revoke all on functions from %I', r);
    end if;
  end loop;
end $$;

-- 網站伺服器專用角色（密碼另外用 alter role 設定，見 docs/SETUP.md）
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'contactbook_app') then
    create role contactbook_app nologin;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 帳號
-- ---------------------------------------------------------------------
create table if not exists app.users (
  id                   uuid primary key default gen_random_uuid(),
  username             text not null,
  display_name         text not null,
  role                 text not null check (role in ('admin', 'editor')),
  password_hash        text not null,
  must_change_password boolean not null default true,
  is_active            boolean not null default true,
  password_changed_at  timestamptz not null default now(),
  last_login_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint users_username_format check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  constraint users_display_name_len check (char_length(display_name) between 1 and 30)
);
create unique index if not exists users_username_key on app.users (username);

create table if not exists app.sessions (
  token_hash   bytea primary key,           -- SHA-256(session token)；資料庫外洩也拿不到可用的 token
  user_id      uuid not null references app.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  ip           text,
  user_agent   text
);
create index if not exists sessions_user_idx on app.sessions (user_id);
create index if not exists sessions_expires_idx on app.sessions (expires_at);

create table if not exists app.login_attempts (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  username text not null,
  ip       text not null,
  success  boolean not null
);
create index if not exists login_attempts_user_idx on app.login_attempts (username, at);
create index if not exists login_attempts_ip_idx on app.login_attempts (ip, at);

-- ---------------------------------------------------------------------
-- 班級設定（只有一列）
-- ---------------------------------------------------------------------
create table if not exists app.settings (
  id                      int primary key default 1 check (id = 1),
  class_title             text not null default '班級聯絡簿' check (char_length(class_title) between 1 and 40),
  announcement            text not null default '' check (char_length(announcement) <= 2000),
  announcement_updated_at timestamptz,
  content_version         bigint not null default 1,   -- 任何內容變動就 +1，給前端判斷要不要重新整理
  updated_at              timestamptz not null default now(),
  updated_by              uuid references app.users (id) on delete set null
);
insert into app.settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 聯絡簿事項
-- ---------------------------------------------------------------------
create table if not exists app.entries (
  id         uuid primary key default gen_random_uuid(),
  entry_date date not null,
  category   text not null check (category in ('homework', 'exam', 'submission', 'reminder')),
  subject    text not null default '' check (char_length(subject) <= 30),
  title      text not null check (char_length(title) between 1 and 200),
  details    text not null default '' check (char_length(details) <= 2000),
  due_date   date,
  priority   text not null default 'normal' check (priority in ('normal', 'high')),
  version    int not null default 1,          -- 樂觀鎖：避免兩個人同時編輯互相覆蓋
  legacy_id  text unique,                     -- 從舊版匯入時的原始 id，避免重複匯入
  created_at timestamptz not null default now(),
  created_by uuid references app.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app.users (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references app.users (id) on delete set null,
  constraint entries_due_after_date check (due_date is null or due_date >= entry_date)
);
create index if not exists entries_date_idx on app.entries (entry_date) where deleted_at is null;
create index if not exists entries_due_idx on app.entries (due_date) where deleted_at is null;
create index if not exists entries_deleted_idx on app.entries (deleted_at) where deleted_at is not null;

-- ---------------------------------------------------------------------
-- 修改紀錄（append-only）
-- ---------------------------------------------------------------------
create table if not exists app.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid,
  actor_name text not null,
  ip         text,
  entity     text not null,   -- entry / settings / user
  entity_id  text not null,
  action     text not null,   -- create / update / trash / restore / password_reset / password_change / ...
  before     jsonb,
  after      jsonb
);
create index if not exists audit_log_at_idx on app.audit_log (id desc);
create index if not exists audit_log_entity_idx on app.audit_log (entity, entity_id);

-- ---------------------------------------------------------------------
-- Trigger：誰在操作（由伺服器在每個交易開頭 set_config 設定）
-- ---------------------------------------------------------------------
create or replace function app.current_actor_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.actor_id', true), '')::uuid
$$;

create or replace function app.entries_before_write() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := app.current_actor_id();
    new.version := 1;
    new.deleted_at := null;
    new.deleted_by := null;
  else
    new.id := old.id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.legacy_id := old.legacy_id;
    new.version := old.version + 1;
    if new.deleted_at is not null and old.deleted_at is null then
      new.deleted_at := now();
      new.deleted_by := app.current_actor_id();
    elsif new.deleted_at is null then
      new.deleted_by := null;
    else
      new.deleted_at := old.deleted_at;
      new.deleted_by := old.deleted_by;
    end if;
  end if;
  new.updated_at := now();
  new.updated_by := app.current_actor_id();
  new.title := btrim(new.title);
  new.subject := btrim(new.subject);
  new.details := btrim(new.details);
  return new;
end $$;

drop trigger if exists entries_before_write on app.entries;
create trigger entries_before_write before insert or update on app.entries
for each row execute function app.entries_before_write();

create or replace function app.bump_content_version() returns trigger
language plpgsql security definer set search_path = app, pg_temp as $$
begin
  update app.settings set content_version = content_version + 1 where id = 1;
  return null;
end $$;

drop trigger if exists entries_bump_version on app.entries;
create trigger entries_bump_version after insert or update or delete on app.entries
for each statement execute function app.bump_content_version();

create or replace function app.settings_before_update() returns trigger
language plpgsql as $$
begin
  if new.class_title is distinct from old.class_title or new.announcement is distinct from old.announcement then
    new.updated_at := now();
    new.updated_by := app.current_actor_id();
    if new.content_version = old.content_version then
      new.content_version := old.content_version + 1;
    end if;
  end if;
  if new.announcement is distinct from old.announcement then
    new.announcement_updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists settings_before_update on app.settings;
create trigger settings_before_update before update on app.settings
for each row execute function app.settings_before_update();

create or replace function app.users_before_update() returns trigger
language plpgsql security definer set search_path = app, pg_temp as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  if new.password_hash is distinct from old.password_hash then
    new.password_changed_at := now();
  end if;
  -- 至少保留一位啟用中的管理員
  if old.role = 'admin' and old.is_active and (new.role <> 'admin' or not new.is_active) then
    if not exists (select 1 from app.users where id <> old.id and role = 'admin' and is_active) then
      raise exception 'LAST_ADMIN' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists users_before_update on app.users;
create trigger users_before_update before update on app.users
for each row execute function app.users_before_update();

-- 修改紀錄
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

drop trigger if exists entries_audit on app.entries;
create trigger entries_audit after insert or update or delete on app.entries
for each row execute function app.write_audit();

drop trigger if exists settings_audit on app.settings;
create trigger settings_audit after update on app.settings
for each row execute function app.write_audit();

drop trigger if exists users_audit on app.users;
create trigger users_audit after insert or update or delete on app.users
for each row execute function app.write_audit();

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

-- 修改紀錄無論如何都不能被改或刪（就算是有權限的角色也一樣）
create or replace function app.audit_log_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;

drop trigger if exists audit_log_immutable on app.audit_log;
create trigger audit_log_immutable before update or delete on app.audit_log
for each row execute function app.audit_log_immutable();

-- ---------------------------------------------------------------------
-- contactbook_app 角色權限（最小權限）
-- ---------------------------------------------------------------------
revoke all on all tables in schema app from contactbook_app;
grant usage on schema app to contactbook_app;
grant select, insert, update          on app.users          to contactbook_app;
grant select, insert, update, delete  on app.sessions       to contactbook_app;
grant select, insert, delete          on app.login_attempts to contactbook_app;
grant select, insert, update          on app.settings       to contactbook_app;
grant select, insert, update          on app.entries        to contactbook_app;
grant select                          on app.audit_log      to contactbook_app;
grant select, update                  on app.timetable      to contactbook_app;
grant select, insert, update          on app.app_installations to contactbook_app;
grant execute on function app.current_actor_id() to contactbook_app;
