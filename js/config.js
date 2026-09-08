/**
 * config.js
 * 聯絡簿全域同步設定
 * 
 * 💡 提示：
 * 若希望所有持通行密碼的人（在任何手機或電腦上）點擊「發布變更」時都能直接同步進 GitHub 倉庫，
 * 可直接在此填入 GitHub Personal Access Token (PAT)。
 * 設定後，點擊「發布變更」時便會直接秒級同步倉庫，完全不需手動填寫任何繁瑣資訊！
 */
window.CONTACT_BOOK_CONFIG = {
  // GitHub 帳號 (若留空，系統將自動從 GitHub Pages 網址判斷)
  owner: '',

  // GitHub 倉庫名稱 (若留空，系統將自動從 GitHub Pages 網址判斷)
  repo: '',

  // 倉庫分支 (預設為 main)
  branch: 'main',

  // GitHub Personal Access Token (PAT)
  // 若在此預先填入，任何人輸入編輯密碼後均可「一鍵直接同步進倉庫」！
  token: '',
};
