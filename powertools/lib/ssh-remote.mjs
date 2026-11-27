import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { antigravityUserDataDir } from './paths.mjs';

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
const PROTOCOL_PREFIX = '__AGY_PT__:';
const WORKER_FILES = [
  './protobuf.mjs',
  './database.mjs',
  './context.mjs',
  './progress.mjs',
  './dashboard.mjs',
  './analytics.mjs',
  './session-parser.mjs',
  './transcript-search.mjs'
];
const REMOTE_LOADER_JS =
  'const z=require("node:zlib");let b="";process.stdin.setEncoding("utf8");' +
  'function f(){const i=b.indexOf("\\n");if(i<0)return;process.stdin.removeListener("data",d);process.stdin.pause();' +
  'const l=b.slice(0,i).trim();globalThis.__agyBootRest=b.slice(i+1);b="";' +
  'try{const c=z.gunzipSync(Buffer.from(l,"base64")).toString("utf8");new Function("require",c)(require);}' +
  'catch(e){process.stdout.write("\\n__AGY_PT__:"+JSON.stringify({type:"error",code:"BOOT_FAILED",message:String(e&&e.message||e)})+"\\n");process.exit(1);}}' +
  'function d(c){b+=c;f();}' +
  'process.stdin.on("data",d);process.stdin.on("end",()=>{if(!globalThis.__agyBootRest&&b.indexOf("\\n")<0)process.exit(0);});' +
  'process.stdin.resume();process.stdout.write("\\n__AGY_PT__:{\\"type\\":\\"boot\\"}\\n");';

let cachedWorkerCode = '';

