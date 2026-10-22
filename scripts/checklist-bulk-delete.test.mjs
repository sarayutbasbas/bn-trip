import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const exports={};
runInNewContext(ts.transpileModule(readFileSync('src/lib/delete-checklist-selection.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,fetch,AbortController,setTimeout,clearTimeout});
let running=0,max=0;const calls=[];
const result=await exports.deleteChecklistSelection(['a','b','c','d','e','a'],id=>id,async (id,options)=>{
  assert.equal(options.method,'DELETE');assert(options.signal);
  calls.push(id);max=Math.max(max,++running);await new Promise(resolve=>setTimeout(resolve,5));running--;
  if(id==='c')throw new Error('network');
  return {ok:id!=='b'};
});
assert.deepEqual([...result.deleted].sort(),['a','d','e']);
assert.deepEqual([...result.failed].sort(),['b','c']);
assert.equal(max,4);assert.equal(calls.length,5);
assert.equal((await exports.deleteChecklistSelection([],id=>id)).deleted.length,0);
running=0;max=0;calls.length=0;
const completed=await exports.completeChecklistSelection(['a','b','c','d','e','a'],id=>id,async (id,options)=>{
  assert.equal(options.method,'PATCH');assert(options.signal);assert.equal(options.headers['content-type'],'application/json');assert.deepEqual(JSON.parse(options.body),{completed:true});
  calls.push(id);max=Math.max(max,++running);await new Promise(resolve=>setTimeout(resolve,5));running--;
  if(id==='c')throw new Error('network');
  return {ok:id!=='b'};
});
assert.deepEqual([...completed.completed].sort(),['a','d','e']);
assert.deepEqual([...completed.failed].sort(),['b','c']);
assert.equal(max,4);assert.equal(calls.length,5);
console.log('PASS bounded delete/complete, deduplication, partial failures, network failures and empty selection');
