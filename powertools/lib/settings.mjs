import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_PROXY_BYPASS, isValidProxyBypass, isValidProxyUrl, normalizeProxyBypass, normalizeProxyUrl } from './proxy.mjs';

import { SUPPORTED_LANGUAGES, matchLocale } from './locales/index.mjs';
export { SUPPORTED_LANGUAGES };

export const OVERVIEW_RANGE_OPTIONS = Object.freeze(['weeklyQuota', 'today', '24h', 'yesterday', 'week', 'month', '30d', 'all']);
export const PRICING_MODES = Object.freeze(['standard', 'promo']);
export const TOKEN_UNITS = Object.freeze(['compact', 'zh']);
export const CURRENCIES = Object.freeze(['USD', 'CNY']);
export const DEFAULT_CNY_RATE = 7.2;
export const USER_BUBBLE_PRESETS = Object.freeze(['accent', 'slate', 'ocean', 'sage', 'sand', 'plum', 'custom']);
export const WORKING_BEAM_PALETTES = Object.freeze(['gemini', 'aurora', 'colorful', 'neon', 'accent', 'quota']);
export const SIDEBAR_BEAM_PALETTES = Object.freeze(['sync', 'gemini', 'aurora', 'colorful', 'neon', 'accent']);
export const SIDEBAR_BEAM_STYLES = Object.freeze(['sweep', 'pulse-inner', 'pulse-outside']);
export const SETTINGS_EXPORT_FORMAT = 'agy-powertools-settings';
export const SETTINGS_EXPORT_SCHEMA_VERSION = 1;
export const SETTINGS_IMPORT_MAX_BYTES = 128 * 1024;
export const NON_PORTABLE_SETTING_KEYS = new Set(['enabled', 'multiAccount', 'autoSwitchAccount']);
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function detectSystemLanguage({ locale, env = process.env } = {}) {
  const candidates = [
    locale,
    env?.LC_ALL,
    env?.LC_MESSAGES,
    env?.LANG,
    (() => { try { return Intl.DateTimeFormat().resolvedOptions().locale; } catch { return ''; } })()
  ];
  for (const raw of candidates) {
    const clean = String(raw || '').trim().split('.')[0].split('@')[0].replaceAll('_', '-');
    if (!clean || /^(?:c|posix)$/i.test(clean)) continue;
    return matchLocale(clean);
  }
  return 'zh-CN';
}

