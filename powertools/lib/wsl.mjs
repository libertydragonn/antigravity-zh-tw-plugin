import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { posix } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

let cachedProcVersion = null;
let cachedWinAppDataPosix = undefined;
let cachedWinLocalAppData = undefined;
let cachedWinTemp = undefined;

function defaultReadProcVersion() {
  if (cachedProcVersion !== null) return cachedProcVersion;
  try {
    cachedProcVersion = readFileSync('/proc/version', 'utf8');
  } catch {
    cachedProcVersion = '';
  }
  return cachedProcVersion;
}

export function isWslEnvironment({ platform = process.platform, env = process.env, readProcVersion } = {}) {
  if (platform !== 'linux') return false;
  if (env?.WSL_DISTRO_NAME || env?.WSL_INTEROP) return true;
  if (typeof readProcVersion === 'function') {
    try { return /microsoft|wsl/i.test(String(readProcVersion() || '')); } catch { return false; }
  }
  // Only inspect host /proc/version when using live process.env on actual Linux
  // (avoids leaking WSL2 host kernel into unit tests simulating non-WSL Linux with custom env).
  if (process.platform !== 'linux' || env !== process.env) return false;
  return /microsoft|wsl/i.test(defaultReadProcVersion());
}

export function wslDistroName({ env = process.env } = {}) {
  const raw = String(env?.WSL_DISTRO_NAME || 'default').trim();
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 48) || 'default';
}

export function appendWslEnv(env = {}, names = []) {
  const existing = String(env.WSLENV || '').split(':').map(s => s.trim()).filter(Boolean);
  const seen = new Set(existing.map(entry => entry.split('/')[0]));
  for (const name of names) {
    const key = String(name || '').split('/')[0];
    if (key && !seen.has(key)) {
      seen.add(key);
      existing.push(name);
    }
  }
  return { ...env, WSLENV: existing.join(':') };
}

export function resolveWindowsEnvVar(name, { runSpawn = spawnSync, env = process.env } = {}) {
  const clean = String(name || '').trim();
  if (!/^[A-Za-z0-9_()]+$/.test(clean)) return '';
  try {
    const res = runSpawn('cmd.exe', ['/d', '/c', `echo %${clean}%`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
      env
    });
    if (res.error || res.status !== 0) return '';
    const line = String(res.stdout || '').trim().split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
    if (!line || line.toUpperCase() === `%${clean.toUpperCase()}%`) return '';
    return line;
  } catch {
    return '';
  }
}

export function windowsPathToWsl(winPath, { runSpawn = spawnSync, env = process.env } = {}) {
  const raw = String(winPath || '').trim();
  if (!raw) return '';
  try {
    const res = runSpawn('wslpath', ['-u', raw], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
      env
    });
    if (!res.error && res.status === 0) {
      const converted = String(res.stdout || '').trim();
      if (converted) return converted;
    }
  } catch {}
  const drive = raw.match(/^([A-Za-z]):[\\/](.*)$/);
  if (drive) return `/mnt/${drive[1].toLowerCase()}/${drive[2].replaceAll('\\', '/')}`;
  return '';
}

export function wslPathToWindows(posixPath, { runSpawn = spawnSync, env = process.env } = {}) {
  const raw = String(posixPath || '').trim();
  if (!raw) return '';
  try {
    const res = runSpawn('wslpath', ['-w', raw], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
      env
    });
    if (!res.error && res.status === 0) {
      const converted = String(res.stdout || '').trim();
      if (converted) return converted;
    }
  } catch {}
  const mnt = raw.match(/^\/mnt\/([a-zA-Z])\/(.*)$/);
  if (mnt) return `${mnt[1].toUpperCase()}:\\${mnt[2].replaceAll('/', '\\')}`;
  return '';
}

export function resolveWslWindowsAppData({ runSpawn = spawnSync, env = process.env, useCache = runSpawn === spawnSync && env === process.env } = {}) {
  if (useCache && cachedWinAppDataPosix !== undefined) return cachedWinAppDataPosix;
  const winAppData = resolveWindowsEnvVar('APPDATA', { runSpawn, env });
  const converted = winAppData ? windowsPathToWsl(winAppData, { runSpawn, env }) : '';
  if (useCache) cachedWinAppDataPosix = converted;
  return converted;
}

