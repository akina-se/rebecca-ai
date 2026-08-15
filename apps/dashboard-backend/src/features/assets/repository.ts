import { Firestore } from '@google-cloud/firestore';
import { Asset, AssetStatus, PaginatedResponse } from '@rebecca/types';
import { getCollections } from '@rebecca/db';

export interface AssetQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

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
   * Helper to map raw document data to strictly-typed Asset model.
   * 
   * @param id - Document ID.
   * @param data - Document data.
   * @returns Normalized Asset entity.
   */
  private mapDocToAsset(id: string, data: Record<string, any>): Asset {
    let status: AssetStatus = AssetStatus.PENDING;
    if (data.status) {
      const s = String(data.status).toUpperCase();
      if (s === 'SUCCESS' || s === 'READY') status = AssetStatus.SUCCESS;
      else if (s === 'FAILED' || s === 'CAPTION FAILED') status = AssetStatus.FAILED;
      else if (s === 'PROCESSING') status = AssetStatus.PROCESSING;
    } else {
      status = data.caption ? AssetStatus.SUCCESS : AssetStatus.FAILED;
    }

    // Resolve filename prioritizing data.filename
    let filename = data.filename;
    if (!filename) {
      if (data.url && typeof data.url === 'string') {
        const parts = data.url.split('/');
        const lastPart = parts.pop() || '';
        // If lastPart is just numbers (like picsum dimensions), fallback to id
        if (/^\d+$/.test(lastPart)) {
          filename = `${id}.png`;
        } else {
          filename = lastPart || `${id}.png`;
        }
      } else {
        filename = `${id}.png`;
      }
    }

    return {
      id,
      filename,
      caption: data.caption || '',
      usedCount: data.useCount || data.usedCount || 0,
      status,
      url: data.url || ''
    };
  }

  /**
   * Retrieves paginated assets supporting keyword search and status filter.
   * 
   * @param params - Query parameters.
   * @returns PaginatedResponse with data and pagination metadata.
   */
  async getPaginated(params: AssetQueryParams = {}): Promise<PaginatedResponse<Asset>> {
    const snapshot = await this.collections.images.get();
    
    let allAssets: Asset[] = [];
    if (!snapshot.empty) {
      allAssets = snapshot.docs.map((doc: any) => this.mapDocToAsset(doc.id, doc.data()));
    }

    // Sort by id or natural creation order
    allAssets.sort((a, b) => {
      // Natural numerical sorting if id is a1, a2...
      const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    // 1. Filter by keyword search (fuzzy case-insensitive match on filename or caption)
    if (params.search && params.search.trim().length > 0) {
      const query = params.search.trim().toLowerCase();
      allAssets = allAssets.filter(asset => 
        asset.filename.toLowerCase().includes(query) ||
        asset.caption.toLowerCase().includes(query)
      );
    }

    // 2. Filter by status
    if (params.status && params.status.trim().length > 0 && params.status !== 'all') {
      const targetStatus = params.status.toUpperCase();
      allAssets = allAssets.filter(asset => asset.status === targetStatus);
    }

    const totalItems = allAssets.length;
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, params.limit || 20);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    const startIndex = (page - 1) * limit;
    const paginatedData = allAssets.slice(startIndex, startIndex + limit);

    return {
      data: paginatedData,
      meta: {
        totalItems,
        totalPages,
        currentPage: page,
        limit
      }
    };
  }

  /**
   * Retrieves all assets.
   * 
   * @returns A promise that resolves to an array of all Assets.
   */
  async getAll(): Promise<Asset[]> {
    const snapshot = await this.collections.images.get();
    if (snapshot.empty) return [];
    return snapshot.docs.map((doc: any) => this.mapDocToAsset(doc.id, doc.data()));
  }

  /**
   * Retrieves a single asset by ID.
   * 
   * @param id - The ID of the asset.
   * @returns The Asset entity or null if not found.
   */
  async getById(id: string): Promise<Asset | null> {
    const doc = await this.collections.images.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return this.mapDocToAsset(doc.id, doc.data() || {});
  }

  /**
   * Creates or overwrites an asset in Firestore.
   * 
   * @param id - Document ID.
   * @param data - Document data.
   */
  async create(id: string, data: Record<string, any>): Promise<void> {
    await (this.collections.images.doc(id) as any).set(data);
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
    if (updates.caption !== undefined) {
      dbUpdates.caption = updates.caption;
      // If caption is updated and was previously empty, update status to SUCCESS
      if (updates.caption.trim().length > 0 && (!updates.status || updates.status === AssetStatus.FAILED)) {
        dbUpdates.status = AssetStatus.SUCCESS;
      }
    }
    if (updates.usedCount !== undefined) dbUpdates.useCount = updates.usedCount;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.filename !== undefined) dbUpdates.filename = updates.filename;
    
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
