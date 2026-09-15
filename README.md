# 📖 線上班級聯絡簿 (Online Class Contact Book)

> 專為班級導師、各科小老師、學生與家長設計的現代化數位聯絡簿。  
> 無須繁瑣編譯，零依賴開箱即用；支援即時雲端同步、作業截止倒數、版本歷史還原與紙本最佳化列印。

---

## 🌟 專案緣起

傳統紙本聯絡簿常遇到**漏抄作業、筆記遺失、進度無法及時讓家長掌握**等痛點；而使用通訊軟體記事本又容易被訊息洗版覆蓋。

**線上班級聯絡簿**提供乾淨優雅的單一入口，讓小老師與導師能即時登記作業與考試，全班同學與家長隨時掌握最新校園動態。採用 **液態毛玻璃（Liquid Glassmorphism）** 現代視覺美學，並透過 **Supabase Realtime** 達成全設備秒級自動更新！

---

## ✨ 功能特色

### 📝 1. 四大分類條目化管理
* **作業項目**：登記各科指派作業與繳交期限。
* **測驗考試**：明確標註考試科目、測驗日期與複習範圍。
* **繳交項目**：回條、費用、同意書等各項備忘叮嚀。
* **提醒事項**：活動集合、攜帶用品、校園日程等注意事項。

### ⏳ 2. 智慧截止日與倒數提醒
* 自動根據當前日期計算剩餘天數：
  * 🚨 **明日截止**：即時醒目標記與呼吸燈提示。
  * ⏳ **期限倒數**：清楚顯示「期限至 MM-DD（剩 X 天）」。
* **持續追蹤機制**：跨日作業在截止前均會持續保留於每日視圖中，避免學生遺忘。

### 📢 3. 置頂班級重大公告
* 導師可發布全班廣播通知。
* **超連結自動解析**：文字中的網址自動轉換為安全外跳連結（`target="_blank"`），並做好 HTML 跳脫防止 XSS 攻擊。

### ⚡ 4. 全設備毫秒級即時同步 (Supabase Realtime)
* 老師或幹部發布變更時，全體開啟網頁的家長與學生**無需手動重新整理**，畫面立即自動同步最新內容。

### 🕒 5. 72 小時版本歷史快照與時光機還原
* 每次發布變更均會自動留下歷史快照備份（保存於 `contact_book_logs` 資料表）。
* 管理員可隨時檢視過去 72 小時內所有修改版本，支援明細預覽與**一鍵無痛還原**。
* 資料庫內建觸發器（PostgreSQL Trigger）自動定時清理過期紀錄，不佔額外容量。

### 🔒 6. 雙層分級安全權限
* **訪客模式（家長）**：預設進入，僅供唯讀瀏覽，介面純淨無多餘按鈕。
* **✏️ 編輯者（所有學生/老師）**：透過專屬密碼解鎖，可新增、編輯與刪除日常項目。
* **👑 最高管理員（我）**：掌控置頂公告、歷史版本還原與密碼更迭。

### 🖨️ 7. 友善紙本列印與本機備份
* **列印最佳化（Print CSS）**：自動隱藏功能按鈕與動態光暈，排版整潔乾淨，方便列印黏貼或張貼公布欄。

---

## 🛠️ 技術架構

本專案堅持 **「Zero Build Tool」** 哲學，無需安裝 Node.js、npm 或任何打包工具即可運行：

