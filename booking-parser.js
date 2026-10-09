const MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MAX_TEXT=10000;
const SAFE_BOOKING_TYPES=/^(gym(?: time| session)?|class|training|weight training|strength training|workout|run|running|yoga|pilates|spin|fitness|hiit)$/i;

function displayLabel(value){
 return String(value||'').replace(/https?:\/\/\S+|webcal:\/\/\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?\d[\d ()-]{6,}\d/gi,'').replace(/\s+/g,' ').trim().slice(0,120);
}

// IDs use only the reviewed booking fields, never booking references or access links.
export function bookingEventId({title,location,start}){
 const key=[title,location,start].map(value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ')).join('|');
 let a=2166136261,b=2246822507;
 for(let i=0;i<key.length;i++){a=Math.imul(a^key.charCodeAt(i),16777619);b=Math.imul(b^key.charCodeAt(i),3266489909);}
 return `email-${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}

function dateWithOffset(year,month,day,hour,minute,second,offsetMinutes){
 if(year<1900||year>2200||month<1||month>12||day<1||day>31||hour<0||hour>23||minute<0||minute>59||second<0||second>59)return null;
 const local=Date.UTC(year,month-1,day,hour,minute,second);
 const check=new Date(local);
 if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)return null;
 return new Date(local-offsetMinutes*60000).toISOString();
}

function parseDate(value){
 const text=String(value||'').replace(/\u00a0/g,' ').trim();
 // An explicit numeric timezone is required. OCR text without one stays for review.
 const offset=text.match(/(?:^|\s)([+-])(\d{2})(?::?(\d{2}))?\s*(?:\([^)]*\))?\s*$/);
 if(!offset)return null;
 const hours=Number(offset[2]),minutes=Number(offset[3]||0);
 if(hours>14||minutes>59||(hours===14&&minutes!==0))return null;
 const offsetMinutes=(hours*60+minutes)*(offset[1]==='-'?-1:1);
 const dateText=text.slice(0,offset.index).trim();
 const iso=dateText.match(/(?:^|\s)(\d{4})-(\d{2})-(\d{2})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
 if(iso)return dateWithOffset(Number(iso[1]),Number(iso[2]),Number(iso[3]),Number(iso[4]),Number(iso[5]),Number(iso[6]||0),offsetMinutes);
 const named=dateText.match(/(?:^|[,\s])(\d{1,2})\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/i);
 if(!named)return null;
 return dateWithOffset(Number(named[3]),MONTHS.indexOf(named[2].slice(0,3).toLowerCase())+1,Number(named[1]),Number(named[4]),Number(named[5]),Number(named[6]||0),offsetMinutes);
}

function field(block,name){
 const pattern=new RegExp(`Booking\\s+Time\\s+${name}\\s*:\\s*([^\\n]*)(?:\\n(?!\\s*(?:Booking|Customer|Contact|Type|Self-Service|https?:))[ \\t]*([^\\n]+))?`,'i');
 const match=block.match(pattern);return match?[match[1],match[2]].filter(Boolean).join(' ').trim():'';
}

/** Detect bookings only; every candidate must be reviewed before being saved. */
export function parseBookingEmails(value){
 const text=String(value||'').slice(0,MAX_TEXT).replace(/\r\n?/g,'\n');
 const headings=[...text.matchAll(/^\s*Booking\s+confirmed\s+for\s+([^\n]+)/gim)];
 const blocks=headings.length?headings.map((heading,index)=>({heading:heading[1],text:text.slice(heading.index,headings[index+1]?.index??text.length)})):/Booking\s+Time\s+(?:Start|End)\s*:/i.test(text)?[{heading:'',text}]:[];
 return blocks.slice(0,20).map(block=>{
  const parts=block.heading.split(/\s+@\s+|\s+at\s+/i);
  const venue=displayLabel(parts.shift()),location=displayLabel(parts.join(' @ '));
  const title=venue?(location?`${venue} @ ${location}`:venue):'';
  const start=parseDate(field(block.text,'Start')),end=parseDate(field(block.text,'End'));
  const rawType=block.text.match(/^\s*Type\s*:\s*([^\n]+)/im)?.[1]?.trim()||'';
  const bookingType=SAFE_BOOKING_TYPES.test(rawType)?displayLabel(rawType):'';
  const candidate={title,location,start,end,allDay:false,bookingType,source:'email'};
  const issues=[];
  if(!title)issues.push('Enter the booking name.');
  if(!start)issues.push('Check the start date, time, and timezone.');
  if(!end)issues.push('Check the end date, time, and timezone.');
  if(start&&end&&new Date(end)<=new Date(start))issues.push('End time must be after start time.');
  if(start&&end&&new Date(end)-new Date(start)>48*3600000)issues.push('Check this booking: its duration exceeds 48 hours.');
  return {...candidate,id:bookingEventId(candidate),needsReview:true,issues};
 });
}

/** The booking editor is explicitly Singapore time, regardless of device timezone. */
export function singaporeDateTime(value){
 const timestamp=Date.parse(value);if(!Number.isFinite(timestamp))return '';
 const local=new Date(timestamp+8*3600000).toISOString();return local.slice(0,local.slice(17,19)==='00'?16:19);
}
export function parseSingaporeDateTime(value){
 const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
 return match?dateWithOffset(...match.slice(1,6).map(Number),Number(match[6]||0),480):null;
}
