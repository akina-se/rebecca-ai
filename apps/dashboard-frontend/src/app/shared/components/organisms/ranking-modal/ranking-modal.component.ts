import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaginationComponent } from '../../molecules/pagination/pagination.component';
import { TranslatePipe } from '../../../pipes/translate.pipe';

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
  imports: [CommonModule, PaginationComponent, TranslatePipe],
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
  @Output() modalClose = new EventEmitter<void>();
  /** Emitted when a row is clicked. */
  @Output() rowClick = new EventEmitter<string>();

  @Input() currentPage = 1;
  @Input() totalPages = 1;
  @Input() totalItems = 0;
  @Input() pageSize = 10;
  @Input() entries: RankingEntry[] = [];
  @Output() pageChange = new EventEmitter<number>();

  get pagedEntries(): RankingEntry[] {
    // If entries length exceeds pageSize (legacy client-side usage in some tests), slice it; otherwise render current page entries directly
    if (this.entries.length > this.pageSize) {
      const start = (this.currentPage - 1) * this.pageSize;
      return this.entries.slice(start, start + this.pageSize);
    }
    return this.entries;
  }

  get computedTotalPages(): number {
    if (this.totalPages && this.totalPages > 1) {
      return this.totalPages;
    }
    if (this.totalItems && this.totalItems > 0) {
      return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
    }
    return Math.max(1, Math.ceil(this.entries.length / this.pageSize));
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.computedTotalPages) {
      this.currentPage = page;
      this.pageChange.emit(page);
    }
  }

  onClose(): void {
    this.modalClose.emit();
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
