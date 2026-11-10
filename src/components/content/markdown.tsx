import type { ReactNode } from "react";
import Link from "next/link";
import { cx } from "@/components/ui";

/**
 * Minimal, safe renderer for the CMS's simple markdown: `## ` / `### ` headings, paragraphs,
 * `- ` lists, `1. ` lists, **bold**, *italic* and [text](url). It builds React elements (never raw HTML),
 * so any HTML in the body is rendered as escaped text. Only http(s), mailto, tel and site-relative links are allowed.
 */
export function Markdown({ body, className }: { body: string; className?: string }) {
  return <div className={cx("prose-tc", className)}>{renderBlocks(body)}</div>;
}

type Block = { kind: "h2" | "h3" | "p" | "ul" | "ol"; lines: string[] };

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  const flush = () => { if (cur) blocks.push(cur); cur = null; };
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^###\s+(.*)$/))) { flush(); blocks.push({ kind: "h3", lines: [m[1]] }); continue; }
    if ((m = line.match(/^##?\s+(.*)$/))) { flush(); blocks.push({ kind: "h2", lines: [m[1]] }); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      if (cur?.kind !== "ul") { flush(); cur = { kind: "ul", lines: [] }; }
      cur.lines.push(m[1]);
      continue;
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (cur?.kind !== "ol") { flush(); cur = { kind: "ol", lines: [] }; }
      cur.lines.push(m[1]);
      continue;
    }
    if (cur?.kind !== "p") { flush(); cur = { kind: "p", lines: [] }; }
    cur.lines.push(line.trim());
  }
  flush();
  return blocks;
}

function renderBlocks(body: string): ReactNode[] {
  return parseBlocks(body).map((b, i) => {
    switch (b.kind) {
      case "h2": return <h2 key={i} id={anchor(b.lines[0])}>{inline(b.lines[0])}</h2>;
      case "h3": return <h3 key={i} className="font-semibold text-lg mt-6 mb-2">{inline(b.lines[0])}</h3>;
      case "ul": return <ul key={i}>{b.lines.map((l, j) => <li key={j}>{inline(l)}</li>)}</ul>;
      case "ol": return <ol key={i} className="list-decimal pl-5 mb-4 text-ink-2">{b.lines.map((l, j) => <li key={j}>{inline(l)}</li>)}</ol>;
      default: return <p key={i}>{inline(b.lines.join(" "))}</p>;
    }
  });
}

export function anchor(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function headings(body: string) {
  return parseBlocks(body).filter((b) => b.kind === "h2").map((b) => ({ text: stripInline(b.lines[0]), id: anchor(b.lines[0]) }));
}

export function stripInline(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1");
}

function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^\/(?!\/)/.test(u) || u.startsWith("#")) return u;
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  return null;
}

const TOKEN = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*([^*]+)\*)/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    if (m[1]) out.push(<strong key={k++}>{inline(m[2])}</strong>);
    else if (m[3]) {
      const href = safeHref(m[5]);
      if (!href) out.push(m[4]);
      else if (href.startsWith("/") || href.startsWith("#")) out.push(<Link key={k++} href={href}>{m[4]}</Link>);
      else out.push(<a key={k++} href={href} target="_blank" rel="noopener noreferrer nofollow">{m[4]}</a>);
    } else if (m[6]) out.push(<em key={k++}>{m[7]}</em>);
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
