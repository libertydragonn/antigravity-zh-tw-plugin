import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { get } from 'node:https';
import { pluginDataDir } from './paths.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
export function declaredNativeNames(source) {
  return [...new Set([...source.matchAll(/(?:\b(?:var|const|let)\s+|[,;])([A-Za-z_$][\w$]*)\s*=/g)].map(match=>match[1]))];
}

export function readLocalBundle(origin,headers={}) {
  const url=new URL('/main.js',origin);
  if(url.protocol!=='https:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('只支持本机界面');
  return new Promise((resolve,reject)=>{
    const request=get(url,{rejectUnauthorized:false,headers},response=>{
      if(response.statusCode===304){response.resume();resolve({status:304,headers:response.headers});return;}
      if(response.statusCode!==200){response.resume();reject(new Error('无法读取原生界面组件'));return;}
      let source='';response.setEncoding('utf8');
      response.on('data',chunk=>{source+=chunk;if(source.length>32*1024*1024)request.destroy(new Error('原生界面组件过大'));});
      response.on('end',()=>resolve({status:200,headers:response.headers,source}));response.on('error',reject);
    });
    request.setTimeout(5000,()=>request.destroy(new Error('读取原生界面组件超时')));request.on('error',reject);
  });
}

export function createNativeDeclarationCache({directory=join(pluginDataDir(),'native-components'),request=readLocalBundle,parse=declaredNativeNames}={}) {
  const memory=new Map(),pending=new Map();
  function valid(record,version){return record?.format===1&&record.version===version&&/^[a-f0-9]{64}$/.test(record.sourceHash)&&
    Array.isArray(record.names)&&record.names.length>0&&record.names.length<100000&&record.names.every(name=>typeof name==='string'&&/^[A-Za-z_$][\w$]*$/.test(name))&&record.namesHash===hash(JSON.stringify(record.names));}
  function load(key,version){
    if(valid(memory.get(key),version))return memory.get(key);
    try{const record=JSON.parse(readFileSync(join(directory,key+'.json'),'utf8'));if(valid(record,version))return record;}catch{}
    return null;
  }
  async function discover(origin,{version='unknown',force=false,fallbackFetch=null,cacheScope=process.platform,preferFallback=false}={}) {
    const key=hash(`${cacheScope}:${version}`),flightKey=origin+':'+key+':'+force;
    if(pending.has(flightKey))return pending.get(flightKey);
    const work=(async()=>{
      const cached=force?null:load(key,version),headers={};
      if(cached?.etag)headers['If-None-Match']=cached.etag;
      else if(cached?.lastModified)headers['If-Modified-Since']=cached.lastModified;
      let response;
      const runFetch=async reqHeaders=>{
        if(preferFallback&&typeof fallbackFetch==='function'){
          try{return await fallbackFetch(origin,reqHeaders);}
          catch{return await request(origin,reqHeaders);}
        }
        try{return await request(origin,reqHeaders);}
        catch(error){
          if(typeof fallbackFetch==='function')return await fallbackFetch(origin,reqHeaders);
          throw error;
        }
      };
      response=await runFetch(headers);
      if(response.status===304&&cached){memory.set(key,cached);return [...cached.names];}
      if(response.status===304)response=await runFetch({});
      if(response.status!==200||typeof response.source!=='string')throw new Error('原生界面组件读取失败');
      const sourceHash=hash(response.source);
      const names=cached?.sourceHash===sourceHash?cached.names:parse(response.source);
      if(!names.length)throw new Error('未找到原生界面组件');
      const record={format:1,version,sourceHash,names,namesHash:hash(JSON.stringify(names)),etag:response.headers?.etag,lastModified:response.headers?.['last-modified']};
      memory.set(key,record);if(memory.size>8)memory.delete(memory.keys().next().value);
      try{mkdirSync(directory,{recursive:true});const temp=join(directory,key+'.'+randomUUID()+'.tmp');writeFileSync(temp,JSON.stringify(record));renameSync(temp,join(directory,key+'.json'));}catch{/* Cache storage is optional. */}
      return [...names];
    })();
    pending.set(flightKey,work);try{return await work;}finally{pending.delete(flightKey);}
  }
  return discover;
}
