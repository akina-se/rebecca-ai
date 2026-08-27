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
    authServiceSpy = jasmine.createSpyObj('AuthService', ['loginWithGoogle', 'loginWithEmail']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    authServiceSpy.loginWithEmail.and.returnValue(Promise.resolve());
    authServiceSpy.loginWithGoogle.and.returnValue(Promise.resolve({ uid: 'admin_123' } as any));

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

  it('should create login page component', () => {
    expect(component).toBeTruthy();
    expect(component.isLoading).toBeFalse();
    expect(component.error).toBeNull();
  });

  it('should handle successful login and navigate to dashboard', async () => {
    authServiceSpy.loginWithEmail.and.returnValue(Promise.resolve());
    authServiceSpy.loginWithGoogle.and.returnValue(Promise.resolve({ uid: 'admin_123' } as any));

    await component.loginWithGoogle();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.isLoading).toBeFalse();
  });

  it('should handle login error and display message', async () => {
    authServiceSpy.loginWithEmail.and.callFake(() => Promise.reject(new Error('Popup closed by user')));
    authServiceSpy.loginWithGoogle.and.callFake(() => Promise.reject(new Error('Popup closed by user')));

    await component.loginWithGoogle();

    expect(component.error).toBe('Popup closed by user');
    expect(routerSpy.navigate).not.toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
  });

  it('should handle non-Error exception gracefully', async () => {
    authServiceSpy.loginWithEmail.and.callFake(() => Promise.reject('Unexpected string error'));
    authServiceSpy.loginWithGoogle.and.callFake(() => Promise.reject('Unexpected string error'));

    await component.loginWithGoogle();

    expect(component.error).toBe('Authentication failed. Please try again.');
    expect(component.isLoading).toBeFalse();
  });
});
