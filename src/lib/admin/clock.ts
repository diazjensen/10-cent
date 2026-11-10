/** Current time in ms. Admin pages render dynamically per request, so reading the clock during render is intended. */
export const nowMs = () => Date.now();
