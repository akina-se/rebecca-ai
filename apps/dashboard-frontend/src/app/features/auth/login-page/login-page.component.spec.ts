import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { LoginPageComponent } from './login-page.component';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigService } from '../../../core/services/config.service';

describe('LoginPageComponent', () => {
  let component: LoginPageComponent;
  let fixture: ComponentFixture<LoginPageComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let configServiceSpy: jasmine.SpyObj<ConfigService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', [
      'loginWithGoogle',
      'loginWithEmail',
      'handleRedirectResult',
      'waitForInit'
    ], {
      currentUser: null
    });
    configServiceSpy = jasmine.createSpyObj('ConfigService', ['adminTitle', 'brandName'], {
      isEmulator: false
    });
    configServiceSpy.adminTitle.and.returnValue('REBECCA AI CORE ADMIN');
    configServiceSpy.brandName.and.returnValue('Rebecca AI');

    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    authServiceSpy.loginWithEmail.and.returnValue(Promise.resolve());
    authServiceSpy.loginWithGoogle.and.returnValue(Promise.resolve({ uid: 'admin_123' } as any));
    authServiceSpy.handleRedirectResult.and.returnValue(Promise.resolve(null));
    authServiceSpy.waitForInit.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ConfigService, useValue: configServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create login page component and check redirect status on init', () => {
    expect(component).toBeTruthy();
    expect(authServiceSpy.handleRedirectResult).toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
    expect(component.error).toBeNull();
  });

  it('should navigate to dashboard if handleRedirectResult returns an authenticated user', async () => {
    authServiceSpy.handleRedirectResult.and.returnValue(Promise.resolve({ uid: 'redirect_user' } as any));
    await component.ngOnInit();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should navigate to dashboard if user is already authenticated on init', async () => {
    authServiceSpy.handleRedirectResult.and.returnValue(Promise.resolve(null));
    Object.defineProperty(authServiceSpy, 'currentUser', { value: { uid: 'existing_user' }, configurable: true });
    await component.ngOnInit();
    expect(authServiceSpy.waitForInit).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should skip redirect check on init when running against emulator', async () => {
    (routerSpy.navigate as any).mockClear?.();
    (authServiceSpy.handleRedirectResult as any).mockClear?.();
    Object.defineProperty(configServiceSpy, 'isEmulator', { value: true, configurable: true });
    await component.ngOnInit();
    expect(authServiceSpy.handleRedirectResult).not.toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('should handle redirect error on init with Error instance', async () => {
    authServiceSpy.handleRedirectResult.and.returnValue(Promise.reject(new Error('Redirect auth failed')));
    await component.ngOnInit();
    expect(component.error).toBe('Redirect auth failed');
    expect(component.isLoading).toBeFalse();
  });

  it('should handle redirect error on init with non-Error value', async () => {
    authServiceSpy.handleRedirectResult.and.returnValue(Promise.reject('Network fail'));
    await component.ngOnInit();
    expect(component.error).toBe('Authentication failed. Please try again.');
    expect(component.isLoading).toBeFalse();
  });

  it('should handle successful desktop popup login and navigate to dashboard', async () => {
    authServiceSpy.loginWithGoogle.and.returnValue(Promise.resolve({ uid: 'admin_123' } as any));

    await component.loginWithGoogle();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.isLoading).toBeFalse();
  });

  it('should handle mobile redirect login when loginWithGoogle returns null', async () => {
    (routerSpy.navigate as any).mockClear?.();
    authServiceSpy.loginWithGoogle.and.returnValue(Promise.resolve(null));

    await component.loginWithGoogle();

    expect(routerSpy.navigate).not.toHaveBeenCalled();
    expect(component.isLoading).toBeTrue();
  });

  it('should login with email and navigate when emulator is enabled', async () => {
    Object.defineProperty(configServiceSpy, 'isEmulator', { value: true, configurable: true });
    authServiceSpy.loginWithEmail.and.returnValue(Promise.resolve());

    await component.loginWithGoogle();

    expect(authServiceSpy.loginWithEmail).toHaveBeenCalledWith('admin@example.com', 'password123');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.isLoading).toBeFalse();
  });

  it('should handle login error and display message', async () => {
    authServiceSpy.loginWithGoogle.and.callFake(() => Promise.reject(new Error('Popup closed by user')));

    await component.loginWithGoogle();

    expect(component.error).toBe('Popup closed by user');
    expect(routerSpy.navigate).not.toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
  });

  it('should handle non-Error exception gracefully in loginWithGoogle', async () => {
    authServiceSpy.loginWithGoogle.and.callFake(() => Promise.reject('Unexpected string error'));

    await component.loginWithGoogle();

    expect(component.error).toBe('Authentication failed. Please try again.');
    expect(component.isLoading).toBeFalse();
  });
});
