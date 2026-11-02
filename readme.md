# 線上班級聯絡簿

學生和家長不用登入就能依日期查看作業、考試、繳交與提醒；只有管理員建立的**幹部帳號**能登入後台編輯。

> 📱 Android App 目前維護中，請使用網頁版。

## 功能

**聯絡簿（公開）**
- 週曆切換日期，每天有幾件事一眼就看得到
- 依類別篩選，截止日倒數（明天截止、剩 3 天…）
- 「接下來兩週截止」時間軸
- 一鍵複製成 LINE 群組格式、列印
- 有人更新內容時自動重新整理
- 手機、平板、電腦都能用，支援深色模式

**管理後台（幹部）**
- 新增、編輯、刪除事項，搜尋與篩選
- 兩個人同時編輯同一個事項時，不會互相覆蓋
- 刪除的事項進垃圾桶，可以還原

**管理員**
- 帳號管理：建立帳號（系統產生臨時密碼）、重設密碼、停用、調整角色
- 公告與班級名稱
- 修改紀錄：誰在什麼時候改了什麼，可以一鍵還原，任何人都無法刪除紀錄
- 備份下載、匯入舊版資料

## 資安

前端不含任何資料庫連線資訊或金鑰。密碼用 scrypt 雜湊，session 用 HttpOnly cookie，並有 CSP nonce、CSRF 防護、登入次數限制。資料庫層也有最小權限和不可竄改的修改紀錄。詳見 **[docs/SECURITY.md](docs/SECURITY.md)**。

## 上線

照著 **[docs/SETUP.md](docs/SETUP.md)** 做即可。

## 技術

Next.js 16（App Router）、React 19、TypeScript、PostgreSQL（Supabase）、`postgres`、`zod`。部署在 Vercel。

```
src/app/            頁面與 API（api/ 底下每支都在伺服器端驗證身分）
src/components/     介面元件
src/lib/server/     只在伺服器執行：資料庫、密碼、session、權限
src/lib/shared/     前後端共用：日期、型別、輸入驗證
src/proxy.ts        CSP、安全標頭、CSRF 檢查
db/schema.sql       資料庫結構、權限、修改紀錄 trigger
db/legacy/          舊版資料庫的備份與鎖定腳本
tests/              單元測試、API 安全測試、瀏覽器端到端測試
```
