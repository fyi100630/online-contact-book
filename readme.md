# 線上班級聯絡簿

以繁體中文打造的班級作業與通知看板。學生和家長可依日期查看每日事項；授權的編輯者可維護作業、考試、繳交項目和提醒。

**線上示範：** <https://online-contact-book.vercel.app>

## 功能

- 依日期瀏覽聯絡簿，快速切換前一天、今天、後一天或指定日期。
- 以作業、考試、繳交、提醒四種類別整理事項，並顯示截止日期與倒數資訊。
- 管理者可發布班級公告；編輯者可新增、修改及刪除聯絡簿項目。
- 將當日內容複製成適合貼到 LINE 群組的文字，或列印聯絡簿。
- 透過 Supabase Realtime 在多個裝置間同步更新，並提供 JSON 資料備份。
- 管理者可查看最近 72 小時的修改快照並還原版本。

## 使用技術

- HTML、CSS、原生 JavaScript
- Vue 3、Tailwind CSS，透過 CDN 載入
- Supabase JavaScript Client v2、PostgreSQL、Realtime
- Vercel 靜態網站部署

## 本機執行

不需要安裝 Node.js 套件或執行建置流程。從專案根目錄啟動靜態 HTTP 伺服器：

```bash
git clone https://github.com/fyi100630/online-contact-book.git
cd online-contact-book
python3 -m http.server 8000
```

接著開啟 <http://localhost:8000>。頁面需要連網載入 CDN 套件。`js/config.js` 目前設有此專案的 Supabase 預設連線資訊；若要自架，請換成自己的 Supabase URL 與 anon/public key。若未設定 Supabase，頁面會使用 `data/records.json` 作為唯讀資料來源，變更不會儲存。透過本機伺服器開啟頁面，才能正常載入 JSON 備援資料。

## Supabase 設定

1. 建立 Supabase 專案。
2. 在 Supabase SQL Editor 執行 [`supabase_schema.sql`](supabase_schema.sql)，建立聯絡簿與歷史紀錄資料表。
3. 在應用程式的「密碼／同步設定」填入 Supabase Project URL 與 anon/public key；自架版本也可調整 [`js/config.js`](js/config.js) 的預設連線設定。
4. 若要啟用登入驗證及雲端儲存，還需在資料庫建立前端所呼叫的 `secure_verify_password` 與 `secure_update_contact_book` RPC 函式。這兩個函式目前沒有包含在此 repository 的 SQL 檔案中。

## 部署至 Vercel

將 repository 匯入 Vercel，使用預設的靜態網站設定即可；專案沒有建置指令。部署前請先確認 `js/config.js` 指向預期使用的 Supabase 專案。

## 安全與資料

`supabase_schema.sql` 目前建立的 RLS policies 允許公開讀取，以及公開新增、修改聯絡簿資料；歷史紀錄也開放公開讀取、新增與刪除。前端密碼介面不能取代資料庫的存取控制。正式使用前，請依需求收緊 RLS policies，並確認 RPC 函式會在伺服器端驗證權限。請勿在瀏覽器程式碼中放入 Supabase `service_role` key，也不要將敏感的學生或家庭資料存入尚未完成權限設定的資料庫。

## 專案檔案

- `index.html`：頁面結構、樣式與 Vue 介面。
- `js/app.js`：日期瀏覽、項目編輯、公告、列印與畫面互動。
- `js/supabase-sync.js`：Supabase 存取、即時同步與 JSON 備份。
- `js/config.js`：瀏覽器端 Supabase URL 與 anon/public key 設定。
- `data/records.json`：Supabase 未連線時使用的唯讀備援資料。
- `supabase_schema.sql`：資料表、RLS policies、Realtime 與歷史紀錄清理設定。
