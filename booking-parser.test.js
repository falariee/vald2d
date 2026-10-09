import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseBookingEmails,bookingEventId,singaporeDateTime,parseSingaporeDateTime} from './booking-parser.js';
import {dueReminders} from './calendar-parser.js';

const confirmation=`Booking confirmed for Ark Grit @ Hougang 422
Booking ID: fabricated-example-reference
Customer Name: Example Person
Contact No: +6500000000
Booking Time Start: Fri, 09 Oct 2026 06:00:00 +08
Booking Time End: Fri, 09 Oct 2026 09:00:00 +08
Type: Gym Time
Self-Service Entry
https://example.invalid/entry?booking-id=fabricated-example-reference`;

test('Gmail booking detection respects +08, including previous UTC date',()=>{
 const [event]=parseBookingEmails(confirmation);
 assert.equal(event.title,'Ark Grit @ Hougang 422');
 assert.equal(event.location,'Hougang 422');
 assert.equal(event.start,'2026-10-08T22:00:00.000Z');
 assert.equal(event.end,'2026-10-09T01:00:00.000Z');
 assert.equal(event.bookingType,'Gym Time');
 assert.equal(event.allDay,false);
 assert.deepEqual(event.issues,[]);
 assert.equal(event.needsReview,true);
});

test('OCR compact dates and wrapped date fields are recognizable',()=>{
 const text='Booking confirmed for Ark Grit @ Hougang 422\nBooking Time Start:\nFri,09Oct2026 06:00:00 +0800\nBooking Time End: Fri,09 Oct2026 09:00:00 +08:00\nType: Gym Time';
 const [event]=parseBookingEmails(text);
 assert.equal(event.start,'2026-10-08T22:00:00.000Z');
 assert.equal(event.end,'2026-10-09T01:00:00.000Z');
});

test('multiple confirmations produce separate stable IDs',()=>{
 const second=confirmation.replace(/09 Oct/g,'10 Oct');
 const events=parseBookingEmails(confirmation+'\n\n'+second);
 assert.equal(events.length,2);
 assert.notEqual(events[0].id,events[1].id);
 assert.equal(events[0].id,parseBookingEmails(confirmation)[0].id);
 assert.equal(bookingEventId({...events[0],title:'  ARK GRIT @ HOUGANG 422  '}),events[0].id);
});

test('unknown or incomplete dates stay blank instead of using today or local timezone',()=>{
 for(const start of ['09 Oct 2026 06:00:00','Today at 06:00 +08','31 Feb 2026 06:00:00 +08','09 Oct 2026 25:00:00 +08','09 Oct 2026 06:00:00 +25']){
  const [event]=parseBookingEmails(confirmation.replace('Fri, 09 Oct 2026 06:00:00 +08',start));
  assert.equal(event.start,null);
  assert.ok(event.issues.some(issue=>issue.includes('start')));
 }
 const [event]=parseBookingEmails('Booking confirmed for Example Gym\nType: Gym Time');
 assert.equal(event.start,null);assert.equal(event.end,null);
 assert.deepEqual(parseBookingEmails('A newsletter about working out today'),[]);
});

test('booking review rejects reversed and excessive durations',()=>{
 const [reversed]=parseBookingEmails(confirmation.replace('09:00:00','05:00:00'));
 assert.ok(reversed.issues.includes('End time must be after start time.'));
 const [long]=parseBookingEmails(confirmation.replace('End: Fri, 09 Oct','End: Mon, 12 Oct'));
 assert.ok(long.issues.some(issue=>issue.includes('48 hours')));
});

test('candidates exclude email contents, personal details, references, and access links',()=>{
 const [event]=parseBookingEmails(confirmation);
 const serialized=JSON.stringify(event);
 for(const sensitive of ['Example Person','+6500000000','fabricated-example-reference','example.invalid','Self-Service'])assert.equal(serialized.includes(sensitive),false);
 assert.deepEqual(Object.keys(event).sort(),['allDay','bookingType','end','id','issues','location','needsReview','source','start','title'].sort());
});

test('Singapore edit values retain timezone independently of host timezone',()=>{
 assert.equal(singaporeDateTime('2026-10-08T22:00:00.000Z'),'2026-10-09T06:00');
 assert.equal(parseSingaporeDateTime('2026-10-09T06:00'),'2026-10-08T22:00:00.000Z');
 assert.equal(singaporeDateTime('2026-10-08T22:00:35.000Z'),'2026-10-09T06:00:35');
 assert.equal(parseSingaporeDateTime('2026-10-09T06:00:35'),'2026-10-08T22:00:35.000Z');
 assert.equal(parseSingaporeDateTime('2026-02-31T06:00'),null);
 assert.equal(parseSingaporeDateTime(''),null);
});

test('past booking imports are reviewable but do not schedule reminders',()=>{
 const events=parseBookingEmails(confirmation);
 assert.equal(events.length,1);
 assert.deepEqual(dueReminders(events,Date.parse('2026-10-09T14:00:00+08:00'),30,new Set()),[]);
});
