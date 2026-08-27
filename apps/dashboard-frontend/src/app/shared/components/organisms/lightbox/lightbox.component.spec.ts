import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LightboxComponent } from './lightbox.component';

describe('LightboxComponent', () => {
  let component: LightboxComponent;
  let fixture: ComponentFixture<LightboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LightboxComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LightboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create lightbox component', () => {
    expect(component).toBeTruthy();
    expect(component.isOpen).toBeFalse();
  });

  it('should emit close on closeLightbox()', () => {
    spyOn(component.lightboxClose, 'emit');
    component.closeLightbox();
    expect(component.lightboxClose.emit).toHaveBeenCalled();
  });

  it('should close on Escape keydown when open', () => {
    spyOn(component.lightboxClose, 'emit');
    component.isOpen = true;
    component.onKeydownHandler();
    expect(component.lightboxClose.emit).toHaveBeenCalled();
  });
});
