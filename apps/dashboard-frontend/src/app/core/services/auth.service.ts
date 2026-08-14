import { Injectable } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, User, signOut, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Service responsible for managing user authentication state and interactions
 * with Firebase Authentication.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();
  
  private initPromise: Promise<void>;

  constructor() {
    const app = !getApps().length ? initializeApp(environment.firebase) : getApp();
    this.auth = getAuth(app);
    
    if (!environment.production && (environment as Record<string, unknown>)['useEmulators']) {
      connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
    
    this.initPromise = new Promise<void>((resolve) => {
      onAuthStateChanged(this.auth, (user) => {
        this.currentUserSubject.next(user);
        resolve();
      });
    });
  }

  /**
   * Waits for the initial authentication state to be resolved.
   *
   * @returns {Promise<void>} A promise that resolves when the auth state is initialized.
   */
  async waitForInit(): Promise<void> {
    return this.initPromise;
  }

  /**
   * Initiates a login flow using Google as the authentication provider.
   *
   * @returns {Promise<User>} A promise that resolves to the authenticated user.
   * @throws Will throw an error if the login process fails.
   */
  async loginWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    try {
      const result = await signInWithPopup(this.auth, provider);
      return result.user;
    } catch (error) {
      console.error('Google login error', error);
      throw error;
    }
  }

  /**
   * Logs out the currently authenticated user.
   *
   * @returns {Promise<void>} A promise that resolves when the user is logged out.
   * @throws Will throw an error if the logout process fails.
   */
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('Logout error', error);
      throw error;
    }
  }

  /**
   * Retrieves the currently authenticated user.
   *
   * @returns {User | null} The current user, or null if no user is logged in.
   */
  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Retrieves the ID token for the currently authenticated user.
   *
   * @returns {Promise<string | null>} A promise that resolves to the token string, or null if unauthenticated.
   */
  async getToken(): Promise<string | null> {
    const user = this.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  }
}
