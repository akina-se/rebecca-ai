import { Component, Input, Output, EventEmitter, inject, ChangeDetectorRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CampaignSlot, SlotTimePeriod } from '@rebecca/types';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { ConfigService } from '../../../../core/services/config.service';

/**
 * ItinerarySlotCardComponent (<app-itinerary-slot-card>)
 *
 * Component representing an individual scheduled narrative campaign slot.
 * Handles slot form controls, content editing, timing selection, and image attachments.
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
  private readonly configService = inject(ConfigService);

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

  /** Emits when illustration media is deleted from this slot. */
  @Output() deleteMedia = new EventEmitter<{ slot: CampaignSlot; filename: string }>();

  /** Emits when user clicks thumbnail to preview in full-size Lightbox. */
  @Output() previewMedia = new EventEmitter<string>();

  /** Local state indicating an in-progress asset upload for this slot. */
  isUploading = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['slot']) {
      this.isUploading = false;
      this.cdr.detectChanges();
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
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: this.configService.appTimezone(),
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
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
   * Computes proxy URL for optimized 400px thumbnail.
   */
  getThumbnailUrl(): string {
    if (!this.slot.mediaUrl) return '';
    const separator = this.slot.mediaUrl.includes('?') ? '&' : '?';
    return `${this.slot.mediaUrl}${separator}size=thumbnail`;
  }

  /**
   * Computes proxy URL for full-size media.
   */
  getFullImageUrl(): string {
    if (!this.slot.mediaUrl) return '';
    const separator = this.slot.mediaUrl.includes('?') ? '&' : '?';
    return `${this.slot.mediaUrl}${separator}size=full`;
  }

  /**
   * Opens full-size Lightbox modal.
   */
  openLightbox(): void {
    if (this.slot.mediaUrl) {
      this.previewMedia.emit(this.getFullImageUrl());
    }
  }

  /**
   * Calculates human-readable file size from bytes.
   *
   * @param bytes - Size in bytes.
   * @returns Formatted size string (e.g., "1.2 MB").
   */
  formatFileSize(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  /**
   * Removes current media attachment from the slot and notifies parent.
   */
  removeMedia(): void {
    if (this.isReadonly) return;
    const filename = this.getAssetFilename();
    this.slot.mediaUrl = undefined;
    this.deleteMedia.emit({ slot: this.slot, filename });
    this.notifyChange();
    this.cdr.detectChanges();
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
   * Resolves the asset filename from the media proxy URL.
   *
   * @returns Filename string or undefined if not parseable.
   */
  private getAssetFilename(): string {
    if (!this.slot.mediaUrl) return '';
    const cleanUrl = this.slot.mediaUrl.split('?')[0];
    const segments = cleanUrl.split('/');
    return segments[segments.length - 1] || '';
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
