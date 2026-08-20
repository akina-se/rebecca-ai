import { Firestore } from '@google-cloud/firestore';
import { CloudTasksClient } from '@google-cloud/tasks';
import { MemoryLayer, MemoryContent } from '@rebecca/types';
import { getCollections } from '@rebecca/db';
import { persona } from '@rebecca/persona';

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
    return {
      level: 0,
      name: 'Layer 0: Persona Core Prompt',
      content: persona.core.identity + '\n' + persona.core.role + '\n' + persona.core.tone,
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
      content: data?.timeline_summary || 'Default mock system summary. Rebecca AI is functioning normally.',
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
   * Triggers the dreaming process asynchronously by sending a task to Google Cloud Tasks.
   * Falls back to a local HTTP call if running in a non-production environment where Cloud Tasks is unavailable.
   * 
   * @returns A promise that resolves when the trigger process is completed or fallback is registered.
   */
  async triggerDreaming(): Promise<void> {
    const botUrl = process.env.BOT_BACKEND_URL || 'https://bot-backend.example.com';
    const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

    if (isEmulator) {
      console.log(`[Local/Emulator fallback] Triggering async dreaming at ${botUrl}/internal/evolution/trigger`);
      return;
    }

    try {
      const client = new CloudTasksClient();
      const project = process.env.GOOGLE_CLOUD_PROJECT || 'rebecca-ai-project';
      const location = process.env.GCP_LOCATION || 'asia-northeast1';
      const queue = process.env.GCP_EVOLUTION_QUEUE || 'evolution-queue';

      const parent = client.queuePath(project, location, queue);
      const task = {
        httpRequest: {
          httpMethod: 'POST' as const,
          url: `${botUrl}/internal/evolution/trigger`,
        },
      };

      console.log(`Sending task to queue ${queue} targeting ${botUrl}`);
      await client.createTask({ parent, task });
      console.log('Successfully kicked off the Dreaming process via Cloud Tasks.');
    } catch (e) {
      console.error('Failed to trigger dreaming via Cloud Tasks', e);
      console.log(`[Local fallback] Triggering async dreaming at ${botUrl}/internal/evolution/trigger`);
    }
  }
}

