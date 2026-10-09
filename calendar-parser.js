import ICAL from 'ical.js';
export function parseCalendar(text,now=new Date()){
 const root=new ICAL.Component(ICAL.parse(text));if(root.name!=='vcalendar')throw Error('Choose a valid .ics calendar.');
 for(const component of root.getAllSubcomponents('vtimezone')){const id=component.getFirstPropertyValue('tzid');if(id)ICAL.TimezoneService.register(id,new ICAL.Timezone(component));}
 const components=root.getAllSubcomponents('vevent');const events=[];const min=now.getTime()-86400000,max=now.getTime()+90*86400000;
 const exceptions=new Map();for(const component of components){if(component.hasProperty('recurrence-id')){const id=component.getFirstPropertyValue('uid');if(!exceptions.has(id))exceptions.set(id,[]);exceptions.get(id).push(component)}}
 let iterations=0;
 function add(event,start,end,source){if(source.getFirstPropertyValue('status')==='CANCELLED')return;const timestamp=start.toJSDate().getTime();if(timestamp<min||timestamp>max)return;events.push({id:`${event.uid}:${timestamp}`,title:source.getFirstPropertyValue('summary')||'Untitled booking',location:source.getFirstPropertyValue('location')||'',start:new Date(timestamp).toISOString(),end:end?.toJSDate().toISOString()||null,allDay:start.isDate});}
 for(const component of components){if(component.hasProperty('recurrence-id')||component.getFirstPropertyValue('status')==='CANCELLED')continue;const event=new ICAL.Event(component);if(!event.startDate)continue;
  const timezone=component.getFirstProperty('dtstart')?.getParameter('tzid');if(timezone&&!ICAL.TimezoneService.has(timezone))throw Error(`Calendar timezone ${timezone} is missing its definition. Export the calendar with timezone information.`);
  for(const exception of exceptions.get(event.uid)||[])event.relateException(new ICAL.Event(exception));
  if(event.isRecurring()){const iterator=event.iterator();let next;while((next=iterator.next())){if(++iterations>10000)throw Error('Calendar has too many recurring events. Export a smaller calendar.');if(next.toJSDate().getTime()>max)break;const occurrence=event.getOccurrenceDetails(next);add(event,occurrence.startDate,occurrence.endDate,occurrence.item.component)}}else add(event,event.startDate,event.endDate,component);
 }
 return events.sort((a,b)=>a.start.localeCompare(b.start));
}
export function gymBooking(event){return /\b(gym|grit|ark|training|workout|fitness|strength|pilates|yoga|spin|crossfit|hiit|run|running)\b/i.test(event.title+' '+event.location);}
export function dueReminders(events,now,leadMinutes,notified){return events.filter(event=>!event.allDay&&!notified.has(event.id)&&new Date(event.start).getTime()>now&&new Date(event.start).getTime()-leadMinutes*60000<=now);}
