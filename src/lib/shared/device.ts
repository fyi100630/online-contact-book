// 從 User-Agent 判斷登入用的裝置。後台「登入紀錄」顯示與 Discord 可疑登入通知共用。

/** Android App 自己帶的 User-Agent 開頭（見 Android repo 的 AppViewModel.kt） */
export const APP_UA_PREFIX = 'ContactBookAndroid/';

const SCRIPT_RE = /curl|wget|python|node|undici|axios|go-http|java\/|okhttp|httpclient|httpx|aiohttp|libwww|postman|insomnia|bot|spider|scrapy/i;

/** 是不是程式或腳本（不是瀏覽器、也不是我們的 App）。沒有 User-Agent 也算，正常瀏覽器一定會帶。 */
export function isScriptUA(ua: string | null | undefined): boolean {
  if (!ua) return true;
  if (ua.startsWith(APP_UA_PREFIX)) return false;
  return SCRIPT_RE.test(ua);
}

/** 把 User-Agent 變成看得懂的裝置名稱 */
export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return '不明';
  if (ua.startsWith(APP_UA_PREFIX)) return `App ${ua.slice(APP_UA_PREFIX.length)}`;
  if (isScriptUA(ua)) return '程式／腳本（不是瀏覽器）';
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Line\//.test(ua) ? 'LINE' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return [os, browser].filter(Boolean).join(' ') || '其他';
}
