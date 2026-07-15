import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssetDrawerComponent } from '../../../shared/components/organisms/asset-drawer/asset-drawer.component';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { LightboxComponent } from '../../../shared/components/organisms/lightbox/lightbox.component';

@Component({
  selector: 'app-assets-page',
  standalone: true,
  imports: [CommonModule, AssetDrawerComponent, RightDrawerComponent, LightboxComponent],
  templateUrl: './assets-page.component.html',
  styleUrl: './assets-page.component.css'
})
export class AssetsPageComponent {
  // Drawer State
  isDrawerOpen = false;
  selectedAssetId: string | null = null;
  drawerTitle = '';
  drawerIcon = '';

  // Lightbox State
  isLightboxOpen = false;
  lightboxImageUrl = '';

  // Bulk Selection
  selectAll = false;
  selectedAssets = new Set<string>();

  mockAssets = [
    { id: 'rebecca_summer_01', name: 'rebecca_summer_01.png', error: false },
    { id: 'beach_bg_02', name: 'beach_bg_02.jpg', error: true }
  ];

  mockAlert(msg: string) {
    alert(msg);
  }

  openAssetDrawer(id: string) {
    this.selectedAssetId = id;
    this.drawerTitle = 'Asset Details';
    this.drawerIcon = 'image';
    this.isDrawerOpen = true;
  }

  openLightbox(url: string = '') {
    this.lightboxImageUrl = url;
    this.isLightboxOpen = true;
  }

  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.mockAssets.forEach(a => this.selectedAssets.add(a.id));
    } else {
      this.selectedAssets.clear();
    }
  }

  isDeletingBulk = false;
  isRetryingBulk = false;

  toggleSelection(id: string, event: Event) {
    event.stopPropagation();
    if (this.selectedAssets.has(id)) {
      this.selectedAssets.delete(id);
      this.selectAll = false;
    } else {
      this.selectedAssets.add(id);
      if (this.selectedAssets.size === this.mockAssets.length) {
        this.selectAll = true;
      }
    }
  }

  executeBulkDelete() {
    this.isDeletingBulk = true;
    setTimeout(() => {
      this.mockAlert('Batch delete completed.');
      this.isDeletingBulk = false;
      this.selectedAssets.clear();
      this.selectAll = false;
    }, 1500);
  }

  executeBulkRetry() {
    this.isRetryingBulk = true;
    setTimeout(() => {
      this.mockAlert('Retry AI generation completed.');
      this.isRetryingBulk = false;
      this.selectedAssets.clear();
      this.selectAll = false;
    }, 1500);
  }
}
