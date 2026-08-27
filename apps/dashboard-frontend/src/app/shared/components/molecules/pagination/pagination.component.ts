import { Component, Input, Output, EventEmitter } from '@angular/core';

import { TranslatePipe } from '../../../pipes/translate.pipe';

/**
 * PaginationComponent (<app-pagination>)
 * 
 * Reusable, atomic pagination molecule adhering to Angular 17+ standalone component patterns.
 * Supports numeric pages, smart ellipsis windowing, prev/next buttons, and loading states.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.css'],
})
export class PaginationComponent {
  /** The currently active page number (1-indexed). */
  @Input() currentPage = 1;

  /** Total number of available pages. */
  @Input() totalPages = 1;

  /** Optional total count of items across all pages. */
  @Input() totalItems?: number;

  /** Label describing the items (e.g. 'posts', 'users', 'records'). */
  @Input() itemsLabel = 'posts';

  /** Indicates whether an asynchronous page load is in progress. */
  @Input() isLoading = false;

  /** Controls whether to display the 'Page X / Y' info text. */
  @Input() showPageInfo = true;

  /** Controls whether to display the total items count text on the left. */
  @Input() showTotalCount = true;

  /** Emits when the user navigates to a new page. */
  @Output() pageChange = new EventEmitter<number>();

  /**
   * Computes the visible pagination sequence with smart windowing.
   */
  get pageNumbers(): (number | string)[] {
    const total = this.totalPages;
    const current = this.currentPage;

    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 3) {
      return [1, 2, 3, 4, total];
    }
    if (current >= total - 2) {
      return [1, total - 3, total - 2, total - 1, total];
    }
    return [1, current - 1, current, current + 1, total];
  }

  /**
   * Navigates to the selected page number.
   * 
   * @param page - Target page number or ellipsis marker.
   */
  goToPage(page: number | string): void {
    if (typeof page === 'string' || this.isLoading) return;
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.pageChange.emit(page);
    }
  }

  /**
   * Navigates to the previous page.
   */
  onPrevious(): void {
    if (this.currentPage > 1 && !this.isLoading) {
      this.pageChange.emit(this.currentPage - 1);
    }
  }

  /**
   * Navigates to the next page.
   */
  onNext(): void {
    if (this.currentPage < this.totalPages && !this.isLoading) {
      this.pageChange.emit(this.currentPage + 1);
    }
  }
}
