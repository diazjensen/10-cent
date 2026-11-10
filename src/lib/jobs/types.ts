export type JobResult = {
  job: string;
  ok: boolean;
  startedAt: string;
  ms: number;
  summary: string;
  counts: Record<string, number>;
  details: string[];
  error?: string;
};

export type JobOptions = {
  /** Ignore per-item frequency windows (used by "Run now" in the admin panel). */
  force?: boolean;
  /** Override "now" for testing. */
  now?: Date;
};
