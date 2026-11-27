import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createSettingsStore } from '../lib/settings.mjs';

// Data-only hooks avoid the metadata-map scrubbing panic in Antigravity 2.31.0.
// Native controls are supplied by the sidecar's runtime integration.
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(raw || '{}');
    const logPath = payload.transcriptPath
      ? join(dirname(payload.transcriptPath), 'powertools-telemetry.jsonl')
      : payload.artifactDirectoryPath ? join(payload.artifactDirectoryPath, '.system_generated', 'logs', 'powertools-telemetry.jsonl') : null;
    if (logPath && createSettingsStore().get().enabled) {
      mkdirSync(dirname(logPath), { recursive: true });
      appendFileSync(logPath, JSON.stringify({
        pluginId:'agy-powertools',event: process.argv[2] || 'Unknown', ts: Date.now(), iso: new Date().toISOString(),
        conversationId: payload.conversationId || '', invocationNum: payload.invocationNum ?? null,
        initialNumSteps: payload.initialNumSteps ?? null, modelName: payload.modelName || ''
      }) + '\n', 'utf8');
    }
  } catch (error) { process.stderr.write(`Telemetry: ${error.message}\n`); }
  process.stdout.write('{}\n');
});
