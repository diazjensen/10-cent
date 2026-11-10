"use client";

import type { ComponentProps } from "react";
import { Select } from "@/components/ui";

/** <select> that submits its form on change (progressive enhancement over a GET form with a submit button). */
export function AutoSelect(props: ComponentProps<"select">) {
  return <Select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
