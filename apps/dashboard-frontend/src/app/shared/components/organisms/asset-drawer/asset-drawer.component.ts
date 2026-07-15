import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerService } from '../../../../core/services/drawer.service';
import { ActionHelperService } from '../../../services/action-helper.service';

/** Data shape for a single image asset shown in the drawer. */
export interface AssetDrawerData {
  id: string;
  name: string;
  caption: string;
  url: string;
  useCount: number;
  lastUsedAt: string | null;
}

/**
 * AssetDrawerComponent
 *
 * Organism-level drawer content for the Assets Library feature.
 * Displays a full-width image preview, asset metadata, usage statistics,
 * and action buttons with proper loading states per the ISSUE spec.
 */
@Component({
  selector: 'app-asset-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asset-drawer.component.html',
  styleUrls: ['./asset-drawer.component.css'],
})
export class AssetDrawerComponent {
  drawerService = inject(DrawerService);
  @Input() assetId: string | null = null;
  @Output() openLightbox = new EventEmitter<string>();

  isDeleting = false;
  isSaving = false;
  isRegenerating = false;

  /** Mock asset data – replaced by real API data post-MVP. */
  mockAsset: AssetDrawerData = {
    id: 'rebecca_summer_01',
    name: 'rebecca_summer_01',
    caption: 'Rebecca in a summer dress, smiling with a parasol on a sunny beach.',
    url: 'https://picsum.photos/seed/asset_summer/600/400',
    useCount: 14,
    lastUsedAt: '2026-07-10T09:30:00.000Z',
  };

  get displayAsset(): AssetDrawerData {
    return this.mockAsset;
  }

  onViewFullSize(): void {
    this.openLightbox.emit(this.displayAsset.url);
  }

  actionHelper = inject(ActionHelperService);

  async onSave(): Promise<void> {
    this.isSaving = true;
    await this.actionHelper.executeMockAction(`Successfully saved asset ${this.displayAsset.id}`);
    this.isSaving = false;
  }

  async onRegenerate(): Promise<void> {
    this.isRegenerating = true;
    await this.actionHelper.executeMockAction(`Successfully regenerated caption for asset ${this.displayAsset.id}`);
    this.mockAsset.caption = 'AI Regenerated: ' + this.mockAsset.caption;
    this.isRegenerating = false;
  }

  async onDelete(): Promise<void> {
    this.isDeleting = true;
    await this.actionHelper.executeMockAction(`Successfully deleted asset ${this.displayAsset.id}`);
    this.isDeleting = false;
  }

  formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  openAiCopilot(): void {
    this.drawerService.open();
  }
}
