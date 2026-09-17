export interface SelfReflectionResult {
  status: 'success' | 'skipped' | 'failed';
  summary?: string;
  previousSummary?: string;
  reason?: string;
  postsCount?: number;
}
