import {access,copyFile,mkdir,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkNodeVersion,prepareModel} from './setup.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'dist');
const appFiles=['index.html','style.css','app.js','metrics.js','import.js','ocr-parser.js','icons.js','calendar.js','calendar-parser.js'];
const vendorFiles=[
  ['node_modules/ical.js/dist/ical.min.js','vendor/ical.js'],
  ['node_modules/tesseract.js/dist/tesseract.min.js','ocr/tesseract.min.js'],
  ['node_modules/tesseract.js/dist/worker.min.js','ocr/worker.min.js'],
  ['node_modules/tesseract.js/dist/tesseract.min.js.LICENSE.txt','ocr/tesseract.min.js.LICENSE.txt'],
  ['node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt','ocr/worker.min.js.LICENSE.txt'],
  ['node_modules/ical.js/LICENSE','licenses/ical.js-LICENSE'],
  ['node_modules/tesseract.js/LICENSE.md','licenses/tesseract.js-LICENSE.md'],
  ['node_modules/tesseract.js-core/LICENSE','licenses/tesseract.js-core-LICENSE'],
];
const coreFiles=['tesseract-core','tesseract-core-lstm','tesseract-core-simd','tesseract-core-simd-lstm','tesseract-core-relaxedsimd','tesseract-core-relaxedsimd-lstm']
  .flatMap(name=>['js','wasm','wasm.js'].map(extension=>`${name}.${extension}`));
const dependencyFiles=[...vendorFiles,...coreFiles.map(name=>[`node_modules/tesseract.js-core/${name}`,`ocr/core/${name}`])];

async function build(){
  checkNodeVersion();
  try{
    for(const [source] of dependencyFiles)await access(path.join(root,source));
  }catch{
    throw new Error('Required dependencies are missing. Run npm ci in the project folder, then run npm run build again.');
  }

  const fontFiles=await readdir(path.join(root,'assets','fonts'));
  const files=[
    ...appFiles.map(name=>[name,name]),
    ...dependencyFiles,
    ...fontFiles.filter(name=>name.endsWith('.woff2')||name==='LICENSE').map(name=>[`assets/fonts/${name}`,`assets/fonts/${name}`]),
    ['assets/licenses/ocr-model-LICENSE','licenses/ocr-model-LICENSE'],
  ];
  for(const [source] of files)await access(path.join(root,source));
  const model=await prepareModel();

  await rm(output,{recursive:true,force:true});
  for(const [source,destination] of files){
    const target=path.join(output,destination);
    await mkdir(path.dirname(target),{recursive:true});
    await copyFile(path.join(root,source),target);
  }
  const target=path.join(output,'ocr','lang','eng.traineddata');
  await mkdir(path.dirname(target),{recursive:true});
  await copyFile(model,target);
  console.log(`Built ${files.length+1} static files in dist/.`);
}

build().catch(error=>{console.error(`Build failed: ${error.message}`);process.exitCode=1;});
