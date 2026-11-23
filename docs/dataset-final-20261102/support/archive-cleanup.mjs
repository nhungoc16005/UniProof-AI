import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import archiver from '../../tracker-20261027/support/node_modules/archiver/index.js';
import unzipper from '../../tracker-20261027/support/node_modules/unzipper/unzip.js';
const root=path.resolve('outputs'), archiveDir=path.join(root,'archive');
fs.mkdirSync(archiveDir,{recursive:true});
const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name==='node_modules'||entry.isSymbolicLink())continue;const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else files.push(p);}}
for(const folder of ['tracker-20261027','review-20261102','supplement-20261102','recheck-38-20261102','synthetic-preview-20261101','synthetic-preview-incomplete-20261101'])if(fs.existsSync(path.join(root,folder)))walk(path.join(root,folder));
const keep=p=>/review-20261102[\\/]DOC-0020-[AB]\.png$/.test(p)||/review-20261102[\\/]support[\\/](contact-\d+\.jpg|source-manifest\.json)$/.test(p)||/supplement-20261102[\\/]provenance\.json$/.test(p)||/tracker-20261027[\\/]support[\\/]package(-lock)?\.json$/.test(p)||path.basename(p).startsWith('~$');
const removed=files.filter(p=>!keep(p)).map(p=>({relative:path.relative(root,p).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),bytes:fs.statSync(p).size}));
const target=path.join(archiveDir,'superseded-20261102.zip');
if(fs.existsSync(target))throw Error('Archive already exists; do not overwrite history.');
const output=fs.createWriteStream(target),zip=archiver('zip',{zlib:{level:6}});
const finished=new Promise((resolve,reject)=>{output.on('close',resolve);output.on('error',reject);zip.on('error',reject);});
zip.pipe(output);for(const item of removed)zip.file(path.join(root,item.relative),{name:item.relative});await zip.finalize();await finished;
const contents=await unzipper.Open.file(target);
for(const item of removed){const entry=contents.files.find(e=>e.path===item.relative);if(!entry)throw Error(`Missing archive member ${item.relative}`);const actual=crypto.createHash('sha256').update(await entry.buffer()).digest('hex');if(actual!==item.sha256)throw Error(`Archive mismatch ${item.relative}`);}
const report={archive:'outputs/archive/superseded-20261102.zip',archive_verified:true,reason:'Superseded workbooks/JSON, one-off scripts and previews; source images, provenance, contact sheets and runtime dependencies remain.',files:removed,total_bytes:removed.reduce((s,r)=>s+r.bytes,0)};
fs.writeFileSync(path.join(archiveDir,'cleanup-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({archived_files:removed.length,bytes:report.total_bytes,archive_bytes:fs.statSync(target).size,verified:true}));
