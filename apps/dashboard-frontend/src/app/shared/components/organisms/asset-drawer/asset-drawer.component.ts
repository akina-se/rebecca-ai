import { Component, Input, Output, EventEmitter, inject, OnChanges, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DrawerService } from '../../../../core/services/drawer.service';
import { ToastService } from '../../../services/toast.service';
import { ASSETS_REPOSITORY, AssetsRepository } from '../../../../core/ports/assets.repository';
import { CopilotContextService } from '../../../../core/services/copilot-context.service';
import { Asset } from '@rebecca/types';
import { TzDatePipe } from '../../../pipes/tz-date.pipe';
import { TranslatePipe } from '../../../pipes/translate.pipe';

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
  imports: [CommonModule, FormsModule, TzDatePipe, TranslatePipe],
  templateUrl: './asset-drawer.component.html',
  styleUrls: ['./asset-drawer.component.css'],
})
export class AssetDrawerComponent implements OnChanges {
  drawerService = inject(DrawerService);
  toastService = inject(ToastService);
  contextService = inject(CopilotContextService);

  @Input() assetId: string | null = null;
  @Output() openLightbox = new EventEmitter<string>();
  @Output() assetUpdated = new EventEmitter<void>();
  @Output() assetDeleted = new EventEmitter<string>();

  isDeleting = false;
  isSaving = false;
  isRegenerating = false;
  isLoading = false;

  assetData: AssetDrawerData | null = null;
  assetBaseName = '';
  assetExtension = '.png';

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
        const dotIndex = (asset.filename || '').lastIndexOf('.');
        if (dotIndex !== -1) {
          this.assetBaseName = asset.filename.substring(0, dotIndex);
          this.assetExtension = asset.filename.substring(dotIndex);
        } else {
          this.assetBaseName = asset.filename || id;
          this.assetExtension = '.png';
        }

        this.assetData = {
          id: asset.id,
          name: asset.filename,
          caption: asset.caption || '',
          url: asset.url || '',
          useCount: asset.usedCount || 0,
          lastUsedAt: asset.lastUsedAt || null,
        };

        this.contextService.setFocusedEntity({
          type: 'asset',
          id: asset.id,
          label: asset.filename,
          details: { status: asset.status, useCount: asset.usedCount, caption: asset.caption }
        });

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
    if (this.displayAsset?.url) {
      this.openLightbox.emit(this.displayAsset.url);
    }
  }

  async onSave(): Promise<void> {
    if (!this.displayAsset) return;
    this.isSaving = true;

    // Sanitize base name to prevent duplicate extensions if user typed .png/.jpg
    let cleanBase = this.assetBaseName.trim();
    if (cleanBase.toLowerCase().endsWith(this.assetExtension.toLowerCase())) {
      cleanBase = cleanBase.substring(0, cleanBase.length - this.assetExtension.length);
    }
    const finalFilename = `${cleanBase}${this.assetExtension}`;

    this.assetsRepo.update(this.displayAsset.id, { 
      caption: this.displayAsset.caption,
      filename: finalFilename
    }).subscribe({
      next: () => {
        this.toastService.show(`Successfully saved asset`, 'success');
        this.isSaving = false;
        if (this.assetData) {
          this.assetData.name = finalFilename;
        }
        this.assetUpdated.emit();
      },
      error: () => {
        this.toastService.show(`Failed to save asset`, 'error');
        this.isSaving = false;
      }
    });
  }

  async onRegenerate(): Promise<void> {
    const assetId = this.displayAsset?.id || this.assetId;
    if (!assetId) return;
    this.isRegenerating = true;
    this.assetsRepo.regenerateCaptions([assetId]).subscribe({
      next: () => {
        this.toastService.show(`Successfully regenerated caption`, 'success');
        this.isRegenerating = false;
        this.loadAsset(assetId);
        this.assetUpdated.emit();
      },
      error: () => {
        this.toastService.show(`Failed to regenerate caption`, 'error');
        this.isRegenerating = false;
      }
    });
  }

  async onDelete(): Promise<void> {
    const assetId = this.displayAsset?.id || this.assetId;
    if (!assetId) return;
    this.isDeleting = true;
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
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Never';
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }
}
