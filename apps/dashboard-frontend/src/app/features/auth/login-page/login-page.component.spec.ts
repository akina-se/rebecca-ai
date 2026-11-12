import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { LoginPageComponent } from './login-page.component';
import { AuthService } from '../../../core/services/auth.service';

describe('LoginPageComponent', () => {
  let component: LoginPageComponent;
  let fixture: ComponentFixture<LoginPageComponent>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['loginWithGoogle', 'waitForInit'], {
      currentUser: null
    });
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    authServiceSpy.loginWithGoogle.and.returnValue(Promise.resolve({ uid: 'admin_123' } as any));
    authServiceSpy.waitForInit.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create login page component without blocking loading state', () => {
    expect(component).toBeTruthy();
    expect(component.isLoading).toBeFalse();
    expect(component.error).toBeNull();
  });

  it('should navigate to dashboard on init if user is already authenticated', async () => {
    const authenticatedAuthSpy = jasmine.createSpyObj('AuthService', ['loginWithGoogle', 'waitForInit'], {
      currentUser: { uid: 'existing_admin' } as any
    });
    authenticatedAuthSpy.waitForInit.and.returnValue(Promise.resolve());

    const navRouterSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: authenticatedAuthSpy },
        { provide: Router, useValue: navRouterSpy }
      ]
    }).compileComponents();

    const authFixture = TestBed.createComponent(LoginPageComponent);
    const authComp = authFixture.componentInstance;
    await authComp.ngOnInit();

    expect(navRouterSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(authComp.isLoading).toBeFalse();
  });

  it('should handle successful login and navigate to dashboard', async () => {
    authServiceSpy.loginWithGoogle.and.returnValue(Promise.resolve({ uid: 'admin_123' } as any));

    await component.loginWithGoogle();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.isLoading).toBeFalse();
    expect(component.error).toBeNull();
  });

  it('should ignore user cancellation when popup is closed without setting error message', async () => {
    const popupError: any = new Error('Popup closed');
    popupError.code = 'auth/popup-closed-by-user';
    authServiceSpy.loginWithGoogle.and.returnValue(Promise.reject(popupError));

    await component.loginWithGoogle();

    expect(component.error).toBeNull();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
  });

  it('should handle login error and display message', async () => {
    authServiceSpy.loginWithGoogle.and.returnValue(Promise.reject(new Error('Network error')));

    await component.loginWithGoogle();

    expect(component.error).toBe('Network error');
    expect(routerSpy.navigate).not.toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
  });

  it('should handle non-Error exception gracefully', async () => {
    authServiceSpy.loginWithGoogle.and.returnValue(Promise.reject('Unexpected string error'));

    await component.loginWithGoogle();

    expect(component.error).toBe('Authentication failed. Please try again.');
    expect(component.isLoading).toBeFalse();
  });
});
