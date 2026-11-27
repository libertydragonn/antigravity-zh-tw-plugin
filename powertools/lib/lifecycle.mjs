import { existsSync,mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,readdirSync,lstatSync,statSync,realpathSync,unlinkSync,openSync,closeSync,cpSync,rmdirSync } from 'node:fs';
import { join,resolve,relative,dirname,isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { collectPackage,validatePackage,writePackage,sha256 } from './package.mjs';
import { stopRuntimes } from './runtime-control.mjs';
import { configureLaunchers,restoreLaunchers } from './launcher.mjs';

function pathsAt(home,root){
  return {home,root,config:join(root,'config','config.json'),installed:join(root,'config','plugins','agy-powertools'),data:join(root,'antigravity','plugin_data','agy-powertools'),sidecars:join(root,'antigravity','sidecar_data','agy-powertools'),brain:join(root,'antigravity','brain')};
}
export function installationPaths(home=homedir()){
  home=resolve(home);
  return pathsAt(home,join(home,'.gemini'));
}
function safeLstat(path){try{return lstatSync(path);}catch(error){if(error?.code==='ENOENT'||error?.code==='ENOTDIR')return null;throw error;}}
function resolveAllowedRootLink(resolvedRoot){
  let realRoot;
  try{realRoot=realpathSync.native(resolvedRoot);}catch{throw Error('目标目录符号链接无效');}
  if(!statSync(realRoot).isDirectory())throw Error('目标目录符号链接必须指向文件夹');
  if(resolve(dirname(realRoot))===resolve(realRoot))throw Error('目标目录符号链接不能指向根目录');
  return realRoot;
}
export function maintenancePaths(home=homedir(),{allowRootLink=process.platform==='win32'}={}){
  const paths=installationPaths(home);
  if(safeLstat(paths.home)?.isSymbolicLink())throw Error('目标目录不能是符号链接');
  // Windows exposes a relocated .gemini junction as a directory link. Pin its
  // destination, but never resolve descendants: each must pass assertOwnedPath.
  if(safeLstat(paths.root)?.isSymbolicLink()){
    if(!allowRootLink)throw Error('目标目录不能是符号链接');
    return pathsAt(paths.home,resolveAllowedRootLink(paths.root));
  }
  return paths;
}
export function assertOwnedPath(root,target,{allowRootLink=false}={}){
  const resolvedRoot=resolve(root),resolvedTarget=resolve(target);
  const rel=relative(resolvedRoot,resolvedTarget);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('目标路径越界');
  let base=resolvedRoot;
  const rootStat=safeLstat(resolvedRoot);
  if(rootStat?.isSymbolicLink()){
    if(!allowRootLink)throw Error('目标目录不能是符号链接');
    base=resolveAllowedRootLink(resolvedRoot);
  }
  let path=base;
  for(const part of rel.split(/[\\/]/)){path=join(path,part);if(safeLstat(path)?.isSymbolicLink())throw Error('目标路径包含符号链接');}
  return resolvedTarget;
}
// Call at mutation boundaries, including after callbacks and Windows rename retries.
export function assertPinnedPath(paths,target,{allowRootLink=process.platform==='win32'}={}){
  if(relative(paths.root,maintenancePaths(paths.home,{allowRootLink}).root))throw Error('.gemini 目录已更改，请重新检查更新');
  return assertOwnedPath(paths.root,target);
}
function assertTree(path){const stat=safeLstat(path);if(!stat)return;if(stat.isSymbolicLink())throw Error('清理目录中包含符号链接');if(stat.isDirectory())for(const name of readdirSync(path))assertTree(join(path,name));}
function removeTree(root,path,options){assertOwnedPath(root,path,options);assertTree(path);rmSync(path,{recursive:true,force:true,maxRetries:8,retryDelay:100});}
function checkReplacement(paths,from,to){
  assertPinnedPath(paths,from);assertPinnedPath(paths,to);
  if(!lstatSync(from).isDirectory())throw Error('替换来源必须是目录');
  assertTree(from);assertTree(to);
}
async function move(paths,from,to){
  for(let i=0;;i++){
    checkReplacement(paths,from,to);
    try{renameSync(from,to);return;}
    catch(error){
      if(error.code==='EXDEV'){
        checkReplacement(paths,from,to);
        try{cpSync(from,to,{recursive:true,force:true});}catch(copyError){try{removeTree(paths.root,assertPinnedPath(paths,to));}catch{}throw copyError;}
        removeTree(paths.root,assertPinnedPath(paths,from));
        return;
      }
      if(i>=20||!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
  }
}
function synchronize(paths,from,to){
  checkReplacement(paths,from,to);
  function prepare(source,target){
    const directory=lstatSync(source).isDirectory();
    if(existsSync(target)&&lstatSync(target).isDirectory()!==directory)removeTree(to,target);
    if(directory){mkdirSync(target,{recursive:true});for(const name of readdirSync(source))prepare(join(source,name),join(target,name));}
  }
  prepare(from,to);cpSync(from,to,{recursive:true,force:true});
  function prune(source,target){for(const name of readdirSync(target)){
    const path=join(target,name),original=join(source,name);
    if(existsSync(original)){if(lstatSync(path).isDirectory())prune(original,path);continue;}
    if(lstatSync(path).isDirectory()){prune(original,path);try{rmdirSync(path);}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;}}
    else unlinkSync(path);
  }}prune(from,to);
}
export function atomicJson(path,value){
  mkdirSync(dirname(path),{recursive:true});const temp=join(dirname(path),'.agy-'+randomUUID()+'.tmp');
  try{writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600});renameSync(temp,path);}finally{try{unlinkSync(temp);}catch{}}
}
function readConfig(path){if(!existsSync(path))return{};const value=JSON.parse(readFileSync(path,'utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error('客户端配置格式无效');return value;}
function changeConfig(paths,fn){assertPinnedPath(paths,paths.config);const config=readConfig(paths.config);fn(config);atomicJson(paths.config,config);}
async function withLock(paths,fn){
  const path=assertOwnedPath(paths.root,join(paths.data,'maintenance.lock')),nonce=randomUUID();mkdirSync(paths.data,{recursive:true});let handle;
  try{handle=openSync(path,'wx');}catch(error){
    if(error.code!=='EEXIST')throw error;
    const lock=JSON.parse(readFileSync(path,'utf8'));let alive=true;try{process.kill(lock.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}
    if(alive)throw Error('已有安装或更新正在进行');unlinkSync(path);handle=openSync(path,'wx');
  }
  writeFileSync(handle,JSON.stringify({pid:process.pid,nonce}));closeSync(handle);
  try{return await fn();}finally{try{if(JSON.parse(readFileSync(assertOwnedPath(paths.root,path),'utf8')).nonce===nonce)unlinkSync(path);}catch{}}
}
function previousPlugin(paths){const config=readConfig(assertOwnedPath(paths.root,paths.config));return config.plugins?.['agy-powertools'];}
function setPlugin(paths,value){changeConfig(paths,config=>{config.plugins||={};if(value===undefined)delete config.plugins['agy-powertools'];else config.plugins['agy-powertools']=value;});}
function legacyBackups(source){
  const directory=join(source,'.backups');if(!existsSync(directory))return[];
  return readdirSync(directory).filter(name=>/^installed-\d{4}-[\dTZ.-]+$/.test(name)).flatMap(name=>{
    const path=join(directory,name);try{assertOwnedPath(source,path);const file=join(path,'plugin.json'),bytes=readFileSync(file);return JSON.parse(bytes).name==='agy-powertools'?[{name,pluginHash:sha256(bytes)}]:[];}catch{return[];}
  });
}

export async function installPlugin({source,bundle,home=homedir(),expectedRoot,stop=stopRuntimes,verify,retainBackup=true}={}){
  const paths=maintenancePaths(home);
  if(expectedRoot&&relative(expectedRoot,paths.root))throw Error('.gemini 目录已更改，请重新检查更新');
  const payload=bundle?validatePackage(bundle):collectPackage(resolve(source));
  assertOwnedPath(paths.root,paths.installed);
  return withLock(paths,async()=>{
    const previous=previousPlugin(paths),id=randomUUID(),stage=join(paths.data,'staging',id),backup=join(paths.data,'backups',id,'plugin');
    assertOwnedPath(paths.root,stage);assertOwnedPath(paths.root,backup);
    const runtime=assertOwnedPath(paths.root,join(paths.data,'runtime'));
    const launcherStatePath=assertOwnedPath(paths.root,join(paths.data,'launcher-state.json'));
    let moved=false,promoted=false,inPlace=false,receipt;
    try{
      if(existsSync(paths.installed)&&JSON.parse(readFileSync(join(paths.installed,'plugin.json'),'utf8')).name!=='agy-powertools')throw Error('安装位置包含其他项目');
      receipt=writePackage(payload,stage);
      const previousReceipt=existsSync(join(paths.installed,'.agy-install.json'))?JSON.parse(readFileSync(join(paths.installed,'.agy-install.json'),'utf8')):{};
      receipt.sourceRoot=source?resolve(source):previousReceipt.sourceRoot;
      receipt.legacyBackups=source?legacyBackups(resolve(source)):previousReceipt.legacyBackups||[];
      atomicJson(join(stage,'.agy-install.json'),receipt);
      setPlugin(paths,{...previous,enabled:false});await stop(runtime);
      assertPinnedPath(paths,stage);
      if(existsSync(assertPinnedPath(paths,paths.installed))){
        mkdirSync(dirname(assertPinnedPath(paths,backup)),{recursive:true});
        try{await move(paths,paths.installed,backup);}catch(error){if(!['EPERM','EACCES','EBUSY','EXDEV'].includes(error.code))throw error;checkReplacement(paths,paths.installed,backup);cpSync(paths.installed,backup,{recursive:true,force:true});inPlace=true;}moved=true;
      }
      mkdirSync(dirname(assertPinnedPath(paths,paths.installed)),{recursive:true});
      if(inPlace)synchronize(paths,stage,paths.installed);else await move(paths,stage,paths.installed);promoted=true;
      for(const file of receipt.files)if(sha256(readFileSync(join(paths.installed,file.path)))!==file.sha256)throw Error('安装后校验失败');
      setPlugin(paths,{...previous,enabled:true});
      if(verify)await verify({paths,version:payload.version});
      assertPinnedPath(paths,launcherStatePath);
      let launcherResult=null;
      let skipLauncherConfig=false;
      if(verify&&process.platform!=='darwin'&&existsSync(launcherStatePath)){
        try{
          const ls=JSON.parse(readFileSync(launcherStatePath,'utf8'));
          if((Array.isArray(ls?.shortcuts)&&ls.shortcuts.length>0)||(Array.isArray(ls?.desktopEntries)&&ls.desktopEntries.length>0))skipLauncherConfig=true;
        }catch{}
      }
      if(!skipLauncherConfig){try{launcherResult=configureLaunchers({home:paths.home,dataDir:paths.data});}catch{}}
      if(!retainBackup&&moved)removeTree(paths.root,assertPinnedPath(paths,dirname(backup)));
      try{
        const statePath=assertPinnedPath(paths,join(paths.data,'update-state.json'));
        if(existsSync(statePath)){
          const prev=JSON.parse(readFileSync(statePath,'utf8'));
          if(['completed','failed','rolled-back'].includes(prev?.status))unlinkSync(statePath);
        }
      }catch{}
      return{version:payload.version,destination:paths.installed,backup:moved&&retainBackup?backup:null,restartRequired:!verify,replacement:inPlace?'in-place':'directory',...(process.platform==='darwin'?{removedLegacyMacApps:launcherResult?.removedLegacyMacApps||[]}:{})};
    }catch(error){
      setPlugin(paths,{...previous,enabled:false});await stop(assertPinnedPath(paths,runtime)).catch(()=>{});
      if(moved)checkReplacement(paths,backup,paths.installed);
      if(inPlace&&moved)synchronize(paths,backup,paths.installed);
      else{if(promoted)removeTree(paths.root,assertPinnedPath(paths,paths.installed));if(moved){mkdirSync(dirname(paths.installed),{recursive:true});await move(paths,backup,paths.installed);}}
      setPlugin(paths,previous);error.rolledBack=true;throw error;
    }finally{if(existsSync(assertPinnedPath(paths,stage)))removeTree(paths.root,stage);}
  });
}

function ownTelemetry(path){
  try{return readFileSync(path,'utf8').split('\n').filter(Boolean).every(line=>{
    const value=JSON.parse(line);return value.pluginId==='agy-powertools'||['PreInvocation','PostInvocation'].includes(value.event)&&Number.isFinite(value.ts)&&typeof value.iso==='string'&&'invocationNum'in value&&'initialNumSteps'in value&&Object.keys(value).every(key=>['event','ts','iso','conversationId','invocationNum','initialNumSteps','modelName'].includes(key));
  });}catch{return false;}
}
function cleanBrain(paths){
  const retained=[];if(!existsSync(paths.brain))return retained;
  for(const id of readdirSync(paths.brain)){
    if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id))continue;
    for(const name of ['telemetry.jsonl','powertools-telemetry.jsonl']){
      const path=join(paths.brain,id,'.system_generated','logs',name);try{assertPinnedPath(paths,path);}catch{retained.push(path);continue;}
      if(existsSync(path)){if(ownTelemetry(path))unlinkSync(path);else retained.push(path);}
    }
  }
  return retained;
}

export async function uninstallPlugin({home=homedir(),purge=true,stop=stopRuntimes}={}){
  const paths=maintenancePaths(home);assertOwnedPath(paths.root,paths.installed);
  const runtime=assertOwnedPath(paths.root,join(paths.data,'runtime'));
  assertOwnedPath(paths.root,join(paths.data,'launcher-state.json'));
  const result=await withLock(paths,async()=>{
    if(existsSync(paths.installed)&&JSON.parse(readFileSync(join(paths.installed,'plugin.json'),'utf8')).name!=='agy-powertools')throw Error('安装位置包含其他项目');
    const receipt=existsSync(join(paths.installed,'.agy-install.json'))?JSON.parse(readFileSync(join(paths.installed,'.agy-install.json'),'utf8')):{};
    setPlugin(paths,{...previousPlugin(paths),enabled:false});await stop(runtime,{purge});
    removeTree(paths.root,assertPinnedPath(paths,paths.installed));
    changeConfig(paths,config=>{delete config.plugins?.['agy-powertools'];for(const key of Object.keys(config.sidecars||{}))if(key==='agy-powertools'||key.startsWith('agy-powertools/'))delete config.sidecars[key];});
    const hooks=join(paths.root,'config','hooks.json');assertPinnedPath(paths,hooks);
    if(existsSync(hooks)){const config=readConfig(hooks);for(const key of Object.keys(config))if(key==='agy-powertools-telemetry'||key.startsWith('agy-powertools/'))delete config[key];atomicJson(hooks,config);}
    const retained=purge?cleanBrain(paths):[];
    if(purge){
      removeTree(paths.root,assertPinnedPath(paths,paths.sidecars));
      if(receipt.sourceRoot)for(const backup of receipt.legacyBackups||[]){
        const path=join(receipt.sourceRoot,'.backups',backup.name);if(!/^installed-\d{4}-[\dTZ.-]+$/.test(backup.name))continue;
        try{assertOwnedPath(join(receipt.sourceRoot,'.backups'),path);if(sha256(readFileSync(join(path,'plugin.json')))===backup.pluginHash)removeTree(join(receipt.sourceRoot,'.backups'),path);}catch{if(existsSync(path))retained.push(path);}
      }
    }
    return{removed:true,purged:purge,retained};
  });
  assertPinnedPath(paths,join(paths.data,'launcher-state.json'));
  try{restoreLaunchers({home:paths.home,dataDir:paths.data});}catch{}
  if(purge)removeTree(paths.root,assertPinnedPath(paths,paths.data));
  return result;
}
