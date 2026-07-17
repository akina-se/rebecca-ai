import { Firestore } from '@google-cloud/firestore';
import { MemoryLayer, MemoryContent } from '@rebecca/types';
import { getCollections } from '@rebecca/db';
import { persona } from '@rebecca/persona';

export class SystemMemoryRepository {
  private collections;

  constructor(private firestore: Firestore) {
    this.collections = getCollections(firestore);
  }

  async getLayers(): Promise<MemoryLayer[]> {
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
        lastUpdated: 'Auto-updated by Dreaming',
        isReadOnly: false
      },
      {
        level: 2,
        name: 'Layer 2: Global Timeline Summary',
        description: 'System-wide context summary',
        lastUpdated: 'Auto-updated by Dreaming',
        isReadOnly: false
      }
    ];
  }

  async getCoreMemory(): Promise<MemoryContent> {
    // In a real system, Layer 0 is loaded from the `@rebecca/persona` package,
    // which serves as the immutable foundational instruction set.
    return {
      level: 0,
      name: 'Layer 0: Persona Core Prompt',
      content: persona.core.identity + '\n' + persona.core.role + '\n' + persona.core.tone,
      isReadOnly: true
    };
  }

  async getGlobalMemory(): Promise<MemoryContent> {
    // Layer 2 from Firestore
    const doc = await this.collections.system.doc('persona').get();
    const data = doc.data();
    return {
      level: 2,
      name: 'Layer 2: Global Timeline Summary',
      content: data?.timeline_summary || 'No recent global summary available.',
      isReadOnly: false
    };
  }

  async updateGlobalMemory(content: string): Promise<void> {
    // Manual override of global memory
    await this.collections.system.doc('persona').set(
      { timeline_summary: content, timelineSummaryUpdatedAt: new Date().toISOString() },
      { merge: true }
    );
  }

  async triggerDreaming(): Promise<void> {
    // Kick off the GCP-controlled dreaming process using Cloud Tasks.
    // This allows the process to run entirely asynchronously in the background.
    const { CloudTasksClient } = require('@google-cloud/tasks');
    const client = new CloudTasksClient();

    const project = process.env.GOOGLE_CLOUD_PROJECT || 'rebecca-ai-project';
    const location = process.env.GCP_LOCATION || 'asia-northeast1';
    const queue = process.env.GCP_EVOLUTION_QUEUE || 'evolution-queue';
    const botUrl = process.env.BOT_BACKEND_URL || 'https://bot-backend.example.com';

    try {
      const parent = client.queuePath(project, location, queue);
      const task = {
        httpRequest: {
          httpMethod: 'POST',
          url: `${botUrl}/internal/evolution/trigger`,
        },
      };

      console.log(`Sending task to queue ${queue} targeting ${botUrl}`);
      // Send create task request
      await client.createTask({ parent, task });
      console.log('Successfully kicked off the Dreaming process via Cloud Tasks.');
    } catch (e) {
      console.error('Failed to trigger dreaming via Cloud Tasks', e);
      // Fallback for local development if Cloud Tasks is not available
      if (process.env.NODE_ENV !== 'production') {
        try {
          console.log(`[Local fallback] Triggering async dreaming at ${botUrl}/internal/evolution/trigger`);
          // Note: using fetch locally as a fallback
          // fetch(`${botUrl}/internal/evolution/trigger`, { method: 'POST' }).catch(console.error);
        } catch (err) {}
      }
    }
  }
}

