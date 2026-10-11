import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/components/timeline-expense-tags.tsx', import.meta.url), 'utf8');
const formatter = source.match(/const currency = (new Intl.NumberFormat\([^;]+\));/);
assert(formatter, 'timeline tags define a shared currency formatter');
const currency = vm.runInNewContext(formatter[1]);
for (const [amount, expected] of [[87, '87'], [87.5, '87.5'], [87.25, '87.25'], [1000, '1,000'], [0, '0'], [12.345, '12.35']]) {
  assert.equal(currency.format(amount), expected);
}
assert.equal((source.match(/currency\.format\(/g) || []).length, 3, 'visible tags, tooltip and accessible label share formatting');
console.log('PASS whole amounts omit .00, fractional amounts and separators preserved');
