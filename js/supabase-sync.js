/**
 * supabase-sync.js
 * 處理線上班級聯絡簿的 Supabase 雲端資料庫讀寫、Realtime 即時推播與權限管理
 */

const SupabaseSync = (function () {
  const STORAGE_KEY = 'contact_book_sb_config';
  const AUTH_ROLE_KEY = 'contact_book_auth_role'; // 'editor' | 'super_admin'

  let cachedClient = null;
  let cachedClientUrl = '';
  let cachedClientKey = '';
  let activeRealtimeChannel = null;

  // 取得本地快取的設定
  function getSavedConfig() {
    try {
      const item = localStorage.getItem(STORAGE_KEY);
      return item ? JSON.parse(item) : {};
    } catch (e) {
      return {};
    }
  }

  // 儲存設定至 localStorage
  function saveConfig(config) {
    try {
      const updated = {
        supabaseUrl: (config.supabaseUrl || '').trim(),
        supabaseAnonKey: (config.supabaseAnonKey || '').trim(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      cachedClient = null;
      return true;
    } catch (e) {
      console.error('儲存設定失敗:', e);
      return false;
    }
  }

  // 讀取當前有效設定
  function getEffectiveConfig() {
    const saved = getSavedConfig();
    const globalCfg = window.CONTACT_BOOK_CONFIG || {};

    let supabaseUrl = saved.supabaseUrl || globalCfg.supabaseUrl || '';
    let supabaseAnonKey = saved.supabaseAnonKey || globalCfg.supabaseAnonKey || '';

    let isAdminRoute = false;
    let isSuperAdmin = false;

    // 檢查 Session 登入狀態
    const sessionRole = getSessionAuthRole();
    if (sessionRole === 'super_admin') {
      isAdminRoute = true;
      isSuperAdmin = true;
    } else if (sessionRole === 'editor') {
      isAdminRoute = true;
      isSuperAdmin = false;
    }

    return {
      supabaseUrl,
      supabaseAnonKey,
      isAdminRoute,
      isSuperAdmin,
      isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    };
  }

  function setSessionAuth(role) {
    if (role) {
      sessionStorage.setItem(AUTH_ROLE_KEY, role);
    } else {
      sessionStorage.removeItem(AUTH_ROLE_KEY);
    }
  }

  function getSessionAuthRole() {
    return sessionStorage.getItem(AUTH_ROLE_KEY) || null;
  }

  // 取得或建立 Supabase Client
  function getSupabaseClient(url, key) {
    if (!window.supabase) {
      console.warn('Supabase SDK 尚未載入');
      return null;
    }
    const globalCfg = window.CONTACT_BOOK_CONFIG || {};
    const targetUrl = (url || globalCfg.supabaseUrl || '').trim();
    const targetKey = (key || globalCfg.supabaseAnonKey || '').trim();

    if (!targetUrl || !targetKey) return null;

    if (cachedClient && cachedClientUrl === targetUrl && cachedClientKey === targetKey) {
      return cachedClient;
    }

    try {
      cachedClient = window.supabase.createClient(targetUrl, targetKey);
      cachedClientUrl = targetUrl;
      cachedClientKey = targetKey;
      return cachedClient;
    } catch (e) {
      console.error('初始化 Supabase Client 失敗:', e);
      return null;
    }
  }

  // 向 Supabase 雲端資料庫驗證密碼 (RPC)
  async function verifyPasswordRemote(inputPassword) {
    if (!inputPassword) return null;
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase 未完成連線設定');

    const str = String(inputPassword).trim();

    // 呼叫雲端函式確認是否為 super_admin
    const { data: isSuper, error: errSuper } = await client.rpc('verify_app_password', {
      target_role: 'super_admin',
      input_password: str,
    });
    if (errSuper) throw errSuper;
    if (isSuper) return 'super_admin';

    // 呼叫雲端函式確認是否為 editor
    const { data: isEditor, error: errEditor } = await client.rpc('verify_app_password', {
      target_role: 'editor',
      input_password: str,
    });
    if (errEditor) throw errEditor;
    if (isEditor) return 'editor';

    return null;
  }

  return {
    getSavedConfig,
    saveConfig,
    getEffectiveConfig,
    verifyPasswordRemote,
    setSessionAuth,
    getSessionAuthRole,
    getClient: () => getSupabaseClient(),

    // 測試 Supabase 連線
    async testConnection(url, key) {
      const client = getSupabaseClient(url, key);
      if (!client) {
        throw new Error('請確認已正確填入 Supabase URL 與 Anon Key');
      }
      const { data, error } = await client
        .from('contact_book')
        .select('id, class_title, updated_at')
        .eq('id', 'default')
        .maybeSingle();

      if (error) {
        throw new Error(error.message || '連線測試失敗，請確認資料表 contact_book 是否已建立');
      }
      return { success: true, data };
    },

    // 讀取聯絡簿資料
    async loadData(config) {
      const client = getSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);

      if (client) {
        try {
          const { data, error } = await client
            .from('contact_book')
            .select('*')
            .eq('id', 'default')
            .maybeSingle();

          if (error) {
            console.warn('從 Supabase 讀取資料失敗，嘗試降級至本機 records.json:', error);
          } else if (data) {
            return {
              success: true,
              source: 'supabase',
              data: {
                classTitle: data.class_title || '班級聯絡簿',
                announcement: data.announcement || '',
                records: Array.isArray(data.records) ? data.records : [],
                updatedAt: data.updated_at,
              },
            };
          } else {
            const initialPayload = {
              id: 'default',
              class_title: '411班級聯絡簿',
              announcement: '內測進行中',
              records: [],
            };
            await client.from('contact_book').insert(initialPayload);
            return {
              success: true,
              source: 'supabase-initialized',
              data: {
                classTitle: initialPayload.class_title,
                announcement: initialPayload.announcement,
                records: initialPayload.records,
              },
            };
          }
        } catch (err) {
          console.warn('連線 Supabase 發生異常，降級至本機備份:', err);
        }
      }

      try {
        const localRes = await fetch(`data/records.json?t=${Date.now()}`);
        if (localRes.ok) {
          const jsonData = await localRes.json();
          return {
            success: true,
            source: 'local-file',
            data: {
              classTitle: jsonData.classTitle || '班級聯絡簿',
              announcement: jsonData.announcement || '',
              records: jsonData.records || [],
            },
          };
        }
      } catch (e) {
        console.warn('本機 records.json 讀取失敗:', e);
      }

      return {
        success: false,
        source: 'none',
        message: '無法載入資料，請確認 Supabase 設定或 records.json 檔案。',
      };
    },

    // 儲存所有資料至 Supabase
    async saveData(config, payload) {
      const client = getSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
      if (!client) {
        throw new Error('尚未設定 Supabase 連線資訊！');
      }

      const updateData = {
        id: 'default',
        class_title: payload.classTitle || '班級聯絡簿',
        announcement: payload.announcement || '',
        records: payload.records || [],
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await client
        .from('contact_book')
        .upsert(updateData, { onConflict: 'id' })
        .select();

      if (error) {
        throw new Error(error.message || '儲存至 Supabase 失敗');
      }

      return {
        success: true,
        data,
      };
    },

    // 訂閱 Supabase Realtime 即時推播
    subscribeToChanges(config, onUpdate) {
      if (activeRealtimeChannel) {
        try {
          activeRealtimeChannel.unsubscribe();
        } catch (e) {}
        activeRealtimeChannel = null;
      }

      const client = getSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
      if (!client) return null;

      try {
        const channel = client
          .channel('contact_book_realtime')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'contact_book',
              filter: 'id=eq.default',
            },
            (payload) => {
              if (payload.new && typeof onUpdate === 'function') {
                onUpdate({
                  classTitle: payload.new.class_title,
                  announcement: payload.new.announcement,
                  records: payload.new.records || [],
                  updatedAt: payload.new.updated_at,
                });
              }
            }
          )
          .subscribe();

        activeRealtimeChannel = channel;
        return channel;
      } catch (e) {
        console.warn('註冊 Supabase Realtime 監聽失敗:', e);
        return null;
      }
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

window.SupabaseSync = SupabaseSync;

