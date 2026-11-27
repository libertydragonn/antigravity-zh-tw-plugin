import { readFileSync,mkdirSync,cpSync,rmSync,existsSync,openSync,closeSync,writeFileSync,unlinkSync } from 'node:fs';
import { join,dirname,isAbsolute,relative,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir,tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { checkForUpdates,compareVersions,projectInfo } from './updates.mjs';
import { atomicJson,installationPaths,maintenancePaths,assertOwnedPath,assertPinnedPath,installPlugin } from './lifecycle.mjs';
import { decodePackage,sha256 } from './package.mjs';
import { waitForRuntime } from './runtime-control.mjs';
import { createProxyFetcher,resolveEffectiveProxyUrl } from './proxy.mjs';

export function updateStatus(home=homedir(),currentVersion=''){
  try{
    const paths=maintenancePaths(home),statePath=assertOwnedPath(paths.root,join(paths.data,'update-state.json'));
    const value=JSON.parse(readFileSync(statePath,'utf8'));
    if(['preparing','downloading','verifying','installing'].includes(value.status)&&Date.now()-value.at>180000)return{status:'failed',version:value.version,error:'更新超时'};
    if(value.status==='completed'&&currentVersion&&value.version&&compareVersions(currentVersion,value.version)>=0){
      try{unlinkSync(assertPinnedPath(paths,statePath));}catch{}
      return{status:'idle'};
    }
    if(['failed','rolled-back'].includes(value.status)&&((currentVersion&&value.version&&compareVersions(currentVersion,value.version)>=0)||Date.now()-value.at>600000)){
      try{unlinkSync(assertPinnedPath(paths,statePath));}catch{}
      return{status:'idle'};
    }
    return value;
  }catch{return{status:'idle'};}
}
function writeState(paths,value){atomicJson(assertPinnedPath(paths,join(paths.data,'update-state.json')),{...value,at:Date.now()});}
export function updateState(home,value){writeState(maintenancePaths(home),value);}
function updateLock(paths){return assertPinnedPath(paths,join(paths.data,'update.lock'));}
function unlock(paths,nonce){if(!nonce||!paths)return;try{const path=assertOwnedPath(paths.root,join(paths.data,'update.lock'));if(JSON.parse(readFileSync(path,'utf8')).nonce===nonce)unlinkSync(path);}catch{}}
function lockUpdate(paths){
  const path=updateLock(paths),nonce=randomUUID();mkdirSync(paths.data,{recursive:true});let handle;
  try{handle=openSync(path,'wx');}catch(error){if(error.code!=='EEXIST')throw error;const previous=JSON.parse(readFileSync(path,'utf8'));let alive=true;try{process.kill(previous.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}if(alive)throw Error('更新正在进行');unlinkSync(path);handle=openSync(path,'wx');}
  writeFileSync(handle,JSON.stringify({pid:process.pid,nonce}));closeSync(handle);return nonce;
}
function launchWorker(script,plan,home=homedir()){
  return new Promise((resolve,reject)=>{
    // runUpdateJob uses createProxyFetcher. Explicitly set NODE_USE_ENV_PROXY=0 so an inherited
    // OS/shell NODE_USE_ENV_PROXY=1 cannot crash bootstrap on socks5:// or socks5h:// proxies.
    const env={...process.env,ELECTRON_RUN_AS_NODE:'1',NODE_USE_ENV_PROXY:'0'};delete env.NODE_OPTIONS;
    const proxyUrl=resolveEffectiveProxyUrl({home,env});
    if(proxyUrl&&!env.HTTPS_PROXY&&!env.https_proxy){env.HTTPS_PROXY=proxyUrl;env.HTTP_PROXY=proxyUrl;}
    const child=spawn(process.execPath,[script,plan],{cwd:tmpdir(),env,windowsHide:true,detached:true,stdio:'ignore'});
    child.once('error',reject);child.once('spawn',()=>{child.unref();resolve(child.pid);});
  });
}
let preparing=false;
function ownedJob(paths,job){
  const jobs=assertPinnedPath(paths,join(paths.data,'jobs'));
  let target=resolve(job);
  const logicalRoot=installationPaths(paths.home).root;
  if(relative(paths.root,logicalRoot)){
    const relFromLogical=relative(logicalRoot,target);
    if(relFromLogical&&!relFromLogical.startsWith('..')&&!isAbsolute(relFromLogical)){
      target=join(paths.root,relFromLogical);
    }
  }
  return assertOwnedPath(jobs,target);
}
export async function startUpdate({currentVersion,expectedVersion,home=homedir(),project=projectInfo(),fetcher,launch=launchWorker}={}){
  const state=updateStatus(home,currentVersion);
  if(preparing||['preparing','downloading','verifying','installing'].includes(state.status)&&Date.now()-state.at<180000)throw Error('更新正在进行');
  const paths=maintenancePaths(home);preparing=true;let job,lockNonce;
  try{
    lockNonce=lockUpdate(paths);
    const release=await checkForUpdates({currentVersion,project,home,fetcher});
    if(release.status!=='available'||release.version!==expectedVersion)throw Error('版本信息已变化，请重新检查');
    if(!release.canInstall)throw Error('此版本未提供可校验的安装包');
    job=ownedJob(paths,join(paths.data,'jobs',randomUUID()));mkdirSync(join(job,'bootstrap','scripts'),{recursive:true});mkdirSync(join(job,'bootstrap','lib'),{recursive:true});
    const root=dirname(dirname(fileURLToPath(import.meta.url)));
    for(const file of ['package.json','project.json','scripts/update-worker.mjs',...['package','lifecycle','launcher','wsl','proxy','runtime-control','paths','updates','update-manager','zh-tw','locales/index','locales/fr','locales/ja','locales/ko','locales/de','locales/es','locales/ru'].map(name=>'lib/'+name+'.mjs')])cpSync(join(root,file),join(job,'bootstrap',file));
    const plan={format:1,home:paths.home,expectedRoot:paths.root,version:release.version,asset:release.asset,job,lockNonce};atomicJson(join(job,'plan.json'),plan);
    writeState(paths,{status:'preparing',version:release.version});const pid=await launch(join(job,'bootstrap','scripts','update-worker.mjs'),join(job,'plan.json'),home);
    const lock=updateLock(paths);if(existsSync(lock)&&JSON.parse(readFileSync(lock,'utf8')).nonce===lockNonce)atomicJson(lock,{pid,nonce:lockNonce});
    return{status:'preparing',version:release.version};
  }catch(error){
    unlock(paths,lockNonce);
    if(job){
      try{const safeJob=ownedJob(paths,job);if(existsSync(safeJob))rmSync(safeJob,{recursive:true,force:true});}catch{}
      try{writeState(paths,{status:'failed',error:String(error?.message||'').slice(0,240)});}catch{}
    }
    throw error;
  }
  finally{preparing=false;}
}

async function download(url,fetcher,maxSize){
  const value=new URL(url);if(value.protocol!=='https:'||value.hostname!=='github.com'||value.username||value.password)throw Error('更新下载地址无效');
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetcher(url,{signal:AbortSignal.timeout(90000),timeoutMs:90000,redirect:'follow'});if(!response.ok)throw Error(`下载安装包失败 (HTTP ${response.status})`);
      if(response.url){const final=new URL(response.url);if(final.protocol!=='https:'||final.hostname!=='github.com'&&!final.hostname.endsWith('.githubusercontent.com'))throw Error('更新下载跳转地址无效');}
      const chunks=[];let size=0;
      for await(const chunk of response.body){size+=chunk.length;if(size>maxSize)throw Error('安装包超过大小限制');chunks.push(Buffer.from(chunk));}
      return Buffer.concat(chunks);
    }catch(error){
      lastError=error;
      if(attempt===0&&!/地址无效|超过大小限制|HTTP 4\d\d/.test(error?.message||'')){await new Promise(r=>setTimeout(r,800));continue;}
      throw error;
    }
  }
  throw lastError;
}
export async function runUpdateJob(plan,{fetcher,verify=async({paths,version})=>waitForRuntime(join(paths.data,'runtime'),version)}={}){
  const {home,expectedRoot,version,asset,job}=plan||{};
  if(plan?.format!==1||typeof home!=='string'||!isAbsolute(home)||!/^\d+\.\d+\.\d+$/.test(version)||!asset?.name||!job)throw Error('更新任务无效');
  const paths=maintenancePaths(home);
  if(expectedRoot&&relative(expectedRoot,paths.root))throw Error('.gemini 目录已更改，请重新检查更新');
  ownedJob(paths,job);
  const doFetch=fetcher||createProxyFetcher({home});
  try{
    writeState(paths,{status:'downloading',version});
    let expected=asset.sha256;
    if(!expected&&asset.checksumUrl){const content=(await download(asset.checksumUrl,doFetch,4096)).toString('utf8').trim();const match=content.match(/^([a-f0-9]{64})\s+\*?([^\r\n]+)$/i);if(match?.[2]!==asset.name)throw Error('校验文件无效');expected=match[1].toLowerCase();}
    if(!/^[a-f0-9]{64}$/.test(expected||''))throw Error('安装包缺少校验信息');
    const bytes=await download(asset.url,doFetch,16*1024*1024);writeState(paths,{status:'verifying',version});
    if(sha256(bytes)!==expected)throw Error('安装包校验失败');const bundle=decodePackage(bytes,version);
    writeState(paths,{status:'installing',version});
    const result=await installPlugin({home,expectedRoot:paths.root,bundle,verify});
    writeState(paths,{status:'completed',version});return result;
  }catch(error){try{writeState(paths,{status:error.rolledBack?'rolled-back':'failed',version,error:String(error?.message||'').slice(0,240)});}catch{}throw error;}
  finally{unlock(paths,plan.lockNonce);const safeJob=ownedJob(paths,job);if(existsSync(safeJob))rmSync(safeJob,{recursive:true,force:true});}
}
