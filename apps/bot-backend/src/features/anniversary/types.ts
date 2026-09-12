export interface AnniversaryItem {
  name: string;
  description: string;
}

export interface IAnniversaryProvider {
  getAnniversaries(date: Date, timezone?: string): Promise<AnniversaryItem[]>;
}

export interface AnniversaryResult {
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
  post?: string;
  attachedMedia?: boolean;
  anniversaryTitle?: string;
}
