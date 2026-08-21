import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePickerPopoverComponent } from './date-picker-popover.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('DatePickerPopoverComponent', () => {
  let component: DatePickerPopoverComponent;
  let fixture: ComponentFixture<DatePickerPopoverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatePickerPopoverComponent, HttpClientTestingModule]
    }).compileComponents();

    fixture = TestBed.createComponent(DatePickerPopoverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create date picker popover component', () => {
    expect(component).toBeTruthy();
    expect(component.isOpen).toBeFalse();
  });

  it('should toggle popover open/close on monthly and yearly mode', () => {
    component.mode = 'monthly';
    component.toggle();
    expect(component.isOpen).toBeTrue();

    component.toggle();
    expect(component.isOpen).toBeFalse();
  });

  it('should not toggle popover on all-time mode', () => {
    component.mode = 'all-time';
    component.toggle();
    expect(component.isOpen).toBeFalse();
  });

  it('should emit previous and next events and honor hasNext flag', () => {
    spyOn(component.previous, 'emit');
    spyOn(component.next, 'emit');

    const mockEvent = new MouseEvent('click');
    component.onPrev(mockEvent);
    expect(component.previous.emit).toHaveBeenCalled();

    component.hasNext = true;
    component.onNext(mockEvent);
    expect(component.next.emit).toHaveBeenCalledTimes(1);

    component.hasNext = false;
    component.onNext(mockEvent);
    expect(component.next.emit).toHaveBeenCalledTimes(1); // Not called again
  });

  it('should emit pick event and close popover when selecting option', () => {
    spyOn(component.pick, 'emit');
    component.isOpen = true;

    const mockEvent = new MouseEvent('click');
    component.select('July 2026', mockEvent);

    expect(component.pick.emit).toHaveBeenCalledWith('July 2026');
    expect(component.isOpen).toBeFalse();
  });

  it('should close popover on outside click', () => {
    component.isOpen = true;
    const outsideTarget = document.createElement('div');
    document.body.appendChild(outsideTarget);

    component.clickout({ target: outsideTarget } as any);
    expect(component.isOpen).toBeFalse();
    document.body.removeChild(outsideTarget);
  });

  it('should provide options based on mode', () => {
    component.mode = 'yearly';
    expect(component.mockOptions).toContain('2026');

    component.mode = 'monthly';
    expect(component.mockOptions).toContain('July 2026');
  });
});
