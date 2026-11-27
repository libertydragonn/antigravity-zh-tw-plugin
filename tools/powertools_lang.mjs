// 第一次安裝 Agy Powertools 時，把它的介面語言設為繁體中文。
// 已經有設定檔（使用者用過或改過設定）就不動，之後在 Powertools 設定裡改選的語言會被保留。
// 用法：node tools/powertools_lang.mjs [zh-TW] [--force]
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const force = args.includes('--force');
const lang = args.find(a => !a.startsWith('--')) || 'zh-TW';
const dir = join(homedir(), '.gemini', 'antigravity', 'plugin_data', 'agy-powertools');

try {
  if (!force && existsSync(join(dir, 'settings.json'))) {
    console.log('kept');
    process.exit(0);
  }
  const { createSettingsStore } = await import(pathToFileURL(join(here, '..', 'powertools', 'lib', 'settings.mjs')).href);
  const saved = createSettingsStore(dir).set({ language: lang });
  console.log('set:' + saved.language);
} catch (e) {
  console.log('failed:' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}
