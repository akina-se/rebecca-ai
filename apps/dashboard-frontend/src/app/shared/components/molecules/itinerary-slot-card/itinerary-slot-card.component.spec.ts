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
    expect(component.formatTimeDisplay('2026-11-01T08:00:00Z')).toBe('08:00 UTC');
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

  it('should remove media, set textOnly to true and emit slotChange', () => {
    jest.spyOn(component.slotChange, 'emit');
    component.slot.mediaUrl = 'https://storage.googleapis.com/bucket/pic.jpg';

    component.removeMedia();
    expect(component.slot.mediaUrl).toBeUndefined();
    expect(component.slot.textOnly).toBe(true);
    expect(component.slotChange.emit).toHaveBeenCalled();
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
});
