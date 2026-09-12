

const SupabaseSync = (function () {
  const STORAGE_KEY = 'contact_book_sb_config';
  const AUTH_ROLE_KEY = 'contact_book_auth_role'; 

  const DEFAULT_EDITOR_PASSWORD = '6830';
  const DEFAULT_SUPER_ADMIN_PASSWORD = '180156';

  let cachedClient = null;
  let cachedClientUrl = '';
  let cachedClientKey = '';
  let activeRealtimeChannel = null;

  function getSavedConfig() {
    try {
      const item = localStorage.getItem(STORAGE_KEY);
      return item ? JSON.parse(item) : {};
    } catch (e) {
      return {};
    }
  }

  function saveConfig(config) {
    try {
      const current = getSavedConfig();
      const updated = {
        supabaseUrl: (config.supabaseUrl || '').trim(),
        supabaseAnonKey: (config.supabaseAnonKey || '').trim(),
        editorPassword: (config.editorPassword || '').trim() || DEFAULT_EDITOR_PASSWORD,
        superAdminPassword: (config.superAdminPassword || '').trim() || DEFAULT_SUPER_ADMIN_PASSWORD,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      
      cachedClient = null;
      return true;
    } catch (e) {
      console.error('儲存設定失敗:', e);
      return false;
    }
  }

  function getEffectiveConfig() {
    const saved = getSavedConfig();
    const globalCfg = window.CONTACT_BOOK_CONFIG || {};

    let supabaseUrl = saved.supabaseUrl || globalCfg.supabaseUrl || '';
    let supabaseAnonKey = saved.supabaseAnonKey || globalCfg.supabaseAnonKey || '';
    let editorPassword = saved.editorPassword || globalCfg.defaultEditorPassword || DEFAULT_EDITOR_PASSWORD;
    let superAdminPassword = saved.superAdminPassword || globalCfg.defaultSuperAdminPassword || DEFAULT_SUPER_ADMIN_PASSWORD;

    let isAdminRoute = false;
    let isSuperAdmin = false;
    const hash = window.location.hash ? window.location.hash.slice(1).trim() : '';

    if (hash) {
      
      if (hash === superAdminPassword || hash === DEFAULT_SUPER_ADMIN_PASSWORD) {
        isAdminRoute = true;
        isSuperAdmin = true;
        setSessionAuth('super_admin');
      } else if (hash === editorPassword || hash === DEFAULT_EDITOR_PASSWORD) {
        isAdminRoute = true;
        isSuperAdmin = false;
        setSessionAuth('editor');
      }

      if (hash.includes('&')) {
        const params = new URLSearchParams(hash);
        if (params.has('sbUrl')) supabaseUrl = params.get('sbUrl');
        if (params.has('sbKey')) supabaseAnonKey = params.get('sbKey');
      }
    }

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
      editorPassword,
      superAdminPassword,
      isAdminRoute,
      isSuperAdmin,
      isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    };
  }

  function verifyPassword(inputPassword) {
    if (!inputPassword) return null;
    const config = getEffectiveConfig();
    const str = String(inputPassword).trim();
    if (str === String(config.superAdminPassword).trim() || str === DEFAULT_SUPER_ADMIN_PASSWORD) {
      return 'super_admin';
    }
    if (str === String(config.editorPassword).trim() || str === DEFAULT_EDITOR_PASSWORD) {
      return 'editor';
    }
    return null;
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

  function getSupabaseClient(url, key) {
    if (!window.supabase) {
      console.warn('Supabase SDK 尚未載入');
      return null;
    }
    let targetUrl = (url || '').trim();
    if (targetUrl.endsWith('/')) targetUrl = targetUrl.slice(0, -1);
    if (targetUrl.endsWith('/rest/v1')) targetUrl = targetUrl.replace(/\/rest\/v1$/, '');
    const targetKey = (key || '').trim();

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

  return {
    DEFAULT_EDITOR_PASSWORD,
    DEFAULT_SUPER_ADMIN_PASSWORD,
    getSavedConfig,
    saveConfig,
    getEffectiveConfig,
    verifyPassword,
    setSessionAuth,
    getSessionAuthRole,

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

    async saveData(config, payload, summary = '') {
      const client = getSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
      if (!client) {
        throw new Error('尚未設定 Supabase 連線資訊！請點擊右上角「⚙️ 密碼／同步設定」填入 Supabase URL 與 Anon Key。');
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

      try {
        const recordsArr = Array.isArray(payload.records) ? payload.records : [];
        const hwCount = recordsArr.filter((r) => r.category === 'homework').length;
        const examCount = recordsArr.filter((r) => r.category === 'exam').length;
        const subCount = recordsArr.filter((r) => r.category === 'submission').length;
        const remCount = recordsArr.filter((r) => r.category === 'reminder').length;
        const autoSummary = summary || `作業 ${hwCount} 筆、考試 ${examCount} 筆、繳交 ${subCount} 筆、提醒 ${remCount} 筆`;

        await client.from('contact_book_logs').insert({
          class_title: updateData.class_title,
          announcement: updateData.announcement,
          records: updateData.records,
          summary: autoSummary,
          editor_role: 'admin',
          created_at: updateData.updated_at,
        });
      } catch (logErr) {
        console.warn('寫入歷史紀錄失敗（若尚未在 Supabase 執行 SQL 建立 logs 資料表請先執行）:', logErr);
      }

      return {
        success: true,
        data,
      };
    },

    async fetchLogs(config) {
      const client = getSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
      if (!client) {
        throw new Error('尚未設定 Supabase 連線資訊');
      }

      const cutoffTime = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

      const { data, error } = await client
        .from('contact_book_logs')
        .select('*')
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false });

      if (error) {
        
        if (error.code === '42P01' || (error.message && error.message.includes('contact_book_logs'))) {
          return {
            success: false,
            tableNotFound: true,
            message: '尚未在 Supabase 建立 contact_book_logs 資料表，請先至 Supabase SQL Editor 執行最新腳本。',
            data: [],
          };
        }
        throw new Error(error.message || '無法取得歷史紀錄');
      }

      return {
        success: true,
        tableNotFound: false,
        data: data || [],
      };
    },

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
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              
            }
          });

        activeRealtimeChannel = channel;
        return channel;
      } catch (e) {
        console.warn('註冊 Supabase Realtime 監聽失敗:', e);
        return null;
      }
    },

    generateSuperAdminLink(pwd) {
      const base = window.location.origin + window.location.pathname;
      return `${base}#${pwd || DEFAULT_SUPER_ADMIN_PASSWORD}`;
    },

    generateEditorLink(pwd) {
      const base = window.location.origin + window.location.pathname;
      return `${base}#${pwd || DEFAULT_EDITOR_PASSWORD}`;
    },

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
