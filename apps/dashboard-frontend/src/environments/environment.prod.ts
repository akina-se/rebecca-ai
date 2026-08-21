/**
 * Production Environment Configuration (12-Factor App)
 * 
 * In production, actual Firebase public identifiers and runtime parameters are dynamically
 * served by the Backend-for-Frontend (BFF) via `/api/v1/config` during application startup (APP_INITIALIZER).
 * 
 * No production API keys, secrets, or GCP project identifiers are hardcoded in source code or Git.
 */
export const environment = {
  production: true,
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  },
  useEmulators: false,
  useMock: false,
  apiUrl: '/api/v1'
};
