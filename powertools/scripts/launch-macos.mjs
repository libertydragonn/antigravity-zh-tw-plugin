#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  DEBUG_FLAG,
  macDirectLauncherPath,
  resolveAntigravityExecutable,
  resolveMacSourceApp
} from '../lib/launcher.mjs';
import { chromiumProxyArgs, maskProxyUrl, proxySpecFromSettings } from '../lib/proxy.mjs';
import { createSettingsStore } from '../lib/settings.mjs';

const MAC_OPEN_BIN = '/usr/bin/open';
const SCRUB_ENV_EXACT = new Set([
  'ELECTRON_RUN_AS_NODE',
  'NODE_OPTIONS',
  'NODE_USE_ENV_PROXY',
  'ANTIGRAVITY_LS_ADDRESS',
  'ANTIGRAVITY_CSRF_TOKEN',
  'ANTIGRAVITY_AGENTAPI_EXE'
]);
const SCRUB_ENV_PREFIXES = [
  'ANTIGRAVITY_SIDECAR_',
  'AGY_PROXY_',
  'AGY_RELAUNCH_',
  'AGY_ONBOARDING_'
];
const CLEAR_PROXY_ENV_UPPER = new Set([
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'AGY_POWERTOOLS_PROXY_SPEC'
]);
const PROXY_URL_ENV_KEYS = new Set([
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy'
]);

export function buildMacProxyEnv(spec) {
  if (!spec?.enabled || !spec?.url) return {};
  return {
    HTTP_PROXY: spec.url,
    HTTPS_PROXY: spec.url,
    ALL_PROXY: spec.url,
    http_proxy: spec.url,
    https_proxy: spec.url,
    all_proxy: spec.url,
    NO_PROXY: spec.bypass,
    no_proxy: spec.bypass,
    AGY_POWERTOOLS_PROXY_SPEC: spec.specKey,
    ...(spec.forceHttp1 ? { GODEBUG: 'http2client=0' } : {})
  };
}

export function buildMacTargetEnv(baseEnv = process.env, spec = { enabled: false }) {
  const env = { ...(baseEnv || {}) };
  for (const key of Object.keys(env)) {
    const upper = key.toUpperCase();
    if (SCRUB_ENV_EXACT.has(upper) || SCRUB_ENV_PREFIXES.some(prefix => upper.startsWith(prefix))) {
      delete env[key];
    }
  }

  if (spec?.enabled && spec?.url) {
    const proxyEnv = buildMacProxyEnv(spec);
    for (const [key, value] of Object.entries(proxyEnv)) {
      env[key] = value;
    }
    if (!spec.forceHttp1) {
      for (const key of Object.keys(env)) {
        if (key.toUpperCase() === 'GODEBUG' && env[key] === 'http2client=0') {
          delete env[key];
        }
      }
    }
    return env;
  }

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
  return env;
}

export function buildMacDirectLaunchPlan({
  platform = process.platform,
  env = process.env,
  home = homedir(),
  execPath = process.execPath,
  sandbox = false,
  dataDir,
  settings,
  sourceApp,
  resolveApp,
  extraArgs = [],
  newInstance = false
} = {}) {
  if (platform !== 'darwin') {
    throw new Error('This launcher requires macOS.');
  }

  const wrapperPath = resolve(macDirectLauncherPath({ home }));
  let app = '';
  if (typeof sourceApp === 'string' && sourceApp.trim()) {
    app = sourceApp.trim();
  } else if (typeof resolveApp === 'function') {
    app = resolveApp({ platform, env, home, execPath, sandbox, excludeAppDir: wrapperPath }) || '';
  } else {
    app = resolveMacSourceApp({ home, env, execPath, sandbox, excludeAppDir: wrapperPath })
      || resolveAntigravityExecutable({ platform, env, home, execPath })
      || '';
  }
  if (app && resolve(app) === wrapperPath) {
    app = '';
  }
  if (!app) {
    throw new Error('Antigravity.app was not found in /Applications or ~/Applications.');
  }

  const resolvedDataDir = dataDir || join(home, '.gemini', 'antigravity', 'plugin_data', 'agy-powertools');
  const liveSettings = settings && typeof settings === 'object'
    ? settings
    : createSettingsStore(resolvedDataDir).get();
  const spec = proxySpecFromSettings(liveSettings);
  const proxyEnv = buildMacProxyEnv(spec);
  const targetEnv = buildMacTargetEnv(env, spec);
  const forwardedArgs = (Array.isArray(extraArgs) ? extraArgs : [])
    .filter(arg => typeof arg === 'string' && arg.length > 0 && !/^-psn_/i.test(arg));
  const appArgs = [DEBUG_FLAG, ...chromiumProxyArgs(spec), ...forwardedArgs];
  const envFlags = Object.entries(proxyEnv).flatMap(([key, value]) => ['--env', `${key}=${value}`]);
  const openTargetArgs = [...(newInstance ? ['-n'] : []), '-a', app, '--args', ...appArgs];
  const primaryArgs = envFlags.length ? [...envFlags, ...openTargetArgs] : [...openTargetArgs];
  const fallbackArgs = [...openTargetArgs];

  return {
    command: MAC_OPEN_BIN,
    app,
    dataDir: resolvedDataDir,
    proxy: {
      enabled: spec.enabled,
      url: spec.url,
      displayUrl: spec.displayUrl,
      bypass: spec.bypass,
      forceHttp1: spec.forceHttp1,
      specKey: spec.specKey
    },
    proxyEnv,
    env: targetEnv,
    appArgs,
    primaryArgs,
    fallbackArgs,
    usesEnvFlags: envFlags.length > 0
  };
}

