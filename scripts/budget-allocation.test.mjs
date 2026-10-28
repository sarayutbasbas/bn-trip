import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const modules = {};
function load(name) {
 if(modules[name]) return modules[name];
 const exports = modules[name] = {};
 runInNewContext(ts.transpileModule(readFileSync(`src/lib/${name}.ts`,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports,require:path=>load(path.replace('./',''))});
 return exports;
}
const {expenseShares, distribute, effectiveAllocation, changeAllocation, formatBudgetAmount, budgetAmountSatang} = load('budget-allocation');
const {expenseSettlement} = load('expense-settlement');
const allocation = {'member:a':10000,'member:b':0,'guest:offline':0};
const cost = {value:10000,splitMemberIds:['a','b'],splitGuestIds:[],paidBy:{type:'member',id:'a'}};
let result = expenseSettlement([{...cost,value:8000},{...cost,value:2000,paidBy:{type:'member',id:'b'}}],['a','b'],['offline'],allocation,['offline']);
assert.equal(result.rows.get('member:a').balance,-200000);
assert.equal(result.rows.get('member:b').balance,200000);
assert.equal(result.rows.get('member:b').share,0);
const mixed = {...cost, value:700, splitGuestIds:['offline','g1','g2','g3','g4']};
const shares = expenseShares(mixed,['a','b'],['offline','g1','g2','g3','g4'],allocation,['offline']);
assert.equal(shares.get('member:a'),30000);
assert.equal(shares.get('guest:offline'),0);
assert.equal(shares.get('guest:g1'),10000);
assert.equal([...shares.values()].reduce((a,b)=>a+b,0),70000);
// Even a member-only selected item is allocated globally after opting in.
assert.equal(expenseShares({...cost,splitMemberIds:['b']},['a','b'],[],allocation).get('member:a'),1000000);
// No opt-in preserves the original per-item selection and equal division.
assert.equal(expenseShares({...cost,splitMemberIds:['b']},['a','b'],[],null).get('member:b'),1000000);
result=expenseSettlement([{...cost,paidBy:undefined}],['a','b'],[],allocation);
assert.equal(result.pendingCount,1);assert.equal(result.rows.get('member:a').share,0);
assert.equal(effectiveAllocation({'member:a':10000},['member:a','member:new'])['member:new'],0);
assert.equal(effectiveAllocation({'removed':10000},['member:a'])['member:a'],10000);
for(let n=1;n<=30;n++) {
 const keys=Array.from({length:n},(_,i)=>'member:'+i);
 let weights=effectiveAllocation(null,keys);
 for(let i=0;i<100;i++) {
  weights=changeAllocation(weights,keys[i%n],i*101);
  assert.equal(Object.values(weights).reduce((a,b)=>a+b,0),10000);
  assert(Object.values(weights).every(v=>Number.isInteger(v)&&v>=0));
  const amounts=distribute(10001,weights);
  assert.equal(Object.values(amounts).reduce((a,b)=>a+b,0),10001);
 }
}
const equal={'member:a':3334,'member:b':3333,'guest:offline':3333};
result=expenseSettlement([mixed,{...cost,value:0.01,paidBy:{type:'guest',id:'g1'}}],['a','b'],['offline','g1','g2','g3','g4'],equal,['offline']);
assert.equal([...result.rows.values()].reduce((sum,row)=>sum+row.balance,0),0);
// Editing money must keep satang, including a share smaller than 0.01%.
const total = 100000000;
const exact = changeAllocation(effectiveAllocation(null,['member:a','member:b'],total),'member:a',1234,total);
assert.equal(exact['member:a'],1234);
assert.equal(exact['member:b'],99998766);
assert.equal(effectiveAllocation(JSON.parse(JSON.stringify(exact)),['member:a','member:b'],total)['member:a'],1234);
assert.equal(expenseShares({...cost,value:1000000},['a','b'],[],exact).get('member:a'),1234);
assert.equal(changeAllocation(exact,'member:a',0,total)['member:a'],0);
assert.equal(formatBudgetAmount(''),'');
assert.equal(formatBudgetAmount('0'),'0');
assert.equal(formatBudgetAmount('0.'),'0.');
assert.equal(formatBudgetAmount('1234.50'),'1,234.50');
assert.equal(budgetAmountSatang(''),0);
assert.equal(budgetAmountSatang('1,234.50'),123450);
assert.equal(budgetAmountSatang('0.29'),29);
const precision = changeAllocation(effectiveAllocation(null,['member:a','member:b']), 'member:a',3333);
assert.equal(precision['member:a'],3333);assert.equal(precision['member:b'],6667);
console.log('PASS exact satang after save/reload, money deletion/zero/decimals, fractional percentages, sponsor/refund, guests, legacy and 3000 rounding cases');
