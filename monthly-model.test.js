import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validDay,streakSummary,monthGrid,bookingDateKey} from './monthly-model.js';
test('streaks deduplicate days, cross month boundaries, and ignore future entries',()=>{assert.deepEqual(streakSummary(['2026-09-29','2026-09-30','2026-10-01','2026-10-01','2026-10-03','2026-10-10'],'2026-10-03'),{current:1,longest:3,total:4})});
test('today can still be logged while the streak through yesterday stays active',()=>{assert.equal(streakSummary(['2026-10-07','2026-10-08'],'2026-10-09').current,2);assert.equal(streakSummary(['2026-10-07'],'2026-10-09').current,0)});
test('monthly overview starts Monday and handles leap days and empty weeks',()=>{const feb=monthGrid(2024,1);assert.equal(feb[0].date,'2024-01-29');assert.equal(feb.filter(day=>day.inMonth).length,29);assert.equal(feb.length%7,0);assert.equal(monthGrid(2026,1).filter(day=>day.inMonth).length,28)});
test('invalid dates never create logged days or streaks',()=>{assert.equal(validDay('2026-02-31'),false);assert.deepEqual(streakSummary(['bad','2026-02-31'],'2026-10-09'),{current:0,longest:0,total:0})});
test('bookings are assigned to their calendar date in the selected timezone',()=>{assert.equal(bookingDateKey('2026-10-08T22:00:00Z','Asia/Singapore'),'2026-10-09');assert.equal(bookingDateKey('invalid','Asia/Singapore'),null)});
