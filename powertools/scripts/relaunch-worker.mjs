import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { dirname, isAbsolute, join, parse as parsePath, relative, resolve, win32 } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const NONCE_RE = /^[a-f0-9-]{16,64}$/i;
const JOB_TTL_MS = 60_000;
const TARGET_BASENAME_RE = /^antigravity\.exe$/i;
const ALLOWED_ARG_PATTERNS = [
  /^--remote-debugging-port=0$/,
  /^--proxy-server=(?:https?|socks5):\/\/[^\x00-\x1f\x7f\s'"`\\;$|&<>]{1,256}$/,
  /^--proxy-bypass-list=[^\x00-\x1f\x7f'"`\\$|&<>]{1,512}$/
];
const ALLOWED_PROXY_ENV_KEYS = new Set([
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
  'NO_PROXY',
  'no_proxy',
  'AGY_POWERTOOLS_PROXY_SPEC',
  'GODEBUG'
]);
const PROXY_URL_VALUE_RE = /^(?:https?|socks5h?):\/\/[^\x00-\x1f\x7f\s'"`\\;$|&<>]{1,256}$/;
const NO_PROXY_VALUE_RE = /^[^\x00-\x1f\x7f'"`\\$|&<>]{0,512}$/;
const PROXY_SPEC_VALUE_RE = /^[^\x00-\x1f\x7f'"`\\$&<>]{1,768}$/;
const SAFE_EMAIL_RE = /^[^\s@"'`\\;|$<>]{1,120}@[^\s@"'`\\;|$<>]{1,120}\.[^\s@"'`\\;|$<>]{1,63}$/;
const SAFE_ACCOUNT_ID_RE = /^[a-z0-9_-]{1,64}$/i;
const SAFE_SHORT_HASH_RE = /^[0-9a-f]{12}$/i;
const SAFE_SWITCH_ID_RE = /^[0-9a-f-]{36}$/i;
const ALLOWED_CRED_SWITCH_KEYS = new Set(['accountId', 'expectedEmail', 'expectedHash', 'switchId']);
const CLEAR_SCOPE_BASENAME_RE = /^credential-user-scope$/i;
const CREDENTIAL_WRITER_IMAGE_RE = /^(?:antigravity|language_server(?:[\w.-]*)?|agy)\.exe$/i;
const LANGUAGE_SERVER_IMAGE_RE = /^language_server(?:[\w.-]*)?\.exe$/i;
const SCRUB_ENV_EXACT = new Set([
  'ELECTRON_RUN_AS_NODE',
  'NODE_OPTIONS',
  'ANTIGRAVITY_LS_ADDRESS',
  'ANTIGRAVITY_CSRF_TOKEN',
  'ANTIGRAVITY_AGENTAPI_EXE'
]);
const CLEAR_PROXY_ENV_UPPER = new Set([
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'AGY_POWERTOOLS_PROXY_SPEC'
]);

function sleep(ms) {
  return new Promise(resolvePromise => setTimeout(resolvePromise, Math.max(0, ms)));
}

function samePath(a, b) {
  const ra = resolve(a);
  const rb = resolve(b);
  return process.platform === 'win32' ? ra.toLowerCase() === rb.toLowerCase() : ra === rb;
}

function isLocalAbsolutePath(p) {
  return typeof p === 'string' && p.length > 0 && p.length <= 512 && isAbsolute(p) &&
    !/^[\\/]{2}|[\x00-\x1f\x7f]/.test(p) &&
    (process.platform !== 'win32' || /^[A-Za-z]:[\\/]/.test(p)) &&
    !p.split(/[\\/]/).includes('..');
}

export function verifiedSwitchProfileDir(dirPath) {
  if (isLocalAbsolutePath(dirPath)) {
    try {
      const dir = realpathSync.native(dirPath);
      if (isLocalAbsolutePath(dir) && dir !== parsePath(dir).root && statSync(dir).isDirectory()) return dir;
    } catch {}
  }
  throw new Error('无法确认账号切换的用户数据目录');
}

function isInsideDir(baseDir, candidatePath) {
  if (!baseDir || !candidatePath || typeof candidatePath !== 'string') return false;
  if (/[\x00-\x1f\x7f]/.test(candidatePath)) return false;
  const resolvedBase = resolve(baseDir);
  const resolvedCandidate = resolve(candidatePath);
  const cmpBase = process.platform === 'win32' ? resolvedBase.toLowerCase() : resolvedBase;
  const cmpCand = process.platform === 'win32' ? resolvedCandidate.toLowerCase() : resolvedCandidate;
  const rel = relative(cmpBase, cmpCand);
  if (!rel || isAbsolute(rel)) return false;
  const segments = rel.split(/[\\/]+/);
  return segments.every(seg => seg && seg !== '.' && seg !== '..');
}

function atomicWriteJson(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tmpPath, JSON.stringify(value) + '\n', { encoding: 'utf8', mode: 0o600 });
    renameSync(tmpPath, filePath);
  } finally {
    try { if (existsSync(tmpPath)) unlinkSync(tmpPath); } catch {}
  }
}

function formatTimestamp(date = new Date()) {
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function validateRelaunchJob(
  job,
  { jobPath = '', now = Date.now, exists = existsSync, allowAnyTargetForTest = false } = {}
) {
  if (!job || typeof job !== 'object' || Array.isArray(job)) {
    return { valid: false, reason: 'invalid-job-object' };
  }
  if (job.format !== 1) {
    return { valid: false, reason: 'invalid-format' };
  }
  if (typeof job.nonce !== 'string' || !NONCE_RE.test(job.nonce)) {
    return { valid: false, reason: 'invalid-nonce' };
  }
  const nowMs = typeof now === 'function' ? now() : Number(now);
  if (!Number.isFinite(job.requestedAt) || !Number.isFinite(nowMs) || Math.abs(nowMs - job.requestedAt) > JOB_TTL_MS) {
    return { valid: false, reason: 'expired-job' };
  }
  if (typeof job.target !== 'string' || !job.target.trim() || job.target.length > 512 || /[\x00-\x1f\x7f]/.test(job.target)) {
    return { valid: false, reason: 'invalid-target' };
  }
  if (!allowAnyTargetForTest && !TARGET_BASENAME_RE.test(win32.basename(job.target))) {
    return { valid: false, reason: 'disallowed-target' };
  }
  if (!exists(job.target)) {
    return { valid: false, reason: 'target-not-found' };
  }
  if (!Array.isArray(job.args) || job.args.length > 10) {
    return { valid: false, reason: 'invalid-args' };
  }
  for (const arg of job.args) {
    if (typeof arg !== 'string' || !ALLOWED_ARG_PATTERNS.some(re => re.test(arg))) {
      return { valid: false, reason: 'disallowed-arg' };
    }
  }
  if (job.proxyEnv !== undefined && job.proxyEnv !== null) {
    if (typeof job.proxyEnv !== 'object' || Array.isArray(job.proxyEnv)) {
      return { valid: false, reason: 'invalid-proxy-env' };
    }
    for (const [key, value] of Object.entries(job.proxyEnv)) {
      if (!ALLOWED_PROXY_ENV_KEYS.has(key)) {
        return { valid: false, reason: 'disallowed-env-key' };
      }
      if (typeof value !== 'string' || /[\x00-\x1f\x7f]/.test(value)) {
        return { valid: false, reason: 'invalid-env-value' };
      }
      if (key === 'GODEBUG') {
        if (value !== 'http2client=0') return { valid: false, reason: 'disallowed-godebug' };
      } else if (key === 'NO_PROXY' || key === 'no_proxy') {
        if (!NO_PROXY_VALUE_RE.test(value)) return { valid: false, reason: 'invalid-no-proxy' };
      } else if (key === 'AGY_POWERTOOLS_PROXY_SPEC') {
        if (!PROXY_SPEC_VALUE_RE.test(value)) return { valid: false, reason: 'invalid-proxy-spec' };
      } else {
        if (!PROXY_URL_VALUE_RE.test(value)) return { valid: false, reason: 'invalid-proxy-url' };
      }
    }
  }
  if (typeof job.ackPath !== 'string' || !job.ackPath.trim()) {
    return { valid: false, reason: 'invalid-ack-path' };
  }
  if (jobPath && !isInsideDir(dirname(resolve(jobPath)), job.ackPath)) {
    return { valid: false, reason: 'ack-path-traversal' };
  }
  if (job.logPath !== undefined && job.logPath !== null && job.logPath !== '') {
    if (typeof job.logPath !== 'string' || (jobPath && !isInsideDir(dirname(resolve(jobPath)), job.logPath))) {
      return { valid: false, reason: 'log-path-traversal' };
    }
  }
  if (job.onboardingSync !== undefined && job.onboardingSync !== null) {
    const sync = job.onboardingSync;
    if (typeof sync !== 'object' || Array.isArray(sync)) {
      return { valid: false, reason: 'invalid-onboarding-sync' };
    }
    if (typeof sync.email !== 'string' || !SAFE_EMAIL_RE.test(sync.email.trim())) {
      return { valid: false, reason: 'invalid-onboarding-email' };
    }
    if (sync.isGcpTos !== null && sync.isGcpTos !== undefined && typeof sync.isGcpTos !== 'boolean') {
      return { valid: false, reason: 'invalid-onboarding-tos' };
    }
    if (typeof sync.appStoragePath !== 'string' || !/^app_storage\.json$/i.test(win32.basename(sync.appStoragePath))) {
      return { valid: false, reason: 'invalid-onboarding-storage' };
    }
  }
  if (job.credentialSwitch !== undefined && job.credentialSwitch !== null) {
    const cs = job.credentialSwitch;
    if (typeof cs !== 'object' || Array.isArray(cs)) {
      return { valid: false, reason: 'invalid-credential-switch' };
    }
    for (const key of Object.keys(cs)) {
      if (!ALLOWED_CRED_SWITCH_KEYS.has(key)) {
        return { valid: false, reason: 'invalid-credential-switch' };
      }
    }
    if (typeof cs.accountId !== 'string' || !SAFE_ACCOUNT_ID_RE.test(cs.accountId)) {
      return { valid: false, reason: 'invalid-credential-switch-account' };
    }
    if (typeof cs.expectedEmail !== 'string' || !SAFE_EMAIL_RE.test(cs.expectedEmail.trim())) {
      return { valid: false, reason: 'invalid-credential-switch-email' };
    }
    if (cs.expectedHash !== undefined && (typeof cs.expectedHash !== 'string' || !SAFE_SHORT_HASH_RE.test(cs.expectedHash))) {
      return { valid: false, reason: 'invalid-credential-switch' };
    }
    if (cs.switchId !== undefined && (typeof cs.switchId !== 'string' || !SAFE_SWITCH_ID_RE.test(cs.switchId))) {
      return { valid: false, reason: 'invalid-credential-switch' };
    }
    if (cs.switchId !== undefined && !isLocalAbsolutePath(job.profileDir)) {
      return { valid: false, reason: 'invalid-switch-profile' };
    }
  }
  if (job.profileDir !== undefined && job.profileDir !== null && job.profileDir !== '') {
    if (!isLocalAbsolutePath(job.profileDir) || resolve(job.profileDir) === parsePath(resolve(job.profileDir)).root) {
      return { valid: false, reason: 'invalid-switch-profile' };
    }
    if (job.onboardingSync?.appStoragePath && !samePath(job.onboardingSync.appStoragePath, join(job.profileDir, 'app_storage.json'))) {
      return { valid: false, reason: 'invalid-switch-profile' };
    }
    if (job.clearScopePath && !samePath(job.clearScopePath, join(job.profileDir, 'credential-user-scope'))) {
      return { valid: false, reason: 'invalid-switch-profile' };
    }
  }
  if (job.clearScopePath !== undefined && job.clearScopePath !== null && job.clearScopePath !== '') {
    if (
      typeof job.clearScopePath !== 'string' ||
      job.clearScopePath.length > 512 ||
      /[\x00-\x1f\x7f]/.test(job.clearScopePath) ||
      !CLEAR_SCOPE_BASENAME_RE.test(win32.basename(job.clearScopePath))
    ) {
      return { valid: false, reason: 'invalid-clear-scope-path' };
    }
  }
  return { valid: true };
}

export function parseTasklistPids(stdout, { excludePids = new Set(), imageNames = ['antigravity.exe'] } = {}) {
  const allowed = new Set(
    (Array.isArray(imageNames) ? imageNames : [imageNames])
      .map(name => String(name || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const pids = [];
  const seen = new Set();
  for (const rawLine of String(stdout || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^"([^"]+)","(\d+)"/);
    if (!match || !allowed.has(match[1].toLowerCase())) continue;
    const pid = Number(match[2]);
    if (!Number.isInteger(pid) || pid <= 0 || excludePids.has(pid) || seen.has(pid)) continue;
    seen.add(pid);
    pids.push(pid);
  }
  return pids;
}

// Strict unfiltered CSV parser: any error, localized diagnostic, empty output,
// or truncated row fails closed instead of looking like "0 running processes".
export function parseCredentialWriterPids(stdout, excludeOrSelfPid = new Set()) {
  const text = String(stdout || '').trim();
  if (!text) throw new Error('process-list-unavailable');
  let excludePids;
  let pattern = CREDENTIAL_WRITER_IMAGE_RE;
  if (typeof excludeOrSelfPid === 'number') {
    excludePids = new Set([excludeOrSelfPid]);
  } else if (excludeOrSelfPid instanceof Set) {
    excludePids = excludeOrSelfPid;
  } else if (excludeOrSelfPid && typeof excludeOrSelfPid === 'object') {
    excludePids = excludeOrSelfPid.excludePids instanceof Set
      ? excludeOrSelfPid.excludePids
      : new Set(excludeOrSelfPid.excludePids || []);
    if (excludeOrSelfPid.pattern instanceof RegExp) pattern = excludeOrSelfPid.pattern;
  } else {
    excludePids = new Set();
  }
  const pids = [];
  const seen = new Set();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = /^"([^"]+)","(\d+)","[^"]*","\d+","[^"]*"$/.exec(line);
    if (!match) throw new Error('process-list-unavailable');
    const pid = Number(match[2]);
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('process-list-unavailable');
    if (pattern.test(match[1]) && !excludePids.has(pid) && !seen.has(pid)) {
      seen.add(pid);
      pids.push(pid);
    }
  }
  return pids;
}

export function buildCleanTargetEnv(baseEnv, job) {
  const env = { ...(baseEnv || {}) };
  for (const key of Object.keys(env)) {
    const upper = key.toUpperCase();
    if (SCRUB_ENV_EXACT.has(upper) || upper.startsWith('ANTIGRAVITY_SIDECAR_') || (job?.profileDir && upper === 'ANTIGRAVITY_USER_DATA_DIR')) {
      delete env[key];
    }
  }
  if (job?.profileDir) {
    env.ANTIGRAVITY_USER_DATA_DIR = job.profileDir;
  }
  if (job?.proxyEnabled) {
    if (job.proxyEnv && typeof job.proxyEnv === 'object') {
      for (const [key, value] of Object.entries(job.proxyEnv)) {
        if (typeof value === 'string') env[key] = value;
      }
    }
    if (!job.forceHttp1) {
      for (const key of Object.keys(env)) {
        if (key.toUpperCase() === 'GODEBUG' && env[key] === 'http2client=0') {
          delete env[key];
        }
      }
    }
  } else {
    const hasPluginProxySpec = Object.keys(env).some(
      key => key.toUpperCase() === 'AGY_POWERTOOLS_PROXY_SPEC' && Boolean(env[key])
    );
    if (hasPluginProxySpec) {
      for (const key of Object.keys(env)) {
        const upper = key.toUpperCase();
        if (CLEAR_PROXY_ENV_UPPER.has(upper) || (upper === 'GODEBUG' && env[key] === 'http2client=0')) {
          delete env[key];
        }
      }
    }
  }
  return env;
}

const SAFE_WINDOWS_USERNAME_RE = /^[\w .-]{1,64}$/;

export function listWindowsImagePids(imageName, { excludePids = new Set(), env = process.env, runCommand = spawnSync } = {}) {
  const runTasklist = username => {
    const args = ['/FI', `IMAGENAME eq ${imageName}`];
    if (username) args.push('/FI', `USERNAME eq ${username}`);
    args.push('/FO', 'CSV', '/NH');
    return runCommand('tasklist.exe', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      timeout: 8000
    });
  };
  const rawUser = typeof env?.USERNAME === 'string' ? env.USERNAME.trim() : '';
  const safeUser = SAFE_WINDOWS_USERNAME_RE.test(rawUser) ? rawUser : '';
  if (safeUser) {
    const filtered = runTasklist(safeUser);
    if (!filtered?.error && filtered?.status === 0 && String(filtered.stdout || '').trim()) {
      return parseTasklistPids(filtered.stdout, { excludePids, imageNames: [imageName.toLowerCase()] });
    }
  }
  const res = runTasklist('');
  if (!res || res.error || res.status !== 0) return [];
  return parseTasklistPids(res.stdout, { excludePids, imageNames: [imageName.toLowerCase()] });
}

export function listWindowsCredentialWriters({
  excludePids = new Set(),
  env = process.env,
  runCommand = spawnSync,
  pattern = CREDENTIAL_WRITER_IMAGE_RE
} = {}) {
  const runTasklist = username => {
    const args = username
      ? ['/FI', `USERNAME eq ${username}`, '/FO', 'CSV', '/NH']
      : ['/FO', 'CSV', '/NH'];
    return runCommand('tasklist.exe', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      timeout: 8000
    });
  };
  const rawUser = typeof env?.USERNAME === 'string' ? env.USERNAME.trim() : '';
  const safeUser = SAFE_WINDOWS_USERNAME_RE.test(rawUser) ? rawUser : '';
  if (safeUser) {
    const filtered = runTasklist(safeUser);
    if (!filtered?.error && filtered?.status === 0 && String(filtered.stdout || '').trim()) {
      try {
        return parseCredentialWriterPids(filtered.stdout, { excludePids, pattern });
      } catch {}
    }
  }
  const res = runTasklist('');
  if (!res || res.error || res.status !== 0) throw new Error('process-list-unavailable');
  return parseCredentialWriterPids(res.stdout, { excludePids, pattern });
}

function defaultListAntigravityPids(excludePids, env = process.env) {
  return listWindowsImagePids('Antigravity.exe', { excludePids, env });
}

function defaultListLanguageServerPids(excludePids, env = process.env) {
  try {
    return listWindowsCredentialWriters({ excludePids, env, pattern: LANGUAGE_SERVER_IMAGE_RE });
  } catch {
    return listWindowsImagePids('language_server.exe', { excludePids, env });
  }
}

function defaultListWriterPids(excludePids, env = process.env) {
  return listWindowsCredentialWriters({ excludePids, env, pattern: CREDENTIAL_WRITER_IMAGE_RE });
}

function defaultGracefulClosePids(pids) {
  if (!pids?.length) return;
  try {
    spawnSync('taskkill.exe', pids.flatMap(pid => ['/PID', String(pid)]), {
      stdio: 'ignore',
      windowsHide: true,
      timeout: 5000
    });
  } catch {}
}

function defaultGracefulClosePid(pid) {
  defaultGracefulClosePids([pid]);
}

function defaultForceKillPid(pid) {
  try {
    process.kill(pid);
  } catch {}
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === 'EPERM';
  }
}

export async function runRelaunchJob(jobPath, deps = {}) {
  if (!jobPath || typeof jobPath !== 'string' || !existsSync(jobPath)) {
    return { ok: false, reason: 'job-not-found' };
  }
  let job;
  try {
    job = JSON.parse(readFileSync(jobPath, 'utf8'));
  } catch {
    return { ok: false, reason: 'job-parse-error' };
  }

  const now = deps.now || Date.now;
  const exists = deps.exists || existsSync;
  const allowAnyTargetForTest = Boolean(deps.allowAnyTargetForTest);
  const validation = validateRelaunchJob(job, { jobPath, now, exists, allowAnyTargetForTest });
  if (!validation.valid) {
    return { ok: false, reason: validation.reason };
  }

  const excludePids = new Set([process.pid, process.ppid].filter(n => Number.isInteger(n) && n > 0));
  const baseEnv = deps.env || process.env;
  const listTargetPids = deps.listTargetPids || (() => defaultListAntigravityPids(excludePids, baseEnv));
  const listLanguageServerPids = deps.listLanguageServerPids
    || (deps.listTargetPids ? (() => []) : (() => defaultListLanguageServerPids(excludePids, baseEnv)));
  const listWriterPids = deps.listWriterPids
    || ((deps.listTargetPids || deps.listLanguageServerPids)
      ? null
      : (() => defaultListWriterPids(excludePids, baseEnv)));
  const gracefulClosePid = deps.gracefulClosePid || defaultGracefulClosePid;
  const forceKillPid = deps.forceKillPid || defaultForceKillPid;
  const spawnProcess = deps.spawnProcess || spawn;
  const restoreCredential = deps.restoreCredential || null;
  const settleMs = deps.settleMs ?? 350;
  const gracefulTimeoutMs = deps.gracefulTimeoutMs ?? 3000;
  const forceTimeoutMs = deps.forceTimeoutMs ?? 6000;
  const writerTimeoutMs = deps.writerTimeoutMs ?? 5000;
  const postExitSettleMs = deps.postExitSettleMs ?? 450;
  const verifyDelayMs = deps.verifyDelayMs ?? 1200;
  const pollMs = deps.pollMs ?? 250;
  const leadingArgsForTest = Array.isArray(deps.leadingArgsForTest) ? deps.leadingArgsForTest : [];
  const sw = job.credentialSwitch || null;

  const appendLog = message => {
    if (!job.logPath) return;
    try {
      mkdirSync(dirname(job.logPath), { recursive: true });
      appendFileSync(job.logPath, `${formatTimestamp()} ${message}\n`, 'utf8');
    } catch {}
  };

  const cleanupOwnJobFile = () => {
    try {
      if (existsSync(jobPath) && JSON.parse(readFileSync(jobPath, 'utf8')).nonce === job.nonce) {
        unlinkSync(jobPath);
      }
    } catch {}
  };

  const finishFailed = (reason, { preClose = false } = {}) => {
    try {
      atomicWriteJson(job.ackPath, {
        nonce: job.nonce,
        pid: process.pid,
        childPid: null,
        state: preClose ? 'failed' : 'launched',
        ok: false,
        ...(sw?.switchId ? { failedSwitchId: sw.switchId } : {}),
        reason,
        at: Date.now()
      });
    } catch {}
    cleanupOwnJobFile();
    return { ok: false, childPid: null, verified: false, reason };
  };

  const stillRequested = () => {
    if (!sw?.switchId) return true;
    const state = JSON.parse(readFileSync(join(dirname(jobPath), 'accounts.json'), 'utf8'));
    const target = state.accounts?.find(a => a.id === sw.accountId);
    if (!target || target.disabled || target.quarantined) return false;
    if (state.pendingSwitch?.switchId !== sw.switchId || state.pendingSwitch?.targetId !== sw.accountId) return false;
    if (job.profileDir && state.pendingSwitch.profileDir && !samePath(state.pendingSwitch.profileDir, job.profileDir)) return false;
    if (String(target.email || '').trim().toLowerCase() !== sw.expectedEmail.trim().toLowerCase()) return false;
    if (sw.expectedHash && target.credHash && target.credHash.toUpperCase() !== sw.expectedHash.toUpperCase()) return false;
    return true;
  };

  const verifiedProfile = () => {
    if (!job.profileDir) return true;
    try {
      return samePath(verifiedSwitchProfileDir(job.profileDir), job.profileDir);
    } catch {
      return false;
    }
  };

  // Pre-close validation: fail closed BEFORE closing Antigravity if profile or intent is invalid/cancelled.
  if (job.profileDir && !verifiedProfile()) {
    appendLog('invalid-switch-profile');
    return finishFailed('invalid-switch-profile', { preClose: true });
  }
  if (sw?.switchId) {
    try {
      if (!stillRequested()) {
        appendLog('switch-cancelled');
        return finishFailed('switch-cancelled', { preClose: true });
      }
    } catch {
      appendLog('switch-cancelled');
      return finishFailed('switch-cancelled', { preClose: true });
    }
  }

  // 1. Immediately write ACK JSON atomically so the caller confirms AV/EDR did not block launch
  try {
    atomicWriteJson(job.ackPath, {
      nonce: job.nonce,
      pid: process.pid,
      state: 'ready',
      at: Date.now()
    });
  } catch (err) {
    appendLog(`ack write err: ${err?.message || err}`);
    if (sw?.switchId) return finishFailed('ack-write-failed', { preClose: true });
  }
  appendLog(`worker started pid=${process.pid} ppid=${process.ppid}`);

  // 2. Brief settle pause so caller reads ACK before Antigravity begins closing
  await sleep(settleMs);
  if (sw?.switchId) {
    try {
      if (!stillRequested()) {
        appendLog('switch-cancelled');
        return finishFailed('switch-cancelled', { preClose: true });
      }
    } catch {
      appendLog('switch-cancelled');
      return finishFailed('switch-cancelled', { preClose: true });
    }
  }

  // 3-4. Find running non-self Antigravity.exe PIDs and send graceful WM_CLOSE in a single taskkill.exe call (no /F)
  const initialPids = listTargetPids().filter(pid => !excludePids.has(pid));
  if (initialPids.length) {
    appendLog(`graceful close pids=${initialPids.join(',')}`);
    if (deps.gracefulClosePid) {
      for (const pid of initialPids) gracefulClosePid(pid);
    } else {
      defaultGracefulClosePids(initialPids);
    }
    const gracefulDeadline = Date.now() + gracefulTimeoutMs;
    while (Date.now() < gracefulDeadline) {
      if (listTargetPids().filter(pid => !excludePids.has(pid)).length === 0) break;
      await sleep(pollMs);
    }
  }

  // 5. Escalate any lingering non-self Antigravity.exe PIDs via Node built-in process.kill (TerminateProcess)
  const remainingPids = listTargetPids().filter(pid => !excludePids.has(pid));
  if (remainingPids.length) {
    appendLog(`force kill pids=${remainingPids.join(',')}`);
    for (const pid of remainingPids) {
      forceKillPid(pid);
    }
    const forceDeadline = Date.now() + forceTimeoutMs;
    while (Date.now() < forceDeadline) {
      if (listTargetPids().filter(pid => !excludePids.has(pid)).length === 0) break;
      await sleep(pollMs);
    }
  }

  // 5b. Terminate sibling language_server*.exe instances (including language_server_windows_x64.exe)
  // so stale OAuth TokenSources cannot write into gemini:antigravity after exit.
  const initialLsPids = listLanguageServerPids().filter(pid => !excludePids.has(pid));
  if (initialLsPids.length) {
    appendLog(`graceful close language_server pids=${initialLsPids.join(',')}`);
    if (deps.gracefulClosePid) {
      for (const pid of initialLsPids) gracefulClosePid(pid);
    } else {
      defaultGracefulClosePids(initialLsPids);
    }
    const lsGracefulDeadline = Date.now() + Math.min(gracefulTimeoutMs, 1500);
    while (Date.now() < lsGracefulDeadline) {
      if (listLanguageServerPids().filter(pid => !excludePids.has(pid)).length === 0) break;
      await sleep(pollMs);
    }
    const remainingLsPids = listLanguageServerPids().filter(pid => !excludePids.has(pid));
    if (remainingLsPids.length) {
      appendLog(`force kill language_server pids=${remainingLsPids.join(',')}`);
      for (const pid of remainingLsPids) {
        forceKillPid(pid);
      }
      const lsForceDeadline = Date.now() + forceTimeoutMs;
      while (Date.now() < lsForceDeadline) {
        if (listLanguageServerPids().filter(pid => !excludePids.has(pid)).length === 0) break;
        await sleep(pollMs);
      }
    }
  }

  // 5c. Only abort launching if Antigravity.exe itself survived force-kill (single-instance lock collision).
  // If Antigravity.exe already exited and only an elevated language_server or CLI writer survived,
  // skip the credential restore safely but NEVER strand the IDE closed.
  const stuckAppPids = listTargetPids().filter(pid => !excludePids.has(pid));
  const stuckLsPids = listLanguageServerPids().filter(pid => !excludePids.has(pid));
  if (stuckAppPids.length) {
    appendLog(`elevated-process-running app=${stuckAppPids.join(',')} ls=${stuckLsPids.join(',')}`);
    return finishFailed('elevated-process-running');
  }
  let restoreFailed = false;
  let restoreFailReason = '';
  if (stuckLsPids.length) {
    appendLog(`warn: elevated language_server running ls=${stuckLsPids.join(',')}; Antigravity exited so launch will continue`);
    if (sw) {
      restoreFailed = true;
      restoreFailReason = 'elevated-process-running';
      appendLog('restore err: skipped credential switch because elevated language_server is still running');
    }
  }

  await sleep(postExitSettleMs);

  // 5d. Fail-closed credential writer check before restore (observes Antigravity.exe, language_server*.exe, and agy.exe).
  if (sw && !restoreFailed && listWriterPids) {
    const writerDeadline = Date.now() + writerTimeoutMs;
    while (true) {
      let writerPids;
      try {
        writerPids = listWriterPids().filter(pid => !excludePids.has(pid));
      } catch (err) {
        restoreFailed = true;
        restoreFailReason = 'process-list-unavailable';
        appendLog(`restore err: process-list-unavailable (${err?.message || err}); continuing launch to avoid stranding IDE`);
        break;
      }
      if (writerPids.length === 0) break;
      if (Date.now() >= writerDeadline) {
        restoreFailed = true;
        restoreFailReason = 'credential-writers-still-running';
        appendLog(`restore err: credential writers still running pids=${writerPids.join(',')}; continuing launch to avoid stranding IDE`);
        break;
      }
      await sleep(pollMs);
    }
  }

  // 6a. Post-exit deferred credential switch (dynamic import keeps WSL standalone worker copy self-contained)
  if (sw && !restoreFailed) {
    let preRestoreOk = true;
    try {
      if (!stillRequested() || !verifiedProfile()) {
        preRestoreOk = false;
        restoreFailed = true;
        restoreFailReason = 'switch-cancelled';
        appendLog('restore err: switch cancelled or profile changed before restore; continuing launch to avoid stranding IDE');
      }
    } catch {
      preRestoreOk = false;
      restoreFailed = true;
      restoreFailReason = 'switch-cancelled';
      appendLog('restore err: unable to confirm pending switch before restore; continuing launch to avoid stranding IDE');
    }

    if (preRestoreOk) {
      let restoreRes = null;
      try {
        if (restoreCredential) {
          restoreRes = await restoreCredential(sw);
        } else {
          const vault = deps.vault || (await import('../lib/credential-vault.mjs')).createCredentialVault({ env: baseEnv });
          if (vault.backend && vault.backend !== 'win32-credman') {
            restoreRes = { ok: false, error: 'unsupported-credential-backend' };
          } else {
            restoreRes = vault.restoreToActive(sw.accountId, {
              expectedEmail: sw.expectedEmail,
              ...(sw.expectedHash ? { expectedHash: sw.expectedHash } : {})
            });
          }
        }
      } catch (err) {
        restoreRes = { ok: false, error: err?.message || String(err) };
      }
      if (!restoreRes?.ok) {
        if (restoreRes?.mismatch) {
          appendLog(`credential switch failed reason=credential-mismatch err=${restoreRes?.error || 'unknown'}`);
          return finishFailed('credential-mismatch');
        }
        restoreFailed = true;
        restoreFailReason = 'credential-switch-failed';
        appendLog(`restore err: ${restoreRes?.error || 'unknown'}; continuing launch to avoid stranding IDE`);
      } else {
        appendLog(`credential switch ok accountId=${sw.accountId}`);
      }
    }
  }

  // 6b. Post-exit credential-user-scope cleanup inside pinned profileDir (or legacy clearScopePath)
  const effectiveScopePath = job.profileDir ? join(job.profileDir, 'credential-user-scope') : job.clearScopePath;
  if (!restoreFailed && effectiveScopePath && exists(effectiveScopePath)) {
    try {
      unlinkSync(effectiveScopePath);
      appendLog('cleared credential-user-scope');
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        appendLog(`clear scope err: ${err?.message || err}`);
      }
    }
  }

  if (sw && !restoreFailed && sw.switchId) {
    try {
      atomicWriteJson(job.ackPath, {
        nonce: job.nonce,
        pid: process.pid,
        state: 'restored',
        appliedSwitchId: sw.switchId,
        at: Date.now()
      });
    } catch {}
  }

  // 6c. Post-exit atomic app_storage.json onboarding sync in pure Node.js
  if (!restoreFailed && job.onboardingSync?.appStoragePath && exists(job.onboardingSync.appStoragePath)) {
    const storagePath = job.onboardingSync.appStoragePath;
    try {
      const raw = readFileSync(storagePath, 'utf8');
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        obj['agy.onboarding.lastLoginUsername'] = job.onboardingSync.email.trim();
        if (typeof job.onboardingSync.isGcpTos === 'boolean') {
          obj['agy.onboarding.lastLoginIsGcpTos'] = String(job.onboardingSync.isGcpTos);
        }
        const tmpStorage = `${storagePath}.agy.tmp`;
        writeFileSync(tmpStorage, JSON.stringify(obj, null, 2), 'utf8');
        renameSync(tmpStorage, storagePath);
        appendLog('synced onboarding app_storage');
      }
    } catch (err) {
      appendLog(`onboarding sync err: ${err?.message || err}`);
    }
  }

  // 7. Build clean target env (scrubbing Electron/sidecar vars, preserving profileDir, and applying/clearing proxy vars)
  const targetEnv = buildCleanTargetEnv(baseEnv, job);

  // 8. Spawn Antigravity.exe detached with NUL stdio so Windows Terminal / ConPTY never attaches
  const spawnArgs = [...leadingArgsForTest, ...job.args];
  appendLog(`spawning ${job.target} args=${JSON.stringify(job.args)}`);
  let child = null;
  let spawnError = null;
  try {
    child = spawnProcess(job.target, spawnArgs, {
      cwd: dirname(job.target),
      env: targetEnv,
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    child?.on?.('error', err => { spawnError = err; });
    child?.unref?.();
  } catch (err) {
    spawnError = err;
  }

  // 9. Verify launch, write final ACK JSON, append log, and delete ONLY our relaunch-job.json
  await sleep(verifyDelayMs);
  let verified = false;
  if (!spawnError) {
    if (child?.pid && isPidAlive(child.pid)) {
      verified = true;
    } else if (!allowAnyTargetForTest) {
      verified = listTargetPids().filter(pid => !excludePids.has(pid)).length > 0;
    } else if (child?.pid) {
      verified = true;
    }
  }

  try {
    atomicWriteJson(job.ackPath, {
      nonce: job.nonce,
      pid: process.pid,
      childPid: child?.pid || null,
      state: 'launched',
      ok: verified,
      ...(sw?.switchId && !restoreFailed ? { appliedSwitchId: sw.switchId } : {}),
      ...(sw?.switchId && restoreFailed ? { failedSwitchId: sw.switchId } : {}),
      ...(restoreFailed ? { restoreFailed: true, ...(restoreFailReason ? { reason: restoreFailReason } : {}) } : {}),
      at: Date.now()
    });
  } catch {}
  appendLog(`done childPid=${child?.pid || 0} verified=${verified}${restoreFailed ? ` restoreFailed=true reason=${restoreFailReason}` : ''}${spawnError ? ` err=${spawnError.message}` : ''}`);

  cleanupOwnJobFile();

  return {
    ok: verified,
    childPid: child?.pid || null,
    verified,
    ...(sw?.switchId && !restoreFailed ? { appliedSwitchId: sw.switchId } : {}),
    ...(sw?.switchId && restoreFailed ? { failedSwitchId: sw.switchId } : {}),
    ...(restoreFailed ? { restoreFailed: true, ...(restoreFailReason ? { reason: restoreFailReason } : {}) } : {})
  };
}

function isSameModulePath(a, b) {
  if (!a || !b) return false;
  let ra = resolve(a);
  let rb = resolve(b);
  try { ra = realpathSync(ra); } catch {}
  try { rb = realpathSync(rb); } catch {}
  return process.platform === 'win32' ? ra.toLowerCase() === rb.toLowerCase() : ra === rb;
}

const isDirectRun = isSameModulePath(process.argv[1], fileURLToPath(import.meta.url));
if (isDirectRun) {
  runRelaunchJob(process.argv[2]).then(
    res => { process.exitCode = res?.ok ? 0 : 1; },
    () => { process.exitCode = 1; }
  );
}
