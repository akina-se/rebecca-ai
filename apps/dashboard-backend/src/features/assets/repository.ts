import { Firestore } from '@google-cloud/firestore';
import { Asset } from '@rebecca/types';
import { getCollections } from '@rebecca/db';

export class AssetsRepository {
  private collections;
  private firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
    this.collections = getCollections(firestore);
  }

  async getAll(): Promise<Asset[]> {
    const snapshot = await this.collections.images.get();
    
    if (snapshot.empty) {
      // Return mock data for UI testing if DB is empty
      return [
        {
          id: '1',
          filename: 'rebecca_summer_01.png',
          caption: 'レベッカが海辺で浮き輪を持っているイラスト。笑顔で楽しそうな表情。',
          usedCount: 3,
          status: 'Ready'
        },
        {
          id: '2',
          filename: 'beach_bg_02.jpg',
          caption: '',
          usedCount: 0,
          status: 'Caption Failed'
        }
      ];
    }

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        filename: data.url.split('/').pop() || data.url, // Extract filename from URL
        caption: data.caption || '',
        usedCount: data.useCount || 0,
        status: data.caption ? 'Ready' : 'Caption Failed' // Simple inferred status
      };
    });
  }

  async update(id: string, updates: Partial<Asset>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.caption !== undefined) dbUpdates.caption = updates.caption;
    if (updates.usedCount !== undefined) dbUpdates.useCount = updates.usedCount;
    
    // We do not store "status" explicitly in ImageDoc, but we could if we wanted.
    
    await this.collections.images.doc(id).set(dbUpdates, { merge: true });
  }

  async deleteMany(ids: string[]): Promise<void> {
    const batch = this.firestore.batch();
    for (const id of ids) {
      batch.delete(this.collections.images.doc(id));
    }
    await batch.commit();
  }
}

