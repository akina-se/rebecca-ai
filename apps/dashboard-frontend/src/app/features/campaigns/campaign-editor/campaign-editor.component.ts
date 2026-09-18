import { Component, OnInit, inject, signal } from '@angular/core';
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
import { ItinerarySlotCardComponent } from '../../../shared/components/molecules/itinerary-slot-card/itinerary-slot-card.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

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

  campaignId: string | null = null;
  readonly isEditMode = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);

  // Form Fields
  title = '';
  description = '';
  startDate = '';
  endDate = '';
  dailySlotTimesText = '08:00, 12:00, 19:00';
  masterContext = '';
  replyContextSummary = '';
  status: CampaignStatus = 'draft';
  isAnnualRecurring = false;
  isPaused = false;
  slots: CampaignSlot[] = [];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.campaignId = id;
      this.isEditMode.set(true);
      this.loadCampaign(id);
    } else {
      // Default to 3 days starting next week
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const after3Days = new Date(nextWeek);
      after3Days.setDate(after3Days.getDate() + 2);

      this.startDate = nextWeek.toISOString().slice(0, 10);
      this.endDate = after3Days.toISOString().slice(0, 10);
      this.autoGenerateSlots();
    }
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
        this.startDate = campaign.startDate;
        this.endDate = campaign.endDate;
        this.dailySlotTimesText = campaign.dailySlotTimes.join(', ');
        this.masterContext = campaign.masterContext;
        this.replyContextSummary = campaign.replyContextSummary;
        this.status = campaign.status;
        this.isAnnualRecurring = campaign.isAnnualRecurring;
        this.isPaused = campaign.isPaused;
        this.slots = campaign.slots;
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('[CampaignEditor] Failed to load campaign:', err);
        this.toastService.show('Failed to load campaign', 'error');
        this.isLoading.set(false);
        this.router.navigate(['/campaigns']);
      },
    });
  }

  /**
   * Parses comma-separated daily slot times text into a normalized array of HH:mm strings.
   */
  get parsedSlotTimes(): string[] {
    return this.dailySlotTimesText
      .split(',')
      .map((t) => t.trim())
      .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
      .map((t) => (t.length === 4 ? `0${t}` : t));
  }

  /**
   * Auto-generates slot entries for the specified date range and times.
   */
  autoGenerateSlots(): void {
    if (!this.startDate || !this.endDate || this.startDate > this.endDate) {
      this.toastService.show('Invalid start or end date', 'warning');
      return;
    }

    const times = this.parsedSlotTimes;
    if (times.length === 0) {
      this.toastService.show('Please provide valid daily slot times (e.g. 08:00, 12:00, 19:00)', 'warning');
      return;
    }
    const generated: CampaignSlot[] = [];

    const start = new Date(`${this.startDate}T00:00:00Z`);
    const end = new Date(`${this.endDate}T00:00:00Z`);
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;

    for (let day = 1; day <= totalDays; day++) {
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
            textOnly: true,
          });
        }
      }
    }

    this.slots = generated;
  }

  /**
   * Maps 24-hour value to SlotTimePeriod.
   */
  private mapHourToPeriod(hour: number): SlotTimePeriod {
    if (hour >= 5 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Updates an individual slot when changed by ItinerarySlotCardComponent.
   */
  onSlotChange(updatedSlot: CampaignSlot): void {
    const idx = this.slots.findIndex((s) => s.slotId === updatedSlot.slotId);
    if (idx !== -1) {
      this.slots[idx] = updatedSlot;
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
        event.slot.textOnly = false;
        this.onSlotChange(event.slot);
        this.toastService.show('Illustration uploaded', 'success');
      },
      error: (err) => {
        console.error('[CampaignEditor] Upload failed:', err);
        this.toastService.show('Failed to upload image', 'error');
      },
    });
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

    const payload: CreateCampaignRequest = {
      title: trimmedTitle,
      description: this.description.trim(),
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
   * Cancels editing and returns to list view.
   */
  cancel(): void {
    this.router.navigate(['/campaigns']);
  }
}
