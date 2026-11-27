import { accessSync, constants as fsConstants } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installPlugin } from '../lib/lifecycle.mjs';
import { isWslEnvironment } from '../lib/wsl.mjs';
const hasStandardPosixNode=()=>['/usr/local/bin/node','/usr/bin/node','/bin/node'].some(p=>{try{accessSync(p,fsConstants.X_OK);return true;}catch{return false;}});
const [major,minor]=process.versions.node.split('.').map(Number);
try{
  if(major<22||major===22&&minor<13)throw Error('需要 Node.js 22.13 或更高版本');
  const args=process.argv.slice(2),homeIndex=args.indexOf('--home');
  const result=await installPlugin({source:resolve(dirname(fileURLToPath(import.meta.url)),'..'),home:homeIndex>=0?args[homeIndex+1]:undefined});
  if(args.includes('--json'))console.log(JSON.stringify(result));
  else{
    console.log(`已安装 Agy Powertools ${result.version}`);
    console.log('请重新打开 Antigravity，安装过程中没有关闭客户端。');
    if(process.platform==='darwin'){
      if(result.removedLegacyMacApps?.length){
        console.log('已自动清理旧版冗余启动器 Antigravity (Powertools).app。');
      }
      console.log('macOS 提示：以后直接正常打开原版 Antigravity 即可，冷启动无调试端口时会自动带参数重启一次启用插件（可在设置或右侧 Powertools 面板关闭自动重启并改为手动点击重启）。');
    }
    if(isWslEnvironment()&&!/^\/(?:usr\/local\/bin|usr\/bin|bin)\//.test(process.execPath)&&!hasStandardPosixNode()){
      console.log(`WSL2 提示：当前 Node.js 位于 ${process.execPath}。由于 Antigravity 通过非登录 Shell 启动 WSL2 后端，若插件未加载，建议执行：sudo ln -sf "${process.execPath}" /usr/local/bin/node`);
    }
  }
}catch(error){console.error('安装失败：'+error.message);process.exitCode=1;}
