import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectPackage,encodePackage,releaseName,sha256} from '../lib/package.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(process.argv[2]||join(root,'dist'));
const bundle=collectPackage(root),bytes=encodePackage(bundle),name=releaseName(bundle.version);
mkdirSync(out,{recursive:true});writeFileSync(join(out,name),bytes);writeFileSync(join(out,name+'.sha256'),sha256(bytes)+'  '+name+'\n');
// ZIP is for manual installation. Updates use the validated bundle.
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
const locals=[],central=[];let offset=0;
for(const file of bundle.files){
  const data=Buffer.from(file.data,'base64'),filename=Buffer.from('agy-powertools-v'+bundle.version+'/'+file.path),crc=crc32(data),header=Buffer.alloc(30),entry=Buffer.alloc(46);
  header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
  entry.writeUInt32LE(0x02014b50,0);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(0x800,8);entry.writeUInt16LE(33,14);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(filename.length,28);entry.writeUInt32LE(offset,42);
  locals.push(header,filename,data);central.push(entry,filename);offset+=header.length+filename.length+data.length;
}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(bundle.files.length,8);end.writeUInt16LE(bundle.files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
writeFileSync(join(out,`agy-powertools-v${bundle.version}.zip`),Buffer.concat([...locals,directory,end]));
console.log(JSON.stringify({version:bundle.version,files:bundle.files.length,bundle:name,sha256:sha256(bytes),zip:`agy-powertools-v${bundle.version}.zip`}));
