import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TopNavComponent } from './top-nav.component';
import { AuthService } from '../../core/services/auth.service';
import { DrawerService } from '../../core/services/drawer.service';
import { TranslationService } from '../../core/services/translation.service';
import { SettingsService } from '../../core/services/settings.service';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('TopNavComponent', () => {
  let component: TopNavComponent;
  let fixture: ComponentFixture<TopNavComponent>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let drawerService: DrawerService;

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj('AuthService', ['logout'], {
      currentUser$: of({ displayName: 'Test User', email: 'test@example.com' })
    });
    mockRouter = jasmine.createSpyObj('Router', ['navigate'], { url: '/dashboard' });

    await TestBed.configureTestingModule({
      imports: [TopNavComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        DrawerService,
        TranslationService,
        SettingsService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TopNavComponent);
    component = fixture.componentInstance;
    drawerService = TestBed.inject(DrawerService);
    fixture.detectChanges();
  });

  it('should calculate pageTitle properly based on router url', () => {
    expect(component.pageTitle).toBeDefined();

    Object.defineProperty(mockRouter, 'url', { value: '/memory', configurable: true });
    expect(component.pageTitle).toBeDefined();

    Object.defineProperty(mockRouter, 'url', { value: '/assets', configurable: true });
    expect(component.pageTitle).toBeDefined();

    Object.defineProperty(mockRouter, 'url', { value: '/users', configurable: true });
    expect(component.pageTitle).toBeDefined();

    Object.defineProperty(mockRouter, 'url', { value: '/settings', configurable: true });
    expect(component.pageTitle).toBeDefined();

    Object.defineProperty(mockRouter, 'url', { value: '', configurable: true });
    expect(component.pageTitle).toBeDefined();
  });

  it('should provide valid userAvatarUrl', () => {
    expect(component.userAvatarUrl).toContain('data:image/svg+xml;utf8');
  });

  it('should toggle AI copilot drawer and emit openDrawer', () => {
    spyOn(component.openDrawer, 'emit');
    spyOn(drawerService, 'toggle');

    component.toggleDrawer();

    expect(drawerService.toggle).toHaveBeenCalled();
    expect(component.openDrawer.emit).toHaveBeenCalled();
  });

  it('should toggle user dropdown menu and handle clickout', () => {
    const mockEvent = { stopPropagation: jasmine.createSpy('stopPropagation') } as any;

    component.toggleUserDropdown(mockEvent);
    expect(component.isUserDropdownOpen).toBeTrue();

    const outsideClickEvent = { target: document.createElement('div') } as any;
    component.clickout(outsideClickEvent);
    expect(component.isUserDropdownOpen).toBeFalse();
  });

  it('should navigate to /login on logout', () => {
    component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