export function sanitizeLaunchPlanForOutput(plan) {
  const safeProxyEnv = {};
  const rawUrl = plan?.proxy?.url || '';
  const displayUrl = plan?.proxy?.displayUrl || (rawUrl ? maskProxyUrl(rawUrl) : '');
  for (const [key, value] of Object.entries(plan?.proxyEnv || {})) {
    if (PROXY_URL_ENV_KEYS.has(key)) {
      safeProxyEnv[key] = maskProxyUrl(value);
    } else if (key === 'AGY_POWERTOOLS_PROXY_SPEC') {
      safeProxyEnv[key] = rawUrl && displayUrl && rawUrl !== displayUrl
        ? String(value).replaceAll(rawUrl, displayUrl)
        : value;
    } else {
      safeProxyEnv[key] = value;
    }
  }
  const safePrimaryArgs = [];
  const rawPrimaryArgs = Array.isArray(plan?.primaryArgs) ? plan.primaryArgs : [];
  for (let i = 0; i < rawPrimaryArgs.length; i++) {
    const arg = rawPrimaryArgs[i];
    if (arg === '--env' && i + 1 < rawPrimaryArgs.length) {
      safePrimaryArgs.push('--env');
      const pair = String(rawPrimaryArgs[++i]);
      const eq = pair.indexOf('=');
      if (eq > 0) {
        const key = pair.slice(0, eq);
        const val = Object.hasOwn(safeProxyEnv, key) ? safeProxyEnv[key] : pair.slice(eq + 1);
        safePrimaryArgs.push(`${key}=${val}`);
      } else {
        safePrimaryArgs.push(pair);
      }
    } else {
      safePrimaryArgs.push(arg);
    }
  }
  return {
    command: plan.command,
    app: plan.app,
    dataDir: plan.dataDir,
    proxy: {
      enabled: Boolean(plan?.proxy?.enabled),
      displayUrl,
      bypass: plan?.proxy?.bypass || '',
      forceHttp1: Boolean(plan?.proxy?.forceHttp1)
    },
    proxyEnv: safeProxyEnv,
    appArgs: [...(plan?.appArgs || [])],
    primaryArgs: safePrimaryArgs,
    fallbackArgs: [...(plan?.fallbackArgs || [])],
    usesEnvFlags: Boolean(plan?.usesEnvFlags)
  };
}

