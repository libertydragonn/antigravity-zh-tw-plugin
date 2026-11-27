import { createServer } from 'node:http';
import { mkdirSync,writeFileSync,readFileSync,readdirSync,unlinkSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID,randomBytes } from 'node:crypto';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function pruneStaleRuntimeRecords(directory,{currentPid=process.pid,isAlive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e?.code!=='ESRCH';}}}={}){
  if(!existsSync(directory))return[];
  const removed=[];
  for(const name of readdirSync(directory)){
    const match=name.match(/^(\d+)-[\da-f-]+\.json$/);
    if(!match)continue;
    const pid=Number(match[1]);
    if(!Number.isInteger(pid)||pid<=0||pid===currentPid)continue;
    if(!isAlive(pid)){
      const target=join(directory,name);
      try{unlinkSync(target);removed.push(target);}catch{}
    }
  }
  return removed;
}
export async function serveRuntime({directory,version,stop,health,exit=()=>process.exit(0)}){
  const token=randomBytes(24).toString('hex'),file=join(directory,`${process.pid}-${randomUUID()}.json`);
  const server=createServer(async(request,response)=>{
    if(request.headers.authorization!==`Bearer ${token}`){response.writeHead(403).end();return;}
    if(request.method==='GET'&&request.url==='/health'){
      try{response.setHeader('content-type','application/json');response.end(JSON.stringify({id:'agy-powertools',version,...await health()}));}catch{response.writeHead(503).end();}return;
    }
    if(request.method==='POST'&&request.url==='/stop'){
      try{await Promise.race([Promise.resolve().then(()=>stop({purge:request.headers['x-agy-purge']==='true'})),pause(3500)]);response.end('{}');}
      catch{response.writeHead(500).end('{}');}
      finally{try{unlinkSync(file);}catch{}server.close();setTimeout(exit,100).unref();}return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  mkdirSync(directory,{recursive:true});
  pruneStaleRuntimeRecords(directory);
  writeFileSync(file,JSON.stringify({id:'agy-powertools',version,port:server.address().port,token}),{mode:0o600});
  return async()=>{try{unlinkSync(file);}catch{}await new Promise(resolve=>server.close(resolve));};
}

export function runtimeRecords(directory){
  if(!existsSync(directory))return[];
  return readdirSync(directory).filter(name=>/^\d+-[\da-f-]+\.json$/.test(name)).flatMap(name=>{
    try{const record=JSON.parse(readFileSync(join(directory,name),'utf8'));return record.id==='agy-powertools'&&Number.isInteger(record.port)&&record.port>0&&record.port<65536&&/^[a-f\d]{48}$/.test(record.token)?[{...record,file:join(directory,name)}]:[];}catch{return[];}
  });
}
const isPidAlive=pid=>{try{process.kill(pid,0);return true;}catch(e){return e?.code!=='ESRCH';}};
const pidFromFile=file=>{const m=String(file||'').match(/(?:^|[\\/])(\d+)-[\da-f-]+\.json$/);return m?Number(m[1]):null;};
export async function stopRuntimes(directory,{purge=false}={}){
  pruneStaleRuntimeRecords(directory);
  const stoppedPids=[];
  await Promise.all(runtimeRecords(directory).map(async record=>{
    const pid=pidFromFile(record.file);
    try{
      const response=await fetch(`http://127.0.0.1:${record.port}/stop`,{method:'POST',headers:{authorization:`Bearer ${record.token}`,'x-agy-purge':String(purge)},signal:AbortSignal.timeout(8000)});
      if(response.status!==200&&response.status!==403)throw Error('插件暂时无法停止');
      if(pid&&pid!==process.pid)stoppedPids.push(pid);
    }catch(error){
      const code=error?.cause?.code||error?.code||'';
      const socketClosed=['ECONNREFUSED','ECONNRESET','UND_ERR_SOCKET','EPIPE'].includes(code);
      if(!socketClosed){
        await pause(150);
        if(!pid||pid===process.pid||isPidAlive(pid))throw Error('插件暂时无法停止，请重新打开客户端后重试');
      }
    }
    try{unlinkSync(record.file);}catch{}
  }));
  await pause(200);
  const waitUntil=Date.now()+1500;
  while(stoppedPids.length&&Date.now()<waitUntil){
    if(stoppedPids.every(pid=>!isPidAlive(pid)))break;
    await pause(100);
  }
}
export async function waitForRuntime(directory,version,{timeout=25000}={}){
  const end=Date.now()+timeout;
  let bootedStatus=null,bootedAt=0;
  while(Date.now()<end){
    for(const record of runtimeRecords(directory).filter(record=>record.version===version)){
      try{
        const response=await fetch(`http://127.0.0.1:${record.port}/health`,{headers:{authorization:`Bearer ${record.token}`},signal:AbortSignal.timeout(1500)});
        const status=await response.json();
        if(status.id==='agy-powertools'&&status.version===version){
          if(status.healthy===true)return status;
          if(!status.compatibilityError){
            if(!bootedAt)bootedAt=Date.now();
            bootedStatus=status;
          }else{
            bootedStatus=null;bootedAt=0;
          }
        }
      }catch{}
    }
    if(bootedStatus&&Date.now()-bootedAt>=3500)return bootedStatus;
    await pause(250);
  }
  if(bootedStatus)return bootedStatus;
  throw Error('新版本未能正常启动');
}
