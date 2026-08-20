import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RightDrawerComponent } from './right-drawer.component';
import { DrawerService } from '../../../../core/services/drawer.service';

describe('RightDrawerComponent', () => {
  let component: RightDrawerComponent;
  let fixture: ComponentFixture<RightDrawerComponent>;
  let drawerService: DrawerService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RightDrawerComponent],
      providers: [DrawerService]
    }).compileComponents();

    fixture = TestBed.createComponent(RightDrawerComponent);
    component = fixture.componentInstance;
    drawerService = TestBed.inject(DrawerService);
    fixture.detectChanges();
  });

  it('should create right drawer component', () => {
    expect(component).toBeTruthy();
  });

  it('should emit closeDrawer on close()', () => {
    spyOn(component.closeDrawer, 'emit');
    component.close();
    expect(component.closeDrawer.emit).toHaveBeenCalled();
  });

  it('should open AI copilot on openAiCopilot()', () => {
    spyOn(drawerService, 'open');
    component.openAiCopilot();
    expect(drawerService.open).toHaveBeenCalled();
  });
});
