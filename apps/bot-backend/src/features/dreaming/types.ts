export interface DreamingConfig {
  throttleMs?: number;
}

export interface DreamingExecutionResult {
  status: 'success' | 'partial_success' | 'failed' | 'skipped';
  reason?: string;
  totalUsers: number;
  processedUsers: number;
  succeeded: number;
  failed: number;
  skipped: number;
}
