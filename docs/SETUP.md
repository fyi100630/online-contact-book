# 上線步驟

全部在 Supabase、Vercel 的網頁上操作即可，大約 20 分鐘。

> **會用到兩個隨機字串**：
>
> 1. **資料庫密碼**：第 2 步會由資料庫自動產生，不用自己想。
> 2. **設定碼 SETUP_TOKEN**：建立第一位管理員時用一次，至少 24 個字元。
>
> 這兩個值只會存在 Supabase 和 Vercel 的設定裡，**不要**寫進程式碼或 commit 到 GitHub。

---

## 1. 舊系統：備份、鎖起來、Android 顯示維護中

在**舊的** Supabase 專案（目前 Android App 連的那個）→ SQL Editor：

1. （選擇性）執行 [`db/legacy/00_inspect.sql`](../db/legacy/00_inspect.sql)，看看裡面有什麼。
2. 執行 [`db/legacy/01_legacy_lockdown.sql`](../db/legacy/01_legacy_lockdown.sql)。它會：
   - 把舊資料完整備份到 `legacy_backup`
   - 關掉所有寫入權限，包括舊的 RPC 函式
   - 把公告改成「App 版維護中，請改用網頁版」。Android App 打開後只會看到這則公告，也不能寫入
3. 執行檔案最下面註解裡的「匯出 JSON」查詢，把結果整格複製、存成 `舊資料.json`，第 6 步會用到。
   如果事項數是 0（資料已經不見），改用 `contact_book_logs` 那段，挑一筆事項數最多的快照。

## 2. 新資料庫

**建議開一個新的 Supabase 專案**，跟舊的雜亂資料完全分開。用舊專案也可以，新版資料都放在獨立的 `app` schema，不會互相影響。

1. 建立專案。區域選離台灣近的（Tokyo `ap-northeast-1` 或 Singapore `ap-southeast-1`）。
2. SQL Editor → 貼上 [`db/schema.sql`](../db/schema.sql) 整份執行。
3. 再開一個新查詢，貼上 [`db/set-app-password.sql`](../db/set-app-password.sql) 執行。
   它會隨機產生網站專用帳號的密碼並顯示在下方，**只顯示這一次**，請立刻複製到記事本或密碼管理器。

4. 組出連線網址：Supabase 專案上方的 **Connect** → **Transaction pooler**，會看到類似：

   ```
   postgresql://postgres.abcdefghijkl:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
   ```

   把開頭的 `postgres.` 改成 `contactbook_app.`，`[YOUR-PASSWORD]` 換成第 3 步的密碼：

   ```
   postgresql://contactbook_app.abcdefghijkl:你的資料庫密碼@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
   ```

   > 網站只用 `contactbook_app` 這個權限很小的帳號連線：它不能刪除事項，也不能修改紀錄。
   > 不要改用 `postgres` 帳號的連線網址。

## 3. Vercel 設定

在 Vercel 專案 → **Settings**：

1. **Environment Variables** 新增（Environment 勾 Production 和 Preview）：

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | 第 2 步組出來的連線網址 |
   | `SETUP_TOKEN` | 設定碼：在 Supabase SQL Editor 執行 `select replace(gen_random_uuid()::text, '-', '');` 產生 |

   這兩個**不要**加 `NEXT_PUBLIC_` 前綴，加了就會被送到瀏覽器。

2. **Build and Deployment → Framework Preset** 確認是 **Next.js**（`vercel.json` 已經指定，通常會自動套用）。
3. **Functions → Function Region**：選跟 Supabase 同一個區域（例如 Tokyo `hnd1`），速度會快很多。

## 4. 部署

把這個分支合併到 `main`，Vercel 會自動部署。部署完成後打開網站，應該會看到空白的聯絡簿。

## 5. 建立第一位管理員

1. 打開 `https://你的網址/setup`
2. 輸入設定碼、你的帳號、顯示名稱、密碼（最多 128 個字元，不限制格式）
3. 建立後會自動登入後台

建立完成後 `/setup` 會永久失效（顯示 404）。保險起見，可以回 Vercel 把 `SETUP_TOKEN` 刪掉。

## 6. 匯入舊資料

後台 → **備份與匯入** → 選第 1 步存的 `舊資料.json` → 確認筆數 → **開始匯入**。
同一個檔案重複匯入不會產生重複的事項。

## 7. 建立幹部與小老師的帳號

後台 → **帳號管理** → **新增帳號**：

- 填顯示名稱和登入帳號，選「幹部與小老師」或「管理員」
- 系統會產生一組臨時密碼，**只顯示這一次**，請私下交給本人（不要貼在群組）
- 對方第一次登入時必須改成自己的密碼

---

## 日常管理

| 想做的事 | 在哪裡 |
| --- | --- |
| 新增幹部或小老師 | 帳號管理 → 新增帳號 |
| 忘記密碼 | 帳號管理 → 重設密碼（會產生新的臨時密碼，對方的所有裝置都會被登出） |
| 卸任 | 帳號管理 → 停用（立刻登出，紀錄保留） |
| 看誰改了什麼 | 修改紀錄 |
| 誤刪的事項 | 垃圾桶 → 還原 |
| 改錯了想復原 | 修改紀錄 → 還原成修改前 |
| 備份 | 備份與匯入 → 下載 JSON 備份（建議每月一次） |
| 懷疑密碼外洩 | 我的帳號 → 修改密碼（其他裝置會自動登出） |

## 本機開發

```bash
cp .env.example .env.local   # 填入本機資料庫連線（DATABASE_SSL=disable）
npm ci
npm run dev
```

檢查指令：`npm run typecheck`、`npm test`、`npm run build && npm run check:bundle`。
安全性測試：啟動伺服器後執行 `BASE=http://localhost:3000 SETUP_TOKEN=... node --test tests/e2e/security.test.mjs`（需要空的資料庫）。
