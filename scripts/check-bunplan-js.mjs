import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root=path.resolve('android-native/app/src/main/assets');
let failures=0;
for(const file of ['index.html','main.html']){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
 console.log(file, 'scripts',scripts.length,'bytes',html.length);
 if(!scripts.length)throw Error('No scripts in '+file);
 for(let i=0;i<scripts.length;i++){
  try{new vm.Script(scripts[i][1],{filename:file+'#'+i});}
  catch(e){failures++;console.error('JS syntax error',e.stack);}
 }
 if(!html.includes('Content-Security-Policy'))throw Error('CSP missing in '+file);
}
for(const file of ['brands/lidl.svg','brands/kaufland.svg']){
 const svg=fs.readFileSync(path.join(root,file),'utf8');
 if(!svg.includes('<svg')||svg.length>60000||/<script|onload=|javascript:/i.test(svg))throw Error('Untrusted SVG: '+file);
 console.log(file,'bytes',svg.length);
}
if(failures)process.exit(1);
console.log('JS + logo validation passed');
