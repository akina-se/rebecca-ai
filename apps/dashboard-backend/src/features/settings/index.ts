import { Router } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { SystemSettings } from '@rebecca/types';

/**
 * Initializes the Settings module with routes for managing global application preferences.
 * 
 * @param firestore - The Firestore instance.
 * @returns Express router for /api/v1/settings.
 */
export function initializeSettingsModule(firestore: Firestore): Router {
  const router = Router();

  // GET /api/v1/settings
  router.get('/', async (req, res) => {
    try {
      const snap = await firestore.collection('system').doc('preferences').get();
      if (!snap.exists) {
        const defaultSettings: SystemSettings = {
          language: 'ja',
          timezone: 'Asia/Tokyo',
          updatedAt: new Date().toISOString()
        };
        return res.json({ data: defaultSettings });
      }
      const data = snap.data() as SystemSettings;
      res.json({
        data: {
          language: data.language || 'ja',
          timezone: data.timezone || 'Asia/Tokyo',
          updatedAt: data.updatedAt || new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to get system settings:', error);
      res.status(500).json({ error: 'Failed to retrieve settings' });
    }
  });

  // PATCH /api/v1/settings
  router.patch('/', async (req, res) => {
    try {
      const { language, timezone } = req.body;
      const updates: Partial<SystemSettings> = {
        updatedAt: new Date().toISOString()
      };
      if (language) updates.language = language;
      if (timezone) updates.timezone = timezone;

      const docRef = firestore.collection('system').doc('preferences');
      await docRef.set(updates, { merge: true });

      const snap = await docRef.get();
      const data = snap.data() as SystemSettings;

      res.json({
        data: {
          language: data.language || 'ja',
          timezone: data.timezone || 'Asia/Tokyo',
          updatedAt: data.updatedAt || updates.updatedAt
        }
      });
    } catch (error) {
      console.error('Failed to update system settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  return router;
}
