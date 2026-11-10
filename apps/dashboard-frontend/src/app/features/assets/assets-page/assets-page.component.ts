import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { AssetDrawerComponent } from '../../../shared/components/organisms/asset-drawer/asset-drawer.component';
import { LightboxComponent } from '../../../shared/components/organisms/lightbox/lightbox.component';
import { PaginationComponent } from '../../../shared/components/molecules/pagination/pagination.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { AuthUrlPipe } from '../../../shared/pipes/auth-url.pipe';
import { ToastService } from '../../../shared/services/toast.service';
import { ASSETS_REPOSITORY } from '../../../core/ports/assets.repository';
import { Asset, AssetStatus, PaginatedResponse } from '@rebecca/types';

@Component({
  selector: 'app-assets-page',
  standalone: true,
  imports: [
    FormsModule,
    RightDrawerComponent,
    AssetDrawerComponent,
    LightboxComponent,
    PaginationComponent,
    TranslatePipe,
    AuthUrlPipe
  ],
  templateUrl: './assets-page.component.html',
  styleUrl: './assets-page.component.css'
})
export class AssetsPageComponent implements OnInit, OnDestroy {
  readonly isDrawerOpen = signal<boolean>(false);
  readonly selectedAssetId = signal<string | null>(null);
  readonly drawerTitle = signal<string>('');
  readonly drawerIcon = signal<string>('');

  // Lightbox State
  readonly isLightboxOpen = signal<boolean>(false);
  readonly lightboxImageUrl = signal<string>('');

  readonly assets = signal<Asset[]>([]);
  selectedAssets = new Set<string>();
  selectAll = false;

  searchQuery = '';
  currentPage = 1;
  pageSize = 20;
  readonly totalPages = signal<number>(1);
  readonly totalItems = signal<number>(0);

  isDeletingBulk = false;
  isRetryingBulk = false;
  readonly isUploading = signal<boolean>(false);
  readonly isProcessing = signal<boolean>(false);
  readonly uploadProgress = signal<number>(0);
  readonly isLoading = signal<boolean>(false);
  private uploadProgressTimer: ReturnType<typeof setInterval> | null = null;

  toastService = inject(ToastService);
  private readonly assetsRepo = inject(ASSETS_REPOSITORY);

  ngOnInit() {
    this.loadAssets(1);
  }

  ngOnDestroy() {
    this.clearUploadTimer();
  }

  private clearUploadTimer() {
    if (this.uploadProgressTimer) {
      clearInterval(this.uploadProgressTimer);
      this.uploadProgressTimer = null;
    }
  }


  loadAssets(page = 1) {
    this.isLoading.set(true);
    this.currentPage = page;
    this.assetsRepo.getAll({
      page: this.currentPage,
      limit: this.pageSize,
      search: this.searchQuery
    }).subscribe({
      next: (res: PaginatedResponse<Asset>) => {
        const items = res.data || [];
        this.assets.set(items);
        const count = res.meta?.totalItems || items.length;
        this.totalItems.set(count);
        this.totalPages.set(res.meta?.totalPages || Math.ceil(count / this.pageSize) || 1);
        this.selectedAssets.clear();
        this.selectAll = false;
        this.isLoading.set(false);
      },
      error: () => {
        this.toastService.show('Failed to load assets', 'error');
        this.isLoading.set(false);
      }
    });
  }

  onSearchChange() {
    this.loadAssets(1);
  }