export function validateSshDestination(host) {
  if (typeof host !== 'string') throw new Error('无效的 SSH 主机标识');
  const trimmed = host.trim();
  if (!trimmed || trimmed.length > 255 || trimmed.startsWith('-') || /[\x00-\x20\x7f`'"\\;$|&<>]/.test(trimmed)) {
    throw new Error('无效的 SSH 主机标识');
  }
  return trimmed;
}

export function parseSshWindowTitle(title = '') {
  const clean = String(title || '').replace(/^\(\d+\)\s+/, '').trim();
  const match = clean.match(/\((?:SSH|ssh):\s*([^)]+)\)\s*$/) || clean.match(/\[(?:SSH|ssh):\s*([^\]]+)\]\s*$/);
  if (!match) return '';
  try {
    return validateSshDestination(match[1]);
  } catch {
    return '';
  }
}

function isValidConfigFile(filePath) {
  if (typeof filePath !== 'string') return '';
  const trimmed = filePath.trim();
  if (!trimmed || trimmed.startsWith('-') || /[\x00-\x1f\x7f]/.test(trimmed) || !isAbsolute(trimmed)) return '';
  return existsSync(trimmed) ? trimmed : '';
}

export function resolveSshWindowConfig(host, { userDataDir = antigravityUserDataDir() } = {}) {
  const validHost = validateSshDestination(host);
  try {
    const winState = JSON.parse(readFileSync(join(userDataDir, 'ssh_windows.json'), 'utf8'));
    const windows = Array.isArray(winState?.windows) ? winState.windows : [];
    for (const entry of windows) {
      if (typeof entry?.host === 'string' && entry.host.trim() === validHost) {
        const cfg = isValidConfigFile(entry.configFile);
        if (cfg) return { host: validHost, configFile: cfg };
      }
    }
  } catch { /* Optional ssh_windows.json metadata. */ }
  try {
    const storage = JSON.parse(readFileSync(join(userDataDir, 'app_storage.json'), 'utf8'));
    const rawRecent = storage?.['ssh.recentConnections'];
    const recent = typeof rawRecent === 'string' ? JSON.parse(rawRecent) : rawRecent;
    if (Array.isArray(recent)) {
      for (const entry of recent) {
        if (typeof entry?.host === 'string' && entry.host.trim() === validHost) {
          const cfg = isValidConfigFile(entry.configFile);
          if (cfg) return { host: validHost, configFile: cfg };
        }
      }
    }
  } catch { /* Optional app_storage.json metadata. */ }
  return { host: validHost, configFile: '' };
}

const COLON_LINE_SUFFIX_RE = /(?::|%3a)(\d+)(?:(?::|%3a)(\d+))?(?:-(\d+)(?:(?::|%3a)(\d+))?)?$/i;

function splitTrailingColonLineSuffix(uriWithoutFragment) {
  const queryIdx = uriWithoutFragment.indexOf('?');
  const pathPart = queryIdx >= 0 ? uriWithoutFragment.slice(0, queryIdx) : uriWithoutFragment;
  const queryPart = queryIdx >= 0 ? uriWithoutFragment.slice(queryIdx) : '';
  const slashIdx = Math.max(pathPart.lastIndexOf('/'), pathPart.lastIndexOf('\\'));
  const dirPart = slashIdx >= 0 ? pathPart.slice(0, slashIdx + 1) : '';
  const basePart = slashIdx >= 0 ? pathPart.slice(slashIdx + 1) : pathPart;
  const match = basePart.match(COLON_LINE_SUFFIX_RE);
  if (!match || match.index <= 0) {
    return { uri: uriWithoutFragment, line: null, column: null };
  }
  const line = Number(match[1]);
  const col = match[2] !== undefined ? Number(match[2]) : null;
  const endLine = match[3] !== undefined ? Number(match[3]) : null;
  const endCol = match[4] !== undefined ? Number(match[4]) : null;
  if (!(Number.isInteger(line) && line > 0)) {
    return { uri: uriWithoutFragment, line: null, column: null };
  }
  if (col !== null && !(Number.isInteger(col) && col > 0)) {
    return { uri: uriWithoutFragment, line: null, column: null };
  }
  if (endLine !== null && !(Number.isInteger(endLine) && endLine > 0)) {
    return { uri: uriWithoutFragment, line: null, column: null };
  }
  if (endCol !== null && !(Number.isInteger(endCol) && endCol > 0)) {
    return { uri: uriWithoutFragment, line: null, column: null };
  }
  const strippedBase = basePart.slice(0, match.index);
  return {
    uri: `${dirPart}${strippedBase}${queryPart}`,
    line,
    column: col
  };
}

function normalizeRemoteFileUri(uri) {
  let s = String(uri || '').trim();
  let hasHashLineAnchor = false;
  const hashIdx = s.indexOf('#');
  if (hashIdx >= 0) {
    const before = s.slice(0, hashIdx);
    const rawFrag = s.slice(hashIdx + 1);
    const decodedFragSep = rawFrag.replace(/%2f/gi, '/').replace(/%5c/gi, '/');
    let decodedForAnchor = rawFrag;
    try { decodedForAnchor = decodeURIComponent(rawFrag); } catch { /* Keep raw fragment. */ }
    const lineAnchorExactRe = /^(?:L\d+(?:(?:C|:)\d+)?(?:-L?\d+(?:(?:C|:)\d+)?)?|\d+(?:-\d+)?)$/i;
    const isLineAnchor = lineAnchorExactRe.test(decodedFragSep) || lineAnchorExactRe.test(decodedForAnchor);
    const beforeWithoutColon = splitTrailingColonLineSuffix(before).uri;
    const isDocHeading = /\.(?:md|markdown|html?|rst|adoc|pdf)$/i.test(beforeWithoutColon) && /^[^/\\#?.]+$/.test(decodedFragSep);
    if (isLineAnchor) {
      hasHashLineAnchor = true;
      s = before;
    } else if (isDocHeading) {
      s = before;
    } else {
      const lineAnchorRe = /(?:#|%23)(?:L\d+(?:(?:C|:|%3a)\d+)?(?:-L?\d+(?:(?:C|:|%3a)\d+)?)?|\d+(?:-\d+)?)$/i;
      const docHeadingRe = /(\.(?:md|markdown|html?|rst|adoc|pdf)(?:(?::|%3a)\d+(?:(?::|%3a)\d+)?(?:-\d+(?:(?::|%3a)\d+)?)?)?)(?:#|%23)[^/\\#?.]+$/i;
      let tail = decodedFragSep;
      if (lineAnchorRe.test(tail)) {
        hasHashLineAnchor = true;
        tail = tail.replace(lineAnchorRe, '');
      } else if (docHeadingRe.test(tail)) {
        tail = tail.replace(docHeadingRe, '$1');
      }
      s = `${before}%23${tail.replaceAll('#', '%23')}`;
    }
  }
  return hasHashLineAnchor ? s : splitTrailingColonLineSuffix(s).uri;
}

export function resolveRemotePosixPath(uri) {
  if (typeof uri !== 'string' || !uri.trim()) throw new Error('文件路径无效');
  let parsed;
  try {
    parsed = new URL(normalizeRemoteFileUri(uri));
  } catch {
    throw new Error('文件路径格式无效');
  }
  if (parsed.protocol !== 'file:') throw new Error('仅支持文件链接');
  if (parsed.hostname && parsed.hostname.toLowerCase() !== 'localhost') throw new Error('仅支持当前主机文件路径');
  parsed.hash = '';
  parsed.search = '';
  let decoded;
  try {
    decoded = decodeURIComponent(parsed.pathname || '');
  } catch {
    throw new Error('文件路径编码无效');
  }
  if (!decoded.startsWith('/') || decoded.includes('\0')) throw new Error('远端文件路径无效');
  return decoded;
}

function transformEsmToCjsFactory(source) {
  let code = String(source || '');
  code = code.replace(/\bimport\.meta(?:\?\.|\.)url\b/g, '""');
  code = code.replace(/^\s*import\s*\{([^}]+)\}\s*from\s*(['"][^'"]+['"])\s*;?/gm, (_, specifiers, mod) => {
    const mapped = specifiers.split(',').map(part => {
      const m = part.trim().match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      return m ? (m[2] ? `${m[1]}: ${m[2]}` : m[1]) : part.trim();
    }).filter(Boolean).join(', ');
    return `const { ${mapped} } = __req(${mod});`;
  });
  code = code.replace(/^\s*import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\s*(['"][^'"]+['"])\s*;?/gm,
    'const $1 = __req($2);');
  code = code.replace(/^\s*import\s+([A-Za-z_$][\w$]*)\s+from\s*(['"][^'"]+['"])\s*;?/gm,
    'const $1 = __req($2).default ?? __req($2);');
  code = code.replace(/^\s*export\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm,
    'exports.$2 = $2; $1function $2(');
  code = code.replace(/^\s*export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm,
    '$1 $2 = exports.$2 =');
  code = code.replace(/^\s*export\s*\{([^}]+)\}\s*;?/gm, (_, specifiers) => {
    return specifiers.split(',').map(part => {
      const m = part.trim().match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      return m ? `exports.${m[2] || m[1]} = ${m[1]};` : '';
    }).filter(Boolean).join(' ');
  });
  return `((exports, __req) => {\n${code}\n})`;
}

export function buildRemoteWorkerCode() {
  if (cachedWorkerCode) return cachedWorkerCode;
  const entries = WORKER_FILES.map(spec => {
    const filePath = join(LIB_DIR, spec.slice(2));
    const source = readFileSync(filePath, 'utf8');
    return `${JSON.stringify(spec)}: ${transformEsmToCjsFactory(source)}`;
  });

  cachedWorkerCode = `'use strict';
const __factories = {
${entries.join(',\n')}
};
const __loaded = Object.create(null);
function __req(spec) {
  if (spec.startsWith('./')) {
    if (!__loaded[spec]) {
      if (!__factories[spec]) throw new Error('Unknown worker module: ' + spec);
      const exports = {};
      __loaded[spec] = exports;
      __factories[spec](exports, __req);
    }
    return __loaded[spec];
  }
  return require(spec);
}
const PREFIX = ${JSON.stringify(PROTOCOL_PREFIX)};
const { getAppDataDir, parseSessionData } = __req('./session-parser.mjs');
const { usageDashboard } = __req('./analytics.mjs');
const { searchTranscripts } = __req('./transcript-search.mjs');
const VALID_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const send = obj => {
  try {
    process.stdout.write(PREFIX + JSON.stringify(obj) + '\\n');
  } catch {
    process.exit(0);
  }
};
process.stdout.on('error', () => process.exit(0));
process.stdin.on('error', () => process.exit(0));
function handleLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req;
  try { req = JSON.parse(trimmed); } catch { return; }
  if (!req || (typeof req.id !== 'number' && typeof req.id !== 'string')) return;
  try {
    let result;
    const params = req.params && typeof req.params === 'object' ? req.params : {};
    if (req.method === 'ping') {
      result = { ok: true, node: process.versions.node, pid: process.pid };
    } else if (req.method === 'state') {
      result = parseSessionData(params.conversationId, {
        includeSessions: false,
        strict: true,
        execution: params.execution || null
      });
    } else if (req.method === 'subagents') {
      const ids = Array.isArray(params.conversationIds)
        ? [...new Set(params.conversationIds.filter(id => typeof id === 'string' && VALID_ID.test(id)))].slice(0, 64)
        : [];
      const sessions = {};
      for (const id of ids) {
        try {
          sessions[id] = parseSessionData(id, { includeSessions: false, strict: true });
        } catch { /* Skip unreadable subagent session. */ }
      }
      result = { sessions };
    } else if (req.method === 'dashboard') {
      result = usageDashboard(getAppDataDir(), { force: params.force === true });
    } else if (req.method === 'search') {
      result = searchTranscripts(params.query, {
        appDataDir: getAppDataDir(),
        scope: params.scope,
        conversationIds: params.conversationIds,
        excludeIds: params.excludeIds,
        maxResults: params.maxResults
      });
    } else {
      throw new Error('不支持的远端操作: ' + String(req.method || ''));
    }
    send({ type: 'res', id: req.id, result });
  } catch (err) {
    send({ type: 'res', id: req.id, error: err?.message || String(err) });
  }
}
let buf = typeof globalThis.__agyBootRest === 'string' ? globalThis.__agyBootRest : '';
delete globalThis.__agyBootRest;
function drain() {
  for (;;) {
    const idx = buf.indexOf('\\n');
    if (idx < 0) break;
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 1);
    handleLine(line);
  }
}
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { buf += chunk; drain(); });
process.stdin.on('end', () => process.exit(0));
process.stdin.on('close', () => process.exit(0));
process.stdin.resume();
send({ type: 'ready', node: process.versions.node, pid: process.pid });
if (buf) drain();
`;
  return cachedWorkerCode;
}

function buildShellBootstrap() {
  const candidates = [
    '"$HOME"/.gemini/antigravity/bin/agy-node',
    '"$HOME"/.nvm/versions/node/*/bin/node',
    '"$HOME"/.volta/bin/node',
    '"$HOME"/.local/share/fnm/node-versions/*/installation/bin/node',
    '"$HOME"/.fnm/node-versions/*/installation/bin/node',
    '"$HOME"/.local/share/mise/installs/node/*/bin/node',
    '"$HOME"/.asdf/installs/nodejs/*/bin/node',
    '/usr/local/bin/node',
    '/opt/homebrew/bin/node',
    '"$HOME"/.local/bin/node'
  ].join(' ');
  return [
    'NODE=""',
    'if [ -x "$HOME/.gemini/antigravity/bin/agy-node" ]; then NODE="$HOME/.gemini/antigravity/bin/agy-node"; fi',
    'if [ -z "$NODE" ]; then NODE=$(command -v node 2>/dev/null || true); fi',
    `if [ -z "$NODE" ]; then for p in ${candidates}; do [ -x "$p" ] && NODE="$p"; done; fi`,
    `if [ -z "$NODE" ]; then printf '\\n${PROTOCOL_PREFIX}{"type":"error","code":"NO_NODE","message":"远端主机未找到 Node.js"}\\n'; exit 1; fi`,
    `exec "$NODE" --no-warnings -e '${REMOTE_LOADER_JS}'`
  ].join('; ') + '\n';
}

export function createRemoteTelemetryBridge({
  spawnProcess = spawn,
  env = process.env,
  platform = process.platform,
  userDataDir,
  connectTimeoutMs = 10000,
  requestTimeoutMs = 8000,
  backoffMs = 15000,
  idleTimeoutMs = 300000,
  onStatus = () => {}
} = {}) {
  const sessions = new Map();
  const failures = new Map();
  let closed = false;
  let nextSeq = 0;

  const sshCommand = env.ANTIGRAVITY_SSH_BIN || (platform === 'win32' ? 'ssh.exe' : 'ssh');

  function dropSession(key, session, error) {
    if (sessions.get(key) === session) sessions.delete(key);
    if (session.idleTimer) { clearTimeout(session.idleTimer); session.idleTimer = null; }
    if (session.connectTimer) { clearTimeout(session.connectTimer); session.connectTimer = null; }
    for (const entry of session.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    session.pending.clear();
  }

  function touchIdle(key, session) {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    if (!(idleTimeoutMs > 0)) return;
    session.idleTimer = setTimeout(() => {
      void terminateSession(key, session);
    }, idleTimeoutMs);
    session.idleTimer.unref?.();
  }

  function terminateSession(key, session) {
    if (session.closingPromise) return session.closingPromise;
    session.closing = true;
    dropSession(key, session, new Error('SSH 远端连接已关闭'));
    session.closingPromise = new Promise(resolve => {
      const child = session.child;
      if (!child || child.exitCode !== null || child.signalCode !== null) {
        resolve();
        return;
      }
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(killTimer);
        clearTimeout(endTimer);
        resolve();
      };
      const killTimer = setTimeout(() => {
        try { child.kill?.(); } catch {}
      }, 300);
      killTimer.unref?.();
      const endTimer = setTimeout(done, 1500);
      endTimer.unref?.();
      child.once?.('close', done);
      child.once?.('exit', done);
      try { child.stdin?.end?.(); } catch {}
    });
    return session.closingPromise;
  }

  function ensureSession(key, host, configFile, { force = false } = {}) {
    if (closed) return Promise.reject(new Error('SSH 远端桥接已关闭'));
    const existing = sessions.get(key);
    if (existing && !existing.closing) return existing.readyPromise;
    if (!force) {
      const failure = failures.get(key);
      if (failure && failure.until > Date.now()) {
        return Promise.reject(new Error(failure.message));
      }
    }

    const args = [
      '-T',
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=8',
      '-o', 'ServerAliveInterval=15',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'ForwardAgent=no',
      '-o', 'ForwardX11=no',
      '-o', 'ForwardX11Trusted=no',
      '-o', 'RemoteCommand=none',
      '-o', 'ControlMaster=no',
      '-o', 'ControlPath=none',
      '-o', 'LogLevel=ERROR',
      ...(configFile ? ['-F', configFile] : []),
      '--',
      host,
      'sh',
      '-s'
    ];

    let child;
    try {
      child = spawnProcess(sshCommand, args, {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });
    } catch (error) {
      const message = `SSH 启动失败: ${error.message}`;
      failures.set(key, { until: Date.now() + backoffMs, message });
      return Promise.reject(new Error(message));
    }

    const session = {
      key,
      host,
      child,
      ready: false,
      closing: false,
      closingPromise: null,
      connectTimer: null,
      idleTimer: null,
      pending: new Map(),
      readyPromise: null
    };
    sessions.set(key, session);

    session.readyPromise = new Promise((resolveReady, rejectReady) => {
      let handshakeSettled = false;
      let stdoutBuf = '';
      let stderrText = '';

      const failHandshake = error => {
        if (handshakeSettled) return;
        handshakeSettled = true;
        if (!session.closing && !closed) {
          failures.set(key, { until: Date.now() + backoffMs, message: error.message });
          onStatus(`[ssh:${host}] ${error.message}`);
        }
        dropSession(key, session, error);
        try { child.stdin?.end?.(); } catch {}
        try { child.kill?.(); } catch {}
        rejectReady(error);
      };

      session.connectTimer = setTimeout(() => {
        failHandshake(new Error(`连接 ${host} 超时`));
      }, connectTimeoutMs);
      session.connectTimer.unref?.();

      child.stderr?.setEncoding?.('utf8');
      child.stderr?.on?.('data', chunk => {
        if (stderrText.length < 2048) stderrText += String(chunk);
      });
      child.stdin?.on?.('error', () => {});

      const handleProtocolLine = line => {
        if (!line.startsWith(PROTOCOL_PREFIX)) return;
        let msg;
        try {
          msg = JSON.parse(line.slice(PROTOCOL_PREFIX.length));
        } catch {
          return;
        }
        if (msg.type === 'boot') {
          try {
            const payload = gzipSync(Buffer.from(buildRemoteWorkerCode(), 'utf8')).toString('base64');
            child.stdin.write(`${payload}\n`);
          } catch (error) {
            failHandshake(new Error(`远端加载失败: ${error.message}`));
          }
          return;
        }
        if (msg.type === 'ready') {
          if (!handshakeSettled) {
            handshakeSettled = true;
            session.ready = true;
            failures.delete(key);
            if (session.connectTimer) { clearTimeout(session.connectTimer); session.connectTimer = null; }
            touchIdle(key, session);
            onStatus(`已接入 SSH 远端主机 (${host})`);
            resolveReady(session);
          }
          return;
        }
        if (msg.type === 'error') {
          failHandshake(new Error(msg.message || `SSH 远端错误 (${msg.code || 'ERROR'})`));
          return;
        }
        if (msg.type === 'res') {
          touchIdle(key, session);
          const pending = session.pending.get(msg.id);
          if (!pending) return;
          session.pending.delete(msg.id);
          clearTimeout(pending.timer);
          if (msg.error) pending.reject(new Error(msg.error));
          else pending.resolve(msg.result);
        }
      };

      child.stdout?.setEncoding?.('utf8');
      child.stdout?.on?.('data', chunk => {
        stdoutBuf += String(chunk);
        for (;;) {
          const idx = stdoutBuf.indexOf('\n');
          if (idx < 0) break;
          const line = stdoutBuf.slice(0, idx).replace(/\r$/, '');
          stdoutBuf = stdoutBuf.slice(idx + 1);
          handleProtocolLine(line);
        }
      });

      child.on?.('error', error => {
        const msg = new Error(`SSH 连接异常: ${error.message}`);
        if (!handshakeSettled) failHandshake(msg);
        else {
          if (!session.closing && !closed) failures.set(key, { until: Date.now() + backoffMs, message: msg.message });
          dropSession(key, session, msg);
        }
      });

      child.on?.('close', code => {
        const detail = stderrText.trim().split(/\r?\n/)[0] || `exit ${code ?? 'unknown'}`;
        const msg = new Error(`SSH 远端会话已断开 (${detail})`);
        if (!handshakeSettled) failHandshake(msg);
        else {
          if (!session.closing && !closed) failures.set(key, { until: Date.now() + backoffMs, message: msg.message });
          dropSession(key, session, msg);
        }
      });

      try {
        child.stdin.write(buildShellBootstrap());
      } catch (error) {
        failHandshake(new Error(`无法写入 SSH 启动脚本: ${error.message}`));
      }
    });

    return session.readyPromise;
  }

  async function call(host, method, params = {}, { force = false } = {}) {
    const { host: validHost, configFile } = resolveSshWindowConfig(host, { userDataDir });
    const key = `${validHost}\0${configFile}`;
    const session = await ensureSession(key, validHost, configFile, { force });
    if (closed || session.closing) throw new Error('SSH 远端连接已关闭');
    touchIdle(key, session);
    const id = ++nextSeq;
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        session.pending.delete(id);
        reject(new Error(`SSH 远端请求 ${method} 超时`));
      }, requestTimeoutMs);
      timer.unref?.();
      session.pending.set(id, { resolve, reject, timer });
      try {
        session.child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
      } catch (error) {
        session.pending.delete(id);
        clearTimeout(timer);
        reject(new Error(`SSH 远端发送失败: ${error.message}`));
      }
    });
  }

  return {
    state(host, params = {}) {
      return call(host, 'state', params);
    },
    subagents(host, params = {}) {
      return call(host, 'subagents', params);
    },
    dashboard(host, params = {}) {
      return call(host, 'dashboard', params, { force: params?.force === true });
    },
    search(host, params = {}) {
      return call(host, 'search', params);
    },
    async close() {
      closed = true;
      const active = [...sessions.entries()];
      await Promise.all(active.map(([key, session]) => terminateSession(key, session)));
      sessions.clear();
      failures.clear();
    }
  };
}
