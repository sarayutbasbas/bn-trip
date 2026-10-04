"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { packExpenseTags } from "@/src/lib/pack-expense-tags";

type Tag = { id?: string; key: string; value: number };
const currency = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function TimelineExpenseTags({ costs, onOpen }: { costs: Tag[]; onOpen: (index: number) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const measurements = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ signature: string; rows: number[][] } | null>(null);
  const signature = JSON.stringify(costs.map(cost => [cost.id, cost.key, cost.value]));
  const rows = layout?.signature === signature ? layout.rows : [costs.map((_, index) => index)];

  useLayoutEffect(() => {
    const element = container.current, measure = measurements.current;
    if (!element || !measure) return;
    let disposed = false;
    const update = () => {
      if (disposed) return;
      const width = element.getBoundingClientRect().width;
      if (!width) return;
      const widths = Array.from(measure.children, child => child.getBoundingClientRect().width);
      const next = packExpenseTags(widths, width, 5);
      setLayout(previous => previous?.signature === signature && JSON.stringify(previous.rows) === JSON.stringify(next) ? previous : { signature, rows: next });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    Array.from(measure.children).forEach(child => observer.observe(child));
    void document.fonts.ready.then(update);
    return () => { disposed = true; observer.disconnect(); };
  }, [signature]);

  const content = (cost: Tag) => <><span className="timeline-expense-tag-name">{cost.key || "ค่าใช้จ่าย"}</span><span className="timeline-expense-tag-amount">฿{currency.format(cost.value)}</span></>;
  return <div ref={container} className="timeline-expense-tags">
    <div ref={measurements} className="timeline-expense-tag-measure" aria-hidden="true" inert>
      {costs.map((cost, index) => <span key={cost.id || index} className="timeline-expense-tag">{content(cost)}</span>)}
    </div>
    {rows.map((row, rowIndex) => <div className="timeline-expense-tag-row" key={rowIndex}>
      {row.map(index => <button type="button" className="timeline-expense-tag" key={costs[index].id || index}
        title={`${costs[index].key} · ฿${currency.format(costs[index].value)}`}
        aria-label={`เปิดค่าใช้จ่าย ${costs[index].key} ฿${currency.format(costs[index].value)}`}
        onClick={event => { event.stopPropagation(); onOpen(index); }}>
        {content(costs[index])}
      </button>)}
    </div>)}
  </div>;
}