export function resolveWslWindowsLocalAppData({ runSpawn = spawnSync, env = process.env, useCache = runSpawn === spawnSync && env === process.env } = {}) {
  if (useCache && cachedWinLocalAppData !== undefined) return cachedWinLocalAppData;
  const winPath = resolveWindowsEnvVar('LOCALAPPDATA', { runSpawn, env });
  const wslPath = winPath ? windowsPathToWsl(winPath, { runSpawn, env }) : '';
  const value = { winPath, wslPath };
  if (useCache) cachedWinLocalAppData = value;
  return value;
}

export function resolveWslWindowsTemp({ runSpawn = spawnSync, env = process.env, useCache = runSpawn === spawnSync && env === process.env } = {}) {
  if (useCache && cachedWinTemp !== undefined) return cachedWinTemp;
  const winPath = resolveWindowsEnvVar('TEMP', { runSpawn, env }) || resolveWindowsEnvVar('TMP', { runSpawn, env });
  const wslPath = winPath ? windowsPathToWsl(winPath, { runSpawn, env }) : '';
  const value = { winPath, wslPath };
  if (useCache) cachedWinTemp = value;
  return value;
}

export function resolveWslWindowsExecutable({ runSpawn = spawnSync, env = process.env, exists = existsSync } = {}) {
  const local = resolveWslWindowsLocalAppData({ runSpawn, env });
  const progFiles = resolveWindowsEnvVar('ProgramFiles', { runSpawn, env });
  const progFilesX86 = resolveWindowsEnvVar('ProgramFiles(x86)', { runSpawn, env });
  const winCandidates = [
    local.winPath && `${local.winPath}\\Programs\\antigravity\\Antigravity.exe`,
    local.winPath && `${local.winPath}\\Programs\\Antigravity\\Antigravity.exe`,
    progFiles && `${progFiles}\\Antigravity\\Antigravity.exe`,
    progFiles && `${progFiles}\\antigravity\\Antigravity.exe`,
    progFilesX86 && `${progFilesX86}\\Antigravity\\Antigravity.exe`
  ].filter(Boolean);
  for (const winCandidate of winCandidates) {
    const wslPath = windowsPathToWsl(winCandidate, { runSpawn, env });
    if (wslPath && exists(wslPath)) return { winPath: winCandidate, wslPath };
  }
  return { winPath: '', wslPath: '' };
}

export function resolveWslWindowsNodeRuntime({ runSpawn = spawnSync, env = process.env, exists = existsSync } = {}) {
  try {
    const whereRes = runSpawn('where.exe', ['node.exe'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 4000,
      env
    });
    if (!whereRes.error && whereRes.status === 0) {
      const first = String(whereRes.stdout || '').trim().split(/\r?\n/).map(s => s.trim()).find(Boolean) || '';
      const wslNode = first ? windowsPathToWsl(first, { runSpawn, env }) : '';
      if (wslNode && exists(wslNode)) return { command: wslNode, extraEnv: {} };
      if (first) return { command: 'node.exe', extraEnv: {} };
    }
  } catch {}
  const appData = resolveWslWindowsAppData({ runSpawn, env });
  if (appData) {
    const agyNode = posix.join(appData, 'Antigravity', 'bin', 'agy-node.exe');
    if (exists(agyNode)) return { command: agyNode, extraEnv: {} };
  }
  const agyExe = resolveWslWindowsExecutable({ runSpawn, env, exists });
  if (agyExe.wslPath) {
    return { command: agyExe.wslPath, extraEnv: { ELECTRON_RUN_AS_NODE: '1' } };
  }
  return { command: 'node.exe', extraEnv: {} };
}

