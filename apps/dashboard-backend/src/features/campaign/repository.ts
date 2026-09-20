import { Firestore, Query, DocumentData } from '@google-cloud/firestore';
import {
  CampaignDoc,
  CampaignDocWithId,
  CampaignQueryParams,
  PaginatedResponse,
} from '@rebecca/types';
import { getCollections } from '@rebecca/db';
export type { CampaignQueryParams };

/**
 * Repository for data access operations related to Narrative Event Campaigns in Firestore.
 * Utilizes @rebecca/db campaignDocConverter for typed normalization and consistency.
 */
export class CampaignsRepository {
  private collections;
  private firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
    this.collections = getCollections(firestore);
  }

  /**
   * Retrieves paginated campaigns with optional status filtering.
   *
   * @param params - Query parameters including page, limit, and status filter.
   * @returns Paginated list of campaigns with metadata.
   */
  async getPaginated(params?: CampaignQueryParams): Promise<PaginatedResponse<CampaignDocWithId>> {
    const page = Math.max(1, Number(params?.page || 1));
    const limit = Math.max(1, Math.min(50, Number(params?.limit || 20)));
    const statusFilter = params?.status?.trim();

    let query: Query<CampaignDoc> = this.collections.campaigns;
    if (statusFilter && statusFilter !== 'all') {
      query = query.where('status', '==', statusFilter);
    }

    const snapshot = await query.get();
    const docs = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    } as CampaignDocWithId));

    // Sort in memory by startDate descending, fallback to createdAt descending
    docs.sort((a, b) => {
      const dateA = a.startDate || a.createdAt || '';
      const dateB = b.startDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });

    const totalItems = docs.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const paginatedDocs = docs.slice((page - 1) * limit, page * limit);

    return {
      data: paginatedDocs,
      meta: {
        totalItems,
        totalPages,
        currentPage: page,
        limit,
        itemCount: paginatedDocs.length,
        itemsPerPage: limit,
      },
    };
  }

  /**
   * Retrieves a single campaign by ID.
   *
   * @param id - Document ID.
   * @returns Campaign document with ID, or null.
   */
  async getById(id: string): Promise<CampaignDocWithId | null> {
    const doc = await this.collections.campaigns.doc(id).get();
    if (!doc.exists) return null;
    return {
      ...doc.data()!,
      id: doc.id,
    };
  }

  /**
   * Finds campaigns that overlap with the specified date window and are not archived/completed.
   * Used to enforce the invariant that only one narrative event can be scheduled or active at any given time.
   *
   * @param startDate - Start date string (YYYY-MM-DD).
   * @param endDate - End date string (YYYY-MM-DD).
   * @param excludeId - Optional campaign ID to exclude (e.g. when updating).
   * @returns Array of overlapping campaigns.
   */
  async findOverlapping(
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<CampaignDocWithId[]> {
    const snapshot = await this.collections.campaigns.get();
    const activeOrScheduled = snapshot.docs
      .map((doc) => ({ ...doc.data(), id: doc.id } as CampaignDocWithId))
      .filter((c) => c.status === 'active' || c.status === 'scheduled');

    return activeOrScheduled.filter((c) => {
      if (excludeId && c.id === excludeId) return false;
      // Overlap condition: c.startDate <= endDate && c.endDate >= startDate
      return c.startDate <= endDate && c.endDate >= startDate;
    });
  }

  /**
   * Creates a new campaign document.
   *
   * @param id - Explicit document ID.
   * @param data - Campaign document data.
   * @returns Created CampaignDocWithId.
   */
  async create(id: string, data: CampaignDoc): Promise<CampaignDocWithId> {
    await this.collections.campaigns.doc(id).set(data);
    return {
      ...data,
      id,
    };
  }

  /**
   * Updates an existing campaign document.
   *
   * @param id - Target document ID.
   * @param data - Partial fields to update.
   * @returns Updated CampaignDocWithId.
   */
  async update(id: string, data: Partial<CampaignDoc>): Promise<CampaignDocWithId> {
    await this.collections.campaigns.doc(id).set(data as DocumentData, { merge: true });
    const updated = await this.getById(id);
    if (!updated) {
      throw new Error(`Campaign ${id} not found after update`);
    }
    return updated;
  }

  /**
   * Deletes a campaign document permanently or soft deletes by archiving.
   *
   * @param id - Document ID.
   */
  async delete(id: string): Promise<void> {
    await this.collections.campaigns.doc(id).delete();
  }
}
