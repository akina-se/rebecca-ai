import { Firestore, FieldValue } from '@google-cloud/firestore';
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
  private mapDocToAsset(id: string, data: Record<string, unknown>): Asset {
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
    let filename = typeof data.filename === 'string' ? data.filename : undefined;
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

    let url = typeof data.url === 'string' ? data.url : '';
    let thumbnailUrl: string | undefined;
    let isInternalStorage = !url || url.startsWith('gs://');
    if (!isInternalStorage && (url.startsWith('http://') || url.startsWith('https://'))) {
      try {
        const parsedHost = new URL(url).hostname;
        if (parsedHost === 'storage.googleapis.com' || parsedHost.endsWith('.storage.googleapis.com')) {
          isInternalStorage = true;
        }
      } catch {
        isInternalStorage = true;
      }
    }
    if (isInternalStorage) {
      url = `/api/v1/assets/${id}/image`;
      thumbnailUrl = `/api/v1/assets/${id}/image?size=thumbnail`;
    } else {
      thumbnailUrl = url;
    }

    return {
      id,
      filename,
      caption: typeof data.caption === 'string' ? data.caption : '',
      useCount: typeof data.useCount === 'number' ? data.useCount : 0,
      status,
      url,
      thumbnailUrl,
      lastUsedAt: typeof data.lastUsedAt === 'string' ? data.lastUsedAt : null,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
    };
  }

  /**
   * Retrieves the raw document data for an asset.
   * 
   * @param id - Document ID.
   * @returns Raw document data or null.
   */
  async getRawDoc(id: string): Promise<Record<string, unknown> | null> {
    const doc = await this.collections.images.doc(id).get();
    return doc.exists ? ((doc.data() || {}) as unknown as Record<string, unknown>) : null;
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
      allAssets = snapshot.docs.map(doc => this.mapDocToAsset(doc.id, doc.data() as unknown as Record<string, unknown>));
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
    return snapshot.docs.map(doc => this.mapDocToAsset(doc.id, doc.data() as unknown as Record<string, unknown>));
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
    return this.mapDocToAsset(doc.id, (doc.data() || {}) as Record<string, unknown>);
  }

  /**
   * Creates or overwrites an asset in Firestore.
   * Wraps numerical embeddings in Firestore FieldValue.vector (VectorValue) for vector indexing.
   * 
   * @param id - Document ID.
   * @param data - Document data.
   */
  async create(id: string, data: Record<string, unknown>): Promise<void> {
    const docData = { ...data };
    if (Array.isArray(docData.embedding) && docData.embedding.length > 0) {
      docData.embedding = FieldValue.vector(docData.embedding as number[]);
    } else {
      delete docData.embedding;
    }
    await this.firestore.collection('images').doc(id).set(docData);
  }

  /**
   * Updates an asset's fields in the database.
   * 
   * @param id - The ID of the asset to update.
   * @param updates - The partial asset fields to update (including optional vector embedding or FieldValue).
   * @returns A promise that resolves when the update is complete.
   */
  async update(id: string, updates: Partial<Asset> & { embedding?: number[] | FieldValue }): Promise<void> {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.caption !== undefined) {
      dbUpdates.caption = updates.caption;
      // If caption is updated and was previously empty, update status to SUCCESS if not explicitly set
      if (updates.caption.trim().length > 0 && updates.status === undefined) {
        dbUpdates.status = AssetStatus.SUCCESS;
      }
    }
    if (updates.useCount !== undefined) dbUpdates.useCount = updates.useCount;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.filename !== undefined) dbUpdates.filename = updates.filename;
    if (updates.embedding !== undefined) {
      if (Array.isArray(updates.embedding)) {
        if (updates.embedding.length > 0) {
          dbUpdates.embedding = FieldValue.vector(updates.embedding);
        } else {
          dbUpdates.embedding = FieldValue.delete();
        }
      } else {
        dbUpdates.embedding = updates.embedding;
      }
    }
    
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