// Persistent Windows-side multiplexed TCP-over-stdio relay.
// Frame format: [type:1][connId:4BE][len:4BE][payload:len]
// Types: 1=OPEN(payload:2B portBE), 2=DATA, 3=END, 4=CLOSE, 5=READY
const WIN_BRIDGE_SCRIPT = [
  "const net=require('net');",
  "const conns=new Map();",
  "let buf=Buffer.alloc(0);",
  "function send(type,id,payload){",
  "  const data=payload?Buffer.from(payload):Buffer.alloc(0);",
  "  const head=Buffer.allocUnsafe(9);",
  "  head[0]=type;head.writeUInt32BE(id>>>0,1);head.writeUInt32BE(data.length>>>0,5);",
  "  process.stdout.write(data.length?Buffer.concat([head,data]):head);",
  "}",
  "function drop(id,notify){",
  "  const s=conns.get(id);if(!s)return;conns.delete(id);",
  "  try{s.destroy();}catch{}",
  "  if(notify)send(4,id);",
  "}",
  "process.stdin.on('data',chunk=>{",
  "  buf=buf.length?Buffer.concat([buf,chunk]):chunk;",
  "  while(buf.length>=9){",
  "    const type=buf[0],id=buf.readUInt32BE(1),len=buf.readUInt32BE(5);",
  "    if(buf.length<9+len)break;",
  "    const payload=buf.subarray(9,9+len);",
  "    buf=buf.subarray(9+len);",
  "    if(type===1){",
  "      const port=payload.length>=2?payload.readUInt16BE(0):0;",
  "      if(port<1||port>65535){send(4,id);continue;}",
  "      const s=net.createConnection({host:'127.0.0.1',port});",
  "      s.setNoDelay(true);",
  "      conns.set(id,s);",
  "      s.on('data',d=>send(2,id,d));",
  "      s.on('end',()=>send(3,id));",
  "      s.on('error',()=>drop(id,true));",
  "      s.on('close',()=>{if(conns.delete(id))send(4,id);});",
  "    }else if(type===2){",
  "      const s=conns.get(id);if(s&&!s.destroyed)s.write(payload);",
  "    }else if(type===3){",
  "      const s=conns.get(id);if(s&&!s.destroyed)s.end();",
  "    }else if(type===4){",
  "      drop(id,false);",
  "    }",
  "  }",
  "});",
  "process.stdin.on('end',()=>{for(const s of conns.values()){try{s.destroy();}catch{}}process.exit(0);});",
  "send(5,0);"
].join('');

function encodeFrame(type, id, payload = null) {
  const data = payload ? (Buffer.isBuffer(payload) ? payload : Buffer.from(payload)) : Buffer.alloc(0);
  const head = Buffer.allocUnsafe(9);
  head[0] = type;
  head.writeUInt32BE(id >>> 0, 1);
  head.writeUInt32BE(data.length >>> 0, 5);
  return data.length ? Buffer.concat([head, data]) : head;
}

export function rewriteCdpWebSocketUrl(rawUrl, fromPort, toPort) {
  const value = String(rawUrl || '');
  if (!value || !fromPort || !toPort || fromPort === toPort) return value;
  try {
    const parsed = new URL(value);
    if ((parsed.protocol === 'ws:' || parsed.protocol === 'wss:') &&
        ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) &&
        Number(parsed.port) === Number(fromPort)) {
      parsed.hostname = '127.0.0.1';
      parsed.port = String(toPort);
      return parsed.toString();
    }
  } catch {}
  return value;
}

