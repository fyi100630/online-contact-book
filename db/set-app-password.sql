-- 幫網站伺服器專用的資料庫帳號 contactbook_app 產生一組隨機密碼。
-- 在 Supabase SQL Editor 執行（要先執行過 schema.sql）。
-- 密碼是在資料庫裡隨機產生的，不會出現在這段文字裡，也不會留在 SQL Editor 的歷史紀錄中。
-- 執行後下方會顯示密碼，只顯示這一次，請立刻複製保存。之後要換密碼，再執行一次即可。

create temp table _pw as
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as pw;

do $$
begin
  execute format('alter role contactbook_app login password %L', (select pw from _pw));
end $$;

select pw as "資料庫密碼（請複製）" from _pw;
