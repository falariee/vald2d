import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bmi,weeklySummary} from './metrics.js';
test('BMI uses centimeters and kilograms',()=>{assert.equal(bmi(80,200),20);assert.equal(bmi(80,0),null)});
test('weekly review includes Monday to Sunday and excludes adjacent weeks',()=>{const sessions=[{date:'2026-10-05',type:'Gym',minutes:45},{date:'2026-10-11',type:'Run',minutes:30,distance:5},{date:'2026-10-04',type:'Run',minutes:20,distance:3},{date:'2026-10-12',type:'Gym',minutes:60}];assert.deepEqual(weeklySummary(sessions,new Date('2026-10-09T12:00:00')),{count:2,minutes:75,distance:5,gym:1})});
