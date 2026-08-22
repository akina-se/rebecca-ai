import { Request, Response } from 'express';

/**
 * Controller for returning public runtime configurations to the frontend application.
 * 
 * Complies with the 12-Factor App methodology by serving environment-driven settings
 * without requiring hardcoded configuration files in client bundles or Git repositories.
 */
export class ConfigController {
  /**
   * Returns public client-side configuration parameters (Firebase public identifiers,
   * API endpoints, and external site URLs).
   */
  getConfig = (req: Request, res: Response): void => {
    const projectId = process.env.GCP_PROJECT_ID || 'rebecca-ai-gal';
    const isProd = process.env.NODE_ENV === 'production';

    const config = {
      firebase: {
        apiKey: process.env.FIREBASE_WEB_API_KEY || (isProd ? 'AIzaSyCpzcui2cfxEfNGdYpaZF3oGm03b1gyDn8' : 'YOUR_API_KEY'),
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
        projectId: projectId,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '556353380728',
        appId: process.env.FIREBASE_WEB_APP_ID || '1:556353380728:web:b589f488a145822a7a688d',
      },
      apiUrl: '/api/v1',
      publicSiteUrl: process.env.PUBLIC_SITE_URL || 'https://rebecca-ai.net',
      production: isProd,
      useEmulators: !isProd,
    };

    res.status(200).json(config);
  };
}
