/** Best-fit decreasing packing; returned indices always refer to the source data. */
export function packExpenseTags(widths: number[], available: number, gap = 5): number[][] {
  if (available <= 0) return [widths.map((_, index) => index)];
  const rows: { indices: number[]; used: number }[] = [];
  const tags = widths.map((width, index) => ({ width: Math.min(available, Math.max(0, width)), index }))
    .sort((a, b) => b.width - a.width || a.index - b.index);
  for (const tag of tags) {
    let best = -1;
    let remaining = Infinity;
    rows.forEach((row, index) => {
      const space = available - row.used - gap - tag.width;
      if (space >= 0 && space < remaining) { best = index; remaining = space; }
    });
    if (best < 0) rows.push({ indices: [tag.index], used: tag.width });
    else { rows[best].indices.push(tag.index); rows[best].used += gap + tag.width; }
  }
  return rows.map(row => row.indices);
}
