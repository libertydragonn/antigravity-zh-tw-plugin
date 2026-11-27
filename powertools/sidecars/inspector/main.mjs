import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAppDataDir, listRecentConversations, resolveConversationId, parseSessionData, exportTranscript } from '../../lib/session-parser.mjs';
import { startNativeIntegration } from '../../lib/native-host.mjs';
import { serveRuntime } from '../../lib/runtime-control.mjs';
import { installationPaths } from '../../lib/lifecycle.mjs';
import { createSettingsStore, DEFAULT_SETTINGS } from '../../lib/settings.mjs';
import { configureLaunchers, createColdStartRelaunchCoordinator, isRemoteSshEnvironment, manualLaunchCommand, maybePromptPostUpdateRelaunch, recordDebugPortReady, recordProxyReady, scheduleRelaunchWithDebugPort, verifyRelaunchStarted } from '../../lib/launcher.mjs';
import { checkProxyPortOpen, inspectProxyRuntime } from '../../lib/proxy.mjs';
import { startSidecarWebUi } from '../../lib/sidecar-ui.mjs';
import { checkForUpdates } from '../../lib/updates.mjs';
import { startUpdate, updateStatus } from '../../lib/update-manager.mjs';

export { getAppDataDir, listRecentConversations, resolveConversationId, parseSessionData, exportTranscript };

