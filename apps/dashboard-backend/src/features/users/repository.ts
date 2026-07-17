import { Firestore } from '@google-cloud/firestore';
import { UserDetail, UserLeaderboard } from '@rebecca/types';
import { getCollections } from '@rebecca/db';

export class UsersRepository {
  private collections;
  private firestore: Firestore;

  constructor(firestore: Firestore) {
    this.firestore = firestore;
    this.collections = getCollections(firestore);
  }

  async getAll(): Promise<UserLeaderboard[]> {
    const snapshot = await this.collections.users.orderBy('daily_reply_count', 'desc').limit(10).get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        userId: `@${doc.id}`,
        interactions: data.daily_reply_count || 0
      };
    });
  }

  async getById(id: string): Promise<UserDetail | null> {
    const rawId = id.replace('@', '');
    const doc = await this.collections.users.doc(rawId).get();
    
    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as any;
    return {
      handle: `@${rawId}`,
      name: (data.coreProfile && typeof data.coreProfile.name === 'string') ? data.coreProfile.name : 'Unknown',
      interactions: data.daily_reply_count || 0,
      affinityScore: data.affinity_score !== undefined ? `${data.affinity_score}%` : 'N/A',
      firstSeen: data.first_seen_date || 'N/A',
      lastSeen: data.last_reply_date || 'N/A',
      coreProfile: JSON.stringify(data.coreProfile || {}),
      chatHistory: [], // Real chat history would come from conversationLogs collection
      status: (data.status as 'Active' | 'Blocked' | 'Muted') || 'Active'
    };
  }

  async updateMemory(id: string, coreProfileJson: string): Promise<void> {
    const rawId = id.replace('@', '');
    try {
      const parsed = JSON.parse(coreProfileJson);
      await this.collections.users.doc(rawId).set(
        { coreProfile: parsed },
        { merge: true }
      );
    } catch (e) {
      console.error('Failed to parse and update memory', e);
    }
  }

  async updateStatusBulk(ids: string[], status: string): Promise<void> {
    const batch = this.firestore.batch();
    for (const id of ids) {
      const rawId = id.replace('@', '');
      batch.set(this.collections.users.doc(rawId), { status }, { merge: true });
    }
    await batch.commit();
  }
}

