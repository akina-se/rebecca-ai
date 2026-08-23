import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { AssetsPageComponent } from './assets-page.component';
import { ASSETS_REPOSITORY } from '../../../core/ports/assets.repository';
import { ToastService } from '../../../shared/services/toast.service';
import { AssetStatus } from '@rebecca/types';

describe('AssetsPageComponent', () => {
  let component: AssetsPageComponent;
  let fixture: ComponentFixture<AssetsPageComponent>;
  let assetsRepoSpy: jasmine.SpyObj<any>;
  let toastServiceSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    assetsRepoSpy = jasmine.createSpyObj('AssetsRepository', [
      'getAll',
      'upload',
      'deleteMany',
      'regenerateCaptions'
    ]);
    toastServiceSpy = jasmine.createSpyObj('ToastService', ['show']);

    await TestBed.configureTestingModule({
      imports: [AssetsPageComponent, HttpClientTestingModule],
      providers: [
        { provide: ASSETS_REPOSITORY, useValue: assetsRepoSpy },
        { provide: ToastService, useValue: toastServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AssetsPageComponent);
    component = fixture.componentInstance;
  });

  it('should create assets page component and load assets on init', () => {
    assetsRepoSpy.getAll.and.returnValue(of({
      data: [
        { id: 'asset_1', filename: 'test.png', url: 'https://example.com/test.png', status: AssetStatus.SUCCESS }
      ],
      meta: { totalItems: 1, totalPages: 1 }
    }));

    component.ngOnInit();

    expect(assetsRepoSpy.getAll).toHaveBeenCalled();
    expect(component.assets.length).toBe(1);
    expect(component.assets[0].id).toBe('asset_1');
    expect(component.isLoading).toBeFalse();
  });

  it('should handle load error gracefully', () => {
    assetsRepoSpy.getAll.and.returnValue(throwError(() => new Error('Error')));
    component.loadAssets();
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to load assets', 'error');
  });

  it('should toggle select all and individual row selection', () => {
    component.assets = [
      { id: 'asset_1', filename: '1.png' } as any,
      { id: 'asset_2', filename: '2.png' } as any
    ];

    component.toggleSelectAll();
    expect(component.selectAll).toBeTrue();
    expect(component.selectedAssets.size).toBe(2);

    const mockEventChecked = { stopPropagation: jasmine.createSpy(), target: { checked: true } } as any;
    component.selectedAssets.clear();
    component.toggleSelection('asset_1', mockEventChecked);
    expect(component.selectedAssets.has('asset_1')).toBeTrue();

    const mockEventUnchecked = { stopPropagation: jasmine.createSpy(), target: { checked: false } } as any;
    component.toggleSelection('asset_1', mockEventUnchecked);
    expect(component.selectedAssets.has('asset_1')).toBeFalse();
  });

  it('should upload files and handle upload error', () => {
    assetsRepoSpy.getAll.and.returnValue(of({ data: [], meta: { totalItems: 0, totalPages: 1 } }));
    assetsRepoSpy.upload.and.returnValue(of({ uploaded: 1 }));

    const mockFile = new File(['content'], 'sample.png', { type: 'image/png' });
    const mockInput = { value: '', files: [mockFile] } as any;
    const mockEvent = { target: mockInput } as any;

    component.onFilesSelected(mockEvent, mockInput);

    expect(assetsRepoSpy.upload).toHaveBeenCalled();
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/Successfully uploaded/), 'success');

    // Error case
    assetsRepoSpy.upload.and.returnValue(throwError(() => new Error('Upload err')));
    component.onFilesSelected(mockEvent, mockInput);
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to upload image(s)', 'error');
  });

  it('should execute bulk delete on selected assets and handle error', async () => {
    assetsRepoSpy.getAll.and.returnValue(of({ data: [], meta: { totalItems: 0, totalPages: 1 } }));
    assetsRepoSpy.deleteMany.and.returnValue(of({ deletedCount: 1 }));

    component.selectedAssets.add('asset_1');
    await component.executeBulkDelete();

    expect(assetsRepoSpy.deleteMany).toHaveBeenCalledWith(['asset_1']);
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/Successfully deleted/), 'success');

    // Error case
    component.selectedAssets.add('asset_1');
    assetsRepoSpy.deleteMany.and.returnValue(throwError(() => new Error('Delete err')));
    await component.executeBulkDelete();
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to delete assets', 'error');
  });

  it('should execute bulk retry on selected assets and handle error', async () => {
    assetsRepoSpy.getAll.and.returnValue(of({ data: [], meta: { totalItems: 0, totalPages: 1 } }));
    assetsRepoSpy.regenerateCaptions.and.returnValue(of({ queued: 1 }));

    component.selectedAssets.add('asset_1');
    await component.executeBulkRetry();

    expect(assetsRepoSpy.regenerateCaptions).toHaveBeenCalledWith(['asset_1']);
    expect(toastServiceSpy.show).toHaveBeenCalledWith(jasmine.stringMatching(/Successfully triggered AI regeneration/), 'success');

    // Error case
    component.selectedAssets.add('asset_1');
    assetsRepoSpy.regenerateCaptions.and.returnValue(throwError(() => new Error('Retry err')));
    await component.executeBulkRetry();
    expect(toastServiceSpy.show).toHaveBeenCalledWith('Failed to trigger regeneration', 'error');
  });

  it('should open lightbox on onOpenLightbox', () => {
    component.onOpenLightbox('https://example.com/large.png');
    expect(component.lightboxImageUrl).toBe('https://example.com/large.png');
    expect(component.isLightboxOpen).toBeTrue();
  });

  it('should return correct badge color based on asset status', () => {
    expect(component.getStatusBadgeColor(AssetStatus.SUCCESS)).toBe('var(--success)');
    expect(component.getStatusBadgeColor(AssetStatus.FAILED)).toBe('var(--danger)');
    expect(component.getStatusBadgeColor(AssetStatus.PROCESSING)).toBe('var(--warning)');
  });

  it('should trigger file input click on triggerFileUpload', () => {
    const inputSpy = jasmine.createSpyObj('HTMLInputElement', ['click']);
    component.triggerFileUpload(inputSpy as any);
    expect(inputSpy.click).toHaveBeenCalled();
  });

  it('should open asset drawer, handle updated and deleted callbacks', () => {
    assetsRepoSpy.getAll.and.returnValue(of({ data: [], meta: { totalItems: 0, totalPages: 1 } }));

    component.openAssetDrawer('asset_1');
    expect(component.selectedAssetId).toBe('asset_1');
    expect(component.isDrawerOpen).toBeTrue();

    component.onAssetUpdated();
    expect(assetsRepoSpy.getAll).toHaveBeenCalled();

    component.onAssetDeleted();
    expect(component.isDrawerOpen).toBeFalse();
  });

  it('should handle search and page change', () => {
    assetsRepoSpy.getAll.and.returnValue(of({ data: [], meta: { totalItems: 0, totalPages: 1 } }));
    component.onSearchChange();
    component.onPageChange(2);
    expect(component.currentPage).toBe(2);
  });

  it('should return early from bulk actions when no assets selected', async () => {
    component.selectedAssets.clear();
    await component.executeBulkDelete();
    await component.executeBulkRetry();
    expect(assetsRepoSpy.deleteMany).not.toHaveBeenCalled();
    expect(assetsRepoSpy.regenerateCaptions).not.toHaveBeenCalled();
  });

  it('should handle onFilesSelected when files list is empty', () => {
    const mockInput = { value: '', files: null } as any;
    const mockEvent = { target: mockInput } as any;
    component.onFilesSelected(mockEvent, mockInput);
    expect(assetsRepoSpy.upload).not.toHaveBeenCalled();
  });

  it('should ignore openAssetDrawer when text is selected in browser', () => {
    spyOn(window, 'getSelection').and.returnValue({ toString: () => 'some text' } as any);
    component.isDrawerOpen = false;
    component.openAssetDrawer('asset_99');
    expect(component.isDrawerOpen).toBeFalse();
  });
});
