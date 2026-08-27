import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AppComponent } from './app.component';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './core/services/auth.service';
import { of } from 'rxjs';

describe('AppComponent', () => {
  let mockAuthService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    mockAuthService = jasmine.createSpyObj('AuthService', ['waitForInit'], {
      currentUser$: of({ uid: 'user_1' } as any),
      currentUserSignal: signal({ uid: 'user_1' } as any),
      currentUser: { uid: 'user_1' } as any
    });
    mockAuthService.waitForInit.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();
  });

  it('should create the app and authenticate user on init', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    expect(app.isLoggedIn()).toBeTrue();
  });
});
