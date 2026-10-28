import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url), modules={};
function load(file) {
 if(modules[file])return modules[file];
 const exports=modules[file]={};
 runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,document:{body:{}},require:id=>{
  if(id==='react-dom')return {...require(id),createPortal:child=>child};
  if(id==='./bottom-sheet')return {BottomSheet:props=>createElement('form',{'aria-label':'งบรายคน'},props.children,createElement('button',{disabled:props.submitDisabled},props.submitLabel))};
  if(id.startsWith('@/'))return load(id.replace('@/','')+'.ts');
  if(id==='./personal-expenses')return load('src/lib/personal-expenses.ts');
  return require(id);
 }});
 return exports;
}
const Sheet=load('src/components/budget-allocation-sheet.tsx').BudgetAllocationSheet;
const props={tripId:'test',people:[{key:'member:a',name:'A',avatar:null},{key:'guest:b',name:'B',avatar:null}],budget:30000,onClose(){},onSave(){}};
let html=renderToStaticMarkup(createElement(Sheet,props));
assert(html.includes('conic-gradient('));assert(html.includes('15,000')||html.includes('value="15000"'));
assert(html.includes('budget-allocation-popover'));assert(html.includes('งบของ A'));
assert(!html.includes('aria-label="สัดส่วนของ A"'));assert(html.includes('aria-label="งบของ A"'));assert(html.includes('inputMode="decimal"'));assert(html.includes('type="range"'));assert(html.includes('step="1"'));assert(html.includes('50.00%'));assert(html.includes('budget-allocation-layout'));assert(html.includes('บันทึกสัดส่วน'));
html=renderToStaticMarkup(createElement(Sheet,{...props,saved:{'member:a':10000,'guest:b':0}}));
assert(html.includes('value="30,000"'));assert(html.includes('value="0"'));assert(html.includes('กลับไปหารตามรายการ'));
html=renderToStaticMarkup(createElement(Sheet,{...props,saved:{'member:a':1234567,'guest:b':1765433}}));
assert(html.includes('value="12,345.67"'));assert(html.includes('41.15%'));
html=renderToStaticMarkup(createElement(Sheet,{...props,budget:0}));assert(html.includes('ยังไม่ได้ตั้งงบทริป'));
html=renderToStaticMarkup(createElement(Sheet,{...props,people:[props.people[0]]}));assert.equal(html,'');
const source=readFileSync('src/components/bn-trip-app.tsx','utf8');
assert(source.indexOf('className="trip-section-add budget-allocation-open"')<source.indexOf('aria-label={t(firstAvailableDay ? "เพิ่มค่าใช้จ่าย"'));
console.log('PASS single-member sheet hidden, amount popover, two-column sheet, amount-only inputs, hundredth-percent slider, decimal money restored and zero/reset states');