| 領域 | 技術 / 函式庫 | 說明 |
| :--- | :--- | :--- |
| **前端核心** | [Vue 3](https://vuejs.org/) (Composition API) | 採用輕量 CDN 載入，反應式資料驅動 |
| **樣式與美學** | [Tailwind CSS](https://tailwindcss.com/) + Liquid Glass | 動態流體光暈背景與毛玻璃質感卡片 |
| **後端與資料庫** | [Supabase](https://supabase.com/) | PostgreSQL 關聯資料庫 + Realtime WebSocket 監聽 |
| **安全機制** | PostgreSQL Row Level Security (RLS) | 提供資料庫層級的讀寫保護規則 |
| **部署相容** | Vercel / GitHub Pages / Cloudflare | 任何靜態網頁託管平台皆可一秒部署 |

## ☁️ Supabase 雲端資料庫設定

若要啟用**多人跨設備即時同步**與**歷史快照還原**，請依序完成以下步驟（完全支援 Supabase 免費方案）：

### 步驟 1：建立 Supabase 專案
1. 註冊並登入 [Supabase 控制台](https://supabase.com/dashboard)。
2. 點擊 **New project**，輸入專案名稱（如 `class-contact-book`）並設定資料庫密碼，區域可選擇鄰近的 `Tokyo` 或 `Singapore`。

### 步驟 2：執行資料庫綱要腳本 (SQL Schema)
1. 進入 Supabase 左側選單的 **SQL Editor**。
2. 點擊 **New query**，將本專案目錄下的 [`supabase_schema.sql`](supabase_schema.sql) 內容完整複製並貼上。
3. 點擊右下角 **Run** 執行腳本。
   * 此腳本會自動建立 `contact_book` 與 `contact_book_logs` 資料表。
   * 自動開啟 Realtime 即時推播功能。
   * 自動建立 72 小時過期自動清理觸發器（Trigger）。

### 步驟 3：獲取連線金鑰
1. 前往 Supabase 專案設定：**Project Settings** -> **API**。
2. 複製以下兩個資訊：
   * **Project URL**（例如：`https://xxxxxxxxxxxx.supabase.co`）
   * **Project API Keys (anon / public)**

### 步驟 4：設定至聯絡簿中
你有兩種方式將金鑰綁定至聯絡簿：

* **方式一：直接在網頁端輸入（最便利）**
  1. 打開聯絡簿網頁，點擊右上角「**編輯登入**」。
  2. 輸入最高管理員密碼（預設為 `180156`）解鎖。
  3. 點擊右上角「**⚙️ 密碼／同步設定**」，將 Project URL 與 Anon Key 貼上並點擊「**測試連線**」。
  4. 確認連線成功後點擊「**儲存設定**」即可！

* **方式二：寫入原始碼 `js/config.js`（適合團隊佈署）**
  開啟 [`js/config.js`](js/config.js)，直接修改預設金鑰與自訂密碼：
  ```javascript
  window.CONTACT_BOOK_CONFIG = {
    supabaseUrl: 'https://你的專案.supabase.co',
    supabaseAnonKey: '你的_ANON_KEY',
    defaultEditorPassword: '你的編輯通行密碼',
    defaultSuperAdminPassword: '你的管理員密碼',
  };
  ```

---

## 🔐 權限與安全架構

系統設計了直覺的階層式身分驗證，兼顧使用便利與防篡改需求：

```
訪客 (學生/家長) ─── 唯讀檢視 ─── 查閱聯絡簿、截止日、重要公告、列印
         │
         ├── 輸入【編輯密碼】 ──► ✏️ 編輯者模式 ──► 新增/修改/刪除作業與考試
         │
         └── 輸入【管理員密碼】──► 👑 管理員模式 ──► 修改公告、設定資料庫、查看還原歷史版本
```

## 📁 專案結構

```
online-contact-book/
├── 📄 index.html             # 主頁面（包含 Vue 模板、液態玻璃 CSS 與彈窗介面）
├── 📁 js/
│   ├── 📄 app.js             # Vue 3 核心業務邏輯（狀態管理、表單控制、篩選與列印）
│   ├── 📄 config.js          # 全域連線與預設密碼設定檔
│   └── 📄 supabase-sync.js   # Supabase 雲端資料同步、Realtime 監聽與備份封裝模組
├── 📁 data/
│   └── 📄 records.json       # 離線/降級備用之本機預設聯絡簿資料
├── 📄 supabase_schema.sql    # Supabase PostgreSQL 初始化與 72 小時備份觸發器腳本
├── 📄 vercel.json            # Vercel 部署設定與安全防護 Header
└── 📄 README.md              # 專案公開說明文件
```
