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

  /** Mock leaderboard data – replaced with real API data post-MVP. */
  readonly allEntries: RankingEntry[] = Array.from({ length: 30 }, (_, i) => ({
    id: i < 2 ? `p${i + 1}` : `mock_id_${i}`,
    rank: i + 1,
    label: i < 2
      ? ['今日は暑いね！水分補給しっかりしてね', '水星の魔女、最新話見た！展開が熱すぎる…'][i]
      : `サンプルポスト #${i + 1} — ダッシュボードモックデータ`,
    value: Math.floor(10000 / (i + 1)).toLocaleString(),
    badge: i < 3 ? ['1st', '2nd', '3rd'][i] : undefined,
  }));

  get totalPages(): number {
    return Math.ceil(this.allEntries.length / this.pageSize);
  }

  get pagedEntries(): RankingEntry[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.allEntries.slice(start, start + this.pageSize);
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
