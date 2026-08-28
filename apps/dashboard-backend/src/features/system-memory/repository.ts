import { Firestore } from '@google-cloud/firestore';
import { MemoryLayer, MemoryContent } from '@rebecca/types';
import { getCollections } from '@rebecca/db';
import { persona } from '@rebecca/persona';
import { config } from '../../config';

/**
 * Repository class for managing and loading system memory layers from Firestore and local static sources.
 */
export class SystemMemoryRepository {
  private collections;

  /**
   * Creates an instance of SystemMemoryRepository.
   * 
   * @param firestore - The Firestore instance.
   */
  constructor(private firestore: Firestore) {
    this.collections = getCollections(firestore);
  }

  /**
   * Retrieves the metadata for the different layers of the system memory.
   * 
   * @returns A promise that resolves to an array of memory layers.
   */
  async getLayers(): Promise<MemoryLayer[]> {
    const doc = await this.collections.system.doc('persona').get();
    const data = doc.data();

    return [
      {
        level: 0,
        name: 'Layer 0: Persona Core Prompt',
        description: 'Core system prompt (Hardcoded)',
        lastUpdated: 'System Deploy',
        isReadOnly: true
      },
      {
        level: 1,
        name: 'Layer 1: Extended Persona Tuning',
        description: 'Dynamic behavioral instructions',
        lastUpdated: data?.updatedAt || 'System Deploy',
        isReadOnly: false
      },
      {
        level: 2,
        name: 'Layer 2: Global Timeline Summary',
        description: 'System-wide context summary',
        lastUpdated: data?.timelineSummaryUpdatedAt || 'System Deploy',
        isReadOnly: false
      }
    ];
  }

  /**
   * Retrieves the core memory content (Layer 0) loaded from the persona configuration.
   * 
   * @returns A promise that resolves to the core memory content.
   */
  async getCoreMemory(): Promise<MemoryContent> {
    const fullContent = `${persona.core.identity}\n\n【キャラクター設定】\n役割: ${persona.core.role}\n口調: ${persona.core.tone}\n\n【ペルソナマスターデータ（全120パターン）】\n${persona.core.patternsText}`;
    return {
      level: 0,
      name: 'Layer 0: Persona Core Prompt',
      content: fullContent,
      isReadOnly: true
    };
  }

  /**
   * Retrieves the extended persona tuning memory content (Layer 1) from Firestore.
   * 
   * @returns A promise that resolves to the extended memory content.
   */
  async getExtendedMemory(): Promise<MemoryContent> {
    const doc = await this.collections.system.doc('persona').get();
    const data = doc.data();
    return {
      level: 1,
      name: 'Layer 1: Extended Persona Tuning',
      content: data?.extended_prompt || 'You are Rebecca, an AI virtual friend. Be helpful, engaging, and friendly.',
      isReadOnly: false
    };
  }

  /**
   * Updates the extended persona tuning memory in Firestore.
   * 
   * @param content - The new extended prompt content.
   * @returns A promise that resolves when the update is complete.
   */
  async updateExtendedMemory(content: string): Promise<void> {
    await this.collections.system.doc('persona').set(
      { extended_prompt: content, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  }

  /**
   * Retrieves the global memory content (Layer 2) from Firestore.
   * 
   * @returns A promise that resolves to the global memory content.
   */
  async getGlobalMemory(): Promise<MemoryContent> {
    const doc = await this.collections.system.doc('persona').get();
    const data = doc.data();
    return {
      level: 2,
      name: 'Layer 2: Global Timeline Summary',
      content: typeof data?.timeline_summary === 'string' ? data.timeline_summary : '',
      isReadOnly: false
    };
  }

  /**
   * Updates the global memory timeline summary in Firestore.
   * 
   * @param content - The new summary content.
   * @returns A promise that resolves when the update is complete.
   */
  async updateGlobalMemory(content: string): Promise<void> {
    await this.collections.system.doc('persona').set(
      { timeline_summary: content, timelineSummaryUpdatedAt: new Date().toISOString() },
      { merge: true }
    );
  }

  /**
   * Triggers the dreaming and evolution processes by invoking the bot-backend Cloud Run endpoints with OIDC authentication.
   * 
   * @returns A promise that resolves when the trigger process is completed.
   */
  async triggerDreaming(): Promise<void> {
    const botUrl = config.services.botBackendUrl;
    if (!botUrl) {
      console.warn('BOT_BACKEND_URL is not configured. Skipping dreaming trigger.');
      return;
    }

    const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
    if (isEmulator) {
      console.log(`[Local/Emulator fallback] Triggering async dreaming at ${botUrl}/batch/dreaming`);
      return;
    }

    try {
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth();
      const client = await auth.getIdTokenClient(botUrl);
      
      console.log(`Triggering dreaming at ${botUrl}/batch/dreaming`);
      await client.request({
        url: `${botUrl}/batch/dreaming`,
        method: 'POST',
      });

      console.log(`Triggering evolution at ${botUrl}/batch/evolution`);
      await client.request({
        url: `${botUrl}/batch/evolution`,
        method: 'POST',
      });
      console.log('Successfully completed Dreaming & Evolution batch executions.');
    } catch (e) {
      console.error('Failed to trigger dreaming on bot-backend', e);
    }
  }
}

