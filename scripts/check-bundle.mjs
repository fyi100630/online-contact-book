// 檢查「會送到瀏覽器的檔案」裡沒有任何秘密或伺服器端程式碼。
// 用法：npm run build && npm run check:bundle
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = '.next/static';
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(ROOT);

// 1. 不應該出現在瀏覽器端的字串（伺服器端程式、資料庫結構、雜湊演算法）
const forbidden = ['password_hash', 'process.env.DATABASE_URL', 'process.env.SETUP_TOKEN', 'contactbook_app', 'app.sessions', 'app.users', 'set_config', 'scrypt', 'service_role', 'postgres://', 'postgresql://'];
// 2. 目前環境變數裡的秘密值本身
for (const key of ['DATABASE_URL', 'SETUP_TOKEN']) {
  const v = process.env[key];
  if (v && v.length >= 8) forbidden.push(v);
}

let problems = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const needle of forbidden) {
    if (text.includes(needle)) {
      const shown = needle.length > 20 ? needle.slice(0, 6) + '…(secret value)' : needle;
      console.error(`✗ ${file} contains "${shown}"`);
      problems++;
    }
  }
  if (file.endsWith('.map')) {
    console.error(`✗ source map shipped to browser: ${file}`);
    problems++;
  }
}
console.log(`scanned ${files.length} browser files`);
if (problems) {
  console.error(`✗ ${problems} problem(s) found`);
  process.exit(1);
}
console.log('✓ no secrets or server-only code in the browser bundle');
