import { formatDate } from "@/lib/format";
import { Stars } from "./review-form";

export type ReviewRow = { id: number; rating: number; body: string | null; created_at: string; name: string | null; user_id: number };

export function ReviewSummary({ reviews }: { reviews: ReviewRow[] }) {
  if (!reviews.length) return null;
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }));
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div>
        <div className="num text-4xl font-semibold tracking-tight">{avg.toFixed(1)}</div>
        <Stars value={avg} />
        <div className="text-xs text-muted mt-0.5">{reviews.length} review{reviews.length === 1 ? "" : "s"}</div>
      </div>
      <div className="flex-1 min-w-[180px] max-w-xs space-y-1">
        {dist.map((d) => (
          <div key={d.n} className="flex items-center gap-2 text-xs">
            <span className="w-3 num text-muted">{d.n}</span>
            <div className="flex-1 h-1.5 rounded-full bg-paper-2 overflow-hidden"><div className="h-full bg-accent" style={{ width: `${(d.c / reviews.length) * 100}%` }} /></div>
            <span className="w-5 num text-muted text-right">{d.c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReviewList({ reviews, meId }: { reviews: ReviewRow[]; meId?: number }) {
  if (!reviews.length) return <p className="text-sm text-muted">No reviews yet. Be the first to write one.</p>;
  return (
    <ul className="divide-y divide-line">
      {reviews.map((r) => (
        <li key={r.id} className="py-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-paper-2 grid place-items-center text-xs font-semibold text-ink-2" aria-hidden>{(r.name || "?").slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{r.name || "10cent user"}{meId === r.user_id && <span className="ml-2 text-[10px] uppercase tracking-wider text-accent-ink font-semibold">You</span>}</div>
              <div className="flex items-center gap-2 text-xs text-muted"><Stars value={r.rating} size={12} /> {formatDate(r.created_at)}</div>
            </div>
          </div>
          {r.body && <p className="mt-2 text-sm text-ink-2 leading-relaxed">{r.body}</p>}
        </li>
      ))}
    </ul>
  );
}

/** First name + last initial, so reviewers aren't fully identified. */
export function shortName(name: string | null) {
  if (!name) return null;
  const [f, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${f} ${rest[rest.length - 1][0]}.` : f;
}
