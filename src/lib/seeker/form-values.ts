/** Flattens FormData to strings (multi-value fields joined with commas). */
export function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of new Set(form.keys())) {
    if (k.startsWith("$ACTION")) continue;
    out[k] = form.getAll(k).map(String).join(",").slice(0, 2000);
  }
  return out;
}
