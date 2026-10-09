import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {fetchCalendar} from './calendar-fetch.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const files={'/':'index.html','/style.css':'style.css','/assets/fonts/regular.woff2':'assets/fonts/regular.woff2','/assets/fonts/medium.woff2':'assets/fonts/medium.woff2','/assets/fonts/bold.woff2':'assets/fonts/bold.woff2','/app.js':'app.js','/journal.js':'journal.js','/journal-model.js':'journal-model.js','/booking-import.js':'booking-import.js','/booking-parser.js':'booking-parser.js','/monthly-overview.js':'monthly-overview.js','/monthly-model.js':'monthly-model.js','/metrics.js':'metrics.js','/import.js':'import.js','/ocr-parser.js':'ocr-parser.js','/icons.js':'icons.js','/calendar.js':'calendar.js','/calendar-parser.js':'calendar-parser.js','/vendor/ical.js':'node_modules/ical.js/dist/ical.min.js','/ocr/tesseract.min.js':'node_modules/tesseract.js/dist/tesseract.min.js','/ocr/worker.min.js':'node_modules/tesseract.js/dist/worker.min.js'};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost').pathname;
 if(url==='/api/calendar'){
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.writeHead(405);return res.end(JSON.stringify({error:'Use POST'}));}
  try{let body='';for await(const chunk of req){body+=chunk;if(body.length>8192)throw Error('Request too large.');}const request=JSON.parse(body);const calendar=await fetchCalendar(request.url);return res.end(JSON.stringify({calendar}));}catch(error){res.writeHead(400);return res.end(JSON.stringify({error:error.message==='fetch failed'?'iCloud is unavailable or blocked by network policy. You can import a private .ics file instead.':error.message}));}
 }
 let file=files[url]&&path.join(root,files[url]);
 if(/^\/ocr\/core\/tesseract-core(?:-relaxedsimd|-simd)?(?:-lstm)?\.(?:wasm|wasm.js|js)$/.test(url))file=path.join(root,'node_modules/tesseract.js-core',path.basename(url));
 if(url==='/ocr/lang/eng.traineddata')file=path.join(process.env.OCR_DATA_PATH||path.join(root,'.cache/ocr'),'eng.traineddata');
 if(!file){res.writeHead(404);return res.end('Not found');}
 try{const body=await readFile(file);res.setHeader('Content-Type',file.endsWith('.woff2')?'font/woff2':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.end(body);}catch{res.writeHead(500);res.end('Unable to load app asset');}
}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Stride running on port '+(process.env.PORT||3000)));
