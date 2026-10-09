import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeImportedBookings,combinedBookings,removeImportedBooking,bookingStatus,filterBookings} from './calendar.js';
const email={id:'email-fixture',title:'Strength class',location:'Example gym',start:'2026-10-09T06:00:00+08:00',end:'2026-10-09T09:00:00+08:00',bookingType:'Gym Time'};

test('email imports deduplicate stable ids and only retain reviewed booking fields',()=>{
 const saved=mergeImportedBookings([], [{...email,customer:'Private customer',contact:'private@example.invalid',bookingId:'private-id',entryUrl:'https://example.invalid/private',rawText:'Private email text',photo:'private-image'}]);
 assert.equal(saved.length,1);assert.equal(saved[0].start,'2026-10-08T22:00:00.000Z');assert.equal(saved[0].end,'2026-10-09T01:00:00.000Z');
 assert.deepEqual(Object.keys(saved[0]).sort(),['allDay','bookingType','end','id','location','source','start','title'].sort());
 const repeated=mergeImportedBookings(saved,[{...email,title:'Updated strength class'}]);assert.equal(repeated.length,1);assert.equal(repeated[0].title,'Updated strength class');assert.equal(repeated[0].source,'email');
});
test('subscription refreshes can replace calendar events without erasing imported emails',()=>{
 const imported=mergeImportedBookings([],[email]);const oldCalendar={...email,id:'old-calendar'},newCalendar={...email,id:'new-calendar',start:'2026-10-10T06:00:00+08:00'};
 assert.deepEqual(combinedBookings([oldCalendar],imported).map(event=>event.id).sort(),['email-fixture','old-calendar']);
 assert.deepEqual(combinedBookings([newCalendar],imported).map(event=>event.id).sort(),['email-fixture','new-calendar']);
 assert.deepEqual(combinedBookings([],imported).map(event=>event.id),['email-fixture']);
});
test('past, ongoing, and upcoming filters expose earlier imported bookings',()=>{
 const events=mergeImportedBookings([],[email]);assert.equal(bookingStatus(events[0],Date.parse('2026-10-08T21:00:00Z')),'upcoming');assert.equal(bookingStatus(events[0],Date.parse('2026-10-08T23:00:00Z')),'ongoing');
 const now=Date.parse('2026-10-09T02:00:00Z');assert.equal(bookingStatus(events[0],now),'past');assert.equal(filterBookings(events,{now}).length,0);assert.equal(filterBookings(events,{now,range:'past'}).length,1);assert.equal(filterBookings(events,{now,range:'all'}).length,1);
 assert.equal(filterBookings(events,{now,range:'all',date:'2026-10-09',timeZone:'Asia/Singapore'}).length,1);assert.equal(filterBookings(events,{now,range:'all',date:'2026-10-08',timeZone:'Asia/Singapore'}).length,0);
});
test('invalid reviewed dates or an end before start do not become bookings',()=>{
 assert.throws(()=>mergeImportedBookings([],[{...email,start:'invalid'}]),/Review the booking/);assert.throws(()=>mergeImportedBookings([],[{...email,end:'2026-10-09T05:00:00+08:00'}]),/Review the booking/);
});
test('removing an email booking preserves the calendar connection and other booking reminders',()=>{
 const state={url:'https://example.invalid/calendar',source:'subscription',events:[{...email,id:'email-fixture'}],importedEvents:mergeImportedBookings([],[email,{...email,id:'keep-email'}]),notified:['email-fixture','keep-email','calendar-reminder']};
 const next=removeImportedBooking(state,'email-fixture');
 assert.equal(next.url,state.url);assert.equal(next.source,'subscription');assert.deepEqual(next.events,state.events);assert.deepEqual(next.importedEvents.map(event=>event.id),['keep-email']);assert.deepEqual(next.notified,['keep-email','calendar-reminder']);assert.equal(state.importedEvents.length,2);
});
