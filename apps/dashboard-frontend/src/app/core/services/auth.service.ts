import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
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

  private ensureAuth(): Auth {
    if (!this.auth) {
      const firebaseConfig = this.configService.firebaseConfig;
      this.app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      this.auth = getAuth(this.app);
      
      const isLocalHost = typeof window !== 'undefined' && 
        (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');
      if (this.configService.isEmulator || isLocalHost) {
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
   * Logs in with Email & Password against Firebase Auth (used for Emulators & E2E tests).
   */
  async loginWithEmail(email: string, password: string): Promise<void> {
    const auth = this.ensureAuth();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    this.currentUserSignal.set(cred.user);
  }

  /**
   * Initiates a login flow using Google as the authentication provider.
   */
  async loginWithGoogle(): Promise<User> {
    const auth = this.ensureAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      const result = await signInWithPopup(auth, provider);
      this.currentUserSignal.set(result.user);
      return result.user;
    } catch (error) {
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
    return this.currentUserSignal() || this.auth?.currentUser || null;
  }

  /**
   * Synchronously retrieves the current user's Firebase in-memory access token without async queue lockups.
   */
  getSyncToken(): string | null {
    const user = this.currentUser;
    if (!user) return null;
    const userObj = user as unknown as { accessToken?: string; stsTokenManager?: { accessToken?: string } };
    return userObj.accessToken || userObj.stsTokenManager?.accessToken || null;
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
