import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { check } from './check.mjs';

await check();
const { version } = JSON.parse(await readFile('package.json','utf8'));
const table = new Uint32Array(256);
for (let n=0;n<256;n++) { let c=n; for (let k=0;k<8;k++) c=(c&1)?0xedb88320^(c>>>1):c>>>1; table[n]=c>>>0; }
function crc32(buffer) { let c=0xffffffff; for(const byte of buffer)c=table[(c^byte)&255]^(c>>>8); return (c^0xffffffff)>>>0; }
async function files(dir) {
  const result=[];
  for (const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
    if(entry.name.startsWith('.') || entry.name==='node_modules') continue;
    const path=join(dir,entry.name);
    if(entry.isDirectory()) result.push(...await files(path));
    else if(entry.isFile()) result.push(path);
  }
  return result;
}
async function zip(paths,strip='') {
  const parts=[], directory=[]; let offset=0;
  for (const path of paths) {
    const raw=await readFile(path), compressed=deflateRawSync(raw,{level:9});
    const name=Buffer.from(path.slice(strip.length).replaceAll('\\','/'),'utf8'), crc=crc32(raw);
    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt16LE(0x5d21,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);
    parts.push(local,name,compressed);
    const central=Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x800,8);central.writeUInt16LE(8,10);central.writeUInt16LE(0x5d21,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
    directory.push(central,name);offset+=local.length+name.length+compressed.length;
  }
  const central=Buffer.concat(directory),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(paths.length,8);end.writeUInt16LE(paths.length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...parts,central,end]);
}
await mkdir('dist',{recursive:true});
const source=['package.json','package-lock.json','README.md','PRIVACY.md','LICENSE','.gitignore','docs/.nojekyll',...await files('extension'),...await files('docs'),...await files('scripts'),...await files('tests'),...await files('.github')];
const outputs=[
  [`generator-size-calculator-${version}.zip`,await zip(await files('extension'),'extension/')],
  [`generator-size-calculator-source-${version}.zip`,await zip(source)],
];
const sums=[];
for(const [name,buffer] of outputs) { await writeFile(join('dist',name),buffer);sums.push(`${createHash('sha256').update(buffer).digest('hex')}  ${name}`);console.log(`Created dist/${name} (${buffer.length.toLocaleString()} bytes).`); }
await writeFile('dist/SHA256SUMS.txt',sums.join('\n')+'\n');
