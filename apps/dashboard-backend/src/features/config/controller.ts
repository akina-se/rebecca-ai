import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

function getAppVersion(): string {
  if (process.env.npm_package_version) {
    return process.env.npm_package_version;
  }
  try {
    const pkgPath = path.resolve(__dirname, '../../../package.json');
    if (fs.existsSync(pkgPath)) {
      const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return parsed.version || '';
    }
  } catch {
    // Graceful fallback if filesystem cannot be read
  }
  return '';
}

/**
 * Controller for returning public runtime configurations to the frontend application.
 * 
 * Complies with the 12-Factor App methodology by serving environment-driven settings
 * without requiring hardcoded configuration files in client bundles or Git repositories.
 */
export class ConfigController {
  private readonly appVersion = getAppVersion();
  /**
   * Returns public client-side configuration parameters (Firebase public identifiers,
   * API endpoints, and external site URLs).
   */
  getConfig = (req: Request, res: Response): void => {
    const projectId = process.env.GCP_PROJECT_ID || 'rebecca-ai-gal';
    const isProd = process.env.NODE_ENV === 'production';

    const config = {
      firebase: {
        apiKey: (process.env.FIREBASE_WEB_API_KEY || '').trim() || (isProd ? '' : 'YOUR_API_KEY'),
        authDomain: (process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`).trim(),
        projectId: projectId.trim(),
        storageBucket: (process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`).trim(),
        messagingSenderId: (process.env.FIREBASE_MESSAGING_SENDER_ID || '').trim(),
        appId: (process.env.FIREBASE_WEB_APP_ID || '').trim(),
      },
      apiUrl: '/api/v1',
      version: this.appVersion,
      publicSiteUrl: process.env.PUBLIC_SITE_URL || 'https://rebecca-ai.net',
      production: isProd,
      useEmulators: !isProd,
    };

    res.status(200).json(config);
  };
}