  onPageChange(page: number) {
    this.loadAssets(page);
  }

  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.assets().forEach(a => this.selectedAssets.add(a.id));
    } else {
      this.selectedAssets.clear();
    }
  }

  toggleSelection(assetId: string, event: Event) {
    event.stopPropagation();
    if (this.selectedAssets.has(assetId)) {
      this.selectedAssets.delete(assetId);
    } else {
      this.selectedAssets.add(assetId);
    }
    this.selectAll = this.selectedAssets.size === this.assets().length && this.assets().length > 0;
  }

  openAssetDrawer(assetId: string) {
    if (typeof window !== 'undefined' && window.getSelection()?.toString().length) {
      return;
    }
    const asset = this.assets().find(a => a.id === assetId);
    this.selectedAssetId.set(assetId);
    this.drawerTitle.set(asset ? asset.filename : 'Asset Details');
    this.drawerIcon.set('image');
    this.isDrawerOpen.set(true);
  }

  onOpenLightbox(imageUrl: string) {
    this.lightboxImageUrl.set(imageUrl);
    this.isLightboxOpen.set(true);
  }

  onAssetUpdated() {
    this.loadAssets(this.currentPage);
  }

  onAssetDeleted() {
    this.isDrawerOpen.set(false);
    this.loadAssets(this.currentPage);
  }

  triggerFileUpload(fileInput: HTMLInputElement) {
    fileInput.click();
  }

  getArcStrokeDashoffset(): string {
    const circumference = 56.55;
    const progress = Math.max(0, Math.min(100, this.uploadProgress()));
    const offset = circumference * (1 - progress / 100);
    return offset.toFixed(2);
  }

  onFilesSelected(event: Event, fileInput: HTMLInputElement) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    const files: File[] = Array.from(target.files);
    this.isUploading.set(true);
    this.isProcessing.set(false);
    this.uploadProgress.set(0);

    // Phase 1: Smooth arc animation (0% -> 80% over ~800ms) capped to synchronize with real network upload
    this.clearUploadTimer();
    const startTime = Date.now();
    const phase1DurationMs = 800;
    const simulatedCap = 80;

    this.uploadProgressTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const simulated = Math.min(simulatedCap, Math.round((elapsed / phase1DurationMs) * simulatedCap));
      if (simulated > this.uploadProgress()) {
        this.uploadProgress.set(simulated);
      }
      if (simulated >= simulatedCap) {
        this.clearUploadTimer();
      }
    }, 40);

    this.assetsRepo.upload(files, (progress: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(progress)));
      if (clamped > this.uploadProgress()) {
        this.uploadProgress.set(clamped);
      }
      if (clamped >= 100) {
        this.clearUploadTimer();
        this.isProcessing.set(true);
      }
    }).subscribe({
      next: () => {
        this.clearUploadTimer();
        this.isProcessing.set(false);
        this.uploadProgress.set(100);
        this.toastService.show(`Successfully uploaded asset(s)`, 'success');
        this.isUploading.set(false);
        this.uploadProgress.set(0);
        fileInput.value = '';
        this.loadAssets(1);
      },
      error: () => {
        this.clearUploadTimer();
        this.isProcessing.set(false);
        this.toastService.show('Failed to upload assets', 'error');
        this.isUploading.set(false);
        this.uploadProgress.set(0);
        fileInput.value = '';
      }
    });
  }

  executeBulkDelete() {
    if (this.selectedAssets.size === 0) return;
    const ids = Array.from(this.selectedAssets);
    this.isDeletingBulk = true;

    this.assetsRepo.deleteMany(ids).subscribe({
      next: () => {
        this.toastService.show(`Deleted ${ids.length} asset(s)`, 'success');
        this.isDeletingBulk = false;
        this.loadAssets(this.currentPage);
      },
      error: () => {
        this.toastService.show('Failed to delete selected assets', 'error');
        this.isDeletingBulk = false;
      }
    });
  }

  executeBulkRetry() {
    if (this.selectedAssets.size === 0) return;
    const ids = Array.from(this.selectedAssets);
    this.isRetryingBulk = true;

    this.assetsRepo.regenerateCaptions(ids).subscribe({
      next: () => {
        this.toastService.show(`Initiated AI regeneration retry for ${ids.length} asset(s)`, 'success');
        this.isRetryingBulk = false;
        this.loadAssets(this.currentPage);
      },
      error: () => {
        this.toastService.show('Failed to retry captions', 'error');
        this.isRetryingBulk = false;
      }
    });
  }

  getStatusBadgeColor(status: AssetStatus): string {
    switch (status) {
      case AssetStatus.SUCCESS: return 'var(--success)';
      case AssetStatus.FAILED: return 'var(--danger)';
      case AssetStatus.PENDING:
      case AssetStatus.PROCESSING: return 'var(--warning)';
      default: return 'var(--text-muted)';
    }
  }
}
