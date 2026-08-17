import { Component, OnInit, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { AssetDrawerComponent } from '../../../shared/components/organisms/asset-drawer/asset-drawer.component';
import { LightboxComponent } from '../../../shared/components/organisms/lightbox/lightbox.component';
import { PaginationComponent } from '../../../shared/components/molecules/pagination/pagination.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ToastService } from '../../../shared/services/toast.service';
import { ASSETS_REPOSITORY, AssetsRepository } from '../../../core/ports/assets.repository';
import { Asset, AssetStatus, PaginatedResponse } from '@rebecca/types';

@Component({
  selector: 'app-assets-page',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RightDrawerComponent, 
    AssetDrawerComponent, 
    LightboxComponent,
    PaginationComponent,
    TranslatePipe
  ],
  templateUrl: './assets-page.component.html',
  styleUrl: './assets-page.component.css'
})
export class AssetsPageComponent implements OnInit {
  isDrawerOpen = false;
  selectedAssetId: string | null = null;
  drawerTitle = '';
  drawerIcon = '';

  // Lightbox State
  isLightboxOpen = false;
  lightboxImageUrl = '';

  assets: Asset[] = [];
  selectedAssets = new Set<string>();
  selectAll = false;

  searchQuery = '';
  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  totalItems = 0;

  isDeletingBulk = false;
  isRetryingBulk = false;
  isUploading = false;
  isLoading = false;

  toastService = inject(ToastService);

  constructor(@Inject(ASSETS_REPOSITORY) private assetsRepo: AssetsRepository) {}

  ngOnInit() {
    this.loadAssets(1);
  }

  loadAssets(page: number = 1) {
    this.isLoading = true;
    this.currentPage = page;
    this.assetsRepo.getAll({
      page: this.currentPage,
      limit: this.pageSize,
      search: this.searchQuery
    }).subscribe({
      next: (res: PaginatedResponse<Asset>) => {
        this.assets = res.data || [];
        this.totalItems = res.meta?.totalItems || this.assets.length;
        this.totalPages = res.meta?.totalPages || Math.ceil(this.totalItems / this.pageSize) || 1;
        this.selectedAssets.clear();
        this.selectAll = false;
        this.isLoading = false;
      },
      error: () => {
        this.toastService.show('Failed to load assets', 'error');
        this.isLoading = false;
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
      this.assets.forEach(a => this.selectedAssets.add(a.id));
    } else {
      this.selectedAssets.clear();
    }
  }

  toggleSelection(assetId: string, event: Event) {
    event.stopPropagation();
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      this.selectedAssets.add(assetId);
    } else {
      this.selectedAssets.delete(assetId);
    }
    this.selectAll = this.selectedAssets.size === this.assets.length && this.assets.length > 0;
  }

  triggerFileUpload(fileInput: HTMLInputElement) {
    fileInput.click();
  }

  onFilesSelected(event: Event, fileInput: HTMLInputElement) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    this.isUploading = true;
    this.toastService.show(`Uploading ${fileList.length} image(s)...`, 'info');

    this.assetsRepo.upload(fileList).subscribe({
      next: () => {
        this.toastService.show(`Successfully uploaded ${fileList.length} image(s) with AI caption processing.`, 'success');
        this.isUploading = false;
        fileInput.value = '';
        this.loadAssets(1);
      },
      error: () => {
        this.toastService.show('Failed to upload image(s)', 'error');
        this.isUploading = false;
        fileInput.value = '';
      }
    });
  }

  async executeBulkDelete() {
    if (this.selectedAssets.size === 0) return;
    this.isDeletingBulk = true;
    this.assetsRepo.deleteMany(Array.from(this.selectedAssets)).subscribe({
      next: () => {
        this.toastService.show(`Successfully deleted ${this.selectedAssets.size} assets`, 'success');
        this.selectedAssets.clear();
        this.selectAll = false;
        this.isDeletingBulk = false;
        this.loadAssets(this.currentPage);
      },
      error: () => {
        this.toastService.show('Failed to delete assets', 'error');
        this.isDeletingBulk = false;
      }
    });
  }

  async executeBulkRetry() {
    if (this.selectedAssets.size === 0) return;
    this.isRetryingBulk = true;
    this.assetsRepo.regenerateCaptions(Array.from(this.selectedAssets)).subscribe({
      next: () => {
        this.toastService.show(`Successfully triggered AI regeneration for ${this.selectedAssets.size} assets`, 'success');
        this.selectedAssets.clear();
        this.selectAll = false;
        this.isRetryingBulk = false;
        this.loadAssets(this.currentPage);
      },
      error: () => {
        this.toastService.show('Failed to trigger regeneration', 'error');
        this.isRetryingBulk = false;
      }
    });
  }

  openAssetDrawer(id: string) {
    if ((window.getSelection()?.toString() || '').trim().length > 0) return;
    this.selectedAssetId = id;
    this.drawerTitle = 'Asset Details';
    this.drawerIcon = 'image';
    this.isDrawerOpen = true;
  }

  onAssetUpdated() {
    this.loadAssets(this.currentPage);
  }

  onAssetDeleted() {
    this.isDrawerOpen = false;
    this.selectedAssetId = null;
    this.loadAssets(this.currentPage);
  }

  onOpenLightbox(url: string) {
    this.lightboxImageUrl = url;
    this.isLightboxOpen = true;
  }

  getStatusBadgeColor(status: AssetStatus | string): string {
    const s = String(status).toUpperCase();
    if (s === 'SUCCESS' || s === 'READY') return 'var(--success)';
    if (s === 'FAILED' || s === 'CAPTION FAILED') return 'var(--danger)';
    return 'var(--warning)';
  }
}
