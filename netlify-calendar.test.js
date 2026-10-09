import test from 'node:test';
import assert from 'node:assert/strict';
import calendar from './netlify/functions/calendar.mjs';

const endpoint='https://stride.example/api/calendar';
const published='https://p1-caldav.icloud.com/published/2/fixture';
const calendarText='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR';
const post=body=>new Request(endpoint,{method:'POST',body});

test('calendar API requires POST and returns uncached JSON',async()=>{
  for(const method of ['GET','PUT','OPTIONS']) {
    const response=await calendar(new Request(endpoint,{method}));
    assert.equal(response.status,405);
    assert.equal(response.headers.get('allow'),'POST');
    assert.equal(response.headers.get('content-type'),'application/json');
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.deepEqual(await response.json(),{error:'Use POST'});
  }
});

test('calendar API rejects malformed JSON and missing links without network requests',async t=>{
  const fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('Unexpected fetch')});
  for(const body of ['{broken','',JSON.stringify({}),JSON.stringify(null)]) {
    const response=await calendar(post(body));
    assert.equal(response.status,400);
    assert.equal(typeof (await response.json()).error,'string');
  }
  assert.equal(fetch.mock.callCount(),0);
});

test('calendar API rejects private and unsupported URLs before fetching',async t=>{
  const fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('Unexpected fetch')});
  for(const url of [
    'http://127.0.0.1/calendar',
    'http://169.254.169.254/latest/meta-data/',
    'https://example.com/published/2/private',
    'http://p1-caldav.icloud.com/published/2/private',
    'https://p1-caldav.icloud.com/private/calendar',
    'https://user:password@p1-caldav.icloud.com/published/2/private',
    'https://p1-caldav.icloud.com:8443/published/2/private'
  ]) {
    const response=await calendar(post(JSON.stringify({url})));
    assert.equal(response.status,400);
    assert.match((await response.json()).error,/iCloud/);
  }
  assert.equal(fetch.mock.callCount(),0);
});

test('calendar API enforces the 8192-byte request limit for multibyte text',async t=>{
  const fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('Unexpected fetch')});
  const body=JSON.stringify({url:published,padding:'é'.repeat(4096)});
  assert(body.length<8192);
  assert(Buffer.byteLength(body)>8192);
  const response=await calendar(post(body));
  assert.equal(response.status,400);
  assert.deepEqual(await response.json(),{error:'Request too large.'});
  assert.equal(fetch.mock.callCount(),0);
});

test('calendar API rejects an oversized chunked request without Content-Length',async t=>{
  const fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('Unexpected fetch')});
  const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(4096).fill(32));controller.enqueue(new Uint8Array(4097).fill(32));controller.close()}});
  const request=new Request(endpoint,{method:'POST',body,duplex:'half'});
  assert.equal(request.headers.get('content-length'),null);
  const response=await calendar(request);
  assert.equal(response.status,400);
  assert.deepEqual(await response.json(),{error:'Request too large.'});
  assert.equal(fetch.mock.callCount(),0);
});

test('calendar API accepts the byte boundary and preserves the fetched calendar',async t=>{
  const fetch=t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(String(url),published);
    assert.equal(options.redirect,'manual');
    assert.equal(options.headers.Accept,'text/calendar');
    return new Response(calendarText);
  });
  const body=JSON.stringify({url:published}).padEnd(8192,' ');
  assert.equal(Buffer.byteLength(body),8192);
  const response=await calendar(post(body));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{calendar:calendarText});
  assert.equal(fetch.mock.callCount(),1);
});

test('calendar API rejects redirects to a private host',async t=>{
  const fetch=t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}}));
  const response=await calendar(post(JSON.stringify({url:published})));
  assert.equal(response.status,400);
  assert.match((await response.json()).error,/published iCloud calendar link/);
  assert.equal(fetch.mock.callCount(),1);
});

test('calendar API explains an unavailable iCloud connection',async t=>{
  t.mock.method(globalThis,'fetch',async()=>{throw TypeError('fetch failed')});
  const response=await calendar(post(JSON.stringify({url:published})));
  assert.equal(response.status,400);
  assert.deepEqual(await response.json(),{error:'iCloud is unavailable or blocked by network policy. You can import a private .ics file instead.'});
});