const isDirectRun = (() => {
  if (!process.argv[1]) return false;
  const norm = p => {
    let resolved = p;
    try { resolved = realpathSync(p); } catch {}
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  return norm(fileURLToPath(import.meta.url)) === norm(process.argv[1]);
})();

if (isDirectRun) {
  const paths = installationPaths();
  const settings = createSettingsStore();
  const remoteSsh = isRemoteSshEnvironment();
  let missingPortPolls = 0, shortcutsHealed = false, everConnectedDebugPort = false;
  const relaunchCoordinator = createColdStartRelaunchCoordinator({
    dataDir: paths.data,
    home: paths.home,
    checkPort: checkProxyPortOpen
  });
  // Cold-start proxy auto-relaunch (non-TUN mode): runs locally before renderer/network mount,
  // with short retries if the local proxy client is still starting up on boot.
  const proxyRetryTimers = [];
  let deferredProxyAfterDebugPort = false;
  let bootProxyLastReason = '';
  const needsBootProxyRelaunch = runtime =>
    Boolean(runtime?.configured && (runtime.reason === 'not-applied' || (!runtime.managedByPowertools && runtime.reason === 'config-changed')));
  const attemptBootProxy = async (attempt = 0) => {
    if (remoteSsh || relaunchCoordinator.isScheduled()) return;
    const cur = settings.get();
    const runtime = inspectProxyRuntime(cur, process.env);
    if (cur.enabled === false || !needsBootProxyRelaunch(runtime)) return;
    const res = await relaunchCoordinator.attemptProxy({
      enabled: cur.enabled !== false,
      proxyEnabled: cur.proxyEnabled,
      proxyUrl: cur.proxyUrl,
      runtimeProxyReason: runtime.reason,
      runtimeProxyManaged: runtime.managedByPowertools
    }).catch(() => null);
    if (res?.reason && res.reason !== 'probe-in-flight') bootProxyLastReason = res.reason;
    if (res?.reason === 'proxy-unreachable' && attempt < 2 && !relaunchCoordinator.isScheduled()) {
      const t = setTimeout(() => { void attemptBootProxy(attempt + 1); }, attempt === 0 ? 4000 : 10000);
      t.unref?.();
      proxyRetryTimers.push(t);
    }
  };
  const scheduleHealLaunchers = () => {
    if (shortcutsHealed) return;
    shortcutsHealed = true;
    const run = () => {
      if (relaunchCoordinator.isScheduled()) return;
      if (relaunchCoordinator.isProxyProbeInFlight()) {
        const waitTimer = setTimeout(run, 250);
        waitTimer.unref?.();
        return;
      }
      try { configureLaunchers({ home: paths.home, dataDir: paths.data }); } catch {}
    };
    const t = setTimeout(run, 0);
    t.unref?.();
  };
  if (!remoteSsh) {
    const bootSettings = settings.get();
    const bootProxy = inspectProxyRuntime(bootSettings, process.env);
    if (bootProxy.reason === 'active') {
      try { recordProxyReady({ dataDir: paths.data }); } catch {}
    } else if (bootSettings.enabled !== false && needsBootProxyRelaunch(bootProxy)) {
      void attemptBootProxy(0);
    }
  }
  const stop = startNativeIntegration({
    parseSessionData,
    onDebugPortReady() {
      const wasConnected = everConnectedDebugPort;
      everConnectedDebugPort = true;
      missingPortPolls = 0;
      const cur = !remoteSsh ? settings.get() : null;
      const runtime = cur ? inspectProxyRuntime(cur, process.env) : null;
      const needsProxy = Boolean(runtime && needsBootProxyRelaunch(runtime));
      if (!wasConnected) {
        try { recordDebugPortReady({ dataDir: paths.data, preserveBlocked: needsProxy }); } catch {}
      }
      if (
        !remoteSsh &&
        !deferredProxyAfterDebugPort &&
        !relaunchCoordinator.isScheduled() &&
        bootProxyLastReason !== 'relaunch-blocked' &&
        bootProxyLastReason !== 'circuit-open' &&
        cur?.enabled !== false &&
        needsProxy
      ) {
        deferredProxyAfterDebugPort = true;
        const t = setTimeout(() => { void attemptBootProxy(0); }, 0);
        t.unref?.();
        proxyRetryTimers.push(t);
      }
    },
    onMissingDebugPort() {
      if (remoteSsh || everConnectedDebugPort) return;
      missingPortPolls++;
      scheduleHealLaunchers();
      const current = settings.get();
      if (current.enabled !== false) {
        if (process.platform === 'darwin' && current.macAutoRelaunch !== false) {
          const autoRes = relaunchCoordinator.attemptMac({
            enabled: current.enabled !== false,
            macAutoRelaunch: current.macAutoRelaunch !== false
          });
          if (autoRes.relaunched || autoRes.reason === 'already-attempted-session' || autoRes.reason === 'cooldown' || autoRes.reason === 'deferred-for-proxy-probe') return;
        }
        if (missingPortPolls >= 2) {
          maybePromptPostUpdateRelaunch({
            dataDir: paths.data,
            installDir: paths.installed,
            language: current.language || DEFAULT_SETTINGS.language,
            home: paths.home
          });
        }
      }
    }
  });
  const version = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
  const closeWebUi = await startSidecarWebUi({
    version,
    getStatus: async () => {
      const current = settings.get();
      const health = await stop.health();
      return {
        healthy: health.healthy,
        compatibilityError: health.compatibilityError || '',
        clientVersion: health.clientVersion || '',
        connected: Boolean(health.connected),
        enabled: current.enabled !== false,
        language: current.language || DEFAULT_SETTINGS.language,
        platform: process.platform,
        macAutoRelaunch: current.macAutoRelaunch !== false,
        mode: remoteSsh ? 'ssh-remote' : 'local',
        manualCommand: remoteSsh ? '' : manualLaunchCommand({ home: paths.home }),
        proxy: remoteSsh ? null : inspectProxyRuntime(current, process.env),
        update: updateStatus(undefined, version)
      };
    },
    onRelaunch: async () => {
      if (remoteSsh) return { scheduled: false, reason: 'ssh-remote' };
      const scheduled = scheduleRelaunchWithDebugPort({ dataDir: paths.data, home: paths.home });
      return verifyRelaunchStarted(scheduled, { dataDir: paths.data });
    },
    onSetSettings: patch => settings.set(patch),
    onCheckUpdate: () => checkForUpdates({ currentVersion: version }),
    onInstallUpdate: ({ version: expectedVersion } = {}) => startUpdate({ currentVersion: version, expectedVersion }),
    onUpdateStatus: () => updateStatus(undefined, version)
  }).catch(() => async () => {});
  const close = await serveRuntime({ directory: join(paths.data, 'runtime'), version, stop, health: stop.health });
  for (const event of ['SIGINT', 'SIGTERM']) process.on(event, async () => { await stop(); await closeWebUi(); await close(); process.exit(0); });
}
