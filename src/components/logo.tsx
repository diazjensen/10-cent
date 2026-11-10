import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="10cent home" className={`inline-flex items-baseline gap-[1px] leading-none ${className}`}>
      <span className="font-display text-[30px] tracking-[-0.02em] text-ink">10</span>
      <span className="font-display italic text-[30px] tracking-[-0.02em] text-ink">cent</span>
      <span className="ml-0.5 inline-block w-[7px] h-[7px] rounded-full bg-accent translate-y-[-2px]" aria-hidden />
    </Link>
  );
}
