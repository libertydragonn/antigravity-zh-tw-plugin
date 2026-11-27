import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getAppDataDir } from './session-parser.mjs';

const VALID_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const FENCE_RE = /```[^\n]*\n([\s\S]*?)```/g;

export function isValidConversationId(id) {
  return typeof id === 'string' && VALID_ID_RE.test(id);
}

function extractUserPrompt(raw) {
  const text = typeof raw === 'string' ? raw : '';
  const match = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
  return (match ? match[1] : text).trim();
}

function readTranscriptTail(filePath, size, maxFileBytes, tailBytes) {
  if (size <= maxFileBytes) return readFileSync(filePath, 'utf8');
  let fd;
  try {
    const length = Math.min(size, tailBytes);
    const offset = Math.max(0, size - length);
    fd = openSync(filePath, 'r');
    const buf = Buffer.allocUnsafe(length);
    const bytesRead = readSync(fd, buf, 0, length, offset);
    const chunk = buf.subarray(0, bytesRead).toString('utf8');
    if (offset === 0) return chunk;
    const nl = chunk.indexOf('\n');
    return nl >= 0 ? chunk.slice(nl + 1) : chunk;
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* Best effort. */ }
    }
  }
}

function parseToolArgString(val) {
  if (typeof val !== 'string') return '';
  if (val.startsWith('"')) {
    try { return String(JSON.parse(val)); } catch { return val; }
  }
  return val;
}

function buildSnippet(source, needleLower, maxChars = 200) {
  const clean = String(source || '').replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();
  const idx = lower.indexOf(needleLower);
  if (idx < 0) return null;
  const half = Math.max(24, Math.floor((maxChars - needleLower.length) / 2));
  let start = Math.max(0, idx - half);
  let end = Math.min(clean.length, start + maxChars);
  if (end - start < maxChars && start > 0) start = Math.max(0, end - maxChars);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < clean.length ? '…' : '';
  const snippet = prefix + clean.slice(start, end) + suffix;
  const matchIndex = prefix.length + (idx - start);
  return { snippet, matchIndex, matchLength: needleLower.length };
}

function extractCandidates(step, needleLower, scope) {
  const out = [];
  if (!step || typeof step !== 'object') return out;
  const wantText = scope === 'all' || scope === 'text';
  const wantCode = scope === 'all' || scope === 'code';

  if (step.type === 'USER_INPUT') {
    const prompt = extractUserPrompt(step.content);
    if (!prompt || /^Error: The stream was interrupted/i.test(prompt)) return out;
    if (wantCode) {
      FENCE_RE.lastIndex = 0;
      let m;
      while ((m = FENCE_RE.exec(prompt)) !== null) {
        const block = m[1].trim();
        if (block && block.toLowerCase().includes(needleLower)) {
          out.push({ kind: 'code', text: block, copyText: block.slice(0, 600) });
        }
      }
    }
    if (wantText && prompt.toLowerCase().includes(needleLower)) {
      out.push({ kind: 'prompt', text: prompt, copyText: '' });
    }
    return out;
  }

  if (step.type === 'PLANNER_RESPONSE') {
    if (wantCode && Array.isArray(step.tool_calls)) {
      for (const call of step.tool_calls) {
        if (!call || typeof call !== 'object') continue;
        if (/run_command/.test(String(call.name || ''))) {
          const cmd = parseToolArgString(call.args?.CommandLine).trim();
          if (cmd && cmd.toLowerCase().includes(needleLower)) {
            out.push({ kind: 'command', text: cmd, copyText: cmd.slice(0, 600) });
          }
        }
      }
    }
    const content = typeof step.content === 'string' ? step.content : '';
    if (content) {
      if (wantCode) {
        FENCE_RE.lastIndex = 0;
        let m;
        while ((m = FENCE_RE.exec(content)) !== null) {
          const block = m[1].trim();
          if (block && block.toLowerCase().includes(needleLower)) {
            out.push({ kind: 'code', text: block, copyText: block.slice(0, 600) });
          }
        }
      }
      if (wantText && content.toLowerCase().includes(needleLower)) {
        out.push({ kind: 'response', text: content, copyText: '' });
      }
    }
    return out;
  }

  if (step.type === 'GENERIC' && wantCode) {
    const raw = typeof step.content === 'string' ? step.content : '';
    if (!raw || !raw.toLowerCase().includes(needleLower)) return out;
    const markerIdx = raw.indexOf('Command output:');
    const body = (markerIdx >= 0 ? raw.slice(markerIdx + 15) : raw).trim();
    if (body && body.toLowerCase().includes(needleLower)) {
      out.push({ kind: 'output', text: body, copyText: body.slice(0, 600) });
    }
  }
  return out;
}

