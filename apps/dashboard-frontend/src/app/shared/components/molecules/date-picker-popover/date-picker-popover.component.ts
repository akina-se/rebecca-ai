import { Component, Input, Output, EventEmitter, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';

/**
 * DatePickerPopoverComponent
 *
 * A molecule-level navigation control that renders a labelled date display
 * (e.g. "July 2026") with prev/next arrow buttons and a click-triggered
 * popover list for direct month/year selection.
 *
 * The popover uses `position: fixed` to escape any `overflow: hidden` parent
 * containers in the dashboard leaderboard panels. Its viewport coordinates are
 * calculated dynamically from the host element's bounding rect on each open.
 */
@Component({
  selector: 'app-date-picker-popover',
  standalone: true,
  imports: [CommonModule, NgStyle],
  templateUrl: './date-picker-popover.component.html',
  styleUrls: ['./date-picker-popover.component.css'],
})
export class DatePickerPopoverComponent {
  @Input() currentText: string = 'July 2026';
  @Input() mode: 'monthly' | 'yearly' | 'all-time' = 'monthly';
  @Input() hasNext: boolean = true;
  @Output() previous = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() pick = new EventEmitter<string>();

  isOpen = false;

  /** Fixed-position coordinates for the popover (computed on open). */
  popoverStyle: { [key: string]: string } = {};

  constructor(private eRef: ElementRef, private cdr: ChangeDetectorRef) {}

  /**
   * Toggles the popover open/closed.
   * Calculates fixed-position coords from the host element's bounding rect
   * so the popover always renders below the trigger even inside overflow:hidden
   * parent containers.
   */
  toggle(navEl: HTMLElement): void {
    if (this.mode === 'all-time') return;

    if (!this.isOpen) {
      const rect = navEl.getBoundingClientRect();
      const popoverWidth = 160;
      let left = rect.left + rect.width / 2 - popoverWidth / 2;

      // Clamp to viewport edges with 8px padding.
      left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8));

      this.popoverStyle = {
        position: 'fixed',
        top: `${rect.bottom + 8}px`,
        left: `${left}px`,
        width: `${popoverWidth}px`,
        zIndex: '9999'
      };
    }

    this.isOpen = !this.isOpen;
    this.cdr.markForCheck();
  }

  onPrev(event: Event): void {
    event.stopPropagation();
    this.previous.emit();
  }

  onNext(event: Event): void {
    event.stopPropagation();
    if (this.hasNext) this.next.emit();
  }

  select(val: string, event: Event): void {
    event.stopPropagation();
    this.pick.emit(val);
    this.isOpen = false;
  }

  /** Returns the available options for the current mode. */
  get mockOptions(): string[] {
    if (this.mode === 'yearly') return ['2024', '2025', '2026'];
    return ['May 2026', 'June 2026', 'July 2026'];
  }

  /** Closes the popover when a click occurs outside the host element. */
  @HostListener('document:click', ['$event'])
  clickout(event: Event): void {
    if (!this.eRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }
}
