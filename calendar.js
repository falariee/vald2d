import {parseCalendar,gymBooking,dueReminders} from './calendar-parser.js';
import {mountBookingImport} from './booking-import.js';
import {mountMonthlyOverview} from './monthly-overview.js';
import {bookingDateKey} from './monthly-model.js';

export function mergeImportedBookings(existing=[],incoming=[]) {
 const records=new Map();
 for(const event of [...existing,...incoming]) {
  const start=new Date(event.start),end=new Date(event.end),title=String(event.title??'').trim();
  if(!event.id||!title||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)throw Error('Review the booking name, start time, and end time before saving.');
  records.set(String(event.id),{id:String(event.id),title:title.slice(0,200),location:String(event.location??'').trim().slice(0,250),start:start.toISOString(),end:end.toISOString(),allDay:false,bookingType:String(event.bookingType??'').trim().slice(0,80),source:'email'});
 }
 return [...records.values()].sort((a,b)=>a.start.localeCompare(b.start));
}
export function combinedBookings(events=[],importedEvents=[]) {
 const records=new Map();
 for(const event of [...events,...importedEvents])if(event?.id&&Number.isFinite(new Date(event.start).getTime()))records.set(event.id,event);
 return [...records.values()].sort((a,b)=>a.start.localeCompare(b.start));
}
export function removeImportedBooking(state,id) {
 return {...state,importedEvents:state.importedEvents.filter(event=>event.id!==id),notified:state.notified.filter(notifiedId=>notifiedId!==id)};
}
export function bookingStatus(event,now=Date.now()) {
 if(new Date(event.start).getTime()>now)return 'upcoming';
 return event.end&&new Date(event.end).getTime()>now?'ongoing':'past';
}
const fitnessBooking=event=>gymBooking({...event,title:`${event.title} ${event.bookingType??''}`});
export function filterBookings(events,{range='upcoming',date=null,fitnessOnly=true,now=Date.now(),timeZone}={}) {
 return events.filter(event=>(range==='all'||(range==='past'?bookingStatus(event,now)==='past':bookingStatus(event,now)!=='past'))&&(!date||bookingDateKey(event.start,timeZone)===date)&&(!fitnessOnly||fitnessBooking(event))).sort((a,b)=>range==='past'?b.start.localeCompare(a.start):a.start.localeCompare(b.start));
}