export function searchTranscripts(query, options = {}) {
  const rawQuery = typeof query === 'string' ? query.trim() : '';
  const scope = options.scope === 'text' || options.scope === 'code' ? options.scope : 'all';
  const hasNonAscii = /[^\x00-\x7f]/.test(rawQuery);
  if (!rawQuery || (!hasNonAscii && rawQuery.length < 2)) {
    return { query: rawQuery, scope, results: [], scannedConversations: 0, truncated: false };
  }

  const dir = options.appDataDir || getAppDataDir();
  const brainDir = join(dir, 'brain');
  if (!existsSync(brainDir)) {
    return { query: rawQuery, scope, results: [], scannedConversations: 0, truncated: false };
  }

  const maxConversations = Number.isInteger(options.maxConversations) && options.maxConversations > 0 ? options.maxConversations : 250;
  const maxResults = Number.isInteger(options.maxResults) && options.maxResults > 0 ? Math.min(100, options.maxResults) : 40;
  const maxPerConversation = Number.isInteger(options.maxPerConversation) && options.maxPerConversation > 0 ? options.maxPerConversation : 3;
  const maxFileBytes = Number.isInteger(options.maxFileBytes) && options.maxFileBytes > 0 ? options.maxFileBytes : 8 * 1024 * 1024;
  const tailBytes = Number.isInteger(options.tailBytes) && options.tailBytes > 0 ? options.tailBytes : 4 * 1024 * 1024;

  const excluded = new Set(
    Array.isArray(options.excludeIds) ? options.excludeIds.filter(isValidConversationId) : []
  );

  let entries = [];
  let truncated = false;
  if (Array.isArray(options.conversationIds)) {
    const uniqueIds = [...new Set(options.conversationIds.filter(isValidConversationId))].slice(0, 500);
    for (const id of uniqueIds) {
      if (excluded.has(id)) continue;
      const filePath = join(brainDir, id, '.system_generated', 'logs', 'transcript.jsonl');
      try {
        const st = statSync(filePath);
        if (st.isFile() && st.size > 0) entries.push({ id, filePath, mtimeMs: st.mtimeMs, size: st.size });
      } catch { /* Missing transcript. */ }
    }
    entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (entries.length > maxConversations) {
      entries = entries.slice(0, maxConversations);
      truncated = true;
    }
  } else {
    const allEntries = [];
    for (const dirent of readdirSync(brainDir, { withFileTypes: true })) {
      if (!dirent.isDirectory() || !isValidConversationId(dirent.name) || excluded.has(dirent.name)) continue;
      const filePath = join(brainDir, dirent.name, '.system_generated', 'logs', 'transcript.jsonl');
      try {
        const st = statSync(filePath);
        if (st.isFile() && st.size > 0) allEntries.push({ id: dirent.name, filePath, mtimeMs: st.mtimeMs, size: st.size });
      } catch { /* Missing transcript. */ }
    }
    allEntries.sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (allEntries.length > maxConversations) {
      entries = allEntries.slice(0, maxConversations);
      truncated = true;
    } else {
      entries = allEntries;
    }
  }

  const needleLower = rawQuery.toLowerCase();
  const results = [];
  let scannedConversations = 0;

  for (const entry of entries) {
    if (results.length >= maxResults) {
      truncated = true;
      break;
    }
    scannedConversations++;
    let content;
    try {
      content = readTranscriptTail(entry.filePath, entry.size, maxFileBytes, tailBytes);
    } catch {
      continue;
    }
    if (!content || !content.toLowerCase().includes(needleLower)) continue;

    const lines = content.split('\n');
    let turnNumber = 0;
    let stepIndexStart = 0;
    let fallbackTitle = '';
    const convMatches = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const isUserInputHint = line.includes('"USER_INPUT"');
      const hasMatchHint = line.toLowerCase().includes(needleLower);
      if (!isUserInputHint && !hasMatchHint) continue;

      let step;
      try { step = JSON.parse(line); } catch { continue; }
      if (step?.type === 'USER_INPUT') {
        const prompt = extractUserPrompt(step.content);
        if (prompt && !/^Error: The stream was interrupted/i.test(prompt)) {
          turnNumber++;
          stepIndexStart = Number.isInteger(step.step_index) ? step.step_index : 0;
          if (!fallbackTitle) fallbackTitle = prompt.split('\n')[0].slice(0, 80);
        }
      }
      if (!hasMatchHint) continue;

      const candidates = extractCandidates(step, needleLower, scope);
      if (!candidates.length) continue;
      const chosen = candidates[0];
      const built = buildSnippet(chosen.text, needleLower, 200);
      if (!built) continue;
      const createdAtMs = step.created_at ? Date.parse(step.created_at) : null;
      convMatches.push({
        conversationId: entry.id,
        fallbackTitle: fallbackTitle || '会话',
        turnNumber: turnNumber || 1,
        stepIndexStart,
        stepIndex: Number.isInteger(step.step_index) ? step.step_index : stepIndexStart,
        kind: chosen.kind,
        snippet: built.snippet,
        matchIndex: built.matchIndex,
        matchLength: built.matchLength,
        copyText: chosen.copyText || '',
        timestampMs: Number.isFinite(createdAtMs) ? createdAtMs : Math.round(entry.mtimeMs)
      });
    }

    if (convMatches.length) {
      const recentOnes = convMatches.slice(-maxPerConversation).reverse();
      for (const item of recentOnes) {
        if (results.length >= maxResults) {
          truncated = true;
          break;
        }
        results.push(item);
      }
    }
  }

  return { query: rawQuery, scope, results, scannedConversations, truncated };
}
