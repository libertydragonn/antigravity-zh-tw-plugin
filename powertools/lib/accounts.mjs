import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse as parsePath } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createCredentialVault } from './credential-vault.mjs';
import { antigravityUserDataDir } from './paths.mjs';
import { rankAutoSwitchCandidates, selectAutoSwitchCandidate } from './account-helpers.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTO_SWITCH_COOLDOWN_MS = 120 * 1000;
const PENDING_SWITCH_TTL_MS = 5 * 60 * 1000;
const AVATAR_DATA_RE = /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;

function clone(value) {
  return structuredClone(value);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeRefreshHash(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function hashesCollide(aHash, aRefreshHash, bHash, bRefreshHash) {
  return Boolean((aHash && bHash && aHash === bHash) || (aRefreshHash && bRefreshHash && aRefreshHash === bRefreshHash));
}

function isInvalidatedSlot(acct, info) {
  if (!acct || !info?.exists) return false;
  if (acct.invalidRefreshHash && info.refreshHash && info.refreshHash === acct.invalidRefreshHash) return true;
  if (acct.invalidCredHash && info.hash && info.hash === acct.invalidCredHash) return true;
  return false;
}

function emailMatches(actualEmail, expectedEmail) {
  const actual = normalizeEmail(actualEmail);
  const expected = normalizeEmail(expectedEmail);
  return Boolean(actual && expected && actual === expected);
}

export function verifiedSwitchProfileDir(dirPath) {
  const isLocal = p => typeof p === 'string' && p.length > 0 && p.length <= 512 && isAbsolute(p) &&
    !/^[\\/]{2}|[\x00-\x1f\x7f]/.test(p) &&
    (process.platform !== 'win32' || /^[A-Za-z]:[\\/]/.test(p)) &&
    !p.split(/[\\/]/).includes('..');
  if (isLocal(dirPath)) {
    try {
      const dir = realpathSync.native(dirPath);
      if (isLocal(dir) && dir !== parsePath(dir).root && statSync(dir).isDirectory()) return dir;
    } catch {}
  }
  throw new Error('无法确认账号切换的用户数据目录');
}

function sanitizeAvatarUrl(url) {
  const value = String(url || '').trim();
  if (!value || value.length > 49152) return '';
  if (AVATAR_DATA_RE.test(value)) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:') return value;
  } catch {}
  return '';
}

function sanitizeGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return groups
    .filter(g => g && typeof g.displayName === 'string')
    .map(g => ({
      displayName: g.displayName,
      buckets: Array.isArray(g.buckets)
        ? g.buckets
          .filter(b => b && b.disabled !== true)
          .map(b => {
            const remainingFraction = typeof b.remainingFraction === 'number' && Number.isFinite(b.remainingFraction)
              ? Math.max(0, Math.min(1, b.remainingFraction))
              : null;
            const rawResetMs = Number.isFinite(b.resetTimeMs) ? b.resetTimeMs : null;
            const resetTimeMs = (remainingFraction != null && remainingFraction >= 1 && b.description === '') ? null : rawResetMs;
            return {
              bucketId: String(b.bucketId || ''),
              window: b.window === 'weekly' || /weekly/i.test(b.bucketId || '') ? 'weekly' : '5h',
              remainingFraction,
              resetTimeMs
            };
          })
        : []
    }));
}

function sanitizePendingSwitch(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.targetId !== 'string' || typeof value.targetEmail !== 'string' || !Number.isFinite(value.atMs)) return null;
  return {
    targetId: value.targetId,
    targetEmail: value.targetEmail,
    atMs: value.atMs,
    fromLsAddress: typeof value.fromLsAddress === 'string' ? value.fromLsAddress : '',
    ...(typeof value.switchId === 'string' && value.switchId ? { switchId: value.switchId } : {}),
    ...(typeof value.profileDir === 'string' && value.profileDir ? { profileDir: value.profileDir } : {})
  };
}

