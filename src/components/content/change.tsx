import { cx } from "@/components/ui";

/** +4.2% / −1.1% figure in trust green or danger red. */
export function Change({ value, className }: { value: number | null; className?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className={cx("text-muted", className)}>—</span>;
  const up = value >= 0;
  return <span className={cx("num font-medium", up ? "text-trust" : "text-danger", className)}>{up ? "+" : "−"}{Math.abs(value).toFixed(1)}%</span>;
}