export function createWslCdpBridge({
  resolveRuntime = resolveWslWindowsNodeRuntime,
  spawnProcess = spawn,
  env = process.env,
  readyTimeoutMs = 6000
} = {}) {
  let server = null;
  let localPort = 0;
  let targetPort = 0;
  let worker = null;
  let workerReady = null;
  let rxBuf = Buffer.alloc(0);
  let nextId = 1;
  let closed = false;
  const sockets = new Map();

  function teardownSockets() {
    for (const sock of sockets.values()) {
      try { sock.destroy(); } catch {}
    }
    sockets.clear();
  }

  function handleWorkerOutput(chunk) {
    rxBuf = rxBuf.length ? Buffer.concat([rxBuf, chunk]) : chunk;
    while (rxBuf.length >= 9) {
      const type = rxBuf[0];
      const id = rxBuf.readUInt32BE(1);
      const len = rxBuf.readUInt32BE(5);
      if (rxBuf.length < 9 + len) break;
      const payload = rxBuf.subarray(9, 9 + len);
      rxBuf = rxBuf.subarray(9 + len);
      if (type === 2) {
        const sock = sockets.get(id);
        if (sock && !sock.destroyed) sock.write(payload);
      } else if (type === 3) {
        const sock = sockets.get(id);
        if (sock && !sock.destroyed) sock.end();
      } else if (type === 4) {
        const sock = sockets.get(id);
        if (sock) {
          sockets.delete(id);
          try { sock.destroy(); } catch {}
        }
      }
    }
  }

  function ensureWorker() {
    if (closed) return Promise.reject(new Error('WSL CDP 桥接已关闭'));
    if (worker && !worker.killed && worker.exitCode === null && workerReady) return workerReady;
    const runtime = resolveRuntime();
    if (!runtime?.command) return Promise.reject(new Error('未找到可用的 Windows Node 运行时'));
    const extraKeys = Object.keys(runtime.extraEnv || {});
    const childEnv = extraKeys.length
      ? appendWslEnv({ ...env, ...runtime.extraEnv }, extraKeys)
      : env;
    rxBuf = Buffer.alloc(0);
    const child = spawnProcess(runtime.command, ['-e', WIN_BRIDGE_SCRIPT], {
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true,
      env: childEnv
    });
    worker = child;
    workerReady = new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { child.kill(); } catch {}
        reject(new Error('WSL CDP 桥接启动超时'));
      }, readyTimeoutMs);
      const finish = (ok, err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (ok) resolve(child); else reject(err);
      };
      child.stdout.on('data', chunk => {
        if (!settled) {
          rxBuf = rxBuf.length ? Buffer.concat([rxBuf, chunk]) : chunk;
          if (rxBuf.length >= 9 && rxBuf[0] === 5 && rxBuf.readUInt32BE(5) === 0) {
            rxBuf = rxBuf.subarray(9);
            finish(true);
            if (rxBuf.length) handleWorkerOutput(Buffer.alloc(0));
            return;
          }
          if (rxBuf.length >= 9) {
            finish(true);
            handleWorkerOutput(Buffer.alloc(0));
          }
          return;
        }
        handleWorkerOutput(chunk);
      });
      child.on('error', err => {
        if (worker === child) { worker = null; workerReady = null; }
        teardownSockets();
        finish(false, err);
      });
      child.on('exit', () => {
        if (worker === child) { worker = null; workerReady = null; }
        teardownSockets();
        finish(false, new Error('WSL CDP 桥接已退出'));
      });
    });
    return workerReady;
  }

  function ensureServer() {
    if (server && localPort) return Promise.resolve(localPort);
    return new Promise((resolve, reject) => {
      const srv = createServer(sock => {
        sock.setNoDelay(true);
        const port = targetPort;
        if (!port || closed) { sock.destroy(); return; }
        const id = nextId++;
        if (nextId >= 0x7fffffff) nextId = 1;
        sockets.set(id, sock);
        const portBuf = Buffer.allocUnsafe(2);
        portBuf.writeUInt16BE(port, 0);
        const pendingChunks = [];
        let opened = false;
        let endedBeforeOpen = false;
        const writeFrame = frame => {
          if (worker?.stdin && !worker.stdin.destroyed) worker.stdin.write(frame);
        };
        sock.on('data', chunk => {
          if (!opened) pendingChunks.push(chunk);
          else writeFrame(encodeFrame(2, id, chunk));
        });
        sock.on('end', () => {
          if (!opened) endedBeforeOpen = true;
          else writeFrame(encodeFrame(3, id));
        });
        sock.on('error', () => {
          if (sockets.delete(id) && opened) writeFrame(encodeFrame(4, id));
        });
        sock.on('close', () => {
          if (sockets.delete(id) && opened) writeFrame(encodeFrame(4, id));
        });
        ensureWorker().then(() => {
          if (!sockets.has(id) || sock.destroyed) return;
          opened = true;
          writeFrame(encodeFrame(1, id, portBuf));
          for (const chunk of pendingChunks) writeFrame(encodeFrame(2, id, chunk));
          pendingChunks.length = 0;
          if (endedBeforeOpen) writeFrame(encodeFrame(3, id));
        }).catch(() => {
          sockets.delete(id);
          try { sock.destroy(); } catch {}
        });
      });
      srv.on('error', reject);
      srv.listen(0, '127.0.0.1', () => {
        const addr = srv.address();
        server = srv;
        localPort = typeof addr === 'object' && addr ? addr.port : 0;
        resolve(localPort);
      });
    });
  }

  return {
    async endpointFor(winPort) {
      const numeric = Number(winPort);
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 65535) {
        throw new Error('调试端口不可用');
      }
      targetPort = numeric;
      await ensureWorker();
      const port = await ensureServer();
      return { host: '127.0.0.1', port };
    },
    rewriteTargets(targets, winPort) {
      if (!Array.isArray(targets) || !localPort) return targets;
      return targets.map(t => t && typeof t === 'object' && t.webSocketDebuggerUrl
        ? { ...t, webSocketDebuggerUrl: rewriteCdpWebSocketUrl(t.webSocketDebuggerUrl, winPort, localPort) }
        : t);
    },
    async close() {
      closed = true;
      teardownSockets();
      if (worker) {
        const child = worker;
        worker = null;
        workerReady = null;
        try { child.stdin?.end(); } catch {}
        try { child.kill(); } catch {}
      }
      if (server) {
        const srv = server;
        server = null;
        localPort = 0;
        await new Promise(resolve => srv.close(() => resolve()));
      }
    }
  };
}
