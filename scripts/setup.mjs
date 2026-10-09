import {createHash} from 'node:crypto';
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const modelUrl='https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/eng.traineddata';
const expectedHash='7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2';
const checksum=bytes=>createHash('sha256').update(bytes).digest('hex');

export function checkNodeVersion(){
  if(Number(process.versions.node.split('.')[0])<20){
    throw new Error('Stride requires Node.js 20 or newer. Install a current Node.js LTS release and try again.');
  }
}

export async function prepareModel(){
  checkNodeVersion();
  const directory=path.join(root,'.cache','ocr');
  const destination=path.join(directory,'eng.traineddata');
  try{
    if(checksum(await readFile(destination))===expectedHash){
      console.log('OCR model ready: verified existing English model.');
      return destination;
    }
    console.log('The cached OCR model failed verification. Downloading a verified replacement.');
  }catch(error){
    if(error.code!=='ENOENT')throw new Error(`Cannot read the OCR model: ${error.message}`);
  }

  console.log('Downloading the pinned English OCR model…');
  let bytes;
  try{
    const response=await fetch(modelUrl,{signal:AbortSignal.timeout(120000)});
    if(!response.ok)throw new Error(`HTTP ${response.status} ${response.statusText}`);
    bytes=Buffer.from(await response.arrayBuffer());
  }catch(error){
    throw new Error(`Unable to download the English OCR model: ${error.message}. Check your internet connection, then run npm run setup again.`);
  }
  const actualHash=checksum(bytes);
  if(actualHash!==expectedHash){
    throw new Error(`OCR model verification failed. Expected SHA-256 ${expectedHash}, received ${actualHash}. The download was not installed; retry npm run setup with a working connection to raw.githubusercontent.com.`);
  }

  await mkdir(directory,{recursive:true});
  const temporary=path.join(directory,`eng.traineddata.${process.pid}.download`);
  try{
    await writeFile(temporary,bytes,{flag:'wx'});
    await rename(temporary,destination);
  }finally{
    await rm(temporary,{force:true});
  }
  console.log('OCR model ready: downloaded and SHA-256 verified.');
  return destination;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  prepareModel().catch(error=>{console.error(`Setup failed: ${error.message}`);process.exitCode=1;});
}
