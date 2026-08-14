import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

/** A single entry in the leaderboard. */
export interface RankingEntry {
  id?: string;
  rank: number;
  label: string;
  value: number | string;
  badge?: string;
}

/**
 * RankingModalComponent
 *
 * Full-screen modal dialog that displays a paginated leaderboard table.
 * Follows the ISSUEs spec: triggered by "View Full Ranking" in the
 * Top Posts / Top Users leaderboard blocks on the dashboard.
 */
@Component({
  selector: 'app-ranking-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ranking-modal.component.html',
  styleUrls: ['./ranking-modal.component.css'],
})
export class RankingModalComponent {
  /** Controls visibility. */
  @Input() isOpen = false;
  /** Title shown in the modal header (e.g. "Top Posts by Impressions"). */
  @Input() title = 'Full Ranking';
  /** Column header for the identifier column. */
  @Input() colLabel = 'Post';
  /** Column header for the metric column. */
  @Input() colMetric = 'Impressions';
  /** Emitted when the modal requests to close. */
  @Output() close = new EventEmitter<void>();
  /** Emitted when a row is clicked. */
  @Output() rowClick = new EventEmitter<string>();

  currentPage = 1;
  readonly pageSize = 10;

  @Input() entries: RankingEntry[] = [];

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.entries.length / this.pageSize));
  }

  get pagedEntries(): RankingEntry[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.entries.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onClose(): void {
    this.currentPage = 1;
    this.close.emit();
  }

  onRowClick(entry: RankingEntry): void {
    if ((window.getSelection()?.toString() || '').trim().length > 0) return;
    if (entry.id) {
      this.rowClick.emit(entry.id);
      this.onClose();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.onClose();
    }
  }
}
