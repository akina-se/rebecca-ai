import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  User, 
  signOut, 
  onAuthStateChanged, 
  connectAuthEmulator, 
  Auth 
} from 'firebase/auth';
import { ConfigService } from './config.service';
import { Observable } from 'rxjs';

/**
 * Service responsible for managing user authentication state and interactions
 * with Firebase Authentication.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private configService = inject(ConfigService);
  private auth: Auth | null = null;
  private app: FirebaseApp | null = null;
  private authReadyPromise: Promise<void> | null = null;

  /** Native Angular Signal for current authenticated user */
  readonly currentUserSignal = signal<User | null>(null);
  public currentUser$: Observable<User | null> = toObservable(this.currentUserSignal);

  get isEmulator(): boolean {
    return this.configService.isEmulator;
  }

  private ensureAuth(): Auth {
    if (!this.auth) {
      const firebaseConfig = this.configService.firebaseConfig;
      this.app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      this.auth = getAuth(this.app);
      
      if (this.configService.isEmulator) {
        connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      }
      
      onAuthStateChanged(this.auth, (user) => {
        this.currentUserSignal.set(user);
      });
      
      this.authReadyPromise = typeof this.auth.authStateReady === 'function' 
        ? this.auth.authStateReady() 
        : Promise.resolve();
    }
    const currentAuth = this.auth;
    if (!currentAuth) {
      throw new Error('Firebase Auth initialization failed');
    }
    return currentAuth;
  }

  /**
   * Detects whether the current environment is a mobile browser (iOS, Android)
   * where popup windows are frequently blocked or suppressed.
   */
  isMobileDevice(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }
    const userAgent = navigator.userAgent;
    const isMobileUA = /iPhone|iPad|iPod|Android/i.test(userAgent);
    const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isMobileUA || isIPadOS;
  }

  /**
   * Waits for Firebase Auth to complete its initial authentication state check.
   */
  async waitForInit(): Promise<void> {
    this.ensureAuth();
    if (this.authReadyPromise) {
      await this.authReadyPromise;
    }
    const user = this.auth?.currentUser ?? null;
    if (this.currentUserSignal() !== user) {
      this.currentUserSignal.set(user);
    }
  }

  /**
   * Checks for and processes the result of a previous signInWithRedirect flow.
   * Should be invoked on application or login page initialization.
   *
   * @returns The authenticated User if a redirect sign-in just completed, or null otherwise.
   */
  async handleRedirectResult(): Promise<User | null> {
    const auth = this.ensureAuth();
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        await result.user.getIdToken(true);
        this.currentUserSignal.set(result.user);
        return result.user;
      }
      return null;
    } catch (error) {
      console.error('Redirect sign-in error', error);
      throw error;
    }
  }

  /**
   * Logs in with Email & Password against Firebase Auth (used for Emulators & E2E tests).
   */
  async loginWithEmail(email: string, password: string): Promise<void> {
    if (!this.configService.isEmulator) {
      throw new Error('Email/password login is strictly disabled outside local emulator environments.');
    }
    const auth = this.ensureAuth();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await cred.user.getIdToken(true);
    this.currentUserSignal.set(cred.user);
  }

  /**
   * Initiates a login flow using Google as the authentication provider.
   * On mobile devices (iOS Safari, Android Chrome), uses signInWithRedirect to avoid
   * silent popup suppression. On desktop, uses signInWithPopup with a timeout guard
   * and fallback to signInWithRedirect if popups are blocked.
   *
   * @returns The authenticated User if resolved via popup, or null if redirect was triggered.
   */
  async loginWithGoogle(): Promise<User | null> {
    const auth = this.ensureAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    if (this.isMobileDevice()) {
      await signInWithRedirect(auth, provider);
      return null;
    }

    try {
      const popupPromise = signInWithPopup(auth, provider);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Authentication popup timed out or was blocked by browser. Please try again.')),
          25000
        )
      );
      const result = await Promise.race([popupPromise, timeoutPromise]);
      await result.user.getIdToken(true);
      this.currentUserSignal.set(result.user);
      return result.user;
    } catch (error: unknown) {
      const authError = error as { code?: string };
      if (authError?.code === 'auth/popup-blocked') {
        console.warn('Authentication popup was blocked by browser, falling back to signInWithRedirect.');
        await signInWithRedirect(auth, provider);
        return null;
      }
      console.error('Google login error', error);
      throw error;
    }
  }

  /**
   * Logs out the currently authenticated user.
   */
  async logout(): Promise<void> {
    const auth = this.ensureAuth();
    await signOut(auth);
    this.currentUserSignal.set(null);
  }

  /**
   * Retrieves the currently authenticated user.
   */
  get currentUser(): User | null {
    return this.currentUserSignal() ?? this.auth?.currentUser ?? null;
  }

  /**
   * Synchronously retrieves the current user's Firebase in-memory access token without async queue lockups.
   */
  getSyncToken(): string | null {
    const user = this.currentUser;
    if (!user) return null;
    const userObj = user as unknown as { accessToken?: string; stsTokenManager?: { accessToken?: string } };
    return userObj.accessToken ?? userObj.stsTokenManager?.accessToken ?? null;
  }

  /**
   * Retrieves the current user's Firebase ID token for HTTP authorization headers.
   */
  async getToken(): Promise<string | null> {
    const sync = this.getSyncToken();
    if (sync) return sync;

    const user = this.currentUser;
    if (!user) return null;

    try {
      return await Promise.race([
        user.getIdToken(false),
        new Promise<string | null>((_, reject) => setTimeout(() => reject(new Error('getIdToken timeout')), 1000))
      ]);
    } catch {
      return null;
    }
  }
}
