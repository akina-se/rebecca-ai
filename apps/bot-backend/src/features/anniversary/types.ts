export interface AnniversaryItem {
  name: string;
  description: string;
}

export interface IAnniversaryProvider {
  getAnniversaries(date: Date, timezone?: string): Promise<AnniversaryItem[]>;
}

import { ProactiveBatchResult } from '../../types';

export interface AnniversaryResult extends ProactiveBatchResult {
  anniversaryTitle?: string;
}
