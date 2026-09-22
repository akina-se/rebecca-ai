import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CampaignListComponent } from './campaign-list.component';
import { CAMPAIGNS_REPOSITORY } from '../../../core/ports/campaigns.repository';
import { ToastService } from '../../../shared/services/toast.service';
import { CampaignDocWithId } from '@rebecca/types';

describe('CampaignListComponent', () => {
  let component: CampaignListComponent;
  let fixture: ComponentFixture<CampaignListComponent>;
  let mockRepo: any;
  let mockRouter: any;
  let mockToast: any;

  const mockCampaign: CampaignDocWithId = {
    id: 'camp_1',
    title: 'Kyoto Journey',
    description: 'Fall tour',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    status: 'active',
    dailySlotTimes: ['08:00', '19:00'],
    masterContext: 'Rebecca in Kyoto',
    replyContextSummary: 'Enjoying Kyoto',
    slots: [],
    totalSlotsCount: 6,
    completedSlotsCount: 2,
    isPaused: false,
    createdAt: '2026-09-18T00:00:00Z',
    updatedAt: '2026-09-18T00:00:00Z',
  };

  beforeEach(async () => {
    mockRepo = {
      getAll: jest.fn().mockReturnValue(
        of({
          data: [mockCampaign],
          meta: { totalItems: 1, totalPages: 1, currentPage: 1, limit: 10 },
        }),
      ),
      pause: jest.fn().mockReturnValue(of({ ...mockCampaign, isPaused: true })),
      resume: jest.fn().mockReturnValue(of({ ...mockCampaign, isPaused: false })),
      clone: jest.fn().mockReturnValue(of({ ...mockCampaign, id: 'camp_cloned' })),
      delete: jest.fn().mockReturnValue(of(undefined)),
    };

    mockRouter = {
      navigate: jest.fn(),
    };

    mockToast = {
      show: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CampaignListComponent],
      providers: [
        { provide: CAMPAIGNS_REPOSITORY, useValue: mockRepo },
        { provide: Router, useValue: mockRouter },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load campaigns on init', () => {
    expect(component).toBeTruthy();
    expect(mockRepo.getAll).toHaveBeenCalledWith({ page: 1, limit: 10, status: undefined });
    expect(component.campaigns()).toHaveLength(1);
    expect(component.totalItems()).toBe(1);
  });

  it('should reload with filter when setFilter is called', () => {
    component.setFilter('scheduled');
    expect(component.selectedFilter).toBe('scheduled');
    expect(mockRepo.getAll).toHaveBeenCalledWith({ page: 1, limit: 10, status: 'scheduled' });
  });

  it('should reload on page change', () => {
    component.onPageChange(2);
    expect(mockRepo.getAll).toHaveBeenCalledWith({ page: 2, limit: 10, status: undefined });
  });

  it('should navigate to new campaign page and edit campaign page', () => {
    component.openNewCampaign();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/campaigns/new']);

    component.editCampaign('camp_1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/campaigns', 'camp_1']);
  });

  it('should toggle pause status and notify toast', () => {
    component.togglePause(mockCampaign);
    expect(mockRepo.pause).toHaveBeenCalledWith('camp_1');
    expect(mockToast.show).toHaveBeenCalledWith('キャンペーンを一時停止しました', 'info');

    const pausedCampaign = { ...mockCampaign, isPaused: true };
    component.togglePause(pausedCampaign);
    expect(mockRepo.resume).toHaveBeenCalledWith('camp_1');
    expect(mockToast.show).toHaveBeenCalledWith('キャンペーンを再開しました', 'info');
  });

  it('should open clone modal and execute clone request', () => {
    component.openCloneModal(mockCampaign);
    expect(component.isCloneModalOpen()).toBe(true);
    expect(component.cloneStartDate).toContain('2027');

    component.submitClone();
    expect(mockRepo.clone).toHaveBeenCalledWith('camp_1', component.cloneStartDate, component.cloneEndDate);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/campaigns', 'camp_cloned']);
    expect(component.isCloneModalOpen()).toBe(false);
  });

  it('should open delete modal and execute delete request', () => {
    component.openDeleteModal(mockCampaign);
    expect(component.isDeleteModalOpen()).toBe(true);

    component.confirmDelete();
    expect(mockRepo.delete).toHaveBeenCalledWith('camp_1');
    expect(component.isDeleteModalOpen()).toBe(false);
    expect(mockToast.show).toHaveBeenCalledWith('Campaign deleted successfully', 'success');
  });

  it('should compute progress percentage correctly', () => {
    expect(component.getProgressPercentage(mockCampaign)).toBe(33);
    expect(component.getProgressPercentage({ ...mockCampaign, totalSlotsCount: 0 })).toBe(0);
  });

  it('should return correct badge CSS class for each status', () => {
    expect(component.getStatusBadgeClass('active')).toBe('badge-active');
    expect(component.getStatusBadgeClass('scheduled')).toBe('badge-scheduled');
    expect(component.getStatusBadgeClass('completed')).toBe('badge-completed');
    expect(component.getStatusBadgeClass('archived')).toBe('badge-cancelled');
    expect(component.getStatusBadgeClass('draft')).toBe('badge-draft');
  });

  it('should identify paused active campaign for emergency banner', () => {
    expect(component.pausedActiveCampaign()).toBeUndefined();

    const pausedActive: CampaignDocWithId = {
      ...mockCampaign,
      id: 'camp_paused_active',
      status: 'active',
      isPaused: true,
    };
    component.campaigns.set([pausedActive]);
    expect(component.pausedActiveCampaign()).toEqual(pausedActive);
  });

  it('should handle error when loadCampaigns fails', () => {
    mockRepo.getAll.mockReturnValue(throwError(() => new Error('Network error')));
    component.loadCampaigns(1);

    expect(mockToast.show).toHaveBeenCalledWith('Failed to load campaigns', 'error');
    expect(component.isLoading()).toBe(false);
  });

  it('should handle error when togglePause fails', () => {
    mockRepo.pause.mockReturnValue(throwError(() => new Error('Server error')));
    component.togglePause(mockCampaign);

    expect(mockToast.show).toHaveBeenCalledWith('Failed to toggle pause status', 'error');
  });

  it('should close clone modal and reset target', () => {
    component.openCloneModal(mockCampaign);
    expect(component.isCloneModalOpen()).toBe(true);
    expect(component.targetCloneCampaign()).toBe(mockCampaign);

    component.closeCloneModal();
    expect(component.isCloneModalOpen()).toBe(false);
    expect(component.targetCloneCampaign()).toBeNull();
  });

  it('should not submit clone if target is null', () => {
    component.closeCloneModal();
    component.submitClone();
    expect(mockRepo.clone).not.toHaveBeenCalled();
  });

  it('should handle error when submitClone fails', () => {
    component.openCloneModal(mockCampaign);
    mockRepo.clone.mockReturnValue(throwError(() => ({ error: { error: 'Name duplicated' } })));

    component.submitClone();
    expect(mockToast.show).toHaveBeenCalledWith('Name duplicated', 'error');
    expect(component.isCloning()).toBe(false);

    // Fallback error message if err.error is empty
    mockRepo.clone.mockReturnValue(throwError(() => new Error('Generic error')));
    component.submitClone();
    expect(mockToast.show).toHaveBeenCalledWith('Failed to clone campaign', 'error');
    expect(component.isCloning()).toBe(false);
  });

  it('should close delete modal and reset target', () => {
    component.openDeleteModal(mockCampaign);
    expect(component.isDeleteModalOpen()).toBe(true);
    expect(component.targetDeleteCampaign()).toBe(mockCampaign);

    component.closeDeleteModal();
    expect(component.isDeleteModalOpen()).toBe(false);
    expect(component.targetDeleteCampaign()).toBeNull();
  });

  it('should not confirm delete if target is null', () => {
    component.closeDeleteModal();
    component.confirmDelete();
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('should handle error when confirmDelete fails', () => {
    component.openDeleteModal(mockCampaign);
    mockRepo.delete.mockReturnValue(throwError(() => new Error('Delete failed')));

    component.confirmDelete();
    expect(mockToast.show).toHaveBeenCalledWith('Failed to delete campaign', 'error');
    expect(component.isDeleting()).toBe(false);
  });
});
