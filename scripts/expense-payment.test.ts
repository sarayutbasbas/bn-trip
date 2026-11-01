import assert from 'node:assert/strict';
import test from 'node:test';
import {bangkokDate} from '../src/lib/accommodation-payment';
import {isExpenseUnpaid} from '../src/lib/expense-payment';
import {expenseSettlement, type SettlementExpense} from '../src/lib/expense-settlement';
import {personalExpenseTotals} from '../src/lib/personal-expenses';

const booking:SettlementExpense={value:1000,category:'ที่พัก',splitMemberIds:['a','b'],splitGuestIds:[],paidBy:{type:'member',id:'b'},accommodationPaymentDate:'2026-11-10',accommodationPaymentStatus:'paid'};
const allocation={'member:a':10000,'member:b':0};
test('future booking is scheduled, not paid, unsettled or missing information',()=>{
 const result=expenseSettlement([booking],['a','b'],[],allocation,[],'2026-11-09');
 assert.equal(result.scheduledCount,1);assert.equal(result.scheduledAmount,100000);
 assert.equal(result.pendingCount,0);
 assert.deepEqual(result.rows.get('member:a'),{paid:0,share:0,balance:0});
 assert.deepEqual(result.rows.get('member:b'),{paid:0,share:0,balance:0});
 assert.deepEqual(personalExpenseTotals([booking],'a',2,'2026-11-09'),{travelExpense:0,shoppingExpense:0});
});
test('due date starts paid settlement automatically, date overrides stale legacy status',()=>{
 const result=expenseSettlement([{...booking,accommodationPaymentStatus:'pending'}],['a','b'],[],allocation,[],'2026-11-10');
 assert.equal(result.scheduledCount,0);
 assert.deepEqual(result.rows.get('member:a'),{paid:0,share:100000,balance:-100000});
 assert.deepEqual(result.rows.get('member:b'),{paid:100000,share:0,balance:100000});
 assert.deepEqual(personalExpenseTotals([booking],'a',2,'2026-11-10'),{travelExpense:500,shoppingExpense:0});
});
test('legacy pending stays unpaid; unknown/paid bookings and ordinary expenses retain existing behavior',()=>{
 assert(isExpenseUnpaid({accommodationPaymentStatus:'pending'},'2026-11-09'));
 assert(!isExpenseUnpaid({accommodationPaymentStatus:'paid'},'2026-11-09'));
 assert(!isExpenseUnpaid({},'2026-11-09'));
 const regular={...booking,accommodationPaymentDate:undefined,accommodationPaymentStatus:undefined};
 const result=expenseSettlement([regular],['a','b'],[],allocation,[],'2026-11-09');
 assert.equal(result.rows.get('member:b')?.paid,100000);
});
test('Thai midnight transitions payment while UTC is still the preceding date',()=>{
 const before=bangkokDate(new Date('2026-11-09T16:59:59Z'));
 const after=bangkokDate(new Date('2026-11-09T17:00:00Z'));
 assert(isExpenseUnpaid(booking,before));assert(!isExpenseUnpaid(booking,after));
});