export function mountCalendar({esc,toast,localDate,getSessions=()=>[],getPosts=()=>[]}) {
 const calendarIcon='<svg class="inline-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18M8 15h3"/></svg>';
 const nav=document.createElement('button');nav.dataset.view='calendar';nav.innerHTML='<svg class="icon" aria-hidden="true"><use href="#i-calendar"/></svg><span>Bookings</span>';document.querySelector('nav').append(nav);
 const section=document.createElement('section');section.id='calendar';section.className='view';section.hidden=true;
 section.innerHTML=`<div class="bookings-layout"><div class="booking-main"><div id="booking-email-import" class="booking-email-import"></div><section class="card bookings-list-card"><div class="section-head"><div><span class="eyebrow">MAKE TIME FOR YOURSELF</span><h3 id="bookings-heading">Upcoming bookings</h3></div><div class="booking-filters"><label class="filter-label">Show<select id="booking-range"><option value="upcoming">Upcoming</option><option value="past">Past</option><option value="all">All bookings</option></select></label><label class="inline-label"><input id="gym-only" type="checkbox" checked> Gym & fitness only</label></div></div><div id="booking-date-filter" class="booking-date-filter" hidden><span id="booking-selected-label"></span><button id="booking-date-clear" class="text-button">Clear date</button></div><div id="bookings"></div></section></div><div class="booking-side"><section class="card monthly-bookings-card"><div id="bookings-monthly"></div></section><section class="card calendar-reminders-card"><span class="eyebrow">A LITTLE NUDGE</span><h3>Make it to your next class</h3><p>Choose when you would like a reminder.</p><label>Remind me before class<select id="reminder-lead"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option></select></label><button class="primary" id="notifications-enable">Enable notifications</button><p id="notification-status" class="note"></p><p class="note">Keep Stride open to receive reminders. For alerts when the app is closed, add an alert in your phone calendar.</p></section></div></div><details class="card calendar-imports"><summary>Calendar imports <span class="note">Optional Apple Calendar links and .ics files</span></summary><div class="calendar-connect-panel"><p>Already keep your bookings in a calendar? You can also import them here. Booking emails stay saved when a calendar refreshes.</p><form id="calendar-connect"><label>Published iCloud calendar link<input name="url" type="text" placeholder="Paste your webcal:// calendar link" required></label><div class="calendar-form-actions"><button class="primary">Connect calendar</button><button type="button" class="text-button" id="calendar-disconnect">Disconnect</button></div></form><details class="calendar-help"><summary>How to find your calendar link</summary><p class="note">In Apple Calendar, share a separate gym calendar → enable Public Calendar → Copy Link. Anyone with the link can read it. Use a separate gym calendar to keep personal events private.</p><p class="note">Published calendars refresh every 15 minutes while Stride is open.</p></details><div class="calendar-import-row"><label class="text-button upload">Import a private .ics file<input id="ics-input" type="file" accept=".ics,text/calendar" hidden></label><button id="calendar-refresh" class="text-button">Refresh ↻</button></div><details class="calendar-help"><summary>Prefer a private calendar export?</summary><p class="note">In Calendar on Mac, choose File → Export → Export. File imports do not sync automatically; import a new file when bookings change.</p></details><p id="calendar-status" role="status"></p></div></details>`;
 document.querySelector('footer').before(section);const $=selector=>section.querySelector(selector);
 let stored;try{stored=JSON.parse(localStorage.getItem('stride-calendar'))}catch{}
 let state={url:'',events:[],importedEvents:[],lead:30,notified:[],source:'',...stored};
 for(const key of ['events','importedEvents','notified'])if(!Array.isArray(state[key]))state[key]=[];
 if(![15,30,60,120].includes(Number(state.lead)))state.lead=30;
 let selectedDate=null,monthly=null,emailImport=null;
 const getBookings=()=>combinedBookings(state.events,state.importedEvents);
 const commit=next=>{try{localStorage.setItem('stride-calendar',JSON.stringify(next));state=next;return true}catch{toast('Unable to save bookings. Free some browser storage.');return false}};
 $('#reminder-lead').value=state.lead;$('#calendar-connect input').value=state.url;
 nav.onclick=()=>{const week=document.querySelector('.week-label');if(week)week.hidden=true;document.querySelectorAll('.view').forEach(view=>view.hidden=view!==section);document.querySelectorAll('nav button').forEach(button=>button.classList.toggle('active',button===nav));document.querySelector('#title').textContent='Your bookings';document.querySelector('#subtitle').textContent='From your inbox to your next session.';document.querySelector('#page-label').textContent='BOOKINGS';monthly?.refresh()};
 const dateText=event=>{
  const start=new Date(event.start),options=event.allDay?{dateStyle:'medium'}:{dateStyle:'medium',timeStyle:'short'};
  let label=start.toLocaleString(undefined,options);if(event.allDay)return label+' · All day';
  if(event.end)label+=' – '+new Date(event.end).toLocaleString(undefined,bookingDateKey(event.start)===bookingDateKey(event.end)?{timeStyle:'short'}:options);
  return label;
 };
 function badge(event,now){const status=bookingStatus(event,now);if(status==='past')return 'PAST';if(status==='ongoing')return 'NOW';if(event.allDay)return 'ALL DAY';const minutes=Math.ceil((new Date(event.start)-now)/60000);return minutes<=60?`IN ${minutes} MIN`:`IN ${Math.ceil(minutes/60)} HRS`}
 function openEmail(){nav.click();$('#booking-email-import').scrollIntoView({behavior:'smooth',block:'start'});emailImport?.focus()}
 function render(){
  const all=getBookings(),now=Date.now(),range=$('#booking-range').value,events=filterBookings(all,{range,date:selectedDate,fitnessOnly:$('#gym-only').checked,now});
  $('#bookings-heading').textContent=selectedDate?'Bookings on this day':range==='past'?'Past bookings':range==='all'?'All bookings':'Upcoming bookings';
  $('#booking-date-filter').hidden=!selectedDate;$('#booking-selected-label').textContent=selectedDate?new Date(selectedDate+'T12:00:00').toLocaleDateString(undefined,{dateStyle:'long'}):'';
  $('#bookings').innerHTML=events.length?events.map(event=>`<article class="activity booking${bookingStatus(event,now)==='past'?' past-booking':''}"><div class="activity-top"><div class="activity-icon">${calendarIcon}</div><div class="activity-detail"><b>${esc(event.title)}</b><small>${esc(dateText(event))}</small><small>${esc(event.location||'Location not specified')}</small><small class="booking-source">${event.source==='email'?'Booking email':state.source==='file'?'Calendar file':'Calendar'}${event.bookingType?' · '+esc(event.bookingType):''}</small></div><span class="badge">${badge(event,now)}</span>${event.source==='email'?`<button type="button" class="delete" data-delete-booking="${esc(event.id)}" aria-label="Delete ${esc(event.title)} booking">×</button>`:''}</div></article>`).join(''):`<div class="empty"><div class="empty-icon">${calendarIcon}</div><div class="empty-copy"><h4>${selectedDate?'A little breathing room on this day':all.length?'No bookings in this view':'Your next class belongs here'}</h4><p>${selectedDate?'Choose another day or clear the date filter.':all.length?'Choose Upcoming, Past, or All bookings to explore your sessions.':'Import a booking confirmation email screenshot, or paste its text to get started.'}</p></div>${all.length?'':'<button class="primary" data-booking-import>Import booking email</button>'}</div>`;
  section.querySelectorAll('[data-delete-booking]').forEach(button=>button.onclick=()=>{if(confirm('Remove this saved booking from Stride?')){if(!commit(removeImportedBooking(state,button.dataset.deleteBooking)))return;render();toast('Booking removed from Stride.')}});
  const nextBlock=document.querySelector('#next-booking'),next=all.find(event=>bookingStatus(event,now)==='upcoming'&&fitnessBooking(event));
  if(nextBlock)nextBlock.innerHTML=next?`<span class="next-booking-label eyebrow">NEXT UP</span><h3 class="next-booking-title">${esc(next.title)}</h3><p class="next-booking-meta">${esc(dateText(next))}${next.location?`<span>${esc(next.location)}</span>`:''}</p>`:`<span class="next-booking-label eyebrow">YOUR NEXT SESSION</span><h3 class="next-booking-title">Save a spot for yourself.</h3><p class="next-booking-meta">${all.length?'Your next upcoming gym booking will appear here.':'Import a booking confirmation email to keep your plans close by.'}</p><button class="text-button" data-booking-import data-calendar-connect>${all.length?'View your bookings':'Import booking email'} ↗</button>`;
  document.querySelectorAll('[data-booking-import],[data-calendar-connect]').forEach(button=>button.onclick=openEmail);
  $('#calendar-disconnect').hidden=!state.url;$('#calendar-refresh').disabled=!state.url;monthly?.refresh();
 }
 function notificationStatus(){const support='Notification'in window;$('#notification-status').textContent=!support?'Notifications are unavailable in this browser. In-app reminders still work.':Notification.permission==='granted'?'Browser notifications enabled while Stride is open.':Notification.permission==='denied'?'Notifications blocked. Change this site’s browser permissions to enable them.':'Allow notifications to get an alert before your bookings.'}
 function checkReminders(){
  const notified=new Set(state.notified),newIds=[];
  for(const event of dueReminders(getBookings().filter(fitnessBooking),Date.now(),state.lead,notified)){
   const minutes=Math.max(1,Math.ceil((new Date(event.start)-Date.now())/60000)),message=`${event.title} in ${minutes} min${event.location?' · '+event.location:''}`;toast(message);
   if('Notification'in window&&Notification.permission==='granted'){try{new Notification('Your gym booking is coming up',{body:message,tag:event.id})}catch{}}
   newIds.push(event.id);notified.add(event.id);
  }
  if(newIds.length)commit({...state,notified:[...state.notified,...newIds].slice(-500)});
 }
 async function sync(raw=state.url){
  if(!raw){toast('Connect a published calendar to refresh it.');return}$('#calendar-status').textContent='Refreshing calendar…';$('#calendar-refresh').disabled=true;
  try{
   const response=await fetch('/api/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:raw})}),body=await response.json();if(!response.ok)throw Error(body.error);
   const events=parseCalendar(body.calendar);if(!commit({...state,url:raw,events,source:'subscription',updated:new Date().toISOString()}))return;
   $('#calendar-status').textContent=`Updated ${new Date().toLocaleTimeString()} · ${events.length} calendar events in the next 90 days`;render();checkReminders();
  }catch(error){$('#calendar-status').textContent=error.message||'Calendar sync failed. Existing bookings were kept.'}finally{$('#calendar-refresh').disabled=!state.url}
 }
 $('#calendar-connect').onsubmit=event=>{event.preventDefault();sync(event.target.elements.url.value.trim())};$('#calendar-refresh').onclick=()=>sync();
 $('#calendar-disconnect').onclick=()=>{if(confirm('Disconnect this calendar? Booking emails stay saved.')){if(!commit({...state,url:'',events:[],source:'',updated:null}))return;$('#calendar-connect').reset();$('#calendar-status').textContent='Calendar disconnected. Booking emails were kept.';render()}};
 $('#ics-input').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('Choose a calendar smaller than 2 MB.');const events=parseCalendar(await file.text());if(!commit({...state,events,url:'',source:'file',updated:new Date().toISOString()}))return;$('#calendar-connect input').value='';$('#calendar-status').textContent=`Imported ${events.length} calendar events. Booking emails were kept.`;render();checkReminders()}catch(error){$('#calendar-status').textContent=error.message||'Unable to read calendar file.'}finally{event.target.value=''}};
 $('#reminder-lead').onchange=event=>{const previous=state.lead;if(!commit({...state,lead:Number(event.target.value)}))event.target.value=previous;checkReminders()};$('#gym-only').onchange=render;$('#booking-range').onchange=render;
 $('#booking-date-clear').onclick=()=>{if(monthly?.clearSelection)monthly.clearSelection();else{selectedDate=null;render()}};
 $('#notifications-enable').onclick=async()=>{if(!('Notification'in window)){toast('Browser notifications are unavailable.');return}try{await Notification.requestPermission();notificationStatus()}catch{toast('Notifications require HTTPS and browser support.')}};
 emailImport=mountBookingImport($('#booking-email-import'),{esc,toast,onSave:events=>{
  try{const importedEvents=mergeImportedBookings(state.importedEvents,events);if(!commit({...state,importedEvents}))return false;$('#booking-range').value='all';selectedDate=null;monthly?.clearSelection();render();setTimeout(checkReminders,0);return true}catch(error){toast(error.message||'Unable to save these bookings.');return false}
 }});
 monthly=mountMonthlyOverview($('#bookings-monthly'),{getData:()=>({sessions:getSessions(),posts:getPosts(),bookings:getBookings()}),onDateSelect:date=>{selectedDate=date;if(date)$('#booking-range').value='all';render()}});
 window.addEventListener('stride-journal-changed',render);window.addEventListener('stride-activities-changed',render);
 setInterval(()=>{checkReminders();render()},30000);setInterval(()=>{if(state.url)sync()},15*60000);
 window.addEventListener('focus',()=>{checkReminders();if(state.url&&(!state.updated||Date.now()-new Date(state.updated)>15*60000))sync()});
 notificationStatus();render();checkReminders();if(state.url)sync();return {getBookings,refresh:render};
}
