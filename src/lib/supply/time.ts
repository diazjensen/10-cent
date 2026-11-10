/** Wall-clock helper for server components (keeps render functions free of direct Date.now calls). */
export const nowMs = () => Date.now();