export const DEFAULT_LANGUAGE = detectSystemLanguage();

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  sshCommandPaste: true,
  sidebarFolderDrop: true,
  sidebarFolderDropPin: false,
  customFont: '', customFontWeight: 0,
  compact: true, userBubbleTint: false, userBubblePreset: 'accent', userBubbleColor: '#2F75C3', userBubbleStrength: 20, contextRing: true, speedStats: true, timing: true, toolDetails: true, turnMeta: false,
  responseBranch: true, messageEdit: true, fileContextMenu: true, sessionSearch: true, progress: true, overviewQuota: false, titlebarQuickPanel: false, composerQuotaHalo: false, composerQuotaHaloWindow: 'auto', composerWorkingBeam: false, composerWorkingBeamPalette: 'gemini', sidebarRunningBeam: false, sidebarRunningBeamPalette: 'sync', sidebarRunningBeamStyle: 'sweep', sidebarHideNativeSpinner: true, sidebarRunningGroup: false, subagentTelemetry: true, keepTurnOutline:true, keepOverviewOpen:true, taskbarBadge:true, macAutoRelaunch:true, autoCheckUpdates:true, autoInstallUpdates:false, multiAccount:false, accountSwitcher:true, accountViewMode:'list', accountQuotaWindow:'5h', autoSwitchAccount:false, proxyEnabled:false, proxyUrl:'', proxyBypass:DEFAULT_PROXY_BYPASS, proxyForceHttp1:false, stageUpdates:true, efficientIO:false, language: DEFAULT_LANGUAGE, overviewRange: 'weeklyQuota', pricingMode: 'standard', tokenUnit: 'compact', currency: 'USD', cnyRate: DEFAULT_CNY_RATE, contextLimit: 0, sidebarProjectLimit: 0
});
const validSetting = (key,value) => key === 'customFontWeight' ? [0,300,400,500,600,700].includes(value) : key === 'customFont' ? (typeof value === 'string' && value.length <= 128 && !/[;{}\\<>\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value)) : key === 'language' ? SUPPORTED_LANGUAGES.includes(value) : key === 'overviewRange' ? OVERVIEW_RANGE_OPTIONS.includes(value) : key === 'pricingMode' ? PRICING_MODES.includes(value) : key === 'tokenUnit' ? TOKEN_UNITS.includes(value) : key === 'currency' ? CURRENCIES.includes(value) : key === 'cnyRate' ? (typeof value === 'number' && Number.isFinite(value) && value >= 0.1 && value <= 1000) : key === 'userBubblePreset' ? USER_BUBBLE_PRESETS.includes(value) : key === 'userBubbleColor' ? (typeof value === 'string' && HEX_COLOR_RE.test(value.trim())) : key === 'userBubbleStrength' ? (Number.isInteger(value) && value >= 10 && value <= 100) : key === 'accountViewMode' ? ['list','card'].includes(value) : key === 'accountQuotaWindow' ? ['5h','weekly'].includes(value) : key === 'composerQuotaHaloWindow' ? ['auto','weekly','5h'].includes(value) : key === 'composerWorkingBeamPalette' ? WORKING_BEAM_PALETTES.includes(value) : key === 'sidebarRunningBeamPalette' ? SIDEBAR_BEAM_PALETTES.includes(value) : key === 'sidebarRunningBeamStyle' ? SIDEBAR_BEAM_STYLES.includes(value) : key === 'contextLimit' ? [0,256000,500000,1000000].includes(value) : key === 'sidebarProjectLimit' ? [0,1,2,3,4,5,10,-1].includes(value) : key === 'proxyUrl' ? isValidProxyUrl(value) : key === 'proxyBypass' ? isValidProxyBypass(value) : typeof value === 'boolean';
const coerceSetting = (key, value) => key === 'customFont' ? value.trim() : key === 'proxyUrl' ? (normalizeProxyUrl(value) || '') : key === 'proxyBypass' ? (normalizeProxyBypass(value) || DEFAULT_PROXY_BYPASS) : key === 'userBubbleColor' ? value.trim().toUpperCase() : value;
export function normalizeSettings(value = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [key, validSetting(key,value[key]) ? coerceSetting(key,value[key]) : fallback]));
}

export function stripProxyUrlCredentials(raw) {
  if (typeof raw !== 'string') return { url: raw, stripped: false };
  const trimmed = raw.trim();
  if (!trimmed) return { url: raw, stripped: false };
  let parsed;
  try { parsed = new URL(trimmed); } catch { return { url: raw, stripped: false }; }
  if (!parsed.username && !parsed.password) return { url: raw, stripped: false };
  parsed.username = '';
  parsed.password = '';
  const normalized = normalizeProxyUrl(parsed.toString());
  if (normalized !== null) return { url: normalized, stripped: true };
  const hadTrailingSlash = trimmed.endsWith('/');
  let clean = parsed.toString();
  if (!hadTrailingSlash && clean.endsWith('/') && parsed.pathname === '/' && !parsed.search && !parsed.hash) {
    clean = clean.slice(0, -1);
  }
  return { url: clean, stripped: true };
}

export function exportSettingsPayload(currentSettings = {}, { pluginVersion = '' } = {}) {
  const source = currentSettings && typeof currentSettings === 'object' && !Array.isArray(currentSettings) ? currentSettings : {};
  const rawProxyValid = validSetting('proxyUrl', source.proxyUrl);
  const rawProxyCheck = rawProxyValid ? stripProxyUrlCredentials(source.proxyUrl) : { url: '', stripped: false };
  const normalized = normalizeSettings(source);
  const proxyCheck = rawProxyCheck.stripped
    ? { url: normalizeProxyUrl(rawProxyCheck.url) || '', stripped: true }
    : stripProxyUrlCredentials(normalized.proxyUrl);
  const exported = {};
  for (const [key, value] of Object.entries(normalized)) {
    if (NON_PORTABLE_SETTING_KEYS.has(key)) continue;
    exported[key] = key === 'proxyUrl' ? (normalizeProxyUrl(proxyCheck.url) || '') : value;
  }
  return {
    format: SETTINGS_EXPORT_FORMAT,
    schemaVersion: SETTINGS_EXPORT_SCHEMA_VERSION,
    pluginVersion: typeof pluginVersion === 'string' ? pluginVersion : '',
    exportedAt: new Date().toISOString(),
    settings: exported,
    strippedProxyAuth: proxyCheck.stripped
  };
}