export function createAccountsStore(
  directory = join(homedir(), '.gemini', 'antigravity', 'plugin_data', 'agy-powertools'),
  {
    now = () => Date.now(),
    vault = createCredentialVault(),
    relaunch = null,
    platform = '',
    env = process.env,
    lsAddress = '',
    userDataDir = '',
    appStoragePath = undefined,
    scopePath = ''
  } = {}
) {
  const path = join(directory, 'accounts.json');
  const effectivePlatform = platform
    || (vault?.backend === 'win32-credman'
      ? 'win32'
      : vault?.backend === 'darwin-keychain'
        ? 'darwin'
        : (vault?.backend === 'linux-secret-service' || vault?.backend === 'wsl-wincred' ? 'linux' : process.platform));
  const resolvedUserDataDir = userDataDir
    || (typeof appStoragePath === 'string' && appStoragePath ? dirname(appStoragePath) : '')
    || (scopePath ? dirname(scopePath) : '')
    || antigravityUserDataDir({ platform: effectivePlatform, env });
  const resolvedAppStoragePath = appStoragePath === null || appStoragePath === ''
    ? ''
    : (appStoragePath || join(resolvedUserDataDir, 'app_storage.json'));
  const resolvedScopePath = scopePath
    || (typeof appStoragePath === 'string' && appStoragePath ? join(dirname(appStoragePath), 'credential-user-scope') : join(resolvedUserDataDir, 'credential-user-scope'));

  const strictIdentity = typeof vault?.inspectActive === 'function';
  let confirmedQuotaEmailValue = '';

  function identityOk(actualEmail, expectedEmail) {
    if (!strictIdentity && !normalizeEmail(actualEmail)) return true;
    return emailMatches(actualEmail, expectedEmail);
  }

  function currentLsAddress(override = '') {
    return String(override || lsAddress || env?.ANTIGRAVITY_LS_ADDRESS || '').trim();
  }

  function readOnboardingState() {
    if (!resolvedAppStoragePath) return null;
    try {
      if (!existsSync(resolvedAppStoragePath)) return null;
      const parsed = JSON.parse(readFileSync(resolvedAppStoragePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      const rawEmail = parsed['agy.onboarding.lastLoginUsername'] ?? parsed['jetski.onboarding.lastLoginUsername'] ?? '';
      const rawTos = parsed['agy.onboarding.lastLoginIsGcpTos'] ?? parsed['jetski.onboarding.lastLoginIsGcpTos'];
      const email = normalizeEmail(rawEmail);
      const isGcpTos = rawTos === 'true' || rawTos === true ? true : (rawTos === 'false' || rawTos === false ? false : null);
      return { email, isGcpTos };
    } catch {
      return null;
    }
  }

  function writeState(state) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(`${path}.tmp`, JSON.stringify(state, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
    renameSync(`${path}.tmp`, path);
  }

  function loadState() {
    try {
      if (existsSync(path)) {
        const parsed = JSON.parse(readFileSync(path, 'utf8'));
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.accounts)) {
          const accounts = parsed.accounts
            .filter(a => a && typeof a.id === 'string' && typeof a.email === 'string')
            .filter(a => a.source !== 'preview' && !a.id.startsWith('preview-'))
            .map(a => ({
              id: a.id,
              email: a.email,
              name: typeof a.name === 'string' ? a.name : '',
              alias: typeof a.alias === 'string' ? a.alias : '',
              avatarUrl: sanitizeAvatarUrl(a.avatarUrl),
              tier: a.tier && typeof a.tier === 'object' ? { id: String(a.tier.id || ''), name: String(a.tier.name || '') } : { id: '', name: '' },
              groups: sanitizeGroups(a.groups),
              disabled: Boolean(a.disabled),
              hasCredential: a.hasCredential !== false,
              credHash: typeof a.credHash === 'string' ? a.credHash : '',
              refreshHash: normalizeRefreshHash(a.refreshHash),
              invalidCredHash: typeof a.invalidCredHash === 'string' ? a.invalidCredHash : '',
              invalidRefreshHash: normalizeRefreshHash(a.invalidRefreshHash),
              quarantined: a.quarantined === true,
              onboardingAccepted: Boolean(a.onboardingAccepted),
              isGcpTos: typeof a.isGcpTos === 'boolean' ? a.isGcpTos : null,
              syncedAtMs: Number.isFinite(a.syncedAtMs) ? a.syncedAtMs : null,
              lastUsedAtMs: Number.isFinite(a.lastUsedAtMs) ? a.lastUsedAtMs : null
            }));
          const activeId = parsed.activeId === '' || accounts.some(a => a.id === parsed.activeId)
            ? parsed.activeId
            : (accounts[0]?.id || '');
          return {
            version: 2,
            activeId,
            pendingAlias: typeof parsed.pendingAlias === 'string' ? parsed.pendingAlias : '',
            pendingSwitch: sanitizePendingSwitch(parsed.pendingSwitch),
            lastAutoSwitchAtMs: Number.isFinite(parsed.lastAutoSwitchAtMs) ? parsed.lastAutoSwitchAtMs : 0,
            accounts
          };
        }
      }
    } catch {}
    return {
      version: 2,
      activeId: '',
      pendingAlias: '',
      pendingSwitch: null,
      lastAutoSwitchAtMs: 0,
      accounts: []
    };
  }

  function vaultCapability() {
    if (typeof vault?.probe === 'function') return vault.probe();
    return { supported: Boolean(vault?.supported), backend: vault?.backend || '', reason: '' };
  }

  function isNativeWindows(cap) {
    return Boolean(platform === 'win32' || cap?.backend === 'win32-credman' || vault?.backend === 'win32-credman');
  }

  function publicAccount({ credHash, refreshHash, invalidCredHash, invalidRefreshHash, quarantined, ...rest }) {
    return rest;
  }

  function snapshotResponse(state) {
    const cap = vaultCapability();
    return clone({
      activeId: state.activeId,
      accounts: state.accounts.map(publicAccount),
      vaultSupported: Boolean(cap.supported),
      ...(cap.reason ? { vaultReason: cap.reason } : {}),
      lastAutoSwitchAtMs: state.lastAutoSwitchAtMs || 0
    });
  }

  function readSavedInfo(accountId) {
    if (!vaultCapability().supported) return { exists: false, hash: '', email: '', refreshHash: '' };
    if (typeof vault.inspectSaved === 'function') {
      const info = vault.inspectSaved(accountId) || {};
      return {
        exists: Boolean(info.exists),
        hash: typeof info.hash === 'string' ? info.hash : '',
        email: normalizeEmail(info.email),
        refreshHash: normalizeRefreshHash(info.refreshHash)
      };
    }
    return { exists: Boolean(vault.hasSaved?.(accountId)), hash: '', email: '', refreshHash: '' };
  }

  function readActiveInfo() {
    if (!vaultCapability().supported) return { exists: false, hash: '', email: '', refreshHash: '' };
    if (typeof vault.inspectActive === 'function') {
      const info = vault.inspectActive() || {};
      return {
        exists: Boolean(info.exists),
        hash: typeof info.hash === 'string' ? info.hash : '',
        email: normalizeEmail(info.email),
        refreshHash: normalizeRefreshHash(info.refreshHash)
      };
    }
    return { exists: false, hash: '', email: '', refreshHash: '' };
  }

  function conflictingOwner(state, target, info) {
    if (!info?.refreshHash) return false;
    return state.accounts.some(other => {
      if (other.id === target?.id || !other.hasCredential || other.quarantined) return false;
      let otherRefresh = other.refreshHash;
      if (!otherRefresh) {
        const saved = readSavedInfo(other.id);
        if (saved.exists && identityOk(saved.email, other.email) && saved.refreshHash) {
          other.refreshHash = saved.refreshHash;
          otherRefresh = saved.refreshHash;
        }
      }
      return Boolean(otherRefresh && otherRefresh === info.refreshHash);
    });
  }

  function backupActive(state, target, info = readActiveInfo(), freshLogin = false) {
    if (target.quarantined) {
      const priorRefresh = target.invalidRefreshHash || target.refreshHash;
      const hasNewHash = Boolean(info.hash && info.hash !== target.credHash && info.hash !== target.invalidCredHash);
      const hasNewRefresh = !priorRefresh || Boolean(info.refreshHash && info.refreshHash !== priorRefresh);
      if (!(freshLogin && hasNewHash && hasNewRefresh)) {
        return { ok: false, mismatch: true, actualEmail: info.email };
      }
    } else if (isInvalidatedSlot(target, info)) {
      return { ok: false, mismatch: true, actualEmail: info.email };
    }
    if (conflictingOwner(state, target, info)) {
      return { ok: false, mismatch: true, actualEmail: info.email };
    }
    if (strictIdentity && (!info.exists || !emailMatches(info.email, target.email))) {
      return { ok: false, mismatch: true, actualEmail: info.email };
    }
    const saved = vault.saveActiveTo(target.id, {
      expectedEmail: target.email,
      ...(info.hash ? { expectedHash: info.hash } : {})
    });
    if (saved?.ok) {
      const savedRefreshHash = normalizeRefreshHash(saved.refreshHash) || info.refreshHash;
      if (savedRefreshHash) target.refreshHash = savedRefreshHash;
      if (freshLogin) {
        target.quarantined = false;
        target.invalidCredHash = '';
        target.invalidRefreshHash = '';
      }
    }
    return saved;
  }

  function buildPendingSwitch(target, ts, deferredRestore) {
    return {
      targetId: target.id,
      targetEmail: target.email,
      atMs: ts,
      fromLsAddress: currentLsAddress(),
      ...(deferredRestore
        ? { switchId: randomUUID(), profileDir: verifiedSwitchProfileDir(resolvedUserDataDir) }
        : {})
    };
  }

  function normalizeRelaunchResult(launched, deferredRestore = false) {
    const manualRestartRequired = Boolean(launched?.manualRestartRequired) ||
      launched?.scheduled === false ||
      (deferredRestore && launched?.scheduled !== true);
    const relaunching = !manualRestartRequired;
    const relaunchReason = manualRestartRequired ? String(launched?.reason || 'relaunch-blocked') : '';
    const relaunchError = manualRestartRequired ? String(launched?.error || launched?.reason || '') : '';
    const manualCommand = manualRestartRequired && typeof launched?.manualCommand === 'string' ? launched.manualCommand : '';
    return { relaunching, manualRestartRequired, relaunchReason, relaunchError, manualCommand };
  }

  function runRelaunch(triggerRelaunch, options = undefined, deferredRestore = false) {
    if (!triggerRelaunch || typeof relaunch !== 'function') {
      return {
        relaunching: false,
        manualRestartRequired: deferredRestore,
        relaunchReason: deferredRestore ? 'relaunch-disabled' : '',
        relaunchError: '',
        manualCommand: ''
      };
    }
    try {
      const launched = options ? relaunch(options) : relaunch();
      if (launched && typeof launched.then === 'function') {
        return launched.then(
          resolved => normalizeRelaunchResult(resolved, deferredRestore),
          error => ({
            relaunching: false,
            manualRestartRequired: true,
            relaunchReason: 'relaunch-failed',
            relaunchError: error?.message || '自动重启失败',
            manualCommand: ''
          })
        );
      }
      return normalizeRelaunchResult(launched, deferredRestore);
    } catch (error) {
      return {
        relaunching: false,
        manualRestartRequired: true,
        relaunchReason: 'relaunch-failed',
        relaunchError: error?.message || '自动重启失败',
        manualCommand: ''
      };
    }
  }

  function scheduleDeferredOrImmediateRelaunch(state, target, triggerRelaunch, onboardingSync, deferredRestore, finish) {
    const pending = state.pendingSwitch;
    const relaunchOpts = deferredRestore
      ? {
          ...(onboardingSync ? { onboardingSync } : {}),
          credentialSwitch: {
            accountId: target.id,
            expectedEmail: target.email,
            ...(target.credHash ? { expectedHash: target.credHash } : {}),
            switchId: pending.switchId
          },
          profileDir: pending.profileDir,
          clearScopePath: resolvedScopePath || join(pending.profileDir, 'credential-user-scope')
        }
      : (onboardingSync ? { onboardingSync } : undefined);

    const done = result => {
      if (deferredRestore && !result.relaunching) {
        const latest = loadState();
        if (latest.pendingSwitch?.switchId === pending.switchId) {
          latest.pendingSwitch = null;
          writeState(latest);
        }
        throw new Error('未能安全重启，未执行凭据切换。请检查重启设置后重试');
      }
      return finish(result);
    };

    const outcome = runRelaunch(triggerRelaunch, relaunchOpts, deferredRestore);
    return outcome && typeof outcome.then === 'function' ? outcome.then(done) : done(outcome);
  }

  return {
    list() {
      return snapshotResponse(loadState());
    },

    confirmedQuotaEmail() {
      return confirmedQuotaEmailValue;
    },

    canRecordQuota(email, { multiAccountEnabled = true } = {}) {
      if (!multiAccountEnabled) return true;
      const clean = normalizeEmail(email);
      return Boolean(clean && confirmedQuotaEmailValue && confirmedQuotaEmailValue === clean);
    },

    clearConfirmedQuota() {
      confirmedQuotaEmailValue = '';
    },

    syncActive({ email, name = '', avatarUrl = '', tier = null, groups = null, availableModels = null, lsAddress: overrideLs = '' } = {}) {
      confirmedQuotaEmailValue = '';
      const cleanEmail = String(email || '').trim();
      const state = loadState();
      if (!EMAIL_RE.test(cleanEmail)) {
        return clone({ ...snapshotResponse(state), confirmedQuotaEmail: '', canRecordQuota: false });
      }
      const ts = now();
      const cap = vaultCapability();

      // Anti-clobber lock: if a switch was triggered and Antigravity has not yet restarted
      // into the target account, ignore syncActive events coming from the old account's UI.
      // Check worker ACK (appliedSwitchId/failedSwitchId) and ANTIGRAVITY_LS_ADDRESS changes:
      // if Antigravity restarted into the wrong account after restore applied, quarantine target slot.
      if (state.pendingSwitch) {
        const pending = state.pendingSwitch;
        const expired = ts - pending.atMs >= PENDING_SWITCH_TTL_MS;
        const liveLs = currentLsAddress(overrideLs);
        const prevLs = String(pending.fromLsAddress || '').trim();
        const sameSession = Boolean(prevLs && liveLs && prevLs === liveLs);
        const newSession = Boolean(prevLs && liveLs && prevLs !== liveLs);

        let applied = !pending.switchId;
        let workerFailed = false;
        if (pending.switchId) {
          try {
            const receipt = JSON.parse(readFileSync(join(directory, 'relaunch-ack.json'), 'utf8'));
            applied = receipt.appliedSwitchId === pending.switchId;
            workerFailed = receipt.failedSwitchId === pending.switchId;
          } catch {}
        }

        if (workerFailed) {
          state.pendingSwitch = null;
          const actualAcct = state.accounts.find(a => normalizeEmail(a.email) === normalizeEmail(cleanEmail));
          if (actualAcct) state.activeId = actualAcct.id;
          writeState(state);
          return clone({
            ...snapshotResponse(state),
            confirmedQuotaEmail: '',
            canRecordQuota: false,
            switchMismatch: {
              expectedEmail: pending.targetEmail,
              actualEmail: cleanEmail,
              restoreFailed: true
            },
            credentialMismatch: {
              uiEmail: cleanEmail,
              targetEmail: pending.targetEmail,
              afterSwitch: true
            }
          });
        }

        const matchedTarget = cleanEmail.toLowerCase() === pending.targetEmail.toLowerCase();
        if (matchedTarget) {
          if (applied || newSession || expired) {
            state.pendingSwitch = null;
          } else {
            return clone({
              ...snapshotResponse(state),
              confirmedQuotaEmail: '',
              canRecordQuota: false,
              pendingSwitchIgnored: true,
              syncSkipped: true
            });
          }
        } else if (!expired) {
          const shouldDetectMismatch = newSession || (pending.switchId && applied && !sameSession);
          if (shouldDetectMismatch) {
            const expectedEmail = pending.targetEmail;
            const failedId = pending.targetId;
            state.pendingSwitch = null;
            const failedTarget = state.accounts.find(a => a.id === failedId || normalizeEmail(a.email) === normalizeEmail(expectedEmail));
            if (failedTarget && applied) {
              const savedTarget = cap.supported ? readSavedInfo(failedTarget.id) : { exists: false, hash: '', refreshHash: '' };
              failedTarget.quarantined = true;
              failedTarget.hasCredential = false;
              failedTarget.invalidCredHash = savedTarget.hash || failedTarget.credHash || failedTarget.invalidCredHash || '';
              failedTarget.invalidRefreshHash = savedTarget.refreshHash || failedTarget.refreshHash || failedTarget.invalidRefreshHash || '';
            }
            const actualAcct = state.accounts.find(a => normalizeEmail(a.email) === normalizeEmail(cleanEmail));
            state.activeId = actualAcct?.id || '';
            writeState(state);
            return clone({
              ...snapshotResponse(state),
              confirmedQuotaEmail: '',
              canRecordQuota: false,
              switchMismatch: {
                expectedEmail,
                actualEmail: cleanEmail
              },
              credentialMismatch: {
                uiEmail: cleanEmail,
                targetEmail: expectedEmail,
                afterSwitch: true
              }
            });
          }
          return clone({
            ...snapshotResponse(state),
            confirmedQuotaEmail: '',
            canRecordQuota: false,
            pendingSwitchIgnored: true,
            syncSkipped: true
          });
        } else {
          if (pending.switchId && applied) {
            const expectedEmail = pending.targetEmail;
            const failedTarget = state.accounts.find(a => a.id === pending.targetId || normalizeEmail(a.email) === normalizeEmail(expectedEmail));
            if (failedTarget) {
              const savedTarget = cap.supported ? readSavedInfo(failedTarget.id) : { exists: false, hash: '', refreshHash: '' };
              failedTarget.quarantined = true;
              failedTarget.hasCredential = false;
              failedTarget.invalidCredHash = savedTarget.hash || failedTarget.credHash || failedTarget.invalidCredHash || '';
              failedTarget.invalidRefreshHash = savedTarget.refreshHash || failedTarget.refreshHash || failedTarget.invalidRefreshHash || '';
            }
            const actualAcct = state.accounts.find(a => normalizeEmail(a.email) === normalizeEmail(cleanEmail));
            state.activeId = actualAcct?.id || '';
            state.pendingSwitch = null;
            writeState(state);
            return clone({
              ...snapshotResponse(state),
              confirmedQuotaEmail: '',
              canRecordQuota: false,
              switchMismatch: {
                expectedEmail,
                actualEmail: cleanEmail
              },
              credentialMismatch: {
                uiEmail: cleanEmail,
                targetEmail: expectedEmail,
                afterSwitch: true
              }
            });
          }
          state.pendingSwitch = null;
        }
      }

      // Guard against credential/UI drift (e.g. a stale in-process TokenSource overwrote the active keyring
      // with a previous account while the UI still displays the newer account): never clobber the displayed
      // account's vault slot or quota with another account's credential and usage.
      const activeInfo = cap.supported ? readActiveInfo() : null;
      if (cap.supported) {
        const owner = state.accounts.find(a => normalizeEmail(a.email) === normalizeEmail(cleanEmail));
        if (strictIdentity && (!activeInfo.exists || !emailMatches(activeInfo.email, cleanEmail))) {
          return clone({
            ...snapshotResponse(state),
            confirmedQuotaEmail: '',
            canRecordQuota: false,
            credentialMismatch: {
              uiEmail: cleanEmail,
              credentialEmail: activeInfo.email
            }
          });
        }
        if (owner?.quarantined || (owner && isInvalidatedSlot(owner, activeInfo))) {
          return clone({
            ...snapshotResponse(state),
            confirmedQuotaEmail: '',
            canRecordQuota: false,
            credentialMismatch: {
              uiEmail: cleanEmail,
              credentialEmail: activeInfo.email
            }
          });
        }
        if (activeInfo.exists && activeInfo.refreshHash) {
          const prevActive = state.accounts.find(a => a.id === state.activeId);
          if (
            prevActive &&
            normalizeEmail(prevActive.email) !== normalizeEmail(cleanEmail) &&
            prevActive.hasCredential &&
            prevActive.refreshHash &&
            activeInfo.refreshHash === prevActive.refreshHash
          ) {
            const prevSaved = readSavedInfo(prevActive.id);
            if (!prevSaved.exists || identityOk(prevSaved.email, prevActive.email)) {
              return clone({
                ...snapshotResponse(state),
                confirmedQuotaEmail: '',
                canRecordQuota: false,
                credentialMismatch: {
                  uiEmail: cleanEmail,
                  credentialEmail: prevActive.email
                }
              });
            }
          }
          if (conflictingOwner(state, owner, activeInfo)) {
            return clone({
              ...snapshotResponse(state),
              confirmedQuotaEmail: '',
              canRecordQuota: false,
              credentialMismatch: {
                uiEmail: cleanEmail,
                credentialEmail: activeInfo.email
              }
            });
          }
        }
      }

      const preSnapshot = snapshotResponse(state);
      const cleanGroups = sanitizeGroups(groups);
      const cleanModels = Array.isArray(availableModels)
        ? [...new Set(availableModels.map(m => String(m || '').trim().slice(0, 80)).filter(Boolean))].slice(0, 64)
        : null;
      let target = state.accounts.find(a => a.email.toLowerCase() === cleanEmail.toLowerCase());
      if (!target) {
        const appliedAlias = String(state.pendingAlias || '').trim().slice(0, 40);
        state.pendingAlias = '';
        target = {
          id: `acct-${randomUUID().slice(0, 8)}`,
          email: cleanEmail,
          name: String(name || '').trim() || cleanEmail.split('@')[0],
          alias: appliedAlias,
          avatarUrl: sanitizeAvatarUrl(avatarUrl),
          tier: tier ? { id: String(tier.id || ''), name: String(tier.name || '') } : { id: '', name: '' },
          groups: cleanGroups,
          ...(cleanModels && cleanModels.length ? { availableModels: cleanModels } : {}),
          disabled: false,
          hasCredential: false,
          credHash: '',
          refreshHash: '',
          invalidCredHash: '',
          invalidRefreshHash: '',
          quarantined: false,
          onboardingAccepted: false,
          isGcpTos: null,
          syncedAtMs: cleanGroups.length > 0 ? ts : null,
          lastUsedAtMs: ts
        };
        state.accounts.push(target);
      } else {
        if (typeof name === 'string' && name.trim()) target.name = name.trim();
        const cleanAvatar = sanitizeAvatarUrl(avatarUrl);
        if (cleanAvatar) target.avatarUrl = cleanAvatar;
        if (tier && (tier.id || tier.name)) target.tier = { id: String(tier.id || ''), name: String(tier.name || '') };
        if (cleanModels && cleanModels.length) target.availableModels = cleanModels;
        if (cleanGroups.length > 0) {
          target.groups = cleanGroups;
          target.syncedAtMs = ts;
        }
        target.lastUsedAtMs = ts;
        if (state.pendingAlias && state.activeId !== target.id) {
          target.alias = String(state.pendingAlias).trim().slice(0, 40);
          state.pendingAlias = '';
        }
      }
      const obState = readOnboardingState();
      if (obState && obState.email && obState.email === normalizeEmail(target.email)) {
        target.onboardingAccepted = true;
        if (typeof obState.isGcpTos === 'boolean') target.isGcpTos = obState.isGcpTos;
      } else if (cleanGroups.length > 0) {
        target.onboardingAccepted = true;
      }
      state.activeId = target.id;
      if (cap.supported) {
        const saved = backupActive(state, target, activeInfo, false);
        if (saved?.mismatch || (strictIdentity && !saved?.ok)) {
          return clone({
            ...preSnapshot,
            confirmedQuotaEmail: '',
            canRecordQuota: false,
            credentialMismatch: {
              uiEmail: cleanEmail,
              credentialEmail: normalizeEmail(saved?.actualEmail)
            }
          });
        }
        if (saved?.ok) {
          target.hasCredential = true;
          const savedHash = typeof saved.hash === 'string' ? saved.hash : '';
          const savedRefreshHash = normalizeRefreshHash(saved.refreshHash) || activeInfo?.refreshHash || '';
          if (savedHash) target.credHash = savedHash;
          if (savedRefreshHash) target.refreshHash = savedRefreshHash;
          if (savedHash || savedRefreshHash) {
            // Detect duplicate/clobbered vault slots on other accounts so we never silently switch into the same token.
            for (const other of state.accounts) {
              if (other.id === target.id || other.quarantined) continue;
              let otherHash = other.credHash;
              let otherRefreshHash = other.refreshHash;
              if (other.hasCredential && (!otherHash || (savedRefreshHash && !otherRefreshHash))) {
                const info = readSavedInfo(other.id);
                if (!info.exists || !identityOk(info.email, other.email) || isInvalidatedSlot(other, info)) {
                  other.hasCredential = false;
                  other.credHash = '';
                  other.refreshHash = '';
                  continue;
                }
                if (info.hash) {
                  otherHash = info.hash;
                  other.credHash = info.hash;
                }
                if (info.refreshHash) {
                  otherRefreshHash = info.refreshHash;
                  other.refreshHash = info.refreshHash;
                }
              }
              if (hashesCollide(otherHash, otherRefreshHash, savedHash, savedRefreshHash)) {
                other.hasCredential = false;
                other.credHash = '';
                other.refreshHash = '';
              }
            }
          }
        }
      }
      writeState(state);
      confirmedQuotaEmailValue = normalizeEmail(target.email);
      return clone({
        ...snapshotResponse(state),
        confirmedQuotaEmail: confirmedQuotaEmailValue,
        canRecordQuota: Boolean(confirmedQuotaEmailValue)
      });
    },

    prepareAdd({ pendingAlias = '' } = {}) {
      const state = loadState();
      const active = state.accounts.find(a => a.id === state.activeId);
      const ts = now();
      const cap = vaultCapability();
      const deferredRestore = isNativeWindows(cap);
      const hasPendingSwitch = Boolean(state.pendingSwitch && ts - state.pendingSwitch.atMs < PENDING_SWITCH_TTL_MS);
      if (deferredRestore && hasPendingSwitch) {
        throw new Error('正在切换账号，请稍候');
      }
      state.pendingSwitch = null;
      if (!cap.supported) {
        throw new Error(cap.reason || '当前系统不支持凭据库操作，无法添加多账号');
      }
      const prevActiveInfo = readActiveInfo();
      let prevCredHash = prevActiveInfo.hash || '';
      let prevRefreshHash = prevActiveInfo.refreshHash || '';
      let backedUpId = '';
      if (active && !hasPendingSwitch) {
        const saved = backupActive(state, active, prevActiveInfo, false);
        if (saved?.mismatch) {
          // A conflicting label isn't evidence of ownership. Leave both backups alone to prevent chimera contamination.
        } else if (!saved?.ok || !vault.hasSaved(active.id)) {
          const detail = typeof saved?.error === 'string' && saved.error.trim() ? `（${saved.error.trim()}）` : '';
          throw new Error(`无法保存当前账号凭证${detail}，已取消添加操作以保护当前登录`);
        } else {
          active.hasCredential = true;
          if (typeof saved.hash === 'string' && saved.hash) {
            active.credHash = saved.hash;
            prevCredHash = saved.hash;
          }
          const savedRefreshHash = normalizeRefreshHash(saved.refreshHash) || prevActiveInfo.refreshHash;
          if (savedRefreshHash) {
            active.refreshHash = savedRefreshHash;
            prevRefreshHash = savedRefreshHash;
          }
          backedUpId = active.id;
        }
      }
      state.pendingAlias = String(pendingAlias || '').trim().slice(0, 40);
      writeState(state);
      return clone({
        ok: true,
        backedUpId,
        prevCredHash,
        prevRefreshHash,
        ...snapshotResponse(state)
      });
    },

    completeAdd({ email = '', prevEmail = '', prevCredHash = '', prevRefreshHash = '', triggerRelaunch = true } = {}) {
      confirmedQuotaEmailValue = '';
      const state = loadState();
      const cleanEmail = String(email || '').trim();
      const normEmail = normalizeEmail(cleanEmail);
      const normPrevEmail = normalizeEmail(prevEmail);
      const ts = now();
      const cap = vaultCapability();
      const deferredRestore = isNativeWindows(cap);
      let activeInfo = cap.supported ? readActiveInfo() : { exists: false, hash: '', email: '', refreshHash: '' };
      const uiUnchanged = Boolean(normPrevEmail && normEmail && normEmail === normPrevEmail);
      const keyringUnchanged = Boolean(prevCredHash && activeInfo.exists && activeInfo.hash && activeInfo.hash === prevCredHash);

      // Cancelled / no-op sign-in: neither UI email nor active keyring changed.
      if (uiUnchanged && keyringUnchanged) {
        if (state.pendingAlias) {
          state.pendingAlias = '';
          writeState(state);
        }
        const existing = state.accounts.find(a => normalizeEmail(a.email) === normEmail) || null;
        return clone({
          ok: true,
          relaunching: false,
          manualRestartRequired: false,
          ...(existing ? { account: publicAccount(existing) } : {}),
          ...snapshotResponse(state)
        });
      }

      const prevAcct = normPrevEmail ? state.accounts.find(a => normalizeEmail(a.email) === normPrevEmail) : null;
      const effectivePrevRefreshHash = normalizeRefreshHash(prevRefreshHash) || prevAcct?.refreshHash || '';

      // Detect chimera credentials where OAuth updated refresh_token while leaving stale id_token_email === prevEmail,
      // or where UI switched to a new email while the keyring still carries prevEmail's refresh_token.
      if (cap.supported && activeInfo.exists && normPrevEmail && normEmail && normEmail !== normPrevEmail) {
        if (activeInfo.email && emailMatches(activeInfo.email, normPrevEmail)) {
          const prevSlot = prevAcct ? readSavedInfo(prevAcct.id) : { exists: false, refreshHash: '' };
          if (
            activeInfo.refreshHash &&
            effectivePrevRefreshHash &&
            activeInfo.refreshHash !== effectivePrevRefreshHash &&
            (!prevSlot.refreshHash || activeInfo.refreshHash !== prevSlot.refreshHash)
          ) {
            throw new Error(`检测到混合登录凭据（系统凭据仍标记为 ${activeInfo.email}，但刷新令牌已变化），为防止凭据串号已中止保存，请重启 Antigravity 后重新登录 ${cleanEmail}`);
          }
        } else if (activeInfo.refreshHash && effectivePrevRefreshHash && activeInfo.refreshHash === effectivePrevRefreshHash) {
          throw new Error(`检测到系统凭据仍使用原账号刷新令牌，未获取到 ${cleanEmail} 的独立凭据，请重启 Antigravity 后重新登录该账号`);
        }
      }

      // Slow-Redux fallback: OAuth wrote a new account credential to the OS keyring before UI capabilities().email caught up.
      const keyringChanged = !prevCredHash || Boolean(activeInfo.hash && activeInfo.hash !== prevCredHash);
      const keyringAheadOfUi = Boolean(
        cap.supported && activeInfo.exists && activeInfo.email && keyringChanged
        && (!normEmail || uiUnchanged)
        && (!normPrevEmail || activeInfo.email !== normPrevEmail)
      );
      const effectiveEmail = keyringAheadOfUi ? activeInfo.email : normEmail;
      if (cap.supported && strictIdentity && (!activeInfo.exists || !emailMatches(activeInfo.email, effectiveEmail))) {
        throw new Error('无法确认新账号的系统凭据，已取消保存，请重新登录');
      }
      let target = effectiveEmail
        ? state.accounts.find(a => normalizeEmail(a.email) === effectiveEmail)
        : state.accounts.find(a => a.id === state.activeId);

      if (!target && effectiveEmail && EMAIL_RE.test(effectiveEmail) && cap.supported && activeInfo.exists && identityOk(activeInfo.email, effectiveEmail)) {
        const appliedAlias = String(state.pendingAlias || '').trim().slice(0, 40);
        state.pendingAlias = '';
        const displayEmail = keyringAheadOfUi ? activeInfo.email : cleanEmail;
        target = {
          id: `acct-${randomUUID().slice(0, 8)}`,
          email: displayEmail,
          name: displayEmail.split('@')[0],
          alias: appliedAlias,
          avatarUrl: '',
          tier: { id: '', name: '' },
          groups: [],
          disabled: false,
          hasCredential: false,
          credHash: '',
          refreshHash: '',
          invalidCredHash: '',
          invalidRefreshHash: '',
          quarantined: false,
          onboardingAccepted: false,
          isGcpTos: null,
          syncedAtMs: null,
          lastUsedAtMs: ts
        };
        state.accounts.push(target);
      } else if (target && keyringAheadOfUi && state.pendingAlias && state.activeId !== target.id) {
        target.alias = String(state.pendingAlias).trim().slice(0, 40);
        state.pendingAlias = '';
      }

      if (!target) {
        return clone({
          ok: true,
          relaunching: false,
          manualRestartRequired: false,
          ...snapshotResponse(state)
        });
      }

      let targetSaved = cap.supported ? readSavedInfo(target.id) : { exists: false, hash: '', email: '', refreshHash: '' };

      if (cap.supported) {
        if (strictIdentity && (!activeInfo.exists || !emailMatches(activeInfo.email, target.email))) {
          throw new Error(`系统凭据仍指向 ${activeInfo.email || '未知账号'}，未检测到 ${target.email} 的有效凭据，请先重启 Antigravity 后再重新登录该账号`);
        }
        if (activeInfo.refreshHash) {
          const existingOwner = state.accounts.find(a =>
            a.id !== target.id && a.hasCredential && !a.quarantined && a.refreshHash && a.refreshHash === activeInfo.refreshHash
          );
          if (existingOwner) {
            const ownerSlot = readSavedInfo(existingOwner.id);
            if (!ownerSlot.exists || identityOk(ownerSlot.email, existingOwner.email)) {
              throw new Error(`检测到系统凭据刷新令牌与账号 ${existingOwner.email} 重复，为防止凭据串号已中止保存，请重启 Antigravity 后重新登录 ${target.email}`);
            }
          }
        }
        if (conflictingOwner(state, target, activeInfo)) {
          throw new Error('凭据所属账号不一致，请重新登录');
        }
        if (target.quarantined || !targetSaved.exists || (activeInfo.hash && targetSaved.hash !== activeInfo.hash) || isInvalidatedSlot(target, targetSaved)) {
          // Only an independently reported UI email matching target.email can authorize quarantine recovery.
          const uiConfirmed = emailMatches(normEmail, target.email);
          const saved = backupActive(state, target, activeInfo, uiConfirmed);
          if (!saved?.ok) {
            throw new Error('无法确认或保存新账号凭据，请重新登录');
          }
          target.hasCredential = true;
          const savedHash = typeof saved.hash === 'string' ? saved.hash : '';
          const savedRefreshHash = normalizeRefreshHash(saved.refreshHash) || activeInfo.refreshHash;
          if (savedHash) target.credHash = savedHash;
          if (savedRefreshHash) target.refreshHash = savedRefreshHash;
          if (savedHash || savedRefreshHash) {
            for (const other of state.accounts) {
              if (!other.quarantined && other.id !== target.id && hashesCollide(other.credHash, other.refreshHash, savedHash, savedRefreshHash)) {
                other.hasCredential = false;
                other.credHash = '';
                other.refreshHash = '';
              }
            }
          }
          targetSaved = {
            exists: true,
            hash: target.credHash,
            email: normalizeEmail(saved.email || activeInfo.email),
            refreshHash: target.refreshHash
          };
        }
      }

      const currentHash = activeInfo.hash || targetSaved.hash || target.credHash || '';
      const targetEmail = normalizeEmail(target.email);
      const accountChanged = Boolean(normPrevEmail && targetEmail && normPrevEmail !== targetEmail);
      const tokenRotated = Boolean(normPrevEmail && prevCredHash && currentHash && prevCredHash !== currentHash);
      const needsRelaunch = accountChanged || tokenRotated;

      if (!needsRelaunch) {
        writeState(state);
        return clone({
          ok: true,
          relaunching: false,
          manualRestartRequired: false,
          account: publicAccount(target),
          ...snapshotResponse(state)
        });
      }

      // Antigravity's language_server retains prior account TokenSources after an in-place OAuth login;
      // relaunch cleanly with pendingSwitch protection so background token refreshes cannot overwrite the new account.
      target.lastUsedAtMs = ts;
      if (!deferredRestore) state.activeId = target.id;
      if (targetSaved.hash) target.credHash = targetSaved.hash;
      state.pendingSwitch = buildPendingSwitch(target, ts, deferredRestore);
      writeState(state);

      const shouldSyncOnboarding = Boolean(target.onboardingAccepted || target.syncedAtMs != null || (Array.isArray(target.groups) && target.groups.length > 0));
      const onboardingSync = shouldSyncOnboarding
        ? { email: target.email, isGcpTos: typeof target.isGcpTos === 'boolean' ? target.isGcpTos : null }
        : null;
      const finish = ({ relaunching, manualRestartRequired, relaunchReason, relaunchError, manualCommand }) => clone({
        ok: true,
        accountChanged: true,
        relaunching,
        manualRestartRequired,
        ...(manualRestartRequired ? { relaunchReason, manualCommand } : {}),
        ...(relaunchError ? { relaunchError } : {}),
        account: publicAccount(target),
        ...snapshotResponse(state)
      });
      return scheduleDeferredOrImmediateRelaunch(state, target, triggerRelaunch, onboardingSync, deferredRestore, finish);
    },

    switchAccount(accountId, { auto = false, triggerRelaunch = true } = {}) {
      const state = loadState();
      const target = state.accounts.find(a => a.id === accountId);
      if (!target) throw new Error('账号不存在');
      if (target.id === state.activeId && !state.pendingSwitch) {
        return clone({ ok: true, unchanged: true, account: publicAccount(target), ...snapshotResponse(state) });
      }
      confirmedQuotaEmailValue = '';
      const ts = now();
      if (target.disabled) {
        throw new Error('该账号已禁用，请先启用后再切换');
      }
      if (auto) {
        if (ts - (state.lastAutoSwitchAtMs || 0) < AUTO_SWITCH_COOLDOWN_MS) {
          throw new Error('自动切换冷却中');
        }
      }
      const cap = vaultCapability();
      if (!cap.supported) throw new Error(cap.reason || '当前系统不支持凭据切换');
      const deferredRestore = isNativeWindows(cap);
      const current = state.accounts.find(a => a.id === state.activeId);
      const hasLivePendingSwitch = Boolean(state.pendingSwitch && ts - state.pendingSwitch.atMs < PENDING_SWITCH_TTL_MS);
      if (deferredRestore && hasLivePendingSwitch) {
        throw new Error('正在切换账号，请稍候');
      }
      if (target.quarantined) {
        throw new Error('已隔离该账号的本地凭据，请点击“添加账号”重新登录该账号');
      }
      if (current && current.id !== target.id && !hasLivePendingSwitch) {
        const backup = backupActive(state, current, readActiveInfo(), false);
        if (backup?.ok) {
          current.hasCredential = true;
          if (typeof backup.hash === 'string' && backup.hash) current.credHash = backup.hash;
          const backupRefreshHash = normalizeRefreshHash(backup.refreshHash);
          if (backupRefreshHash) current.refreshHash = backupRefreshHash;
        }
        // On mismatch, do NOT auto-backup into another account's slot (prevents chimera contamination).
      }
      const targetInfo = readSavedInfo(target.id);
      if (!targetInfo.exists) {
        target.hasCredential = false;
        target.credHash = '';
        target.refreshHash = '';
        writeState(state);
        throw new Error('该账号尚未保存有效凭证，请点击“添加账号”重新登录该账号');
      }
      if (isInvalidatedSlot(target, targetInfo)) {
        target.hasCredential = false;
        target.credHash = '';
        target.refreshHash = '';
        writeState(state);
        throw new Error('该账号的本地凭据已失效或曾导致串号，请点击“添加账号”重新登录该账号');
      }
      if (!identityOk(targetInfo.email, target.email) || conflictingOwner(state, target, targetInfo)) {
        target.hasCredential = false;
        target.credHash = '';
        target.refreshHash = '';
        writeState(state);
        throw new Error(`该账号的本地凭据属于 ${targetInfo.email || '未知账号'}，与当前账号不一致，请点击“添加账号”重新登录该账号`);
      }
      if (current && current.id !== target.id && hashesCollide(current.credHash, current.refreshHash, targetInfo.hash, targetInfo.refreshHash)) {
        target.hasCredential = false;
        target.credHash = '';
        target.refreshHash = '';
        writeState(state);
        throw new Error('该账号的本地凭据与当前账号重复，请点击“添加账号”重新登录该账号');
      }
      const collidingOther = state.accounts.find(a =>
        a.id !== target.id &&
        a.id !== current?.id &&
        a.hasCredential &&
        !a.quarantined &&
        hashesCollide(a.credHash, a.refreshHash, targetInfo.hash, targetInfo.refreshHash)
      );
      if (collidingOther) {
        target.hasCredential = false;
        target.credHash = '';
        target.refreshHash = '';
        writeState(state);
        throw new Error(`该账号的本地凭据与账号 ${collidingOther.email} 重复，请点击“添加账号”重新登录该账号`);
      }

      // On native Windows, the detached relaunch worker owns the ONLY restore strictly after writers exit.
      // Never fall back to live restoreInPlace() while Antigravity/LS are still running.
      if (deferredRestore) {
        if (!targetInfo.hash) {
          throw new Error('无法校验目标账号凭据指纹，请重新登录该账号');
        }
        target.hasCredential = true;
        target.credHash = targetInfo.hash;
        if (targetInfo.refreshHash) target.refreshHash = targetInfo.refreshHash;
      } else {
        const restored = vault.restoreToActive(target.id, {
          expectedEmail: target.email,
          ...(targetInfo.hash ? { expectedHash: targetInfo.hash } : {})
        });
        if (!restored?.ok) {
          if (restored?.mismatch) {
            target.hasCredential = false;
            target.credHash = '';
            target.refreshHash = '';
            writeState(state);
            throw new Error(`该账号的本地凭据属于 ${restored.actualEmail || '其他账号'}，与当前账号不一致，请点击“添加账号”重新登录该账号`);
          }
          throw new Error(restored?.error || '写入目标账号凭证失败，请重试');
        }
        target.hasCredential = true;
        if (typeof restored.hash === 'string' && restored.hash) target.credHash = restored.hash;
        const restoredRefreshHash = normalizeRefreshHash(restored.refreshHash) || targetInfo.refreshHash;
        if (restoredRefreshHash) target.refreshHash = restoredRefreshHash;
      }

      target.lastUsedAtMs = ts;
      // On native Windows, keep state.activeId on the current account until the relaunched session confirms.
      if (!deferredRestore) state.activeId = target.id;
      state.pendingSwitch = buildPendingSwitch(target, ts, deferredRestore);
      if (auto) state.lastAutoSwitchAtMs = ts;
      writeState(state);

      const shouldSyncOnboarding = Boolean(target.onboardingAccepted || target.syncedAtMs != null || (Array.isArray(target.groups) && target.groups.length > 0));
      const onboardingSync = shouldSyncOnboarding
        ? { email: target.email, isGcpTos: typeof target.isGcpTos === 'boolean' ? target.isGcpTos : null }
        : null;
      const finish = ({ relaunching, manualRestartRequired, relaunchReason, relaunchError, manualCommand }) => clone({
        ok: true,
        relaunching,
        manualRestartRequired,
        ...(manualRestartRequired ? { relaunchReason, manualCommand } : {}),
        ...(relaunchError ? { relaunchError } : {}),
        account: publicAccount(target),
        ...snapshotResponse(state)
      });
      return scheduleDeferredOrImmediateRelaunch(state, target, triggerRelaunch, onboardingSync, deferredRestore, finish);
    },

    renameAccount(accountId, alias = '') {
      const state = loadState();
      const target = state.accounts.find(a => a.id === accountId);
      if (!target) throw new Error('账号不存在');
      target.alias = String(alias || '').trim().slice(0, 40);
      writeState(state);
      return clone({
        ok: true,
        account: publicAccount(target),
        ...snapshotResponse(state)
      });
    },

    setDisabled(accountId, disabled) {
      const state = loadState();
      const target = state.accounts.find(a => a.id === accountId);
      if (!target) throw new Error('账号不存在');
      target.disabled = Boolean(disabled);
      writeState(state);
      return clone({
        ok: true,
        account: publicAccount(target),
        ...snapshotResponse(state)
      });
    },

    reorderAccounts(orderedIds = []) {
      if (!Array.isArray(orderedIds)) throw new Error('排序参数无效');
      const state = loadState();
      const byId = new Map(state.accounts.map(a => [a.id, a]));
      const next = [];
      const seen = new Set();
      for (const id of orderedIds) {
        if (typeof id === 'string' && byId.has(id) && !seen.has(id)) {
          seen.add(id);
          next.push(byId.get(id));
        }
      }
      for (const acct of state.accounts) {
        if (!seen.has(acct.id)) next.push(acct);
      }
      state.accounts = next;
      writeState(state);
      return clone({
        ok: true,
        ...snapshotResponse(state)
      });
    },

    removeAccount(accountId) {
      const state = loadState();
      const index = state.accounts.findIndex(a => a.id === accountId);
      if (index < 0) throw new Error('账号不存在');
      if (state.accounts[index].id === state.activeId) {
        throw new Error('请先切换到其他账号后再移除');
      }
      try { vault?.removeSaved?.(accountId); } catch {}
      state.accounts.splice(index, 1);
      writeState(state);
      return clone({
        ok: true,
        ...snapshotResponse(state)
      });
    },

    refreshCredentials({ accountId = '' } = {}) {
      const state = loadState();
      const cap = vaultCapability();
      if (!cap.supported) throw new Error(cap.reason || '当前系统不支持凭据库校验');
      const ts = now();
      const hasLivePendingSwitch = Boolean(state.pendingSwitch && ts - state.pendingSwitch.atMs < PENDING_SWITCH_TTL_MS);
      const active = state.accounts.find(a => a.id === state.activeId);

      // Refresh active account's backup first when not mid-switch.
      if (active && !hasLivePendingSwitch && (!accountId || accountId === active.id)) {
        const saved = backupActive(state, active, readActiveInfo(), false);
        if (saved?.ok) {
          active.hasCredential = true;
          if (typeof saved.hash === 'string' && saved.hash) active.credHash = saved.hash;
          const savedRefreshHash = normalizeRefreshHash(saved.refreshHash);
          if (savedRefreshHash) active.refreshHash = savedRefreshHash;
        } else {
          const info = readSavedInfo(active.id);
          const ownerOk = !active.quarantined && info.exists && identityOk(info.email, active.email) && !isInvalidatedSlot(active, info) && !conflictingOwner(state, active, info);
          active.hasCredential = ownerOk;
          if (!active.quarantined) {
            active.credHash = ownerOk ? (info.hash || '') : '';
            active.refreshHash = ownerOk ? (info.refreshHash || '') : '';
          }
        }
      }

      const targets = accountId
        ? state.accounts.filter(a => a.id === accountId)
        : state.accounts;
      if (accountId && targets.length === 0) throw new Error('账号不存在');

      const seenHashes = new Map();
      const seenRefreshHashes = new Map();
      if (active?.hasCredential && !active.quarantined) {
        if (active.credHash) seenHashes.set(active.credHash, active.id);
        if (active.refreshHash) seenRefreshHashes.set(active.refreshHash, active.id);
      }
      if (accountId) {
        for (const other of state.accounts) {
          if (other.id === accountId || other.id === active?.id || !other.hasCredential || other.quarantined) continue;
          if (other.credHash && !seenHashes.has(other.credHash)) seenHashes.set(other.credHash, other.id);
          if (other.refreshHash && !seenRefreshHashes.has(other.refreshHash)) seenRefreshHashes.set(other.refreshHash, other.id);
        }
      }

      let valid = 0, invalid = 0;
      for (const acct of targets) {
        if (acct.id === active?.id) {
          if (acct.hasCredential && !acct.quarantined) valid++; else invalid++;
          continue;
        }
        const info = readSavedInfo(acct.id);
        if (acct.quarantined || !info.exists || !identityOk(info.email, acct.email) || isInvalidatedSlot(acct, info) || conflictingOwner(state, acct, info)) {
          acct.hasCredential = false;
          if (!acct.quarantined) {
            acct.credHash = '';
            acct.refreshHash = '';
          }
          invalid++;
          continue;
        }
        if (
          (info.hash && seenHashes.has(info.hash) && seenHashes.get(info.hash) !== acct.id) ||
          (info.refreshHash && seenRefreshHashes.has(info.refreshHash) && seenRefreshHashes.get(info.refreshHash) !== acct.id)
        ) {
          acct.hasCredential = false;
          acct.credHash = '';
          acct.refreshHash = '';
          invalid++;
          continue;
        }
        acct.hasCredential = true;
        if (info.hash) {
          acct.credHash = info.hash;
          seenHashes.set(info.hash, acct.id);
        }
        if (info.refreshHash) {
          acct.refreshHash = info.refreshHash;
          seenRefreshHashes.set(info.refreshHash, acct.id);
        }
        valid++;
      }
      writeState(state);
      return clone({
        ok: true,
        checked: targets.length,
        valid,
        invalid,
        ...(accountId ? { account: publicAccount(targets[0]) } : {}),
        ...snapshotResponse(state)
      });
    },

    refreshLocalQuotas({ accountId = '' } = {}) {
      const state = loadState();
      const ts = now();
      const targets = accountId
        ? state.accounts.filter(a => a.id === accountId)
        : state.accounts;
      if (accountId && targets.length === 0) throw new Error('账号不存在');
      let updatedBuckets = 0;
      for (const acct of targets) {
        if (acct.id === state.activeId) continue;
        for (const group of acct.groups || []) {
          for (const bucket of group.buckets || []) {
            const snapshotAfterReset = Number.isFinite(acct.syncedAtMs) && Number.isFinite(bucket.resetTimeMs) && acct.syncedAtMs >= bucket.resetTimeMs;
            if (Number.isFinite(bucket.resetTimeMs) && !snapshotAfterReset && ts >= bucket.resetTimeMs && bucket.remainingFraction != null && bucket.remainingFraction < 1) {
              bucket.remainingFraction = 1;
              updatedBuckets++;
            }
          }
        }
      }
      writeState(state);
      return clone({
        ok: true,
        updatedBuckets,
        ...snapshotResponse(state)
      });
    },

    pickAutoSwitch(depletedGroupKey = '', { activeModel = '' } = {}) {
      const state = loadState();
      const ts = now();
      const elapsed = ts - (state.lastAutoSwitchAtMs || 0);
      const cooldownRemainingMs = elapsed < AUTO_SWITCH_COOLDOWN_MS ? AUTO_SWITCH_COOLDOWN_MS - elapsed : 0;
      const ranked = rankAutoSwitchCandidates(state.accounts, state.activeId, depletedGroupKey, ts, 0.05, { activeModel });
      const candidates = ranked.map(item => publicAccount(item.acct));
      const candidate = candidates[0] || null;
      return clone({ candidate, candidates, cooldownRemainingMs });
    }
  };
}
