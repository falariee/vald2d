import {fetchCalendar} from '../../calendar-fetch.js';

const MAX_BODY_BYTES=8192;

function json(body,status=200,extraHeaders={}) {
  return new Response(JSON.stringify(body),{
    status,
    headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extraHeaders}
  });
}

async function readBody(request) {
  if(Number(request.headers.get('content-length'))>MAX_BODY_BYTES)throw Error('Request too large.');
  if(!request.body)return '';
  const reader=request.body.getReader(),chunks=[];
  let size=0;
  try {
    for(;;) {
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_BODY_BYTES) {
        await reader.cancel();
        throw Error('Request too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function calendar(request) {
  if(request.method!=='POST')return json({error:'Use POST'},405,{Allow:'POST'});
  try {
    const payload=JSON.parse(await readBody(request));
    const calendar=await fetchCalendar(payload?.url);
    return json({calendar});
  } catch(error) {
    const message=error.message==='fetch failed'
      ?'iCloud is unavailable or blocked by network policy. You can import a private .ics file instead.'
      :error.message;
    return json({error:message},400);
  }
}
