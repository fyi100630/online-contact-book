/**
 * app.js
 * 線上聯絡簿 Vue 3 核心邏輯
 */

const { createApp, ref, reactive, computed, onMounted } = Vue;

createApp({
  setup() {
    // 取得當前本地 YYYY-MM-DD
    function getTodayString() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 格式化日期標題（包含星期幾）
    function formatDateWithWeekday(dateStr) {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
      return `${year} 年 ${Number(month)} 月 ${Number(day)} 日（${weekdays[d.getDay()]}）`;
    }

    // 基本狀態
    const classTitle = ref('班級聯絡簿');
    const announcement = ref('');
    const records = ref([]);
    const currentDate = ref(getTodayString());
    const viewMode = ref('daily'); // 'daily' 或 'all-active'
    const isLoading = ref(true);
    const isSaving = ref(false);

    // 管理員與 Supabase 雲端設定
    const isAdmin = ref(false); // 一般編輯權限 (6830 或 180156)
    const isSuperAdmin = ref(false); // 管理員 (180156)
    const showPasswordModal = ref(false);
    const inputPassword = ref('');
    const loginError = ref('');
    const passwordModalTitle = ref('解鎖編輯模式');
    const passwordModalSubtitle = ref('請輸入通行密碼以開啟權限');

    const sbConfig = reactive({
      supabaseUrl: '',
      supabaseAnonKey: '',
      editorPassword: SupabaseSync.DEFAULT_EDITOR_PASSWORD,
      superAdminPassword: SupabaseSync.DEFAULT_SUPER_ADMIN_PASSWORD,
    });
    const isCloudConnected = ref(false);
    const isTestingConnection = ref(false);
    const connectionTestResult = ref(null); // { success: boolean, message: string }
    const showConfigModal = ref(false);
    const showClassInfoModal = ref(false);

    // 編輯項目 Modal
    const showEditModal = ref(false);
    const isEditingExisting = ref(false);
    const formItem = reactive({
      id: '',
      date: getTodayString(),
      category: 'homework',
      subject: '',
      title: '',
      details: '',
      dueDate: '',
      priority: 'normal',
    });

    // Toast 提示框
    const toast = reactive({
      show: false,
      message: '',
      type: 'success', // 'success', 'error', 'info'
    });

    let toastTimer = null;
    function showToast(message, type = 'success') {
      toast.message = message;
      toast.type = type;
      toast.show = true;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.show = false;
      }, 3500);
    }

    // 計算兩日期間的天數差距
    function getDaysDiff(fromDateStr, toDateStr) {
      if (!fromDateStr || !toDateStr) return null;
      try {
        const [y1, m1, d1] = fromDateStr.split('-').map(Number);
        const [y2, m2, d2] = toDateStr.split('-').map(Number);
        const t1 = new Date(y1, m1 - 1, d1).getTime();
        const t2 = new Date(y2, m2 - 1, d2).getTime();
        return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
      } catch (e) {
        return null;
      }
    }

    // 判斷項目是否在特定日期應該顯示
    // 規則：若有設定截止日 (dueDate)，截止日當天起 (targetDate >= item.dueDate) 不再顯示此項目！
    function isItemActiveOnDate(item, targetDate) {
      if (!item.date && !item.dueDate) return false;

      if (item.dueDate) {
        const startDate = item.date || item.dueDate;
        // 若截止日晚於起始日：僅在 [startDate, item.dueDate) 期間顯示，截止日當天自動隱藏
        if (item.dueDate > startDate) {
          return targetDate >= startDate && targetDate < item.dueDate;
        }
        // 若截止日早於或等於起始日：僅在起始日當天顯示
        return targetDate === startDate;
      }

      // 未設定截止日：僅在建立當日 (item.date) 顯示
      return targetDate === item.date;
    }

    // 取得項目在目標日期的期限狀態徽章資訊
    function getItemDeadlineInfo(item, targetDate = currentDate.value) {
      if (!item.dueDate) return null;
      const diff = getDaysDiff(targetDate, item.dueDate);
      if (diff === null) return null;

      const isContinuing = Boolean(item.date && item.date < targetDate);

      if (diff === 1) {
        // 截止日前一天（最後顯示的一天）
        return {
          status: 'tomorrow',
          daysLeft: 1,
          badgeText: `🚨 明日截止（${item.dueDate}）`,
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse',
          lineText: `⚠️【明日截止:${item.dueDate}】`,
          isContinuing,
        };
      } else if (diff > 1) {
        return {
          status: 'ongoing',
          daysLeft: diff,
          badgeText: `⏳ 期限至 ${item.dueDate}（剩 ${diff} 天）`,
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
          lineText: `(期限:${item.dueDate}，剩 ${diff} 天)`,
          isContinuing,
        };
      } else if (diff === 0) {
        return {
          status: 'today',
          daysLeft: 0,
          badgeText: `🚨 今日截止（${item.dueDate}）`,
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
          lineText: `⚠️【今日截止】`,
          isContinuing,
        };
      } else {
        return {
          status: 'expired',
          daysLeft: diff,
          badgeText: `已截止（${item.dueDate}）`,
          badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
          lineText: `(已截止:${item.dueDate})`,
          isContinuing: false,
        };
      }
    }

    // 依據當前選定日期的項目清單（截止日當天自動隱藏）
    const currentRecords = computed(() => {
      if (viewMode.value === 'daily') {
        return records.value.filter((r) => isItemActiveOnDate(r, currentDate.value));
      } else {
        // 近期所有未過期項目（截止日必須大於當前日期）
        return records.value.filter((r) => {
          if (r.dueDate) return r.dueDate > currentDate.value;
          return r.date >= currentDate.value;
        });
      }
    });

    // 四大分類分流
    const homeworkItems = computed(() => currentRecords.value.filter((r) => r.category === 'homework'));
    const examItems = computed(() => currentRecords.value.filter((r) => r.category === 'exam'));
    const submissionItems = computed(() => currentRecords.value.filter((r) => r.category === 'submission'));
    const reminderItems = computed(() => currentRecords.value.filter((r) => r.category === 'reminder'));

    // 日期導覽切換
    function changeDay(delta) {
      const [y, m, d] = currentDate.value.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + delta);
      const newY = date.getFullYear();
      const newM = String(date.getMonth() + 1).padStart(2, '0');
      const newD = String(date.getDate()).padStart(2, '0');
      currentDate.value = `${newY}-${newM}-${newD}`;
    }

    function goToday() {
      currentDate.value = getTodayString();
    }

    // 讀取資料（優先自 Supabase 讀取，降級讀取本機 records.json）
    async function loadData() {
      isLoading.value = true;
      try {
        const res = await SupabaseSync.loadData(sbConfig);
        if (res.success && res.data) {
          classTitle.value = res.data.classTitle || '班級聯絡簿';
          announcement.value = res.data.announcement || '';
          records.value = Array.isArray(res.data.records) ? res.data.records : [];
          isCloudConnected.value = (res.source === 'supabase' || res.source === 'supabase-initialized');

          // 若當前今天無紀錄，但有其他未來紀錄，自動選取最新日期
          const dates = records.value.map((r) => r.date).sort();
          if (!records.value.some((r) => r.date === currentDate.value) && dates.length > 0) {
            const latestDate = dates[dates.length - 1];
            if (latestDate > currentDate.value) {
              currentDate.value = latestDate;
            }
          }
        } else {
          showToast('無法載入聯絡簿資料', 'error');
        }
      } catch (err) {
        showToast('載入資料發生錯誤：' + err.message, 'error');
      } finally {
        isLoading.value = false;
      }
    }

    // 儲存資料（直接同步發布至 Supabase 雲端資料庫）
    async function saveAllData() {
      if (!isAdmin.value) {
        showToast('您目前為訪客模式，無儲存權限', 'error');
        return;
      }

      if (!sbConfig.supabaseUrl || !sbConfig.supabaseAnonKey) {
        showToast('請先填入 Supabase URL 與 Anon Key 才能同步至雲端', 'info');
        showConfigModal.value = true;
        return;
      }

      isSaving.value = true;
      const payload = {
        classTitle: classTitle.value,
        announcement: announcement.value,
        records: records.value,
      };

      try {
        const res = await SupabaseSync.saveData(sbConfig, payload);
        if (res.success) {
          isCloudConnected.value = true;
          showToast('🎉 成功儲存並同步至 Supabase 雲端！', 'success');
        }
      } catch (err) {
        showToast('雲端儲存失敗：' + err.message, 'error');
      } finally {
        isSaving.value = false;
      }
    }

    // Modal: 打開新增項目
    function openAddModal(defaultCategory = 'homework') {
      isEditingExisting.value = false;
      formItem.id = 'rec-' + Date.now();
      formItem.date = currentDate.value;
      formItem.category = defaultCategory;
      formItem.subject = '';
      formItem.title = '';
      formItem.details = '';
      formItem.dueDate = defaultCategory === 'homework' ? getNextDayString(currentDate.value) : '';
      formItem.priority = 'normal';
      showEditModal.value = true;
    }

    // Modal: 打開編輯現有項目
    function openEditModal(item) {
      isEditingExisting.value = true;
      formItem.id = item.id;
      formItem.date = item.date;
      formItem.category = item.category;
      formItem.subject = item.subject || '';
      formItem.title = item.title;
      formItem.details = item.details || '';
      formItem.dueDate = item.dueDate || '';
      formItem.priority = item.priority || 'normal';
      showEditModal.value = true;
    }

    // 儲存單一項目表單
    function submitItemForm() {
      if (!formItem.title.trim()) {
        showToast('請輸入項目內容或標題', 'error');
        return;
      }

      const itemData = {
        id: formItem.id,
        date: formItem.date,
        category: formItem.category,
        subject: formItem.subject.trim(),
        title: formItem.title.trim(),
        details: formItem.details.trim(),
        dueDate: formItem.dueDate,
        priority: formItem.priority,
      };

      if (isEditingExisting.value) {
        const idx = records.value.findIndex((r) => r.id === itemData.id);
        if (idx !== -1) {
          records.value[idx] = itemData;
        }
      } else {
        records.value.push(itemData);
      }

      showEditModal.value = false;
      showToast(isEditingExisting.value ? '已修改項目' : '已新增項目，記得點擊右上角「發布變更」！', 'success');
    }

    // 刪除項目
    function removeItem(item) {
      if (!confirm(`確定要刪除「${item.title}」嗎？`)) return;
      records.value = records.value.filter((r) => r.id !== item.id);
      showToast('已刪除項目，記得點擊右上角「發布變更」！', 'info');
    }

    // 一鍵複製 LINE 群組格式文字
    function copyLineFormat() {
      const dateText = formatDateWithWeekday(currentDate.value);
      const lines = [
        `📅 【${classTitle.value} - 聯絡簿】`,
        `📆 日期：${dateText}`,
      ];

      if (announcement.value) {
        lines.push(`\n📢【重要公告】\n${announcement.value}`);
      }

      if (homeworkItems.value.length > 0) {
        lines.push(`\n📝【今日作業】`);
        homeworkItems.value.forEach((it, idx) => {
          const subj = it.subject ? `[${it.subject}] ` : '';
          const info = getItemDeadlineInfo(it, currentDate.value);
          const dueText = info ? ` ${info.lineText}` : '';
          lines.push(`${idx + 1}. ${subj}${it.title}${dueText}`);
          if (it.details) lines.push(`   ↳ ${it.details}`);
        });
      }

      if (examItems.value.length > 0) {
        lines.push(`\n📋【測驗考試】`);
        examItems.value.forEach((it, idx) => {
          const subj = it.subject ? `[${it.subject}] ` : '';
          const info = getItemDeadlineInfo(it, currentDate.value);
          const dueText = info ? ` ${info.lineText}` : '';
          lines.push(`${idx + 1}. ${subj}${it.title}${dueText}`);
          if (it.details) lines.push(`   ↳ 範圍/備註: ${it.details}`);
        });
      }

      if (submissionItems.value.length > 0) {
        lines.push(`\n📦【繳交項目】`);
        submissionItems.value.forEach((it, idx) => {
          const subj = it.subject ? `[${it.subject}] ` : '';
          const info = getItemDeadlineInfo(it, currentDate.value);
          const dueText = info ? ` ${info.lineText}` : '';
          lines.push(`${idx + 1}. ${subj}${it.title}${dueText}`);
          if (it.details) lines.push(`   ↳ 說明: ${it.details}`);
        });
      }

      if (reminderItems.value.length > 0) {
        lines.push(`\n🔔【提醒事項】`);
        reminderItems.value.forEach((it, idx) => {
          const subj = it.subject ? `[${it.subject}] ` : '';
          const info = getItemDeadlineInfo(it, currentDate.value);
          const dueText = info ? ` ${info.lineText}` : '';
          lines.push(`${idx + 1}. ${subj}${it.title}${dueText}`);
          if (it.details) lines.push(`   ↳ ${it.details}`);
        });
      }

      lines.push(`\n🔗 線上聯絡簿完整網址：${window.location.origin + window.location.pathname}`);

      const fullText = lines.join('\n');
      navigator.clipboard
        .writeText(fullText)
        .then(() => {
          showToast('📋 已複製 LINE 格式文字，可直接貼至班級群組！', 'success');
        })
        .catch(() => {
          // 降級方式
          const textarea = document.createElement('textarea');
          textarea.value = fullText;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          showToast('📋 已複製 LINE 格式文字！', 'success');
        });
    }

    // 列印
    function printNotebook() {
      window.print();
    }

    // 密碼登入相關
    function openPasswordModal() {
      passwordModalTitle.value = '解鎖編輯模式';
      passwordModalSubtitle.value = '請輸入通行密碼以開啟權限';
      inputPassword.value = '';
      loginError.value = '';
      showPasswordModal.value = true;
    }

    function openSuperAdminModal() {
      passwordModalTitle.value = '管理員驗證';
      passwordModalSubtitle.value = '請輸入管理員密碼以解鎖公告與系統設定';
      inputPassword.value = '';
      loginError.value = '';
      showPasswordModal.value = true;
    }

    function submitPassword() {
      const role = SupabaseSync.verifyPassword(inputPassword.value);
      if (role === 'super_admin') {
        SupabaseSync.setSessionAuth('super_admin');
        isAdmin.value = true;
        isSuperAdmin.value = true;
        showPasswordModal.value = false;
        inputPassword.value = '';
        loginError.value = '';
        showToast('👑 管理員驗證成功！已解鎖公告與設定功能', 'success');
        updateAdminLinks();
      } else if (role === 'editor') {
        SupabaseSync.setSessionAuth('editor');
        isAdmin.value = true;
        isSuperAdmin.value = false;
        showPasswordModal.value = false;
        inputPassword.value = '';
        loginError.value = '';
        showToast('✏️ 編輯密碼驗證成功！已切換至編輯模式', 'success');
        updateAdminLinks();
      } else {
        loginError.value = '密碼錯誤，請重新輸入';
      }
    }

    function logoutAdmin() {
      SupabaseSync.setSessionAuth(null);
      isAdmin.value = false;
      isSuperAdmin.value = false;
      showConfigModal.value = false;
      showClassInfoModal.value = false;
      // 清理網址中的 hash
      try {
        window.history.replaceState(null, '', window.location.pathname);
      } catch (e) {}
      showToast('已退出編輯，切換為唯讀訪客模式', 'info');
    }

    // 專屬免密碼快速網址
    const simplePasswordLink = ref('');
    const superAdminLink = ref('');

    function updateAdminLinks() {
      const editorPwd = sbConfig.editorPassword || SupabaseSync.DEFAULT_EDITOR_PASSWORD;
      const superPwd = sbConfig.superAdminPassword || SupabaseSync.DEFAULT_SUPER_ADMIN_PASSWORD;
      simplePasswordLink.value = SupabaseSync.generateEditorLink(editorPwd);
      superAdminLink.value = SupabaseSync.generateSuperAdminLink(superPwd);
    }

    // 測試 Supabase 連線
    async function testSupabaseConnection() {
      if (!sbConfig.supabaseUrl || !sbConfig.supabaseAnonKey) {
        connectionTestResult.value = {
          success: false,
          message: '請先輸入 Supabase 專案網址與 Anon Key！',
        };
        return;
      }
      isTestingConnection.value = true;
      connectionTestResult.value = null;
      try {
        await SupabaseSync.testConnection(sbConfig.supabaseUrl, sbConfig.supabaseAnonKey);
        connectionTestResult.value = {
          success: true,
          message: '✅ 連線成功！Supabase 資料庫運作正常，contact_book 資料表已就緒。',
        };
        isCloudConnected.value = true;
      } catch (err) {
        connectionTestResult.value = {
          success: false,
          message: '❌ 連線失敗：' + (err.message || '請確認網址、金鑰或 SQL 資料表是否已建立。'),
        };
        isCloudConnected.value = false;
      } finally {
        isTestingConnection.value = false;
      }
    }

    // 儲存 Supabase 設定
    function saveSupabaseSettings() {
      SupabaseSync.saveConfig(sbConfig);
      isAdmin.value = true;
      updateAdminLinks();
      loadData();
      initRealtime();
      showToast('設定已成功儲存！', 'success');
    }

    function copySimplePasswordLink() {
      if (!simplePasswordLink.value) {
        updateAdminLinks();
      }
      navigator.clipboard.writeText(simplePasswordLink.value).then(() => {
        showToast('🔗 已複製編輯專屬連結！可私下傳送給編輯人員。', 'success');
      });
    }

    function copySuperAdminLink() {
      if (!superAdminLink.value) {
        updateAdminLinks();
      }
      navigator.clipboard.writeText(superAdminLink.value).then(() => {
        showToast('👑 已複製管理員免密碼連結！', 'success');
      });
    }

    // 下載 JSON 備份
    function downloadBackup() {
      const payload = {
        classTitle: classTitle.value,
        announcement: announcement.value,
        records: records.value,
      };
      SupabaseSync.downloadBackup(payload);
      showToast('已匯出 JSON 資料備份檔', 'info');
    }

    // 初始化即時推播監聽 (Realtime)
    function initRealtime() {
      if (!sbConfig.supabaseUrl || !sbConfig.supabaseAnonKey) return;
      SupabaseSync.subscribeToChanges(sbConfig, (newData) => {
        if (newData) {
          classTitle.value = newData.classTitle || classTitle.value;
          announcement.value = newData.announcement !== undefined ? newData.announcement : announcement.value;
          if (Array.isArray(newData.records)) {
            records.value = newData.records;
          }
          isCloudConnected.value = true;
          showToast('⚡ 偵測到雲端即時更新，聯絡簿已同步最新內容！', 'info');
        }
      });
    }

    // 輔助函式：隔天字串
    function getNextDayString(dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const next = new Date(y, m - 1, d + 1);
      const ny = next.getFullYear();
      const nm = String(next.getMonth() + 1).padStart(2, '0');
      const nd = String(next.getDate()).padStart(2, '0');
      return `${ny}-${nm}-${nd}`;
    }

    // 初始化載入
    onMounted(() => {
      // 解析身分與設定
      const effective = SupabaseSync.getEffectiveConfig();
      sbConfig.supabaseUrl = effective.supabaseUrl;
      sbConfig.supabaseAnonKey = effective.supabaseAnonKey;
      sbConfig.editorPassword = effective.editorPassword;
      sbConfig.superAdminPassword = effective.superAdminPassword;

      // 若網址帶有密碼或已有 Session，解鎖對應管理模式
      if (effective.isAdminRoute) {
        isAdmin.value = true;
        isSuperAdmin.value = effective.isSuperAdmin;
      }

      updateAdminLinks();
      loadData();
      initRealtime();
    });

    return {
      classTitle,
      announcement,
      records,
      currentDate,
      viewMode,
      isLoading,
      isSaving,
      isAdmin,
      isSuperAdmin,
      sbConfig,
      isCloudConnected,
      isTestingConnection,
      connectionTestResult,
      testSupabaseConnection,
      saveSupabaseSettings,
      showConfigModal,
      showClassInfoModal,
      showEditModal,
      isEditingExisting,
      formItem,
      showPasswordModal,
      inputPassword,
      loginError,
      passwordModalTitle,
      passwordModalSubtitle,
      openPasswordModal,
      openSuperAdminModal,
      submitPassword,
      logoutAdmin,
      simplePasswordLink,
      copySimplePasswordLink,
      superAdminLink,
      copySuperAdminLink,
      getItemDeadlineInfo,
      toast,
      currentRecords,
      homeworkItems,
      examItems,
      submissionItems,
      reminderItems,
      formatDateWithWeekday,
      changeDay,
      goToday,
      saveAllData,
      openAddModal,
      openEditModal,
      submitItemForm,
      removeItem,
      copyLineFormat,
      printNotebook,
      downloadBackup,
    };
  },
}).mount('#app');
