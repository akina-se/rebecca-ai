import { Injectable } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, User, signOut, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

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
    
    if (!environment.production && (environment as any).useEmulators) {
      connectAuthEmulator(this.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
    
    this.initPromise = new Promise<void>((resolve) => {
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        this.currentUserSubject.next(user);
        resolve();
      });
    });
  }

  async waitForInit(): Promise<void> {
    return this.initPromise;
  }

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

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('Logout error', error);
      throw error;
    }
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  async getToken(): Promise<string | null> {
    const user = this.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  }
}
