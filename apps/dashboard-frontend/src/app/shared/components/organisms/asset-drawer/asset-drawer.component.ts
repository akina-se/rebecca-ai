import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  @Input() assetId: string | null = null;
  @Output() openLightbox = new EventEmitter<string>();

  isDeleting = false;
  isSaving = false;

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

  onSave(): void {
    this.isSaving = true;
    setTimeout(() => {
      this.isSaving = false;
    }, 1500);
  }

  onDelete(): void {
    this.isDeleting = true;
    // Simulates an async API call; replaced with real service injection post-MVP.
    setTimeout(() => {
      this.isDeleting = false;
    }, 2000);
  }

  formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }
}
