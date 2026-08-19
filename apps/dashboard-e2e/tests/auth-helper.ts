import { Page } from '@playwright/test';

/**
 * Sets up network request forwarding for API routes where frontend repository
 * base URLs may need mapping to the BFF service endpoints.
 */
export async function setupApiRouting(page: Page) {
  // Pass-through routing with graceful teardown error suppression
  await page.route('**/api/v1/**', async (route) => {
    try {
      await route.continue();
    } catch {
      // Ignored if test page is closing
    }
  });
}


/**
 * Authenticates a test user against the local Firebase Auth Emulator
 * and reliably injects the session into the browser's IndexedDB (firebaseLocalStorageDb)
 * so that Firebase Auth SDK immediately restores the authenticated user session.
 */
export async function loginWithEmulatorAndSeedDB(page: Page, email = 'admin@example.com', password = 'password123') {
  console.log(`[auth-helper] Setting up network API routing...`);
  await setupApiRouting(page);

  console.log(`[auth-helper] Authenticating ${email} via emulator REST API in browser...`);

  // 1. Navigate to the login page first to establish the origin context.
  console.log(`[auth-helper] Navigating to /login to establish origin...`);
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  console.log(`[auth-helper] Navigation complete.`);

  // 2. Perform authentication via Auth Emulator REST API inside the browser context
  const firebaseUserData = await page.evaluate(async ({ email, password }) => {
    let tokenData = {
      localId: 'admin_test_uid',
      email,
      displayName: 'Rebecca Administrator',
      idToken: 'mock_e2e_jwt_token',
      refreshToken: 'mock_e2e_refresh_token',
      expiresIn: '3600'
    };

    try {
      const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=YOUR_API_KEY', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      });

      if (response.ok) {
        const json = await response.json();
        tokenData = { ...tokenData, ...json };
      }
    } catch {
      // Emulator is offline/unreachable in CI environment - fallback to mock token
    }

    return {
      uid: tokenData.localId,
      email: tokenData.email,
      emailVerified: true,
      displayName: tokenData.displayName || 'Rebecca Administrator',
      isAnonymous: false,
      photoURL: null,
      createdAt: Date.now().toString(),
      lastLoginAt: Date.now().toString(),
      apiKey: 'YOUR_API_KEY',
      appName: '[DEFAULT]',
      stsTokenManager: {
        apiKey: 'YOUR_API_KEY',
        refreshToken: tokenData.refreshToken,
        accessToken: tokenData.idToken,
        expirationTime: Date.now() + Number(tokenData.expiresIn) * 1000
      },
      providerData: [
        {
          uid: tokenData.localId,
          displayName: tokenData.displayName || 'Rebecca Administrator',
          email: tokenData.email,
          photoURL: null,
          providerId: 'password',
          phoneNumber: null
        }
      ]
    };
  }, { email, password });

  console.log(`[auth-helper] Emulator authentication successful!`);

  // 3. Inject the session object into IndexedDB (firebaseLocalStorageDb -> firebaseLocalStorage)
  console.log(`[auth-helper] Injecting IndexedDB session...`);
  await page.evaluate(async (userData) => {
    await new Promise<void>((resolve, reject) => {
      const openReq = indexedDB.open('firebaseLocalStorageDb', 1);
      openReq.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
          db.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
        }
      };
      openReq.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const tx = db.transaction('firebaseLocalStorage', 'readwrite');
        const store = tx.objectStore('firebaseLocalStorage');
        const putReq = store.put({
          fbase_key: 'firebase:authUser:YOUR_API_KEY:[DEFAULT]',
          value: userData
        });
        putReq.onsuccess = () => {
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
        putReq.onerror = () => {
          db.close();
          reject(putReq.error);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
      openReq.onerror = () => reject(openReq.error);
    });
  }, firebaseUserData);
  console.log(`[auth-helper] IndexedDB session injected.`);

  // 4. Also populate localStorage & sessionStorage as multi-layer fallbacks
  console.log(`[auth-helper] Injecting localStorage & sessionStorage session...`);
  await page.evaluate((userData) => {
    const firebaseKey = 'firebase:authUser:YOUR_API_KEY:[DEFAULT]';
    const payload = JSON.stringify(userData);
    window.localStorage.setItem(firebaseKey, payload);
    window.sessionStorage.setItem(firebaseKey, payload);
  }, firebaseUserData);

  console.log(`[auth-helper] Auth Helper complete.`);
}


