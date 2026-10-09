const DAY=86400000;
export function validDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function streakSummary(dates,today){
 if(!validDay(today))throw Error('A valid current day is required.');
 const days=[...new Set(dates.filter(date=>validDay(date)&&date<=today))].sort();
 let longest=0,run=0,previous=null;
 for(const day of days){const number=Date.parse(day+'T00:00:00Z')/DAY;run=previous!==null&&number===previous+1?run+1:1;longest=Math.max(longest,run);previous=number;}
 const set=new Set(days);let cursor=Date.parse(today+'T00:00:00Z')/DAY;if(!set.has(today))cursor--;
 let current=0;while(set.has(new Date(cursor*DAY).toISOString().slice(0,10))){current++;cursor--;}
 return {current,longest,total:days.length};
}
export function monthGrid(year,month){
 const start=new Date(Date.UTC(year,month,1));const offset=(start.getUTCDay()+6)%7;
 const days=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return Array.from({length:Math.ceil((offset+days)/7)*7},(_,index)=>{const date=new Date(Date.UTC(year,month,1-offset+index));return {date:date.toISOString().slice(0,10),day:date.getUTCDate(),inMonth:date.getUTCMonth()===month};});
}
export function bookingDateKey(iso,timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone){
 const date=new Date(iso);if(!Number.isFinite(date.getTime()))return null;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get=key=>parts.find(part=>part.type===key).value;return `${get('year')}-${get('month')}-${get('day')}`;
}
