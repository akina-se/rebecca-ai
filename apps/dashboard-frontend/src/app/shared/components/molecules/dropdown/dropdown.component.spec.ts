import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DropdownComponent } from './dropdown.component';

describe('DropdownComponent', () => {
  let component: DropdownComponent;
  let fixture: ComponentFixture<DropdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DropdownComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create dropdown component', () => {
    expect(component).toBeTruthy();
    expect(component.isOpen).toBeFalse();
  });

  it('should toggle open/closed on toggle()', () => {
    component.toggle();
    expect(component.isOpen).toBeTrue();

    component.toggle();
    expect(component.isOpen).toBeFalse();
  });

  it('should select option, emit selectionChange, and close dropdown', () => {
    spyOn(component.selectionChange, 'emit');
    component.isOpen = true;

    component.selectOption('Option B');

    expect(component.selectedOption).toBe('Option B');
    expect(component.selectionChange.emit).toHaveBeenCalledWith('Option B');
    expect(component.isOpen).toBeFalse();
  });

  it('should close on outside click', () => {
    component.isOpen = true;
    const outsideEvent = {
      target: document.createElement('div')
    } as any;

    component.clickout(outsideEvent);
    expect(component.isOpen).toBeFalse();
  });
});
