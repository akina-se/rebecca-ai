import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ItinerarySlotCardComponent } from './itinerary-slot-card.component';
import { CampaignSlot } from '@rebecca/types';

describe('ItinerarySlotCardComponent', () => {
  let component: ItinerarySlotCardComponent;
  let fixture: ComponentFixture<ItinerarySlotCardComponent>;

  const sampleSlot: CampaignSlot = {
    slotId: 'slot-1-0800',
    dayNumber: 1,
    timePeriod: 'morning',
    scheduledTime: '2026-11-01T08:00:00Z',
    theme: 'Arrival in Kyoto',
    status: 'pending',
    isFixedText: false,
    captionPromptHint: 'Excited arrival tweet',
    textOnly: false,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItinerarySlotCardComponent, FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ItinerarySlotCardComponent);
    component = fixture.componentInstance;
    component.slot = { ...sampleSlot };
    fixture.detectChanges();
  });

  it('should create and display day and time period information', () => {
    expect(component).toBeTruthy();
    expect(component.getTimePeriodIcon('morning')).toBe('light_mode');
    expect(component.getTimePeriodIcon('afternoon')).toBe('wb_sunny');
    expect(component.getTimePeriodIcon('evening')).toBe('nights_stay');
    expect(component.getTimePeriodIcon('night')).toBe('bedtime');
    expect(component.formatTimeDisplay('2026-11-01T08:00:00Z')).toBe('08:00');
    expect(component.formatTimeDisplay('2026-09-23T03:00:00+09:00')).toBe('03:00');
  });

  it('should toggle fixed text mode and emit slotChange', () => {
    jest.spyOn(component.slotChange, 'emit');

    component.setFixedTextMode(true);
    expect(component.slot.isFixedText).toBe(true);
    expect(component.slotChange.emit).toHaveBeenCalledWith(
      expect.objectContaining({ isFixedText: true }),
    );

    component.setFixedTextMode(false);
    expect(component.slot.isFixedText).toBe(false);
    expect(component.slotChange.emit).toHaveBeenCalledWith(
      expect.objectContaining({ isFixedText: false }),
    );
  });

  it('should remove media, emit deleteMedia and slotChange', () => {
    jest.spyOn(component.slotChange, 'emit');
    jest.spyOn(component.deleteMedia, 'emit');
    component.slot.mediaUrl = '/api/v1/campaigns/c1/assets/pic.jpg';

    component.removeMedia();
    expect(component.slot.mediaUrl).toBeUndefined();
    expect(component.deleteMedia.emit).toHaveBeenCalledWith({
      slot: component.slot,
      filename: 'pic.jpg',
    });
    expect(component.slotChange.emit).toHaveBeenCalled();
  });

  it('should compute thumbnail and full URLs, and open/close Lightbox', () => {
    component.slot.mediaUrl = '/api/v1/campaigns/c1/assets/pic.jpg';
    expect(component.getThumbnailUrl()).toBe('/api/v1/campaigns/c1/assets/pic.jpg?size=thumbnail');
    expect(component.getFullImageUrl()).toBe('/api/v1/campaigns/c1/assets/pic.jpg?size=full');
    expect(component.getAssetFilename()).toBe('pic.jpg');

    component.openLightbox();
    expect(component.isLightboxOpen).toBe(true);

    component.closeLightbox();
    expect(component.isLightboxOpen).toBe(false);

    // Empty URL handling
    component.slot.mediaUrl = undefined;
    expect(component.getThumbnailUrl()).toBe('');
    expect(component.getFullImageUrl()).toBe('');
    expect(component.getAssetFilename()).toBe('');
  });

  it('should emit uploadMedia when onFileSelected is triggered', () => {
    jest.spyOn(component.uploadMedia, 'emit');
    const mockFile = new File(['data'], 'test.png', { type: 'image/png' });
    const mockEvent = {
      target: {
        files: [mockFile],
        value: 'C:\\fake\\test.png',
      },
    } as unknown as Event;

    component.onFileSelected(mockEvent);
    expect(component.uploadMedia.emit).toHaveBeenCalledWith({
      slot: component.slot,
      file: mockFile,
    });
  });

  it('should not modify state when isReadonly is true', () => {
    component.isReadonly = true;
    jest.spyOn(component.slotChange, 'emit');

    component.setFixedTextMode(true);
    expect(component.slotChange.emit).not.toHaveBeenCalled();

    component.removeMedia();
    expect(component.slotChange.emit).not.toHaveBeenCalled();
  });

  it('should toggle skip status between pending and skipped, and emit slotChange', () => {
    jest.spyOn(component.slotChange, 'emit');

    // pending -> skipped
    component.slot.status = 'pending';
    component.toggleSkip();
    expect(component.slot.status).toBe('skipped');
    expect(component.slotChange.emit).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' }),
    );

    // skipped -> pending
    component.toggleSkip();
    expect(component.slot.status).toBe('pending');
    expect(component.slotChange.emit).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
  });

  it('should not toggle skip if slot is already posted or isReadonly is true', () => {
    jest.spyOn(component.slotChange, 'emit');

    // Posted guard
    component.slot.status = 'posted';
    component.toggleSkip();
    expect(component.slot.status).toBe('posted');
    expect(component.slotChange.emit).not.toHaveBeenCalled();

    // isReadonly guard
    component.slot.status = 'pending';
    component.isReadonly = true;
    component.toggleSkip();
    expect(component.slot.status).toBe('pending');
    expect(component.slotChange.emit).not.toHaveBeenCalled();
  });

  it('should handle formatTimeDisplay edge cases (empty or invalid string)', () => {
    expect(component.formatTimeDisplay('')).toBe('--:--');
    expect(component.formatTimeDisplay('invalid-date-string')).toBe('invalid-date-string');
  });

  it('should return default schedule icon for unknown time period', () => {
    expect(component.getTimePeriodIcon('custom_period' as any)).toBe('schedule');
  });

  it('should reset isUploading on slot ngOnChanges input change', () => {
    component.isUploading = true;
    component.ngOnChanges({
      slot: {
        currentValue: { ...sampleSlot, slotId: 'slot-2' },
        previousValue: sampleSlot,
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    expect(component.isUploading).toBe(false);
  });

  it('should not emit uploadMedia if file input has no files selected', () => {
    jest.spyOn(component.uploadMedia, 'emit');
    const mockEvent = {
      target: {
        files: [] as unknown as FileList,
        value: '',
      },
    } as unknown as Event;

    component.onFileSelected(mockEvent);
    expect(component.uploadMedia.emit).not.toHaveBeenCalled();
  });
});
