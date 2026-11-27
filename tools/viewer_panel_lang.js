'use strict';
// 若使用者尚未在看板中自行選擇面板語言，將「上下文檢視器與 Token 用量看板」的面板語言設為繁體中文。
// 使用者之後在看板內改選的語言會被保留，不會被覆蓋。
// 用法：node tools/viewer_panel_lang.js [zh-TW|zh-CN|en] [--force]
const path = require('path');

const collector = require(path.join(__dirname, '..', 'context-viewer', 'meter-collector.js'));
const args = process.argv.slice(2);
const force = args.includes('--force');
const lang = args.find(a => !a.startsWith('--')) || 'zh-TW';

try {
  const cur = collector.getPluginSettings();
  if (!force && cur && cur.panelLanguageExplicit) {
    console.log('kept:' + cur.panelLanguage);
    process.exit(0);
  }
  const res = collector.savePluginSettings({ panelLanguage: lang });
  if (res && res.ok) {
    console.log('set:' + lang);
    process.exit(0);
  }
  console.log('failed:' + JSON.stringify(res));
  process.exit(1);
} catch (e) {
  console.log('failed:' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}
