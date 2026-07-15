import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActionHelperService } from '../../../services/action-helper.service';

@Component({
  selector: 'app-memory-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="level === 0">
      <h4 style="margin-bottom: 1rem; color: var(--color-primary);">Persona Core Prompt</h4>
      <textarea class="form-control" rows="15" style="width: 100%; background: rgba(0,0,0,0.5); color: var(--text-main); font-family: monospace; resize: vertical;" readonly>{{ mockCorePrompt }}</textarea>
      <div style="margin-top: 1rem; color: var(--text-muted); font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
          <span class="material-icons" style="font-size: 1rem;">lock</span> Hardcoded in source code (Read-only)
      </div>
    </div>
    <div *ngIf="level === 1">
      <h4 style="margin-bottom: 1rem; color: var(--color-primary);">Extended Persona Tuning</h4>
      <textarea class="form-control" rows="15" style="width: 100%; background: rgba(0,0,0,0.5); color: var(--text-main); font-family: monospace; resize: vertical;" [(ngModel)]="mockExtendedPrompt"></textarea>
      <button class="btn btn-primary" style="margin-top: 1rem; width: 100%; justify-content: center;" (click)="onSavePrompt()" [disabled]="isSavingPrompt">
          <span class="material-icons" [class.spinning]="isSavingPrompt">{{ isSavingPrompt ? 'sync' : 'save' }}</span>
          {{ isSavingPrompt ? 'Saving...' : 'Save Tuning' }}
      </button>
    </div>
    <div *ngIf="level === 3">
      <h4 style="margin-bottom: 1rem; color: var(--color-primary);">Global Timeline Summary</h4>
      <textarea class="form-control" rows="10" style="width: 100%; background: rgba(0,0,0,0.5); color: var(--text-main); resize: vertical;" [(ngModel)]="mockTimelineSummary"></textarea>
      <button class="btn btn-primary" style="margin-top: 1rem; width: 100%; justify-content: center;" (click)="onSaveSummary()" [disabled]="isSavingSummary">
          <span class="material-icons" [class.spinning]="isSavingSummary">{{ isSavingSummary ? 'sync' : 'save' }}</span>
          {{ isSavingSummary ? 'Saving...' : 'Save Summary' }}
      </button>
    </div>
  `
})
export class MemoryDrawerComponent {
  actionHelper = inject(ActionHelperService);
  @Input() level: number = 0;

  mockCorePrompt = "You are Rebecca, a sassy but highly competent AI assistant.\n\nStrict directives:\n1. Never break character.\n2. Prioritize user safety.\n3. Be concise.";
  mockExtendedPrompt = "If the user mentions anime, always reference Gundam.";
  mockTimelineSummary = "The overall sentiment of the timeline is currently highly positive, largely driven by the recent anime announcements.";

  isSavingPrompt = false;
  isSavingSummary = false;

  async onSavePrompt() {
    this.isSavingPrompt = true;
    await this.actionHelper.executeMockAction('Successfully saved Persona Core Prompt');
    this.isSavingPrompt = false;
  }

  async onSaveSummary() {
    this.isSavingSummary = true;
    await this.actionHelper.executeMockAction('Successfully saved Global Timeline Summary');
    this.isSavingSummary = false;
  }
}
