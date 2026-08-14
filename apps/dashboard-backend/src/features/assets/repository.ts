import { Firestore } from '@google-cloud/firestore';
import { Asset, AssetStatus } from '@rebecca/types';
import { getCollections } from '@rebecca/db';

/**
 * Repository class for managing Asset (image) data persistence in Firestore.
 */
export class AssetsRepository {
  private collections;
  private firestore: Firestore;

  /**
   * Creates an instance of AssetsRepository.
   * 
   * @param firestore - The Firestore instance.
   */
  constructor(firestore: Firestore) {
    this.firestore = firestore;
    this.collections = getCollections(firestore);
  }

  /**
   * Retrieves all assets. Falls back to mock data if the collection is empty.
   * 
   * @returns A promise that resolves to an array of Assets.
   */
  async getAll(): Promise<Asset[]> {
    const snapshot = await this.collections.images.get();
    
    if (snapshot.empty) {
      return [
        {
          id: '1',
          filename: 'rebecca_summer_01.png',
          caption: 'レベッカが海辺で浮き輪を持っているイラスト。笑顔で楽しそうな表情。',
          usedCount: 3,
          status: AssetStatus.SUCCESS
        },
        {
          id: '2',
          filename: 'beach_bg_02.jpg',
          caption: '',
          usedCount: 0,
          status: AssetStatus.FAILED
        }
      ];
    }

    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      let status: AssetStatus = AssetStatus.PENDING;
      if (data.status) {
        const s = String(data.status).toUpperCase();
        if (s === 'SUCCESS' || s === 'READY') status = AssetStatus.SUCCESS;
        else if (s === 'FAILED' || s === 'CAPTION FAILED') status = AssetStatus.FAILED;
        else if (s === 'PROCESSING') status = AssetStatus.PROCESSING;
      } else {
        status = data.caption ? AssetStatus.SUCCESS : AssetStatus.FAILED;
      }

      return {
        id: doc.id,
        filename: data.url ? (data.url.split('/').pop() || data.url) : (data.filename || doc.id),
        caption: data.caption || '',
        usedCount: data.useCount || 0,
        status,
        url: data.url || ''
      };
    });
  }

  /**
   * Updates an asset's fields in the database.
   * 
   * @param id - The ID of the asset to update.
   * @param updates - The partial asset fields to update.
   * @returns A promise that resolves when the update is complete.
   */
  async update(id: string, updates: Partial<Asset>): Promise<void> {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.caption !== undefined) dbUpdates.caption = updates.caption;
    if (updates.usedCount !== undefined) dbUpdates.useCount = updates.usedCount;
    
    await this.collections.images.doc(id).set(dbUpdates, { merge: true });
  }

  /**
   * Deletes multiple assets by their IDs.
   * 
   * @param ids - The array of asset IDs to delete.
   * @returns A promise that resolves when the deletion is complete.
   */
  async deleteMany(ids: string[]): Promise<void> {
    const batch = this.firestore.batch();
    for (const id of ids) {
      batch.delete(this.collections.images.doc(id));
    }
    await batch.commit();
  }
}

