export function parseDuration(raw){
 const text=String(raw??'').trim().toLowerCase();
 if(/^\d+(?:\.\d+)?$/.test(text))return Number(text)*60;
 if(/^\d+:\d{2}(?::\d{2})?$/.test(text)){const parts=text.split(':').map(Number);if(parts.slice(1).some(n=>n>=60))return null;return parts.length===3?parts[0]*3600+parts[1]*60+parts[2]:parts[0]*60+parts[1];}
 const match=text.match(/^(?:(\d+)\s*h(?:ours?|rs?)?\s*)?(?:(\d+)\s*m(?:in(?:utes?)?)?\s*)?(?:(\d+)\s*s(?:ec(?:onds?)?)?\s*)?$/);
 return match&&match[0]?Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0):null;
}
export function formatDuration(seconds){if(seconds==null||!Number.isFinite(seconds))return '';const n=Math.round(seconds);return n>=3600?`${Math.floor(n/3600)}:${String(Math.floor(n%3600/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`:`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
export function parseActivities(text){
 const lines=text.replace(/\r/g,'').split('\n');
 const headers=[];
 lines.forEach((line,index)=>{
  const title=line.trim();if(!title||title.length>100||/^(?:distance|pace|time|calories|run time|running time|gym time|upload|log|track|avg|total)\b/i.test(title))return;
  const run=/\b(?:run|running|treadmill|jog|jogging)\b/i.test(title),gym=/\b(?:weight training|strength training|workout|gym|weightlifting|weights|training)\b/i.test(title);
  if(run||gym)headers.push({index,title,type:run?'Run':'Gym'});
 });
 return headers.map((header,i)=>{
  const block=lines.slice(header.index+1,headers[i+1]?.index??lines.length).join('\n');
  const distance=block.match(/(\d+(?:[.,]\d+)?)\s*km\b/i);
  const pace=block.match(/(\d{1,2})\s*[:'’]\s*(\d{2})\s*(?:\/\s*km|min\s*\/\s*km)/i);
  const calories=block.match(/\b(\d+(?:[.,]\d+)?)[ \t]*(?:kcal|cals?|calories)\b/i)||block.match(/(?:calories|kcal|cal)\s*[:\n]?\s*(\d+(?:[.,]\d+)?)/i);
  const withoutPace=block.replace(/\d{1,2}\s*[:'’]\s*\d{2}\s*(?:\/\s*km|min\s*\/\s*km)/gi,'');
  const unitTime=withoutPace.match(/\b(?:\d+\s*h(?:ours?|rs?)?\s*)?(?:\d+\s*m(?:in(?:utes?)?)?\s*)(?:\d+\s*s(?:ec(?:onds?)?)?)?\b/i)||withoutPace.match(/\b\d+\s*h(?:ours?|rs?)?\b/i);
  const clock=withoutPace.match(/\b\d+:\d{2}(?::\d{2})?\b/);
  const durationSeconds=unitTime?parseDuration(unitTime[0]):clock?parseDuration(clock[0]):null;
  return {type:header.type,title:header.title,durationSeconds,distance:header.type==='Run'&&distance?Number(distance[1].replace(',','.')):null,paceSeconds:header.type==='Run'&&pace?Number(pace[1])*60+Number(pace[2]):null,calories:calories?Number(calories[1].replace(',','.')):null};
 });
}
