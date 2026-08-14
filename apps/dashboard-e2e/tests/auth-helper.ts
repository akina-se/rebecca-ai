import { Page } from '@playwright/test';

/**
 * Sets up network request forwarding for API routes where frontend repository
 * base URLs may need mapping to the BFF service endpoints.
 */
export async function setupApiRouting(page: Page) {
  await page.route('**/api/v1**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    
    // Route /api/v1 (with query parameters or DELETE method) to /api/v1/posts
    if (url.pathname === '/api/v1') {
      if (request.method() === 'DELETE' || url.searchParams.has('page') || url.searchParams.has('limit') || url.searchParams.has('period') || url.searchParams.has('sortBy') || url.searchParams.has('date')) {
        url.pathname = '/api/v1/posts';
        try {
          const response = await route.fetch({ url: url.toString() });
          await route.fulfill({ response });
          return;
        } catch (e) {
          console.error('Error forwarding /api/v1 to /api/v1/posts:', e);
        }
      }
    } else if (url.pathname.match(/^\/api\/v1\/p\d+$/)) {
      url.pathname = url.pathname.replace('/api/v1/', '/api/v1/posts/');
      try {
        const response = await route.fetch({ url: url.toString() });
        await route.fulfill({ response });
        return;
      } catch (e) {
        console.error('Error forwarding post by ID:', e);
      }
    }

    await route.continue();
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
    const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=YOUR_API_KEY', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to login via emulator REST API: ${err}`);
    }

    const tokenData = await response.json();
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


