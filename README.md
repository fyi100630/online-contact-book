# 📖 線上班級聯絡簿 (Online Class Contact Book)

> 專為班級導師、各科小老師、學生與家長設計的現代化數位聯絡簿。  
> 無須繁瑣編譯，零依賴開箱即用；支援即時雲端同步、作業截止倒數、版本歷史還原與紙本最佳化列印。

[✨ 功能特色](#-功能特色) • [🚀 5分鐘快速開始](#-5-分鐘快速開始) • [☁️ Supabase 資料庫設定](#-supabase-雲端資料庫設定) • [🔐 權限與安全架構](#-權限與安全架構) • [📁 專案結構](#-專案結構) • [💡 常見問題](#-常見問題)

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
* **訪客模式（一般大眾/學生/家長）**：預設進入，僅供唯讀瀏覽，介面純淨無多餘按鈕。
* **✏️ 編輯者模式（各科小老師/學藝股長）**：透過專屬密碼解鎖，可新增、編輯與刪除日常項目。
* **👑 最高管理員模式（班級導師）**：掌控置頂公告、資料庫連線金鑰、歷史版本還原與密碼更迭。
* 支援**免輸入密碼專屬快捷連結**（URL Hash 攜帶），方便私下分發給幹部加入書籤。

### 🖨️ 7. 友善紙本列印與本機備份
* **列印最佳化（Print CSS）**：自動隱藏功能按鈕與動態光暈，排版整潔乾淨，方便列印黏貼或張貼公布欄。
* **離線降級備份**：支援離線靜態檔讀取 (`data/records.json`) 與一鍵匯出 JSON 資料庫備份。

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

---

## 🚀 5 分鐘快速開始

### 方式 A：本機直接體驗
1. 下載或複製本專案原始碼：
   ```bash
   git clone https://github.com/your-username/online-contact-book.git
   ```
2. 直接雙擊開啟 `index.html`，或使用 VS Code 的 **Live Server** 外掛預覽。
3. 預設即可看到示範聯絡簿內容！

---

### 方式 B：免費一鍵雲端部署 (以 Vercel 為例)
1. 將專案推送到自己的 GitHub 倉庫。
2. 前往 [Vercel](https://vercel.com/)，點選 **Add New Project**。
3. 匯入該 GitHub 倉庫，無須設定任何 Build Command，直接點擊 **Deploy**。
4. 部署完成後，即可獲得專屬公開網址（例如：`https://your-class.vercel.app`）。

> 專案內已包含 `vercel.json`，自動配置好安全標頭（X-Frame-Options 等）與乾淨路由。

---

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

### 預設密碼清單
| 角色 | 預設密碼 | 具備權限 |
| :--- | :---: | :--- |
| **一般編輯者 (Editor)** | `6830` | 可新增、修改、刪除四大項目的內容與截止日 |
| **最高管理員 (Super Admin)** | `180156` | 具備所有權限，可修改班級名稱、置頂公告、管理員密碼、還原 72h 歷史版本 |

> [!CAUTION]
> **正式上線前安全提醒**：
> 部署至公開網路後，請務必點擊右上角「⚙️ 密碼／同步設定」將預設密碼更換為自訂密碼，避免非授權人員進行編輯！

### 🔗 免密碼快捷登入連結
在「⚙️ 密碼／同步設定」視窗中，系統會自動生成專屬免密連結：
* **管理員連結**：`https://your-domain.com/#<管理員密碼>`（建議導師加入私人書籤）。
* **小老師編輯連結**：`https://your-domain.com/#<編輯密碼>`（可直接分享給協助登記作業的幹部）。

---

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

---

## 💡 常見問題 (FAQ)

<details>
<summary><strong>Q1：如果沒有設定 Supabase，這個聯絡簿還能正常運作嗎？</strong></summary>
<br>
可以！系統具備降級機制，如果未設定 Supabase 或網路異常，會自動讀取 <code>data/records.json</code> 進行靜態展示。但若需要多台裝置即時儲存與同步更新，強烈建議免費啟用 Supabase 雲端資料庫。
</details>

<details>
<summary><strong>Q2：72 小時歷史紀錄會不會把 Supabase 免費容量佔滿？</strong></summary>
<br>
完全不用擔心。在執行 <code>supabase_schema.sql</code> 時，已建立 PostgreSQL 自動清理觸發程序 <code>trigger_prune_contact_book_logs</code>，任何建立超過 72 小時的備份快照均會被自動抹除，確保資料庫維持在極輕量的狀態。
</details>

<details>
<summary><strong>Q3：忘記密碼怎麼辦？</strong></summary>
<br>
若未將密碼寫死在 <code>js/config.js</code>，密碼預設儲存於當前瀏覽器的 <code>localStorage</code> 中。如果忘記，清除瀏覽器快取即可重設回預設值；若為管理者，可隨時在 <code>js/config.js</code> 重新指定預設密碼並重新佈署。
</details>

<details>
<summary><strong>Q4：列印聯絡簿時如何獲得最乾淨的版面？</strong></summary>
<br>
直接點擊右上角的「列印」按鈕（或按快捷鍵 <kbd>Ctrl</kbd>+<kbd>P</kbd> / <kbd>Cmd</kbd>+<kbd>P</kbd>），系統已內建專門的 <code>@media print</code> 樣式，會自動剔除光暈背景、操作按鈕與設定面板，只保留清晰的黑白/彩色表格。
</details>

---

## 🤝 參與貢獻

歡迎任何形式的參與！無論是回報 Bug、提出新功能建議或送出 Pull Request：

1. Fork 本倉庫
2. 建立您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送至分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

---

## 📄 開源授權

本專案採用 [MIT License](LICENSE) 開源授權。歡迎自由用於教學現場、學校班級或社團組織。

<div align="center">
  <sub>Made with ❤️ for teachers, students, and parents.</sub>
</div>
