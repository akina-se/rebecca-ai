import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { AssetDrawerComponent } from './asset-drawer.component';
import { ASSETS_REPOSITORY } from '../../../../core/ports/assets.repository';
import { DrawerService } from '../../../../core/services/drawer.service';
import { ToastService } from '../../../services/toast.service';
import { CopilotContextService } from '../../../../core/services/copilot-context.service';

describe('AssetDrawerComponent', () => {
  let component: AssetDrawerComponent;
  let fixture: ComponentFixture<AssetDrawerComponent>;
  let assetsRepoSpy: jasmine.SpyObj<any>;
  let drawerServiceSpy: jasmine.SpyObj<DrawerService>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    assetsRepoSpy = jasmine.createSpyObj('AssetsRepository', ['getById', 'update', 'regenerateCaptions', 'deleteMany']);
    drawerServiceSpy = jasmine.createSpyObj('DrawerService', ['close']);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['show']);

    await TestBed.configureTestingModule({
      imports: [AssetDrawerComponent, HttpClientTestingModule],
      providers: [
        { provide: ASSETS_REPOSITORY, useValue: assetsRepoSpy },
        { provide: DrawerService, useValue: drawerServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        CopilotContextService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AssetDrawerComponent);
    component = fixture.componentInstance;
  });

  it('should create asset drawer component', () => {
    expect(component).toBeTruthy();
  });

  it('should load asset details when assetId changes', () => {
    assetsRepoSpy.getById.and.returnValue(of({
      id: 'asset_1',
      filename: 'rebecca_portrait.png',
      caption: 'A lovely portrait of Rebecca',
      url: 'https://example.com/rebecca.png',
      usedCount: 12,
      lastUsedAt: '2026-08-15T00:00:00Z',
      status: 'SUCCESS'
    }));

    component.assetId = 'asset_1';
    component.ngOnChanges();

    expect(assetsRepoSpy.getById).toHaveBeenCalledWith('asset_1');
    expect(component.assetData).toBeTruthy();
    expect(component.assetBaseName).toBe('rebecca_portrait');
    expect(component.assetExtension).toBe('.png');
    expect(component.isLoading).toBeFalse();
  });

  it('should load asset with fallback filename without extension and null fields', () => {
    assetsRepoSpy.getById.and.returnValue(of({
      id: 'asset_2',
      filename: 'no_extension',
      caption: null,
      url: null,
      usedCount: null,
      lastUsedAt: null,
      status: null
    }));

    component.assetId = 'asset_2';
    component.ngOnChanges();

    expect(component.assetBaseName).toBe('no_extension');
    expect(component.assetExtension).toBe('.png');
    expect(component.assetData?.useCount).toBe(0);
    expect(component.assetData?.lastUsedAt).toBeNull();
  });

  it('should handle asset load error gracefully', () => {
    assetsRepoSpy.getById.and.returnValue(throwError(() => new Error('Load failed')));

    component.assetId = 'err_asset';
    component.ngOnChanges();

    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/Failed to load/), 'error');
    expect(component.isLoading).toBeFalse();
  });

  it('should save updated asset caption and filename on onSave', async () => {
    component.assetData = {
      id: 'asset_1',
      name: 'rebecca.png',
      caption: 'Updated caption',
      url: 'https://example.com/rebecca.png',
      useCount: 1,
      lastUsedAt: null
    };
    component.assetBaseName = 'rebecca_v2.png';
    component.assetExtension = '.png';
    assetsRepoSpy.update.and.returnValue(of({ success: true }));
    spyOn(component.assetUpdated, 'emit');

    await component.onSave();

    expect(assetsRepoSpy.update).toHaveBeenCalledWith('asset_1', {
      caption: 'Updated caption',
      filename: 'rebecca_v2.png'
    });
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/saved asset/), 'success');
    expect(component.assetUpdated.emit).toHaveBeenCalled();

    // When base name does not already include extension
    component.assetBaseName = 'clean_name';
    await component.onSave();
    expect(assetsRepoSpy.update).toHaveBeenCalledWith('asset_1', {
      caption: 'Updated caption',
      filename: 'clean_name.png'
    });

    // Error case
    assetsRepoSpy.update.and.returnValue(throwError(() => new Error('Save failed')));
    await component.onSave();
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/Failed to save/), 'error');

    // When assetData is null
    component.assetData = null;
    await component.onSave();
  });

  it('should regenerate caption on onRegenerate', async () => {
    component.assetData = {
      id: 'asset_1',
      name: 'rebecca.png',
      caption: 'Old caption',
      url: 'https://example.com/rebecca.png',
      useCount: 1,
      lastUsedAt: null
    };
    component.assetId = 'asset_1';
    assetsRepoSpy.regenerateCaptions.and.returnValue(of({ success: true }));
    assetsRepoSpy.getById.and.returnValue(of({ id: 'asset_1', filename: 'rebecca.png' }));

    await component.onRegenerate();

    expect(assetsRepoSpy.regenerateCaptions).toHaveBeenCalledWith(['asset_1']);
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/regenerated caption/), 'success');

    // Error case
    assetsRepoSpy.regenerateCaptions.and.returnValue(throwError(() => new Error('Regen error')));
    await component.onRegenerate();
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/Failed to regenerate/), 'error');

    // When assetData is null
    component.assetData = null;
    await component.onRegenerate();
  });

  it('should delete asset and close drawer on onDelete', async () => {
    component.assetData = {
      id: 'asset_1',
      name: 'rebecca.png',
      caption: 'Delete me',
      url: 'https://example.com/rebecca.png',
      useCount: 0,
      lastUsedAt: null
    };
    assetsRepoSpy.deleteMany.and.returnValue(of({ deletedCount: 1 }));
    spyOn(component.assetDeleted, 'emit');

    await component.onDelete();

    expect(assetsRepoSpy.deleteMany).toHaveBeenCalledWith(['asset_1']);
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/deleted asset/), 'success');
    expect(component.assetDeleted.emit).toHaveBeenCalledWith('asset_1');
    expect(drawerServiceSpy.close).toHaveBeenCalled();

    // Error case
    assetsRepoSpy.deleteMany.and.returnValue(throwError(() => new Error('Delete error')));
    await component.onDelete();
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/Failed to delete/), 'error');

    // When assetData is null
    component.assetData = null;
    await component.onDelete();
  });

  it('should emit openLightbox on onViewFullSize when url exists', () => {
    spyOn(component.openLightbox, 'emit');
    component.assetData = {
      id: 'asset_1',
      name: 'rebecca.png',
      caption: '',
      url: 'https://example.com/large.png',
      useCount: 0,
      lastUsedAt: null
    };

    component.onViewFullSize();
    expect(component.openLightbox.emit).toHaveBeenCalledWith('https://example.com/large.png');

    // When url is empty
    component.assetData.url = '';
    component.onViewFullSize();
    expect(component.openLightbox.emit).toHaveBeenCalledTimes(1);
  });

  it('should format ISO dates correctly', () => {
    expect(component.formatDate(null)).toBe('Never');
    expect(component.formatDate('invalid')).toBe('Never');
    expect(component.formatDate('2026-08-15T12:00:00Z')).toContain('2026');
  });
});
