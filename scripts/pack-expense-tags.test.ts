import assert from 'node:assert/strict';
import { packExpenseTags } from '../src/lib/pack-expense-tags.ts';

assert.deepEqual(packExpenseTags([125, 110, 60, 70], 200), [[0, 3], [1, 2]]);
assert.deepEqual(packExpenseTags([], 200), []);
assert.deepEqual(packExpenseTags([400, 20], 200), [[0], [1]]);
assert.deepEqual(packExpenseTags([50, 50, 50], 105), [[0, 1], [2]]);
for (const width of [100, 200, 320, 500]) {
  const sizes = [125, 110, 60, 70, 400, 0, 32];
  const rows = packExpenseTags(sizes, width);
  assert.deepEqual(rows.flat().sort((a, b) => a - b), sizes.map((_, i) => i));
  for (const row of rows) assert(row.reduce((sum, index) => sum + Math.min(width, sizes[index]), 0) + (row.length - 1) * 5 <= width);
}
console.log('PASS expense tag packing, stable indices, long/short pairs and constrained widths');
