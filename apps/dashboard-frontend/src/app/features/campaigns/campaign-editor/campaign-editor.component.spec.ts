import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CampaignEditorComponent } from './campaign-editor.component';
import { CAMPAIGNS_REPOSITORY } from '../../../core/ports/campaigns.repository';
import { ToastService } from '../../../shared/services/toast.service';
import { CampaignDocWithId } from '@rebecca/types';

describe('CampaignEditorComponent', () => {
  let component: CampaignEditorComponent;
  let fixture: ComponentFixture<CampaignEditorComponent>;
  let mockRepo: any;
  let mockRouter: any;
  let mockToast: any;
  let mockRoute: any;

  const sampleCampaign: CampaignDocWithId = {
    id: 'camp_edit_1',
    title: 'Kyoto Journey',
    description: 'Fall tour',
    hashtag: 'レベッカ京都旅',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    status: 'draft',
    dailySlotTimes: ['08:00', '19:00'],
    masterContext: 'Rebecca in Kyoto',
    replyContextSummary: 'Enjoying Kyoto',
    slots: [
      {
        slotId: 'slot-1-0800',
        dayNumber: 1,
        timePeriod: 'morning',
        scheduledTime: '2026-11-01T08:00:00Z',
        theme: 'Arrival',
        status: 'pending',
      },
    ],
    totalSlotsCount: 1,
    completedSlotsCount: 0,
    isPaused: false,
    createdAt: '2026-09-18T00:00:00Z',
    updatedAt: '2026-09-18T00:00:00Z',
  };

  beforeEach(async () => {
    mockRepo = {
      getById: jest.fn().mockReturnValue(of(sampleCampaign)),
      create: jest.fn().mockReturnValue(of({ ...sampleCampaign, id: 'camp_new' })),
      update: jest.fn().mockReturnValue(of(sampleCampaign)),
      pause: jest.fn().mockReturnValue(of({ ...sampleCampaign, isPaused: true })),
      resume: jest.fn().mockReturnValue(of({ ...sampleCampaign, isPaused: false })),
      delete: jest.fn().mockReturnValue(of(undefined)),
      uploadAsset: jest.fn().mockReturnValue(
        of({ url: 'https://storage.googleapis.com/bucket/pic.png', filename: 'pic.png' }),
      ),
    };

    mockRouter = {
      navigate: jest.fn(),
    };

    mockToast = {
      show: jest.fn(),
    };

    mockRoute = {
      paramMap: of({
        get: jest.fn().mockReturnValue('camp_edit_1'),
      }),
      snapshot: {
        paramMap: {
          get: jest.fn().mockReturnValue('camp_edit_1'),
        },
      },
    };

    await TestBed.configureTestingModule({
      imports: [CampaignEditorComponent],
      providers: [
        { provide: CAMPAIGNS_REPOSITORY, useValue: mockRepo },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load campaign when id is present in route params (edit mode)', () => {
    expect(component).toBeTruthy();
    expect(component.isEditMode()).toBe(true);
    expect(mockRepo.getById).toHaveBeenCalledWith('camp_edit_1');
    expect(component.title).toBe('Kyoto Journey');
    expect(component.hashtag).toBe('レベッカ京都旅');
    expect(component.slots).toHaveLength(1);
  });

  it('should sanitize hashtag input on user typing and limit to 20 chars', () => {
    const input = document.createElement('input');
    input.value = '#京都旅行 2026';
    component.onHashtagInput({ target: input } as any);
    expect(component.hashtag).toBe('京都旅行2026');

    input.value = '##12345678901234567890EXTRA';
    component.onHashtagInput({ target: input } as any);
    expect(component.hashtag).toBe('12345678901234567890');
    expect(component.hashtag.length).toBe(20);
  });

  it('should auto-generate slots based on dates and slot times', () => {
    component.startDate = '2026-12-01';
    component.endDate = '2026-12-02';
    component.setPresetMode('custom');
    component.selectedCustomTimes = ['08:00', '19:00'];

    component.autoGenerateSlots();
    // 2 days * 2 slots = 4 slots
    expect(component.slots).toHaveLength(4);
    expect(component.slots[0].dayNumber).toBe(1);
    expect(component.slots[0].timePeriod).toBe('morning');
    expect(component.slots[1].dayNumber).toBe(1);
    expect(component.slots[1].timePeriod).toBe('night');
    expect(component.slots[2].dayNumber).toBe(2);
    expect(component.slots[3].dayNumber).toBe(2);
  });

  it('should toggle preset mode and generate standard 3 slots', () => {
    component.startDate = '2026-12-01';
    component.endDate = '2026-12-01'; // 1 day
    component.setPresetMode('standard');

    expect(component.presetMode).toBe('standard');
    expect(component.parsedSlotTimes).toEqual(['08:00', '12:00', '19:00']);
    expect(component.slots).toHaveLength(3);
  });

  it('should toggle hourly chips and enforce maximum slot limit guard', () => {
    component.setPresetMode('custom');
    component.selectedCustomTimes = ['08:00'];

    // Add 10:00
    component.toggleHourChip('10:00');
    expect(component.isHourSelected('10:00')).toBe(true);
    expect(component.selectedCustomTimes).toContain('10:00');

    // Remove 10:00
    component.toggleHourChip('10:00');
    expect(component.isHourSelected('10:00')).toBe(false);

    // Prevent removing the last slot
    expect(component.selectedCustomTimes).toHaveLength(1);
    component.toggleHourChip('08:00');
    expect(mockToast.show).toHaveBeenCalledWith('At least one delivery slot is required', 'warning');
    expect(component.selectedCustomTimes).toContain('08:00');

    // Test max slots guard (8 slots)
    component.selectedCustomTimes = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
    component.toggleHourChip('23:00');
    expect(mockToast.show).toHaveBeenCalledWith(
      expect.stringContaining('Daily limit (8 slots) reached'),
      'warning',
    );
    expect(component.selectedCustomTimes).not.toContain('23:00');
  });

  it('should manage accordion day groups and expand/collapse states', () => {
    component.startDate = '2026-12-01';
    component.endDate = '2026-12-03'; // 3 days
    component.setPresetMode('standard'); // 3 slots/day = 9 slots total

    const groups = component.groupedSlots;
    expect(groups).toHaveLength(3);
    expect(groups[0].dayNumber).toBe(1);
    expect(groups[0].slots).toHaveLength(3);
    expect(groups[1].dayNumber).toBe(2);
    expect(groups[2].dayNumber).toBe(3);

    // Test expand/collapse
    expect(component.isDayOpen(1)).toBe(true);
    component.toggleDay(1);
    expect(component.isDayOpen(1)).toBe(false);

    component.collapseAllDays();
    expect(component.isDayOpen(1)).toBe(false);
    expect(component.isDayOpen(2)).toBe(false);

    component.expandAllDays();
    expect(component.isDayOpen(1)).toBe(true);
    expect(component.isDayOpen(2)).toBe(true);
    expect(component.isDayOpen(3)).toBe(true);
  });

  it('should update slot on onSlotChange', () => {
    const updated = { ...component.slots[0], theme: 'New Theme' };
    component.onSlotChange(updated);
    expect(component.slots[0].theme).toBe('New Theme');
  });

  it('should upload illustration asset and attach url to slot', () => {
    const file = new File(['abc'], 'kyoto.png', { type: 'image/png' });
    component.onUploadMedia({ slot: component.slots[0], file });

    expect(mockRepo.uploadAsset).toHaveBeenCalledWith('camp_edit_1', file);
    expect(component.slots[0].mediaUrl).toBe('https://storage.googleapis.com/bucket/pic.png');
    expect(component.slots[0].textOnly).toBe(false);
  });

  it('should validate title and dates on save', () => {
    component.title = '';
    component.save('draft');
    expect(mockToast.show).toHaveBeenCalledWith('Title is required', 'warning');
    expect(mockRepo.update).not.toHaveBeenCalled();

    component.title = 'Valid Title';
    component.startDate = '2026-12-05';
    component.endDate = '2026-12-01';
    component.save('draft');
    expect(mockToast.show).toHaveBeenCalledWith('Valid start date and end date are required', 'warning');
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('should save updates in edit mode and navigate to /campaigns', () => {
    component.title = 'Updated Title';
    component.startDate = '2026-11-01';
    component.endDate = '2026-11-03';

    component.save('scheduled');
    expect(mockRepo.update).toHaveBeenCalledWith(
      'camp_edit_1',
      expect.objectContaining({
        title: 'Updated Title',
        status: 'scheduled',
      }),
    );
    expect(mockToast.show).toHaveBeenCalledWith('Campaign saved successfully', 'success');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/campaigns']);
  });

  it('should cancel and navigate to /campaigns', () => {
    component.cancel();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/campaigns']);
  });

  it('should create draft and proceed to edit mode on createDraftAndProceed', () => {
    component.title = 'Spring Tour';
    component.startDate = '2026-12-01';
    component.endDate = '2026-12-03';
    component.createDraftAndProceed();

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Spring Tour',
        status: 'draft',
      }),
    );
    expect(mockToast.show).toHaveBeenCalledWith(
      'Campaign draft created. Please configure detailed settings.',
      'success',
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/campaigns', 'camp_new']);
  });

  it('should toggle pause and resume status in editor', () => {
    component.campaignId = 'camp_edit_1';
    component.isPaused = false;
    component.togglePause();

    expect(mockRepo.pause).toHaveBeenCalledWith('camp_edit_1');
    expect(component.isPaused).toBe(true);
    expect(mockToast.show).toHaveBeenCalledWith('Campaign paused successfully', 'success');

    component.togglePause();
    expect(mockRepo.resume).toHaveBeenCalledWith('camp_edit_1');
    expect(component.isPaused).toBe(false);
    expect(mockToast.show).toHaveBeenCalledWith('Campaign resumed successfully', 'success');
  });

  it('should open delete modal, confirm delete and navigate to /campaigns', () => {
    component.campaignId = 'camp_edit_1';
    expect(component.isDeleteModalOpen()).toBe(false);

    component.openDeleteModal();
    expect(component.isDeleteModalOpen()).toBe(true);

    component.closeDeleteModal();
    expect(component.isDeleteModalOpen()).toBe(false);

    component.openDeleteModal();
    component.confirmDelete();

    expect(mockRepo.delete).toHaveBeenCalledWith('camp_edit_1');
    expect(component.isDeleteModalOpen()).toBe(false);
    expect(mockToast.show).toHaveBeenCalledWith('Campaign deleted successfully', 'success');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/campaigns']);
  });

  it('should initialize new campaign defaults when route id is "new"', () => {
    mockRoute.paramMap = of({ get: () => 'new' });
    const newFixture = TestBed.createComponent(CampaignEditorComponent);
    const newComponent = newFixture.componentInstance;
    newFixture.detectChanges();

    expect(newComponent.isEditMode()).toBe(false);
    expect(newComponent.campaignId).toBeNull();
    expect(newComponent.title).toBe('');
    expect(newComponent.presetMode).toBe('standard');
    expect(newComponent.slots.length).toBeGreaterThan(0);
  });

  it('should call repo.create when saving in new campaign mode', () => {
    component.campaignId = null;
    component.isEditMode.set(false);
    component.title = 'New Adventure';
    component.startDate = '2026-12-01';
    component.endDate = '2026-12-02';

    component.save('draft');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'New Adventure',
        status: 'draft',
      }),
    );
    expect(mockToast.show).toHaveBeenCalledWith('Campaign saved successfully', 'success');
  });

  it('should prevent asset upload if campaignId is null', () => {
    component.campaignId = null;
    const file = new File(['test'], 'dummy.png', { type: 'image/png' });
    component.onUploadMedia({ slot: component.slots[0], file });

    expect(mockToast.show).toHaveBeenCalledWith(
      'Please save campaign before uploading images',
      'warning',
    );
    expect(mockRepo.uploadAsset).not.toHaveBeenCalled();
  });

  it('should handle asset upload failure gracefully', () => {
    mockRepo.uploadAsset.mockReturnValue(throwError(() => new Error('Upload error')));
    const file = new File(['test'], 'dummy.png', { type: 'image/png' });
    component.onUploadMedia({ slot: component.slots[0], file });

    expect(mockToast.show).toHaveBeenCalledWith('Failed to upload image', 'error');
  });

  it('should load campaign with custom time slots and nullable fields properly', () => {
    const customCampaign: CampaignDocWithId = {
      ...sampleCampaign,
      id: 'camp_custom_times',
      description: undefined,
      hashtag: undefined,
      dailySlotTimes: ['09:00', '15:00', '21:00'],
    };
    mockRepo.getById.mockReturnValue(of(customCampaign));

    component.loadCampaign('camp_custom_times');
    expect(component.description).toBe('');
    expect(component.hashtag).toBe('');
    expect(component.presetMode).toBe('custom');
    expect(component.selectedCustomTimes).toEqual(['09:00', '15:00', '21:00']);
  });

  it('should navigate to /campaigns when loadCampaign fails', () => {
    mockRepo.getById.mockReturnValue(throwError(() => new Error('Not found')));
    component.loadCampaign('camp_invalid');

    expect(mockToast.show).toHaveBeenCalledWith('Failed to load campaign', 'error');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/campaigns']);
  });

  it('should show warning toast when autoGenerateSlots encounters validation failure and notifyOnValidationError is true', () => {
    // Invalid dates
    component.startDate = '2026-12-05';
    component.endDate = '2026-12-01';
    component.autoGenerateSlots(true);
    expect(mockToast.show).toHaveBeenCalledWith('Invalid start or end date', 'warning');

    // Empty slot times
    component.startDate = '2026-12-01';
    component.endDate = '2026-12-03';
    component.presetMode = 'custom';
    component.selectedCustomTimes = [];
    component.autoGenerateSlots(true);
    expect(mockToast.show).toHaveBeenCalledWith('Please provide valid daily slot times', 'warning');

    // Valid slots regenerated with notification
    component.selectedCustomTimes = ['08:00', '12:00', '19:00'];
    component.autoGenerateSlots(true);
    expect(mockToast.show).toHaveBeenCalledWith(
      expect.stringContaining('スロットを再同期しました'),
      'info',
    );
  });

  it('should validate masterContext and replyContextSummary when saving as scheduled or active', () => {
    component.title = 'Winter Journey';
    component.startDate = '2026-12-01';
    component.endDate = '2026-12-03';
    component.masterContext = '';
    component.replyContextSummary = '';

    // Missing master context
    component.save('scheduled');
    expect(mockToast.show).toHaveBeenCalledWith(
      'Master context is required for scheduled campaigns',
      'warning',
    );
    expect(mockRepo.update).not.toHaveBeenCalled();

    // Missing reply context summary
    component.masterContext = 'Valid Master Context';
    component.save('scheduled');
    expect(mockToast.show).toHaveBeenCalledWith(
      'Reply context summary is required for scheduled campaigns',
      'warning',
    );
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('should handle error when save fails', () => {
    component.title = 'Valid Title';
    component.startDate = '2026-12-01';
    component.endDate = '2026-12-03';
    mockRepo.update.mockReturnValue(throwError(() => ({ error: { error: 'Database lock' } })));

    component.save('draft');
    expect(mockToast.show).toHaveBeenCalledWith('Database lock', 'error');
    expect(component.isSaving()).toBe(false);
  });

  it('should validate inputs and handle error on createDraftAndProceed', () => {
    // Empty title
    component.title = '';
    component.createDraftAndProceed();
    expect(mockToast.show).toHaveBeenCalledWith('Title is required', 'warning');

    // Invalid dates
    component.title = 'Valid Title';
    component.startDate = '2026-12-05';
    component.endDate = '2026-12-01';
    component.createDraftAndProceed();
    expect(mockToast.show).toHaveBeenCalledWith('Valid start date and end date are required', 'warning');

    // API error
    component.startDate = '2026-12-01';
    component.endDate = '2026-12-03';
    mockRepo.create.mockReturnValue(throwError(() => ({ error: { error: 'Creation failed' } })));
    component.createDraftAndProceed();
    expect(mockToast.show).toHaveBeenCalledWith('Creation failed', 'error');
    expect(component.isSaving()).toBe(false);
  });

  it('should guard against null campaignId in togglePause and confirmDelete', () => {
    component.campaignId = null;

    component.togglePause();
    expect(mockRepo.pause).not.toHaveBeenCalled();
    expect(mockRepo.resume).not.toHaveBeenCalled();

    component.confirmDelete();
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('should handle error in togglePause and confirmDelete', () => {
    component.campaignId = 'camp_edit_1';

    mockRepo.pause.mockReturnValue(throwError(() => new Error('Pause failed')));
    component.isPaused = false;
    component.togglePause();
    expect(mockToast.show).toHaveBeenCalledWith('Failed to toggle pause status', 'error');
    expect(component.isTogglingPause()).toBe(false);

    mockRepo.delete.mockReturnValue(throwError(() => new Error('Delete failed')));
    component.confirmDelete();
    expect(mockToast.show).toHaveBeenCalledWith('Failed to delete campaign', 'error');
    expect(component.isDeleting()).toBe(false);
  });

  it('should open a closed day via toggleDay', () => {
    component.collapseAllDays();
    expect(component.isDayOpen(1)).toBe(false);

    component.toggleDay(1);
    expect(component.isDayOpen(1)).toBe(true);
  });
});
