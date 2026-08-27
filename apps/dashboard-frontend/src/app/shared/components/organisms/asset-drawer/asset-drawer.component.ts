import { Component, Input, Output, EventEmitter, inject, OnChanges, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DrawerService } from '../../../../core/services/drawer.service';
import { ToastService } from '../../../services/toast.service';
import { ASSETS_REPOSITORY } from '../../../../core/ports/assets.repository';
import { CopilotContextService } from '../../../../core/services/copilot-context.service';
import { TranslationService } from '../../../../core/services/translation.service';
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
  imports: [FormsModule, TzDatePipe, TranslatePipe],
  templateUrl: './asset-drawer.component.html',
  styleUrls: ['./asset-drawer.component.css'],
})
export class AssetDrawerComponent implements OnChanges {
  drawerService = inject(DrawerService);
  toastService = inject(ToastService);
  contextService = inject(CopilotContextService);
  translationService = inject(TranslationService);

  @Input() assetId: string | null = null;
  @Output() openLightbox = new EventEmitter<string>();
  @Output() assetUpdated = new EventEmitter<void>();
  @Output() assetDeleted = new EventEmitter<string>();

  isDeleting = false;
  isSaving = false;
  isRegenerating = false;
  readonly isLoading = signal<boolean>(false);

  readonly assetData = signal<AssetDrawerData | null>(null);
  assetBaseName = '';
  assetExtension = '.png';
  private readonly assetsRepo = inject(ASSETS_REPOSITORY);

  ngOnChanges() {
    if (this.assetId) {
      this.loadAsset(this.assetId);
    }
  }

  loadAsset(id: string) {
    this.isLoading.set(true);
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

        this.assetData.set({
          id: asset.id,
          name: asset.filename,
          caption: asset.caption || '',
          url: asset.url || '',
          useCount: asset.usedCount || 0,
          lastUsedAt: asset.lastUsedAt || null,
        });

        this.contextService.setFocusedEntity({
          type: 'asset',
          id: asset.id,
          label: asset.filename,
          details: { status: asset.status, useCount: asset.usedCount, caption: asset.caption }
        });

        this.isLoading.set(false);
      },
      error: () => {
        const isEn = this.translationService.currentLang() === 'en';
        this.toastService.show(isEn ? 'Failed to load asset details' : 'アセット情報の取得に失敗しました', 'error');
        this.isLoading.set(false);
      }
    });
  }

  get displayAsset(): AssetDrawerData | null {
    return this.assetData();
  }

  onViewFullSize(): void {
    const data = this.assetData();
    if (data?.url) {
      this.openLightbox.emit(data.url);
    }
  }

  onSave(): void {
    const data = this.assetData();
    if (!data) return;

    this.isSaving = true;
    const newFilename = `${this.assetBaseName.trim()}${this.assetExtension}`;

    this.assetsRepo.update(data.id, {
      filename: newFilename,
      caption: data.caption,
    }).subscribe({
      next: () => {
        const isEn = this.translationService.currentLang() === 'en';
        this.toastService.show(isEn ? 'Successfully saved asset' : 'アセットを正常に保存しました', 'success');
        this.isSaving = false;
        this.assetUpdated.emit();
      },
      error: () => {
        const isEn = this.translationService.currentLang() === 'en';
        this.toastService.show(isEn ? 'Failed to update asset' : 'アセットの更新に失敗しました', 'error');
        this.isSaving = false;
      }
    });
  }

  onRegenerate(): void {
    const data = this.assetData();
    if (!data) return;

    this.isRegenerating = true;
    this.assetsRepo.regenerateCaptions([data.id]).subscribe({
      next: () => {
        const isEn = this.translationService.currentLang() === 'en';
        this.toastService.show(isEn ? 'AI caption regeneration requested' : 'キャプション再生成を開始しました', 'success');
        this.isRegenerating = false;
        this.loadAsset(data.id);
        this.assetUpdated.emit();
      },
      error: () => {
        const isEn = this.translationService.currentLang() === 'en';
        this.toastService.show(isEn ? 'Failed to request caption regeneration' : 'キャプション再生成要求に失敗しました', 'error');
        this.isRegenerating = false;
      }
    });
  }

  onDelete(): void {
    const data = this.assetData();
    if (!data) return;

    this.isDeleting = true;
    this.assetsRepo.deleteMany([data.id]).subscribe({
      next: () => {
        const isEn = this.translationService.currentLang() === 'en';
        this.toastService.show(isEn ? 'Successfully deleted asset' : 'アセットを正常に削除しました', 'success');
        this.isDeleting = false;
        this.assetDeleted.emit(data.id);
      },
      error: () => {
        const isEn = this.translationService.currentLang() === 'en';
        this.toastService.show(isEn ? 'Failed to delete asset' : 'アセットの削除に失敗しました', 'error');
        this.isDeleting = false;
      }
    });
  }
}
