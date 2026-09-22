import { Component, OnInit, inject, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CampaignDocWithId,
  CampaignSlot,
  CampaignStatus,
  SlotTimePeriod,
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from '@rebecca/types';
import { CAMPAIGNS_REPOSITORY } from '../../../core/ports/campaigns.repository';
import { ToastService } from '../../../shared/services/toast.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ItinerarySlotCardComponent } from '../../../shared/components/molecules/itinerary-slot-card/itinerary-slot-card.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

export interface DaySlotGroup {
  dayNumber: number;
  dateStr: string;
  slots: CampaignSlot[];
  postedCount: number;
  pendingCount: number;
  skippedCount: number;
}

export const STANDARD_SLOT_HOURS: string[] = ['08:00', '12:00', '19:00'];
export const MAX_CUSTOM_SLOT_HOURS = 8;
export const ALL_HOURLY_SLOTS: string[] = Array.from({ length: 24 }, (_, i) => {
  return `${String(i).padStart(2, '0')}:00`;
});

/**
 * CampaignEditorComponent
 *
 * Smart page component handling both creation (/campaigns/new) and editing (/campaigns/:id)
 * of episodic narrative campaigns and their timetable slot configurations.
 */
@Component({
  selector: 'app-campaign-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ItinerarySlotCardComponent, TranslatePipe],
  templateUrl: './campaign-editor.component.html',
  styleUrls: ['./campaign-editor.component.css'],
})
export class CampaignEditorComponent implements OnInit {
  private readonly repo = inject(CAMPAIGNS_REPOSITORY);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastService = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);

  campaignId: string | null = null;
  readonly isEditMode = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly isTogglingPause = signal<boolean>(false);
  readonly isDeleteModalOpen = signal<boolean>(false);
  readonly isDeleting = signal<boolean>(false);

  // Form Fields
  title = '';
  description = '';
  hashtag = '';
  startDate = '';
  endDate = '';
  dailySlotTimesText = '08:00, 12:00, 19:00';
  masterContext = '';
  replyContextSummary = '';
  status: CampaignStatus = 'draft';
  isAnnualRecurring = false;
  isPaused = false;
  slots: CampaignSlot[] = [];

  // Presets & Hourly Chips
  presetMode: 'standard' | 'custom' = 'standard';
  selectedCustomTimes: string[] = ['08:00', '12:00', '19:00'];
  readonly standardHours = STANDARD_SLOT_HOURS;
  readonly allHourlySlots = ALL_HOURLY_SLOTS;
  readonly maxCustomSlots = MAX_CUSTOM_SLOT_HOURS;

  // Day-level Accordion Open State
  openDays = new Set<number>();

  ngOnInit(): void {
    if (this.route.paramMap) {
      this.route.paramMap.subscribe((params) => {
        const id = params?.get ? params.get('id') : null;
        this.applyRouteId(id);
      });
    } else {
      const id = this.route.snapshot?.paramMap?.get('id');
      this.applyRouteId(id);
    }
  }

  private applyRouteId(id: string | null | undefined): void {
    if (id && id !== 'new') {
      this.campaignId = id;
      this.isEditMode.set(true);
      this.loadCampaign(id);
    } else {
      this.campaignId = null;
      this.isEditMode.set(false);
      this.initNewCampaignDefaults();
    }
  }

  /**
   * Sets sensible default dates and initial preset for new campaign creation.
   */
  initNewCampaignDefaults(): void {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const after3Days = new Date(nextWeek);
    after3Days.setDate(after3Days.getDate() + 2);

    this.title = '';
    this.description = '';
    this.hashtag = '';
    this.startDate = nextWeek.toISOString().slice(0, 10);
    this.endDate = after3Days.toISOString().slice(0, 10);
    this.presetMode = 'standard';
    this.selectedCustomTimes = [...this.standardHours];
    this.autoGenerateSlots(false);
  }

  /**
   * Loads existing campaign data for editing.
   */
  loadCampaign(id: string): void {
    this.isLoading.set(true);
    this.repo.getById(id).subscribe({
      next: (campaign: CampaignDocWithId) => {
        this.title = campaign.title;
        this.description = campaign.description ?? '';
        this.hashtag = campaign.hashtag ?? '';
        this.startDate = campaign.startDate;
        this.endDate = campaign.endDate;
        this.dailySlotTimesText = campaign.dailySlotTimes.join(', ');

        // Detect if loaded campaign matches standard 3-slot preset
        const isStandard =
          campaign.dailySlotTimes.length === 3 &&
          campaign.dailySlotTimes[0] === '08:00' &&
          campaign.dailySlotTimes[1] === '12:00' &&
          campaign.dailySlotTimes[2] === '19:00';

        this.presetMode = isStandard ? 'standard' : 'custom';
        this.selectedCustomTimes =
          campaign.dailySlotTimes.length > 0
            ? [...campaign.dailySlotTimes]
            : [...this.standardHours];

        this.masterContext = campaign.masterContext;
        this.replyContextSummary = campaign.replyContextSummary;
        this.status = campaign.status;
        this.isAnnualRecurring = campaign.isAnnualRecurring;
        this.isPaused = campaign.isPaused;
        this.slots = campaign.slots;

        // Open all days by default for loaded campaign
        for (const slot of campaign.slots) {
          this.openDays.add(slot.dayNumber);
        }

        this.isLoading.set(false);
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[CampaignEditor] Failed to load campaign:', err);
        this.toastService.show('Failed to load campaign', 'error');
        this.isLoading.set(false);
        this.cdr.markForCheck();
        this.router.navigate(['/campaigns']);
      },
    });
  }

  /**
   * Returns active daily slot times based on preset mode.
   */
  get parsedSlotTimes(): string[] {
    if (this.presetMode === 'standard') {
      return this.standardHours;
    }
    return [...this.selectedCustomTimes].sort();
  }

  /**
   * Switches schedule preset mode (standard vs custom hourly chips).
   */
  setPresetMode(mode: 'standard' | 'custom'): void {
    if (this.presetMode === mode) return;
    this.presetMode = mode;
    if (mode === 'standard') {
      this.selectedCustomTimes = [...this.standardHours];
    }
    this.autoGenerateSlots(false);
  }

  /**
   * Toggles an hour chip selection in custom mode.
   * Guarantees at least 1 slot is selected and prevents exceeding max limit (Anti-Spam Guard).
   */
  toggleHourChip(hour: string): void {
    if (this.presetMode !== 'custom') {
      this.presetMode = 'custom';
    }

    const idx = this.selectedCustomTimes.indexOf(hour);
    if (idx !== -1) {
      if (this.selectedCustomTimes.length <= 1) {
        this.toastService.show('At least one delivery slot is required', 'warning');
        return;
      }
      this.selectedCustomTimes.splice(idx, 1);
    } else {
      if (this.selectedCustomTimes.length >= this.maxCustomSlots) {
        this.toastService.show(
          `Daily limit (${this.maxCustomSlots} slots) reached to protect X API rate limits`,
          'warning',
        );
        return;
      }
      this.selectedCustomTimes.push(hour);
    }

    this.selectedCustomTimes.sort();
    this.autoGenerateSlots(false);
  }

  /**
   * Checks whether a specific hour is currently selected.
   */
  isHourSelected(hour: string): boolean {
    return this.parsedSlotTimes.includes(hour);
  }

  /**
   * Groups slots by dayNumber for the collapsible accordion UI.
   */
  get groupedSlots(): DaySlotGroup[] {
    const map = new Map<number, CampaignSlot[]>();
    for (const slot of this.slots) {
      const list = map.get(slot.dayNumber) || [];
      list.push(slot);
      map.set(slot.dayNumber, list);
    }

    const result: DaySlotGroup[] = [];
    for (const [dayNumber, daySlots] of map.entries()) {
      const dateStr = daySlots[0]?.scheduledTime ? daySlots[0].scheduledTime.slice(0, 10) : '';
      result.push({
        dayNumber,
        dateStr,
        slots: daySlots,
        postedCount: daySlots.filter((s) => s.status === 'posted').length,
        pendingCount: daySlots.filter((s) => s.status === 'pending').length,
        skippedCount: daySlots.filter((s) => s.status === 'skipped').length,
      });
    }

    return result.sort((a, b) => a.dayNumber - b.dayNumber);
  }

  /**
   * Accordion expand/collapse helpers.
   */
  isDayOpen(dayNumber: number): boolean {
    return this.openDays.has(dayNumber);
  }

  toggleDay(dayNumber: number): void {
    if (this.openDays.has(dayNumber)) {
      this.openDays.delete(dayNumber);
    } else {
      this.openDays.add(dayNumber);
    }
  }

  expandAllDays(): void {
    for (const group of this.groupedSlots) {
      this.openDays.add(group.dayNumber);
    }
  }

  collapseAllDays(): void {
    this.openDays.clear();
  }

  /**
   * Auto-generates slot entries for the specified date range and times.
   *
   * @param notifyOnValidationError - Whether to show a warning toast on validation failure.
   */
  autoGenerateSlots(notifyOnValidationError = false): void {
    if (!this.startDate || !this.endDate || this.startDate > this.endDate) {
      if (notifyOnValidationError) {
        this.toastService.show('Invalid start or end date', 'warning');
      }
      return;
    }

    const times = this.parsedSlotTimes;
    if (times.length === 0) {
      if (notifyOnValidationError) {
        this.toastService.show('Please provide valid daily slot times', 'warning');
      }
      return;
    }
    const generated: CampaignSlot[] = [];

    const start = new Date(`${this.startDate}T00:00:00Z`);
    const end = new Date(`${this.endDate}T00:00:00Z`);
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;

    for (let day = 1; day <= totalDays; day++) {
      this.openDays.add(day);
      const currentDayDate = new Date(start.getTime() + (day - 1) * dayMs);
      const dateStr = currentDayDate.toISOString().slice(0, 10);

      for (const timeStr of times) {
        const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
        const hour = isNaN(h) ? 8 : h;
        const timePeriod = this.mapHourToPeriod(hour);
        const scheduledTime = `${dateStr}T${String(hour).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:00Z`;
        const slotId = `slot-${day}-${String(hour).padStart(2, '0')}${String(m || 0).padStart(2, '0')}`;

        // Preserve existing slot settings if slotId matches
        const existing = this.slots.find((s) => s.slotId === slotId);
        if (existing) {
          generated.push({ ...existing, dayNumber: day, scheduledTime, timePeriod });
        } else {
          generated.push({
            slotId,
            dayNumber: day,
            timePeriod,
            scheduledTime,
            theme: `Day ${day} ${timePeriod.toUpperCase()}`,
            status: 'pending',
            isFixedText: false,
          });
        }
      }
    }

    this.slots = generated;
    this.cdr.markForCheck();

    if (notifyOnValidationError) {
      this.toastService.show(this.translation.translate('campaign.slots_regenerated_success'), 'info');
    }
  }

  /**
   * Maps 24-hour value to SlotTimePeriod.
   */
  private mapHourToPeriod(hour: number): SlotTimePeriod {
    if (hour >= 5 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 15) return 'afternoon';
    if (hour >= 15 && hour < 19) return 'evening';
    return 'night';
  }

  /**
   * Updates an individual slot when changed by ItinerarySlotCardComponent.
   */
  onSlotChange(updatedSlot: CampaignSlot): void {
    const idx = this.slots.findIndex((s) => s.slotId === updatedSlot.slotId);
    if (idx !== -1) {
      this.slots[idx] = updatedSlot;
      this.cdr.markForCheck();
    }
  }

  /**
   * Handles illustration file upload for an individual slot.
   */
  onUploadMedia(event: { slot: CampaignSlot; file: File }): void {
    const campaignId = this.campaignId;
    if (!campaignId) {
      this.toastService.show('Please save campaign before uploading images', 'warning');
      return;
    }

    this.toastService.show('Uploading illustration...', 'info');
    this.repo.uploadAsset(campaignId, event.file).subscribe({
      next: (res) => {
        event.slot.mediaUrl = res.url;
        this.onSlotChange(event.slot);
        this.toastService.show('Illustration uploaded', 'success');
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[CampaignEditor] Upload failed:', err);
        this.toastService.show('Failed to upload image', 'error');
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Handles illustration file deletion for an individual slot.
   */
  onDeleteMedia(event: { slot: CampaignSlot; filename: string }): void {
    const campaignId = this.campaignId;
    const filename = event.filename;

    event.slot.mediaUrl = undefined;
    this.onSlotChange(event.slot);

    if (campaignId && filename) {
      this.repo.deleteAsset(campaignId, filename).subscribe({
        next: () => {
          this.toastService.show('Illustration deleted', 'info');
        },
        error: (err) => {
          console.warn('[CampaignEditor] Failed to physically delete asset from GCS:', err);
        },
      });
    } else {
      this.toastService.show('Illustration deleted', 'info');
    }
  }

  /**
   * Sanitizes hashtag input to strip leading '#' and spaces, capped at 20 chars.
   */
  onHashtagInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input) return;
    let clean = input.value.replace(/^#+/, '').replace(/[\s#]+/g, '');
    if (clean.length > 20) {
      clean = clean.slice(0, 20);
    }
    this.hashtag = clean;
    input.value = clean;
  }

  /**
   * Saves the campaign document as draft or scheduled.
   */
  save(targetStatus: CampaignStatus): void {
    const trimmedTitle = this.title.trim();
    if (!trimmedTitle) {
      this.toastService.show('Title is required', 'warning');
      return;
    }

    if (!this.startDate || !this.endDate || this.startDate > this.endDate) {
      this.toastService.show('Valid start date and end date are required', 'warning');
      return;
    }

    if (this.parsedSlotTimes.length === 0) {
      this.toastService.show('At least one valid daily slot time (HH:mm) is required', 'warning');
      return;
    }

    if (targetStatus === 'scheduled' || targetStatus === 'active') {
      if (!this.masterContext.trim()) {
        this.toastService.show('Master context is required for scheduled campaigns', 'warning');
        return;
      }
      if (!this.replyContextSummary.trim()) {
        this.toastService.show('Reply context summary is required for scheduled campaigns', 'warning');
        return;
      }
    }

    this.isSaving.set(true);

    const cleanHashtag = this.hashtag.trim().replace(/^#+/, '');
    const payload: CreateCampaignRequest = {
      title: trimmedTitle,
      description: this.description.trim(),
      hashtag: cleanHashtag ? cleanHashtag : undefined,
      startDate: this.startDate,
      endDate: this.endDate,
      dailySlotTimes: this.parsedSlotTimes,
      masterContext: this.masterContext.trim(),
      replyContextSummary: this.replyContextSummary.trim(),
      status: targetStatus,
      isAnnualRecurring: this.isAnnualRecurring,
      isPaused: this.isPaused,
      slots: this.slots,
    };

    const updates: UpdateCampaignRequest = payload;
    const action$ = this.isEditMode() && this.campaignId
      ? this.repo.update(this.campaignId, updates)
      : this.repo.create(payload);

    action$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toastService.show('Campaign saved successfully', 'success');
        this.router.navigate(['/campaigns']);
      },
      error: (err) => {
        console.error('[CampaignEditor] Save failed:', err);
        const msg = err.error?.error || 'Failed to save campaign';
        this.toastService.show(msg, 'error');
        this.isSaving.set(false);
      },
    });
  }

  /**
   * Step 1 Progressive Disclosure:
   * Creates a draft campaign with basic information & schedule,
   * then transitions directly to the detailed campaign editor.
   */
  createDraftAndProceed(): void {
    const trimmedTitle = this.title.trim();
    if (!trimmedTitle) {
      this.toastService.show('Title is required', 'warning');
      return;
    }

    if (!this.startDate || !this.endDate || this.startDate > this.endDate) {
      this.toastService.show('Valid start date and end date are required', 'warning');
      return;
    }

    if (this.parsedSlotTimes.length === 0) {
      this.toastService.show('At least one delivery slot is required', 'warning');
      return;
    }

    this.autoGenerateSlots(false);
    this.isSaving.set(true);

    const cleanHashtag = this.hashtag.trim().replace(/^#+/, '');
    const payload: CreateCampaignRequest = {
      title: trimmedTitle,
      description: this.description.trim(),
      hashtag: cleanHashtag ? cleanHashtag : undefined,
      startDate: this.startDate,
      endDate: this.endDate,
      dailySlotTimes: this.parsedSlotTimes,
      masterContext: this.masterContext.trim(),
      replyContextSummary: this.replyContextSummary.trim(),
      status: 'draft',
      isAnnualRecurring: this.isAnnualRecurring,
      isPaused: false,
      slots: this.slots,
    };

    this.repo.create(payload).subscribe({
      next: (created: CampaignDocWithId) => {
        this.isSaving.set(false);
        this.toastService.show('Campaign draft created. Please configure detailed settings.', 'success');
        this.router.navigate(['/campaigns', created.id]);
      },
      error: (err) => {
        console.error('[CampaignEditor] Create draft failed:', err);
        const msg = err.error?.error || 'Failed to create campaign draft';
        this.toastService.show(msg, 'error');
        this.isSaving.set(false);
      },
    });
  }

  /**
   * Toggles emergency pause / resume for this campaign.
   */
  togglePause(): void {
    if (!this.campaignId) return;
    this.isTogglingPause.set(true);
    const action$ = this.isPaused
      ? this.repo.resume(this.campaignId)
      : this.repo.pause(this.campaignId);

    action$.subscribe({
      next: (updated: CampaignDocWithId) => {
        this.isPaused = updated.isPaused;
        this.isTogglingPause.set(false);
        const msg = updated.isPaused
          ? 'Campaign paused successfully'
          : 'Campaign resumed successfully';
        this.toastService.show(msg, 'success');
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[CampaignEditor] Toggle pause failed:', err);
        this.isTogglingPause.set(false);
        this.toastService.show('Failed to toggle pause status', 'error');
      },
    });
  }

  /**
   * Opens delete confirmation modal.
   */
  openDeleteModal(): void {
    this.isDeleteModalOpen.set(true);
  }

  /**
   * Closes delete modal.
   */
  closeDeleteModal(): void {
    this.isDeleteModalOpen.set(false);
  }

  /**
   * Confirms and permanently deletes this campaign.
   */
  confirmDelete(): void {
    if (!this.campaignId) return;
    this.isDeleting.set(true);
    this.repo.delete(this.campaignId).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.closeDeleteModal();
        this.toastService.show('Campaign deleted successfully', 'success');
        this.router.navigate(['/campaigns']);
      },
      error: (err) => {
        console.error('[CampaignEditor] Delete failed:', err);
        this.isDeleting.set(false);
        this.toastService.show('Failed to delete campaign', 'error');
      },
    });
  }

  /**
   * Cancels editing and returns to list view.
   */
  cancel(): void {
    this.router.navigate(['/campaigns']);
  }
}
