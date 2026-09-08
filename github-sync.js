/**
 * github-sync.js
 * 處理 GitHub Pages 線上聯絡簿的資料讀取、GitHub REST API 提交與管理權限管理
 */

const GitHubSync = (function () {
  const STORAGE_KEY = 'contact_book_gh_config';
  const DATA_PATH = 'data/records.json';

  // 支援 UTF-8 中文字元的 Base64 編碼
  function utf8ToBase64(str) {
    return window.btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
        return String.fromCharCode('0x' + p1);
      })
    );
  }

  // 支援 UTF-8 中文字元的 Base64 解碼
  function base64ToUtf8(base64) {
    return decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
  }

  const DEFAULT_EDITOR_PASSWORD = '6830';
  const DEFAULT_SUPER_ADMIN_PASSWORD = '180156';
  const AUTH_ROLE_KEY = 'contact_book_auth_role'; // 'editor' | 'super_admin'

  // 讀取編輯密碼（預設 6830）
  function getEditorPassword() {
    const saved = getSavedConfig();
    return saved.editorPassword || saved.adminPassword || DEFAULT_EDITOR_PASSWORD;
  }

  // 讀取專屬管理員密碼（預設 180156）
  function getSuperAdminPassword() {
    const saved = getSavedConfig();
    return saved.superAdminPassword || DEFAULT_SUPER_ADMIN_PASSWORD;
  }

  // 驗證密碼，回傳身分字串 ('super_admin' | 'editor' | null)
  function verifyPassword(inputPassword) {
    if (!inputPassword) return null;
    const str = String(inputPassword).trim();
    if (str === String(getSuperAdminPassword()).trim()) {
      return 'super_admin';
    }
    if (str === String(getEditorPassword()).trim()) {
      return 'editor';
    }
    return null;
  }

  // 記錄身分狀態
  function setSessionAuth(role) {
    if (role) {
      sessionStorage.setItem(AUTH_ROLE_KEY, role);
    } else {
      sessionStorage.removeItem(AUTH_ROLE_KEY);
    }
  }

  // 取得目前身分 ('editor' | 'super_admin' | null)
  function getSessionAuthRole() {
    return sessionStorage.getItem(AUTH_ROLE_KEY) || null;
  }

  // 自動偵測 GitHub Pages 網址所屬的 owner 與 repo
  function autoDetectRepoInfo() {
    const hostname = window.location.hostname || '';
    const pathname = window.location.pathname || '';
    let detectedOwner = '';
    let detectedRepo = '';

    if (hostname.endsWith('.github.io')) {
      detectedOwner = hostname.replace('.github.io', '');
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        detectedRepo = parts[0];
      }
    }
    return { owner: detectedOwner, repo: detectedRepo };
  }

  // 解析 URL Hash 或 Query 中的管理員參數與密碼
  function parseUrlCredentials() {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const cleanHash = hash.replace(/^#\/?/, '');

    // 支援 #6830&token=xxx 或 #admin&token=xxx 或 #180156
    let hashPwd = null;
    let paramString = cleanHash;

    if (cleanHash.includes('&')) {
      const firstAmp = cleanHash.indexOf('&');
      const prefix = cleanHash.substring(0, firstAmp);
      paramString = cleanHash.substring(firstAmp + 1);
      if (prefix !== 'admin') {
        hashPwd = prefix;
      }
    } else if (cleanHash && cleanHash !== 'admin' && !cleanHash.includes('=')) {
      hashPwd = cleanHash;
    }

    const params = new URLSearchParams(paramString.replace(/^admin&?/, ''));
    const queryParams = new URLSearchParams(search);

    const token = params.get('token') || queryParams.get('token');
    const owner = params.get('owner') || queryParams.get('owner');
    const repo = params.get('repo') || queryParams.get('repo');
    const branch = params.get('branch') || queryParams.get('branch');
    const pwdInUrl = params.get('pwd') || queryParams.get('pwd') || hashPwd;

    // 檢查 URL 中的密碼
    let role = getSessionAuthRole();
    if (pwdInUrl) {
      const verifiedRole = verifyPassword(pwdInUrl);
      if (verifiedRole) {
        role = verifiedRole;
        setSessionAuth(role);
      }
    }

    if (!role && token) {
      // 若帶有 Token 且未特別指定密碼，預設為編輯身分
      role = 'editor';
      setSessionAuth('editor');
    }

    const isAdminRoute = Boolean(role);
    const isSuperAdmin = role === 'super_admin';

    return {
      isAdminRoute,
      isSuperAdmin,
      role,
      token,
      owner,
      repo,
      branch,
    };
  }

  // 讀取本機儲存的設定
  function getSavedConfig() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  // 儲存設定到本機
  function saveConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save config to localStorage', e);
    }
  }

  // 取得有效設定（URL 優先 > 本機 localStorage > js/config.js 預設 > 網址自動偵測）
  function getEffectiveConfig() {
    const urlCreds = parseUrlCredentials();
    const saved = getSavedConfig();
    const fileConfig = window.CONTACT_BOOK_CONFIG || {};
    const auto = autoDetectRepoInfo();

    const token = urlCreds.token || saved.token || fileConfig.token || '';
    const owner = urlCreds.owner || saved.owner || fileConfig.owner || auto.owner || '';
    const repo = urlCreds.repo || saved.repo || fileConfig.repo || auto.repo || '';
    const branch = urlCreds.branch || saved.branch || fileConfig.branch || 'main';

    // 若 URL 帶有 Token，自動保存至本機，使後續直接具備秒級同步功能
    if (urlCreds.token && urlCreds.token !== saved.token) {
      saveConfig({
        ...saved,
        token: urlCreds.token,
        owner,
        repo,
        branch,
      });
    }

    return {
      isAdminRoute: urlCreds.isAdminRoute,
      isSuperAdmin: urlCreds.isSuperAdmin,
      role: urlCreds.role,
      editorPassword: saved.editorPassword || DEFAULT_EDITOR_PASSWORD,
      superAdminPassword: saved.superAdminPassword || DEFAULT_SUPER_ADMIN_PASSWORD,
      token,
      owner,
      repo,
      branch,
    };
  }

  let cachedSha = null;

  // 處理 Token 授權標頭（自動去除首尾空白、自動相容 Bearer 格式）
  function getAuthHeader(token) {
    if (!token) return '';
    let clean = String(token).trim();
    clean = clean.replace(/^Bearer\s+/i, '').replace(/^token\s+/i, '').trim();
    return `Bearer ${clean}`;
  }

  return {
    DEFAULT_EDITOR_PASSWORD,
    DEFAULT_SUPER_ADMIN_PASSWORD,
    getEditorPassword,
    getSuperAdminPassword,
    verifyPassword,
    setSessionAuth,
    getSessionAuthRole,
    getEffectiveConfig,
    saveConfig,
    parseUrlCredentials,
    autoDetectRepoInfo,

    // 產生專屬管理員編輯連結
    generateAdminLink(config) {
      const base = window.location.origin + window.location.pathname;
      const params = new URLSearchParams();
      if (config.owner) params.set('owner', config.owner);
      if (config.repo) params.set('repo', config.repo);
      if (config.branch && config.branch !== 'main') params.set('branch', config.branch);
      if (config.token) params.set('token', config.token.trim());

      return `${base}#admin&${params.toString()}`;
    },

    // 產生免手動輸入 Token 的全自動同步編輯連結（分享給協作者）
    generateDirectSyncEditorLink(config) {
      const base = window.location.origin + window.location.pathname;
      const pwd = config.editorPassword || DEFAULT_EDITOR_PASSWORD;
      if (config.token) {
        return `${base}#${pwd}&token=${encodeURIComponent(config.token.trim())}`;
      }
      return `${base}#${pwd}`;
    },

    // 產生免手動輸入 Token 的全自動同步專屬管理員連結
    generateDirectSyncAdminLink(config) {
      const base = window.location.origin + window.location.pathname;
      const pwd = config.superAdminPassword || DEFAULT_SUPER_ADMIN_PASSWORD;
      if (config.token) {
        return `${base}#${pwd}&token=${encodeURIComponent(config.token.trim())}`;
      }
      return `${base}#${pwd}`;
    },

    // 讀取聯絡簿資料（若有 GitHub Token 則可同時獲取最新 SHA）
    async loadData(config) {
      // 1. 如果有設定 GitHub Token 與 Repo，嘗試直接向 GitHub API 取得最新版與 SHA
      if (config && config.token && config.owner && config.repo) {
        try {
          const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${DATA_PATH}?ref=${config.branch || 'main'}&t=${Date.now()}`;
          const res = await fetch(apiUrl, {
            headers: {
              Authorization: getAuthHeader(config.token),
              Accept: 'application/vnd.github.v3+json',
            },
          });
          if (res.ok) {
            const fileInfo = await res.json();
            cachedSha = fileInfo.sha;
            const content = base64ToUtf8(fileInfo.content.replace(/\n/g, ''));
            return {
              success: true,
              data: JSON.parse(content),
              sha: fileInfo.sha,
              source: 'github-api',
            };
          }
        } catch (err) {
          console.warn('GitHub API fetch failed, falling back to static file:', err);
        }
      }

      // 2. 唯讀訪客或 API 失敗時，直接讀取靜態 records.json
      try {
        const res = await fetch(`${DATA_PATH}?t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return {
          success: true,
          data: data,
          sha: cachedSha,
          source: 'static-file',
        };
      } catch (err) {
        console.error('Failed to load static records.json:', err);
        return {
          success: false,
          error: err.message,
        };
      }
    },

    // 透過 GitHub REST API 儲存資料
    async saveData(dataObj, config) {
      if (!config || !config.token || !config.owner || !config.repo) {
        throw new Error('未設定完整的 GitHub 資訊（Owner / Repo / Token）');
      }

      const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${DATA_PATH}`;
      const branch = config.branch || 'main';

      // 確保取得檔案的最新 SHA（避免衝突）
      if (!cachedSha) {
        try {
          const getRes = await fetch(`${apiUrl}?ref=${branch}&t=${Date.now()}`, {
            headers: {
              Authorization: getAuthHeader(config.token),
              Accept: 'application/vnd.github.v3+json',
            },
          });
          if (getRes.ok) {
            const existing = await getRes.json();
            cachedSha = existing.sha;
          }
        } catch (e) {
          console.warn('Could not query existing SHA:', e);
        }
      }

      const jsonString = JSON.stringify(dataObj, null, 2);
      const base64Content = utf8ToBase64(jsonString);

      const dateStr = new Date().toLocaleString('zh-TW', { hour12: false });
      const payload = {
        message: `聯絡簿更新：${dateStr} 由線上管理員發布`,
        content: base64Content,
        branch: branch,
      };

      if (cachedSha) {
        payload.sha = cachedSha;
      }

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: getAuthHeader(config.token),
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!putRes.ok) {
        const errJson = await putRes.json().catch(() => ({}));
        if (putRes.status === 401) {
          throw new Error('GitHub 金鑰無效（Bad credentials）。請確認填入的是完整的 GitHub Personal Access Token（格式為 ghp_... 或 github_pat_...），請勿輸入 GitHub 登入密碼！');
        }
        if (putRes.status === 404) {
          throw new Error(`找不到儲存庫或分支（HTTP 404）。請確認儲存庫「${config.owner}/${config.repo}」已建立且檔案 data/records.json 已存在。`);
        }
        if (putRes.status === 409) {
          // SHA 衝突時清除快取，提示使用者重新整理
          cachedSha = null;
          throw new Error('儲存衝突（SHA 衝突）：可能有其他地方進行了變更，請重新整理頁面後再發布一次。');
        }
        throw new Error(errJson.message || `GitHub API 儲存失敗（HTTP ${putRes.status}）`);
      }

      const result = await putRes.json();
      cachedSha = result.content ? result.content.sha : null;

      return {
        success: true,
        commit: result.commit,
      };
    },

    // 下載 JSON 備份檔案
    downloadBackup(dataObj) {
      const jsonStr = JSON.stringify(dataObj, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `聯絡簿資料備份_${now}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  };
})();

// 掛載到全域
window.GitHubSync = GitHubSync;
