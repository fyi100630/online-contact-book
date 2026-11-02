# 資安設計

## 一句話

**瀏覽器只拿得到「公開的聯絡簿內容」。** 資料庫網址、資料庫密碼、密碼雜湊、任何金鑰都只存在伺服器端，前端程式碼裡沒有任何可以逆向出來的秘密。

## 架構

```
瀏覽器 ──HTTPS──▶ Next.js 伺服器（Vercel） ──TLS──▶ PostgreSQL（Supabase）
  │                  │                               │
  │ 只有 session      │ DATABASE_URL、SETUP_TOKEN     │ 網站只用 contactbook_app 角色
  │ cookie（JS 讀不到）│ 只存在伺服器環境變數          │ Supabase 公開 API 金鑰完全碰不到資料
```

舊版是瀏覽器直接拿 Supabase 公開金鑰連資料庫，權限只靠前端畫面擋。任何人打開開發者工具就能繞過，這很可能就是資料不見的原因之一。新版的瀏覽器完全不知道資料庫在哪裡。

## 各層防護

### 1. 沒有秘密在前端
- 所有伺服器程式都標記 `server-only`，萬一被前端 import，build 會直接失敗。
- 環境變數不加 `NEXT_PUBLIC_` 前綴，Next.js 不會把它們打包進瀏覽器。
- 正式環境不輸出 source map。
- `npm run check:bundle` 會掃描所有要送到瀏覽器的檔案，確認沒有資料庫網址、密碼值、SQL、雜湊相關程式碼，CI 每次都會跑。

### 2. 帳號與密碼
- 密碼用 **scrypt**（N=2¹⁷, r=8, p=1，OWASP 建議值）加隨機 salt 雜湊。資料庫裡沒有明碼，雜湊也不會出現在任何 API 回應或修改紀錄裡。
- 比對密碼用 constant-time 比較。帳號不存在時也會跑一次同樣成本的運算，無法用回應時間猜出帳號是否存在。
- 帳號不存在、密碼錯誤、帳號已停用，三種情況回應完全一樣。
- 新帳號和重設密碼都由伺服器產生隨機臨時密碼（約 71 bits），第一次登入強制修改。
- 密碼不限制字元種類與最短長度（可以全部是數字或全部是英文），上限 128 字元。防暴力破解靠的是下面的登入次數限制，不是密碼規則。

### 3. 暴力破解
- 同一帳號 15 分鐘內錯 5 次就鎖 15 分鐘，鎖住期間正確密碼也不行。
- 同一 IP 15 分鐘內錯 20 次也鎖住。
- 計數存在資料庫，所以 Vercel 的多台伺服器會共用同一份計數。
- 「修改密碼」和「初次設定」也受同樣限制。

### 4. Session
- Session token 是 256 bits 隨機值，資料庫只存它的 SHA-256。就算資料庫外洩，也拿不到可以用的 token。
- Cookie 設定 `HttpOnly`（JavaScript 讀不到，XSS 偷不走）、`Secure`、`SameSite=Strict`，正式環境使用 `__Host-` 前綴。
- 7 天沒使用就失效，最長 30 天一定要重新登入。
- 登出時伺服器端刪除 session，偷來的 cookie 立刻失效。
- 改密碼、被重設密碼、被停用時，該帳號其他裝置立刻登出。

### 5. 授權
- 每一支 API 都在伺服器端檢查身分和角色（訪客／幹部與小老師／管理員）。前端隱藏按鈕只是介面，不是防線。
- 所有輸入都用 zod 嚴格驗證：型別、長度、日期格式。多餘的欄位會直接拒絕，避免有人偷塞 `createdBy` 之類的欄位。
- Request body 有大小限制，一般 16 KB，匯入 8 MB。

### 6. CSRF、XSS、點擊劫持
- 所有寫入請求都要求 `Origin` 和網站同源，而且必須是 `application/json`。再加上 `SameSite=Strict` cookie，三層防護。
- **CSP（Content Security Policy）**：每次請求產生新的 nonce，只有帶正確 nonce 的 script 能執行（`'strict-dynamic'`），不允許 `eval`、inline script、外部網域。就算有人想辦法塞了 `<script>`，瀏覽器也不會執行。
- 所有使用者輸入都由 React 轉義後輸出，沒有使用 `innerHTML`。公告裡的網址只轉成 `http/https` 連結，並加上 `rel="noopener noreferrer"`。
- `X-Frame-Options: DENY` 加 `frame-ancestors 'none'`，防止被嵌入其他網站做點擊劫持。
- 其他 header：HSTS、`nosniff`、`Referrer-Policy`、`Permissions-Policy`、`Cross-Origin-Opener-Policy`。

### 7. 資料庫層（最後一道防線）
就算伺服器程式有 bug，資料庫本身也會擋：
- 網站用的 `contactbook_app` 角色**不能刪除任何事項**，只能標記為刪除（垃圾桶）。
- **修改紀錄只能新增**：`contactbook_app` 沒有寫入權限，紀錄由資料庫 trigger 自動寫入；另外有 trigger 禁止任何人修改或刪除紀錄，管理員也不行。
- 每次修改都會記下是誰、什麼時候、從哪個 IP、改了什麼。
- 不能把最後一位管理員降級或停用。
- 所有查詢都是參數化，沒有字串拼接 SQL。
- Supabase 的 `anon` / `authenticated` 角色（公開 API 金鑰）對 `app` schema 完全沒有權限。

### 8. 資料不會再互相覆蓋
- 每個事項獨立存放，不再是整本聯絡簿一包 JSON。
- 每個事項都有版本號。兩個人同時編輯時，後存的人會收到「有其他人修改了」，不會蓋掉對方。

### 9. 供應鏈
- 套件版本完全鎖定（`package-lock.json` 加精確版本號），而且只用少數幾個主流套件。
- CI 每次都跑 `npm audit`，有高風險漏洞就失敗。
- Dependabot 每週檢查套件更新。

## 測試

`tests/e2e/security.test.mjs` 會對真正的伺服器和資料庫驗證以上大部分項目：未登入、跨站請求、SQL injection、暴力破解、session 重放、權限越級、樂觀鎖、修改紀錄、header。CI 每次 push 都會跑。

## 已知限制

- **沒有兩步驟驗證（2FA）。** 幹部或小老師的帳號密碼外洩時，對方可以修改或刪除事項。但所有動作都有紀錄而且可以還原，管理員也可以立刻停用帳號。
- **帳號鎖定可能被濫用。** 知道某人帳號名稱的人，可以故意輸錯讓對方被鎖 15 分鐘。這是防暴力破解的代價。
- **資料庫 TLS 沒有驗證憑證鏈**（`ssl: 'require'`），連線有加密，但不檢查 Supabase 的 CA。Vercel 和 Supabase 之間是雲端業者的網路，風險很低。
- **聯絡簿內容本身是公開的**（照原本的設計，學生和家長不用登入就能看）。請不要在事項裡寫學生個資。
- **App 安裝統計可以被灌水。** `POST /api/installations` 不需要登入（App 一打開就要回報），任何人都能送假的安裝 ID 讓數字變大。只影響管理員看到的統計數字，不影響聯絡簿內容；表裡只有隨機 ID、版本號和時間，不記錄 IP 或裝置資訊。