export function launchMacDirect({
  platform = process.platform,
  env = process.env,
  home = homedir(),
  execPath = process.execPath,
  sandbox = false,
  dataDir,
  settings,
  sourceApp,
  resolveApp,
  extraArgs = [],
  newInstance = false,
  dryRun = false,
  run = spawnSync
} = {}) {
  const plan = buildMacDirectLaunchPlan({
    platform,
    env,
    home,
    execPath,
    sandbox,
    dataDir,
    settings,
    sourceApp,
    resolveApp,
    extraArgs,
    newInstance
  });

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      launched: false,
      usedFallback: false,
      command: plan.command,
      args: plan.primaryArgs,
      plan
    };
  }

  const spawnOpts = { env: plan.env, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' };
  const primary = run(plan.command, plan.primaryArgs, spawnOpts);
  if (!primary?.error && primary?.status === 0) {
    return {
      ok: true,
      dryRun: false,
      launched: true,
      usedFallback: false,
      command: plan.command,
      args: plan.primaryArgs,
      plan
    };
  }

  if (plan.usesEnvFlags) {
    const fallback = run(plan.command, plan.fallbackArgs, spawnOpts);
    if (!fallback?.error && fallback?.status === 0) {
      return {
        ok: true,
        dryRun: false,
        launched: true,
        usedFallback: true,
        command: plan.command,
        args: plan.fallbackArgs,
        plan
      };
    }
    const detail = String(
      fallback?.stderr || fallback?.error?.message || primary?.stderr || primary?.error?.message || ''
    ).trim();
    throw new Error(detail ? `macOS could not open Antigravity.app: ${detail}` : 'macOS could not open Antigravity.app.');
  }

  const detail = String(primary?.stderr || primary?.error?.message || '').trim();
  throw new Error(detail ? `macOS could not open Antigravity.app: ${detail}` : 'macOS could not open Antigravity.app.');
}

export function parseMacLaunchCliArgs(argv = process.argv.slice(2)) {
  const result = {
    dryRun: false,
    json: false,
    newInstance: false,
    help: false,
    dataDir: '',
    extraArgs: []
  };
  let passthrough = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = String(argv[i] ?? '');
    if (passthrough) {
      if (arg && !/^-psn_/i.test(arg)) result.extraArgs.push(arg);
      continue;
    }
    if (/^-psn_/i.test(arg)) continue;
    if (arg === '--') {
      passthrough = true;
      continue;
    }
    if (arg === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    if (arg === '--json') {
      result.json = true;
      continue;
    }
    if (arg === '-n' || arg === '--new-instance') {
      result.newInstance = true;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      result.help = true;
      continue;
    }
    if (arg === '--data-dir') {
      const next = argv[++i];
      if (!next) throw new Error('Missing value for --data-dir');
      result.dataDir = next;
      continue;
    }
    if (arg.startsWith('--data-dir=')) {
      const val = arg.slice('--data-dir='.length);
      if (!val) throw new Error('Missing value for --data-dir');
      result.dataDir = val;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (arg) result.extraArgs.push(arg);
  }
  return result;
}

function isSameModulePath(a, b) {
  if (!a || !b) return false;
  let ra = resolve(a);
  let rb = resolve(b);
  try { ra = realpathSync(ra); } catch {}
  try { rb = realpathSync(rb); } catch {}
  return process.platform === 'win32' ? ra.toLowerCase() === rb.toLowerCase() : ra === rb;
}

if (isSameModulePath(process.argv[1], fileURLToPath(import.meta.url))) {
  let wantsJson = process.argv.includes('--json');
  try {
    const cli = parseMacLaunchCliArgs(process.argv.slice(2));
    wantsJson = cli.json;
    if (cli.help) {
      console.log('Usage: node launch-macos.mjs [--dry-run] [--json] [--new-instance] [--data-dir <dir>] [-- <app args...>]');
    } else {
      const outcome = launchMacDirect({
        dataDir: cli.dataDir || undefined,
        extraArgs: cli.extraArgs,
        newInstance: cli.newInstance,
        dryRun: cli.dryRun
      });
      const safePlan = sanitizeLaunchPlanForOutput(outcome.plan);
      if (cli.json) {
        console.log(JSON.stringify({
          ok: outcome.ok,
          dryRun: outcome.dryRun,
          launched: outcome.launched,
          usedFallback: outcome.usedFallback,
          plan: safePlan
        }, null, 2));
      } else if (cli.dryRun) {
        console.log(`Command: ${safePlan.command} ${safePlan.primaryArgs.join(' ')}`);
        console.log(`App: ${safePlan.app}`);
        console.log(`Proxy: ${safePlan.proxy.enabled ? safePlan.proxy.displayUrl : 'disabled'}`);
      }
    }
  } catch (error) {
    if (wantsJson) {
      console.error(JSON.stringify({ ok: false, error: error.message }));
    } else {
      console.error(error.message);
    }
    process.exitCode = 1;
  }
}
