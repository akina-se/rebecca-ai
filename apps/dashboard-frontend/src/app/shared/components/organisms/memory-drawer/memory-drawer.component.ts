import { Component, Input, inject, OnChanges, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../services/toast.service';
import { MEMORY_REPOSITORY } from '../../../../core/ports/memory.repository';
import { TranslatePipe } from '../../../pipes/translate.pipe';

@Component({
  selector: 'app-memory-drawer',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <!-- Layer 0: Persona Core Prompt -->
    @if (level === 0) {
      <div>
        <h4 style="margin-bottom: 1rem; color: var(--color-primary);">Layer 0: {{ 'memory.layer0_name' | translate }}</h4>
        <textarea
          class="form-control"
          rows="15"
          style="width: 100%; background: rgba(0,0,0,0.5); color: var(--text-main); font-family: monospace; resize: vertical;"
          [disabled]="isLoading()"
        readonly>{{ corePrompt() }}</textarea>
        <div style="margin-top: 1rem; color: var(--text-muted); font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
          <span class="material-icons" style="font-size: 1rem;">lock</span> {{ 'memory.layer0_note' | translate }}
        </div>
      </div>
    }
    
    <!-- Layer 1: Extended Persona Tuning -->
    @if (level === 1) {
      <div>
        <h4 style="margin-bottom: 1rem; color: var(--color-primary);">Layer 1: {{ 'memory.layer1_name' | translate }}</h4>
        <textarea
          class="form-control"
          rows="15"
          style="width: 100%; background: rgba(0,0,0,0.5); color: var(--text-main); font-family: monospace; resize: vertical;"
          [disabled]="isLoading()"
          [ngModel]="extendedPrompt()"
        (ngModelChange)="extendedPrompt.set($event)"></textarea>
        <button
          class="btn btn-primary"
          style="margin-top: 1rem; width: 100%; justify-content: center;"
          (click)="onSavePrompt()"
          [disabled]="isSavingPrompt || isLoading()">
          <span class="material-icons" [class.spinning]="isSavingPrompt">{{ isSavingPrompt ? 'sync' : 'save' }}</span>
          {{ isSavingPrompt ? ('memory.saving' | translate) : ('memory.save_tuning' | translate) }}
        </button>
      </div>
    }
    
    <!-- Layer 2: Global Timeline Summary -->
    @if (level === 2) {
      <div>
        <h4 style="margin-bottom: 1rem; color: var(--color-primary);">Layer 2: {{ 'memory.layer2_name' | translate }}</h4>
        <textarea
          class="form-control"
          rows="10"
          style="width: 100%; background: rgba(0,0,0,0.5); color: var(--text-main); resize: vertical;"
          [disabled]="isLoading()"
          [ngModel]="timelineSummary()"
        (ngModelChange)="timelineSummary.set($event)"></textarea>
        <button
          class="btn btn-primary"
          style="margin-top: 1rem; width: 100%; justify-content: center;"
          (click)="onSaveSummary()"
          [disabled]="isSavingSummary || isLoading()">
          <span class="material-icons" [class.spinning]="isSavingSummary">{{ isSavingSummary ? 'sync' : 'save' }}</span>
          {{ isSavingSummary ? ('memory.saving' | translate) : ('memory.save_summary' | translate) }}
        </button>
      </div>
    }
    `
})
export class MemoryDrawerComponent implements OnChanges {
  toastService = inject(ToastService);
  memoryRepo = inject(MEMORY_REPOSITORY);

  @Input() level = 0;

  readonly corePrompt = signal<string>('Loading...');
  readonly extendedPrompt = signal<string>('');
  readonly timelineSummary = signal<string>('');

  readonly isLoading = signal<boolean>(false);
  isSavingPrompt = false;
  isSavingSummary = false;

  ngOnChanges() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    if (this.level === 0) {
      this.memoryRepo.getCoreMemory().subscribe({
        next: (data) => {
          this.corePrompt.set(data.content || '');
          this.isLoading.set(false);
        },
        error: () => {
          this.toastService.show('Failed to load Persona Core Prompt', 'error');
          this.isLoading.set(false);
        }
      });
    } else if (this.level === 1) {
      this.memoryRepo.getExtendedMemory().subscribe({
        next: (data) => {
          this.extendedPrompt.set(data.content || '');
          this.isLoading.set(false);
        },
        error: () => {
          this.toastService.show('Failed to load Extended Tuning Prompt', 'error');
          this.isLoading.set(false);
        }
      });
    } else if (this.level === 2) {
      this.memoryRepo.getGlobalMemory().subscribe({
        next: (data) => {
          this.timelineSummary.set(data.content || '');
          this.isLoading.set(false);
        },
        error: () => {
          this.toastService.show('Failed to load Global Timeline Summary', 'error');
          this.isLoading.set(false);
        }
      });
    }
  }

  onSavePrompt() {
    this.isSavingPrompt = true;
    this.memoryRepo.updateExtendedMemory(this.extendedPrompt()).subscribe({
      next: () => {
        this.toastService.show('Successfully saved Extended Persona Tuning', 'success');
        this.isSavingPrompt = false;
      },
      error: () => {
        this.toastService.show('Failed to save Extended Persona Tuning', 'error');
        this.isSavingPrompt = false;
      }
    });
  }

  onSaveSummary() {
    this.isSavingSummary = true;
    this.memoryRepo.updateGlobalMemory(this.timelineSummary()).subscribe({
      next: () => {
        this.toastService.show('Successfully saved Global Timeline Summary', 'success');
        this.isSavingSummary = false;
      },
      error: () => {
        this.toastService.show('Failed to save Global Timeline Summary', 'error');
        this.isSavingSummary = false;
      }
    });
  }
}
