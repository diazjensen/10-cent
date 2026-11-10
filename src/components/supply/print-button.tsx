"use client";

import { Printer } from "lucide-react";
import { btnClass } from "@/components/ui";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={btnClass("primary", "md")}>
      <Printer size={16} aria-hidden /> Print / save as PDF
    </button>
  );
}
