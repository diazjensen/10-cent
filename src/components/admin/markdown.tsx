import type { ReactNode } from "react";

/**
 * Renders the CMS's simple markdown: "## " / "### " headings, blank-line paragraphs,
 * "- " bullet lists, **bold** and [links](/path). No raw HTML is ever injected.
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length} className="my-3 leading-relaxed">{inline(para.join(" "))}</p>);
    para = [];
  };
  const flushList = () => {
    if (list.length) blocks.push(<ul key={blocks.length} className="my-3 pl-5 list-disc space-y-1">{list.map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>);
    list = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) { flushPara(); flushList(); blocks.push(<h3 key={blocks.length} className="mt-5 mb-1.5 text-lg font-semibold">{inline(line.replace(/^###\s+/, ""))}</h3>); continue; }
    if (/^##\s+/.test(line)) { flushPara(); flushList(); blocks.push(<h2 key={blocks.length} className="mt-6 mb-2 font-display text-2xl">{inline(line.replace(/^##\s+/, ""))}</h2>); continue; }
    if (/^[-*]\s+/.test(line)) { flushPara(); list.push(line.replace(/^[-*]\s+/, "")); continue; }
    if (!line.trim()) { flushPara(); flushList(); continue; }
    flushList();
    para.push(line.trim());
  }
  flushPara(); flushList();
  return <div className={className}>{blocks}</div>;
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={k++}>{m[1]}</strong>);
    else {
      const href = m[3];
      const safe = /^(\/|https?:\/\/|mailto:)/.test(href) ? href : "#";
      out.push(<a key={k++} href={safe} className="underline underline-offset-2 text-accent-ink" {...(safe.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{m[2]}</a>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
