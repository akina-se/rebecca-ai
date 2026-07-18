import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AssetDrawerComponent } from '../../../shared/components/organisms/asset-drawer/asset-drawer.component';
import { RightDrawerComponent } from '../../../shared/components/organisms/right-drawer/right-drawer.component';
import { LightboxComponent } from '../../../shared/components/organisms/lightbox/lightbox.component';
import { ActionHelperService } from '../../../shared/services/action-helper.service';
import { inject } from '@angular/core';

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

  openLightbox(url = '') {
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

  actionHelper = inject(ActionHelperService);

  async executeBulkDelete() {
    this.isDeletingBulk = true;
    await this.actionHelper.executeMockAction(`Successfully deleted ${this.selectedAssets.size} assets`);
    this.isDeletingBulk = false;
    this.selectedAssets.clear();
    this.selectAll = false;
  }

  async executeBulkRetry() {
    this.isRetryingBulk = true;
    await this.actionHelper.executeMockAction(`Successfully queued retry for ${this.selectedAssets.size} assets`);
    this.isRetryingBulk = false;
    this.selectedAssets.clear();
    this.selectAll = false;
  }
}