export function sanitizeImportedSettings(rawPayload) {
  const fail = (code, msg) => {
    const err = new Error(msg);
    err.code = code;
    throw err;
  };
  let payload;
  if (typeof rawPayload === 'string') {
    if (Buffer.byteLength(rawPayload, 'utf8') > SETTINGS_IMPORT_MAX_BYTES) {
      fail('too-large', '设置导入文件过大（超过 128 KB 限制）');
    }
    try { payload = JSON.parse(rawPayload); } catch { fail('invalid-json', '设置导入文件 JSON 格式无效'); }
  } else if (rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)) {
    let serializedSize = 0;
    try { serializedSize = Buffer.byteLength(JSON.stringify(rawPayload), 'utf8'); } catch { fail('invalid-data', '设置导入数据格式无效'); }
    if (serializedSize > SETTINGS_IMPORT_MAX_BYTES) {
      fail('too-large', '设置导入文件过大（超过 128 KB 限制）');
    }
    payload = rawPayload;
  } else {
    fail('invalid-data', '设置导入数据格式无效');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('invalid-data', '设置导入数据格式无效');
  }
  if (payload.format !== SETTINGS_EXPORT_FORMAT) {
    fail('invalid-format', '不支持的设置文件格式');
  }
  if (!Number.isInteger(payload.schemaVersion) || payload.schemaVersion < 1 || payload.schemaVersion > SETTINGS_EXPORT_SCHEMA_VERSION) {
    fail('unsupported-version', '不支持的设置文件版本');
  }
  if (!payload.settings || typeof payload.settings !== 'object' || Array.isArray(payload.settings)) {
    fail('missing-settings', '设置文件缺少有效的 settings 配置对象');
  }
  const patch = {};
  const skippedKeys = [];
  let strippedProxyAuth = false;
  for (const [key, rawValue] of Object.entries(payload.settings)) {
    if (NON_PORTABLE_SETTING_KEYS.has(key) || !Object.hasOwn(DEFAULT_SETTINGS, key)) {
      skippedKeys.push(key);
      continue;
    }
    let value = rawValue;
    let proxyAuthWasStripped = false;
    if (key === 'proxyUrl' && typeof value === 'string') {
      const stripped = stripProxyUrlCredentials(value);
      if (stripped.stripped) {
        value = stripped.url;
        proxyAuthWasStripped = true;
      }
    }
    if (!validSetting(key, value)) {
      skippedKeys.push(key);
      continue;
    }
    if (proxyAuthWasStripped) strippedProxyAuth = true;
    patch[key] = coerceSetting(key, value);
  }
  const importedKeys = Object.keys(patch);
  if (importedKeys.length === 0) {
    fail('no-applicable-settings', '未找到可应用的有效设置项');
  }
  return {
    patch,
    appliedCount: importedKeys.length,
    importedKeys,
    skippedKeys,
    strippedProxyAuth
  };
}

export function createSettingsStore(directory = join(homedir(), '.gemini', 'antigravity', 'plugin_data', 'agy-powertools')) {
  const path = join(directory, 'settings.json');
  return {
    get() {
      try { return normalizeSettings(existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}); }
      catch { return { ...DEFAULT_SETTINGS }; }
    },
    set(patch) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('设置格式无效');
      for (const [key, value] of Object.entries(patch)) {
        if (!Object.hasOwn(DEFAULT_SETTINGS, key) || !validSetting(key,value)) throw new Error('设置选项无效');
      }
      const value = normalizeSettings({ ...this.get(), ...patch });
      mkdirSync(directory, { recursive: true });
      writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n', 'utf8');
      renameSync(`${path}.tmp`, path);
      return value;
    },
    reset() {
      return this.set({ ...DEFAULT_SETTINGS });
    }
  };
}
