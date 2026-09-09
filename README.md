# 📖 線上班級聯絡簿 (Online Contact Book)

一個輕量、現代、極速且免伺服器維護的**線上班級聯絡簿**系統。完美支援手機與電腦瀏覽（RWD），採用 **Vercel + Supabase + GitHub** 現代雲端黃金架構。

---

## 🏗️ 系統架構分工

| 角色 | 服務 | 職責 | 優勢 |
| :--- | :--- | :--- | :--- |
| **程式碼倉庫** | **GitHub** | 存放前端網頁原始碼（HTML、JS、CSS）與版本控制 | 乾淨規範，不再將每日資料混入代碼歷史。 |
| **網頁託管** | **Vercel** | 全球高速 CDN 託管、自動 SSL、自訂網域 | 只要推送程式碼到 GitHub，數秒內自動完成發布（CI/CD）。 |
| **雲端資料庫** | **Supabase** | 雲端 PostgreSQL 資料庫、RLS 安全策略、即時推播 | 毫秒級儲存，並支援 **Realtime 即時同步**，老師發布後全體家長畫面瞬間自動更新！ |

---

## ✨ 核心特色

1. **四大分類清楚條列**：
   - 📝 **今日作業**：科目標籤、作業詳細內容、繳交期限。
   - 📋 **測驗考試**：科目、測驗範圍、考試節次或日期。
   - 📦 **繳交項目**：收費、重要回條、學用品、截止日期。
   - 📢 **提醒事項**：作息變動、重要公告、全校活動、攜帶物品。
2. **雙層通行密碼機制（無須註冊繁瑣帳號）**：
   - 👑 **管理員**：可修改置頂班級公告、修改班級名稱、調整密碼與 Supabase 雲端設定。
   - ✏️ **一般編輯通行**：可新增、修改、刪除四大分類項目，並發布儲存至雲端。
   - 👁️ **一般訪客（免密碼）**：學生與家長純閱覽、切換日期、複製 LINE 群組文字、友善列印。
3. **⚡ 雲端即時同步 (Supabase Realtime)**：
   - 支援多人協同、毫秒級存檔。
   - 老師或幹部在任何裝置發布後，其他已開啟網頁的家長手機**無須重新整理**即可即時看到最新項目！
4. **📅 跨期截止日智慧倒數**：
   - 設定截止日為多天後（如 3 天後）的作業或回條，期間內的每日聯絡簿都會自動跨日顯示。
   - 當天會以鮮紅 `🚨 今日截止` 強烈提醒；進行中會標註 `⏳ 期限至 YYYY-MM-DD（剩 X 天）`。
5. **貼心工具**：
   - 📱 **一鍵複製 LINE 格式**：自動轉成適合貼入班級家長群組的整齊條列文字。
   - 🖨️ **友善列印**：一鍵輸出乾淨美觀的 A4 紙本或轉存 PDF。

---

## 🚀 5 分鐘快速上線教學 (Supabase + GitHub + Vercel)

### 步驟 1：建立 Supabase 雲端資料庫（免費）
1. 前往 [Supabase 官網](https://supabase.com/) 註冊/登入帳號。
2. 點擊 **「New project」**，輸入專案名稱（如 `contact-book`），設定資料庫密碼並選擇地區。
3. 建立完成後，點選左側選單的 **「SQL Editor」**。
4. 點選 **「New query」**，將專案中的 [`supabase_schema.sql`](supabase_schema.sql) 內容完整貼上，點擊右下角 **「Run」** 執行（顯示 Success 即代表資料表與權限已自動建置完畢）。
5. 點選左側齒輪 **「Project Settings」** -> **「API」**：
   - 複製 **Project URL**（專案網址）
   - 複製 **Project API Keys** 中的 **anon / public** 金鑰。

> 💡 **快速配置**：
> 可以將這兩組資訊填入專案內的 [`js/config.js`](js/config.js) 檔案中；或者在網站部署好後，登入管理員後台點擊「⚙️ 密碼／同步設定」直接在網頁上填入並保存。

---

### 步驟 2：推送到 GitHub 倉庫
1. 在 [GitHub](https://github.com/) 建立一個新的公開或私人儲存庫（如 `online-contact-book`）。
2. 在本機專案目錄執行：
   ```bash
   git init
   git add .
   git commit -m "feat: upgrade to Vercel and Supabase"
   git branch -M main
   git remote add origin https://github.com/<你的GitHub帳號>/online-contact-book.git
   git push -u origin main
   ```

---

### 步驟 3：在 Vercel 一鍵發布
1. 前往 [Vercel 官網](https://vercel.com/) 登入（直接使用 GitHub 帳號登入最方便）。
2. 點擊 **「Add New...」** -> **「Project」**。
3. 在 GitHub 倉庫清單中找到剛才建立的 `online-contact-book`，點擊 **「Import」**。
4. Framework Preset 保持預設，直接點擊 **「Deploy」**！
5. 約 10~20 秒部署完成，Vercel 會為您產生一個專屬的高速 HTTPS 網址（如 `https://online-contact-book.vercel.app`）。

---

## 🔑 進入編輯／管理模式的方式

### 方法 1：點擊網頁上的「🔒 編輯登入」
- 輸入密碼解鎖**管理員模式**（可改公告與系統設定）。
- 輸入密碼解鎖**一般編輯通行**（可新增/編輯/刪除項目）。

### 方法 2：使用免輸入密碼的專屬秘密網址
- **管理員專用網址**：`https://你的網站.vercel.app/#180156`
- **編輯者專用網址**：`https://你的網站.vercel.app/#6830`

> 💡 老師可將管理員網址加入手機主畫面或瀏覽器書籤；編輯者網址可私下傳給協助登錄項目的小老師或班級幹部。

---

## 💻 本地測試預覽

在專案目錄下啟動任意本地伺服器即可直接測試：

```bash
# 使用 Python 內建伺服器
python -m http.server 8000
```
開啟 `http://localhost:8000` 即可預覽。
- 尚未連線 Supabase 時，系統會自動切換為本機示範模式，讀取 `data/records.json`。
- 輸入 Supabase URL 與 Key 後，點擊「測試連線」，確認無誤後即可體驗完整的雲端同步！
