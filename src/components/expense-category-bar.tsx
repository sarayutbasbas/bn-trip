import { ChartNoAxesColumnIncreasing, RotateCcw } from "lucide-react";
import { expenseCategoryColor } from "@/src/lib/expense-category";

export function ExpenseCategoryBar({ categories, total, selectedCategory, onSelectedCategoryChange, t }: {
  categories: Array<[string, number]>; total: number; selectedCategory: string | null;
  onSelectedCategoryChange: (category: string | null) => void; t: (text: string) => string;
}) {
  if (!(total > 0)) return null;
  const segments = categories.map(([category, amount]) => ({ category, amount, percent: total > 0 ? amount / total * 100 : 0, color: expenseCategoryColor(category) }));
  const select = (category: string) => onSelectedCategoryChange(selectedCategory === category ? null : category);
  const money = (amount: number) => amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <section className="expense-category-summary">
    <div className="expense-category-heading"><h3><ChartNoAxesColumnIncreasing size={18} />{t("สัดส่วนค่าใช้จ่าย")}</h3><button type="button" disabled={selectedCategory === null} onClick={() => onSelectedCategoryChange(null)}><RotateCcw size={14} aria-hidden="true" />{t("รีเซ็ท")}</button></div>
    <div className="expense-category-bar" role="group" aria-label={t("สัดส่วนค่าใช้จ่ายตามประเภท")}>
      {segments.filter(segment => segment.percent > 0).map(segment => <button key={segment.category} type="button" className={selectedCategory === segment.category ? "active" : ""} style={{ width: segment.percent + "%", background: segment.color }} aria-pressed={selectedCategory === segment.category} aria-label={`${t(segment.category)} ${segment.percent.toFixed(1)}%`} title={`${t(segment.category)} · ฿${money(segment.amount)}`} onClick={() => select(segment.category)} />)}
    </div>
    {segments.length ? <div className="expense-category-legend">{segments.map(segment => <button key={segment.category} type="button" className={selectedCategory === segment.category ? "active" : ""} aria-pressed={selectedCategory === segment.category} onClick={() => select(segment.category)}>
      <i style={{ background: segment.color }} /><span><b>{t(segment.category)}</b><strong>฿{money(segment.amount)}</strong></span><small>{segment.percent.toFixed(1)}%</small>
    </button>)}</div> : <p className="expense-category-empty">{t("ยังไม่มีค่าใช้จ่าย")}</p>}
  </section>;
}
