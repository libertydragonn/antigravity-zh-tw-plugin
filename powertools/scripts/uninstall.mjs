import { tmpdir } from 'node:os';
import { uninstallPlugin } from '../lib/lifecycle.mjs';
try{
  const args=process.argv.slice(2),homeIndex=args.indexOf('--home');process.chdir(tmpdir());
  const result=await uninstallPlugin({home:homeIndex>=0?args[homeIndex+1]:undefined,purge:!args.includes('--keep-settings')});
  if(args.includes('--json'))console.log(JSON.stringify(result));
  else{console.log(result.purged?'已卸载并清理插件数据，原生聊天记录已保留。':'已卸载，个人设置已保留。');if(result.retained.length)console.log(`有 ${result.retained.length} 项无法确认归属的文件未删除。`);}
}catch(error){console.error('卸载失败：'+error.message);process.exitCode=1;}
