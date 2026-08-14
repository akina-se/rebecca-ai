import { Component, OnInit, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { AssetDrawerComponent } from '../../../shared/components/organisms/asset-drawer/asset-drawer.component';
import { ActionHelperService } from '../../../shared/services/action-helper.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ASSETS_REPOSITORY, AssetsRepository } from '../../../core/ports/assets.repository';
import { Asset } from '@rebecca/types';

@Component({
  selector: 'app-assets-page',
  standalone: true,
  imports: [CommonModule, RightDrawerComponent, AssetDrawerComponent],
  templateUrl: './assets-page.component.html',
  styleUrl: './assets-page.component.css'
})
export class AssetsPageComponent implements OnInit {
  isDrawerOpen = false;
  selectedAssetId: string | null = null;
  drawerTitle = '';
  drawerIcon = '';

  assets: Asset[] = [];
  selectedAssets = new Set<string>();
  selectAll = false;

  isDeletingBulk = false;
  isRetryingBulk = false;
  isLoading = false;

  toastService = inject(ToastService);

  constructor(@Inject(ASSETS_REPOSITORY) private assetsRepo: AssetsRepository) {}

  ngOnInit() {
    this.loadAssets();
  }

  loadAssets() {
    this.isLoading = true;
    this.assetsRepo.getAll().subscribe({
      next: (assets) => {
        this.assets = assets;
        this.isLoading = false;
      },
      error: () => {
        this.toastService.show('Failed to load assets', 'error');
        this.isLoading = false;
      }
    });
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

  actionHelper = inject(ActionHelperService);

  async executeBulkDelete() {
    if (this.selectedAssets.size === 0) return;
    this.isDeletingBulk = true;
    this.assetsRepo.deleteMany(Array.from(this.selectedAssets)).subscribe({
      next: () => {
        this.toastService.show(`Successfully deleted ${this.selectedAssets.size} assets`, 'success');
        this.selectedAssets.clear();
        this.selectAll = false;
        this.isDeletingBulk = false;
        this.loadAssets();
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
        // Optionally reload, or rely on local state updates if we want to be fancy.
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

  mockAlert(msg: string) {
    this.toastService.show('Not implemented yet: ' + msg, 'info');
  }
}
