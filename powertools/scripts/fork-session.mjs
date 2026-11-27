import { readFileSync } from 'node:fs';
import { devToolsPortFile } from '../lib/paths.mjs';
import { connectCdp, isHubTarget } from '../lib/native-host.mjs';
import { parseSessionData } from '../sidecars/inspector/main.mjs';

const port = Number(readFileSync(devToolsPortFile(), 'utf8').split('\n')[0]);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find(isHubTarget);
if (!target) throw new Error('请先打开 Antigravity 会话');
const conversationId = process.argv[2] || new URL(target.url).pathname.match(/^\/c\/([^/]+)/)?.[1];
if (!conversationId) throw new Error('没有选中的会话');
const data = parseSessionData(conversationId, { includeSessions: false });
const turnNumber = process.argv[3] ? Number(process.argv[3]) : null;
const turn = turnNumber == null ? null : data.turns.find(t => t.turnNumber === turnNumber);
if (turnNumber != null && !turn) throw new Error('轮次不存在');
const client = await connectCdp(target.webSocketDebuggerUrl);
try {
  const result = await client.send('Runtime.evaluate', {
    expression: `globalThis.__agyNativeAdapter.fork(${JSON.stringify(conversationId)},${turn?.stepIndexEnd ?? -1})`,
    awaitPromise: true, returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  console.log(JSON.stringify(result.result.value));
} finally { client.socket.close(); }
