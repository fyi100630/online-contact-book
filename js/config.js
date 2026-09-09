/**
 * config.js
 * 聯絡簿全域同步設定 (Supabase 雲端資料庫)
 * 
 * 💡 說明：
 * 1. 請至 Supabase 控制台 (https://supabase.com) 進入您的專案。
 * 2. 在「Project Settings」->「API」找到「Project URL」與「Project API Keys (anon / public)」。
 * 3. 填入下方的 supabaseUrl 與 supabaseAnonKey，推送到 GitHub 即可全體生效！
 * 4. 亦可直接在網頁介面上點擊右上角「⚙️ 密碼／同步設定」手動填入，系統會自動記憶於瀏覽器。
 */
window.CONTACT_BOOK_CONFIG = {
  // Supabase 專案網址 (https://xxxxxxxxxxxxxxxxxxxx.supabase.co)
  supabaseUrl: 'https://bcddawmffqadxevuwegf.supabase.co',

  // Supabase 匿名公鑰 (Project API Key: anon / public)
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZGRhd21mZnFhZHhldnV3ZWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTIxOTEsImV4cCI6MjEwNDUyODE5MX0.heTNO_inKi9FUWPCQUFZji11MFh_m6dPELYckDW1mwc',

  // 系統預設通行密碼 (可在此處或網頁後台修改)
  defaultEditorPassword: '6830',
  defaultSuperAdminPassword: '180156',
};
