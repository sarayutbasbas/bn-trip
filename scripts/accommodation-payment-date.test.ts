import assert from 'node:assert/strict';
import { bangkokDate, accommodationPaymentStatus } from '../src/lib/accommodation-payment';
assert.equal(bangkokDate(new Date('2026-10-09T16:59:59Z')), '2026-10-09');
assert.equal(bangkokDate(new Date('2026-10-09T17:00:00Z')), '2026-10-10');
assert.equal(accommodationPaymentStatus('2026-10-10',null,'2026-10-09'),'pending');
assert.equal(accommodationPaymentStatus('2026-10-10',null,'2026-10-10'),'paid');
assert.equal(accommodationPaymentStatus('2026-10-09',null,'2026-10-10'),'paid');
assert.equal(accommodationPaymentStatus(null,'pending','2026-10-10'),'pending');
console.log('PASS Bangkok midnight, future/today/past dates and legacy status');
