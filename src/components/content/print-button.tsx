"use client";

import { Printer } from "lucide-react";
import { btnClass } from "@/components/ui";

export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={btnClass("primary", "md", "print:hidden")}>
      <Printer size={16} aria-hidden /> {label}
    </button>
  );
}
