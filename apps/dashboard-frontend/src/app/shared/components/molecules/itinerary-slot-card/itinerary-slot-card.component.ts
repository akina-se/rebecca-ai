import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CampaignSlot, SlotTimePeriod } from '@rebecca/types';
import { TranslatePipe } from '../../../pipes/translate.pipe';

/**
 * ItinerarySlotCardComponent (<app-itinerary-slot-card>)
 *
 * Atomic UI molecule component representing an individual scheduled narrative campaign slot.
 * Complies with strict Glassmorphism theme, zero emojis (Material Icons only), and enterprise UX.
 */
@Component({
  selector: 'app-itinerary-slot-card',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './itinerary-slot-card.component.html',
  styleUrls: ['./itinerary-slot-card.component.css'],
})
export class ItinerarySlotCardComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  /** The slot data model. */
  @Input({ required: true }) slot!: CampaignSlot;

  /** Whether the slot is editable or read-only (e.g. after being posted). */
  @Input() isReadonly = false;

  /** Optional parent campaign ID for asset context. */
  @Input() campaignId?: string;

  /** Emits when slot attributes are updated. */
  @Output() slotChange = new EventEmitter<CampaignSlot>();

  /** Emits when an image file is selected for upload. */
  @Output() uploadMedia = new EventEmitter<{ slot: CampaignSlot; file: File }>();

  /** Local state indicating an in-progress asset upload for this slot. */
  isUploading = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['slot']) {
      this.isUploading = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Resolves the appropriate Material Icon for a given slot time period.
   *
   * @param period - The slot time period.
   * @returns Material Icon ligature name.
   */
  getTimePeriodIcon(period: SlotTimePeriod): string {
    switch (period) {
      case 'morning':
        return 'light_mode';
      case 'afternoon':
        return 'wb_sunny';
      case 'evening':
        return 'nights_stay';
      case 'night':
        return 'bedtime';
      default:
        return 'schedule';
    }
  }

  /**
   * Formats scheduled time string (ISO 8601) to HH:mm for clean display.
   *
   * @param isoString - Scheduled time ISO string.
   * @returns Formatted HH:mm string or raw string.
   */
  formatTimeDisplay(isoString: string): string {
    if (!isoString) return '--:--';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      return `${hours}:${minutes} UTC`;
    } catch {
      return isoString;
    }
  }

  /**
   * Toggles whether the slot uses AI generation or fixed authored text.
   *
   * @param fixed - True for fixed text, false for AI generation.
   */
  setFixedTextMode(fixed: boolean): void {
    if (this.isReadonly) return;
    this.slot.isFixedText = fixed;
    this.notifyChange();
    this.cdr.markForCheck();
  }

  /**
   * Removes attached illustration media from this slot.
   */
  removeMedia(): void {
    if (this.isReadonly) return;
    this.slot.mediaUrl = undefined;
    this.slot.textOnly = true;
    this.notifyChange();
    this.cdr.markForCheck();
  }

  /**
   * Toggles slot skip status between pending and skipped.
   */
  toggleSkip(): void {
    if (this.isReadonly || this.slot.status === 'posted') return;
    this.slot.status = this.slot.status === 'skipped' ? 'pending' : 'skipped';
    this.notifyChange();
    this.cdr.markForCheck();
  }

  /**
   * Handles native file input change event for isolated campaign illustration upload.
   *
   * @param event - DOM file input change event.
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.uploadMedia.emit({ slot: this.slot, file });
      // Reset input value so the same file can be re-selected if needed
      input.value = '';
    }
  }

  /**
   * Emits slotChange event on attribute change.
   */
  notifyChange(): void {
    this.slotChange.emit({ ...this.slot });
  }
}
