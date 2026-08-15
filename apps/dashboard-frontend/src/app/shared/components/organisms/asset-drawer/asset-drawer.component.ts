import { Component, Input, Output, EventEmitter, inject, OnChanges, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerService } from '../../../../core/services/drawer.service';
import { ToastService } from '../../../services/toast.service';
import { ASSETS_REPOSITORY, AssetsRepository } from '../../../../core/ports/assets.repository';
import { Asset } from '@rebecca/types';

export interface AssetDrawerData {
  id: string;
  name: string;
  caption: string;
  url: string;
  useCount: number;
  lastUsedAt: string | null;
}

@Component({
  selector: 'app-asset-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asset-drawer.component.html',
  styleUrls: ['./asset-drawer.component.css'],
})
export class AssetDrawerComponent implements OnChanges {
  drawerService = inject(DrawerService);
  toastService = inject(ToastService);
  @Input() assetId: string | null = null;
  @Output() openLightbox = new EventEmitter<string>();
  @Output() assetUpdated = new EventEmitter<void>();
  @Output() assetDeleted = new EventEmitter<string>();

  isDeleting = false;
  isSaving = false;
  isRegenerating = false;
  isLoading = false;

  assetData: AssetDrawerData | null = null;

  constructor(@Inject(ASSETS_REPOSITORY) private assetsRepo: AssetsRepository) {}

  ngOnChanges() {
    if (this.assetId) {
      this.loadAsset(this.assetId);
    }
  }

  loadAsset(id: string) {
    this.isLoading = true;
    this.assetsRepo.getById(id).subscribe({
      next: (asset: Asset) => {
        this.assetData = {
          id: asset.id,
          name: asset.filename,
          caption: asset.caption || '',
          url: asset.url || '',
          useCount: asset.usedCount || 0,
          lastUsedAt: null,
        };
        this.isLoading = false;
      },
      error: () => {
        this.toastService.show('Failed to load asset details', 'error');
        this.isLoading = false;
      }
    });
  }

  get displayAsset(): AssetDrawerData | null {
    return this.assetData;
  }

  onViewFullSize(): void {
    if (this.displayAsset) this.openLightbox.emit(this.displayAsset.url);
  }

  async onSave(): Promise<void> {
    if (!this.displayAsset) return;
    this.isSaving = true;
    this.assetsRepo.update(this.displayAsset.id, { 
      caption: this.displayAsset.caption,
      filename: this.displayAsset.name
    }).subscribe({
      next: () => {
        this.toastService.show(`Successfully saved asset`, 'success');
        this.isSaving = false;
        this.assetUpdated.emit();
      },
      error: () => {
        this.toastService.show(`Failed to save asset`, 'error');
        this.isSaving = false;
      }
    });
  }

  async onRegenerate(): Promise<void> {
    if (!this.displayAsset) return;
    this.isRegenerating = true;
    this.assetsRepo.regenerateCaptions([this.displayAsset.id]).subscribe({
      next: () => {
        this.toastService.show(`Successfully regenerated caption`, 'success');
        this.isRegenerating = false;
        if (this.assetId) {
          this.loadAsset(this.assetId);
        }
        this.assetUpdated.emit();
      },
      error: () => {
        this.toastService.show(`Failed to regenerate caption`, 'error');
        this.isRegenerating = false;
      }
    });
  }

  async onDelete(): Promise<void> {
    if (!this.displayAsset) return;
    this.isDeleting = true;
    const assetId = this.displayAsset.id;
    this.assetsRepo.deleteMany([assetId]).subscribe({
      next: () => {
        this.toastService.show(`Successfully deleted asset`, 'success');
        this.isDeleting = false;
        this.assetDeleted.emit(assetId);
        this.drawerService.close();
      },
      error: () => {
        this.toastService.show(`Failed to delete asset`, 'error');
        this.isDeleting = false;
      }
    });
  }

  formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }
}
