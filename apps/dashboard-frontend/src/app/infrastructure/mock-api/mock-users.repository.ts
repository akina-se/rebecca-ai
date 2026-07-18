import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { UsersRepository } from '../../core/ports/users.repository';
import { UserDetail, ChatMessage, UserStatus } from '@rebecca/types';

@Injectable({
  providedIn: 'root'
})
export class MockUsersRepository implements UsersRepository {
  private users: UserDetail[] = [
    {
      handle: '@rebecca_oshi',
      name: 'レベッカ推し',
      interactions: 240,
      affinityScore: '98%',
      firstSeen: '2025-08-01',
      lastSeen: '2026-07-10',
      coreProfile: '{\n  "attributes": ["student", "tokyo"],\n  "preferences": ["anime", "programming"],\n  "concerns": ["exams"],\n  "important_memories": ["promised to go to comiket"]\n}',
      status: UserStatus.ACTIVE,
      chatHistory: this.generateMockHistory('@rebecca_oshi')
    },
    {
      handle: '@tech_geek_tokyo',
      name: 'Tech Geek',
      interactions: 85,
      affinityScore: '70%',
      firstSeen: '2026-01-15',
      lastSeen: '2026-07-09',
      coreProfile: '{\n  "attributes": ["engineer", "adult"],\n  "preferences": ["ai", "tech"],\n  "concerns": ["burnout"],\n  "important_memories": []\n}',
      status: UserStatus.ACTIVE,
      chatHistory: this.generateMockHistory('@tech_geek_tokyo')
    },
    {
      handle: '@user_alpha_99',
      name: 'Alpha 99',
      interactions: 42,
      affinityScore: '45%',
      firstSeen: '2026-05-01',
      lastSeen: '2026-07-11',
      coreProfile: '{\n  "attributes": ["gamer"],\n  "preferences": ["gaming"],\n  "concerns": [],\n  "important_memories": []\n}',
      status: UserStatus.ACTIVE,
      chatHistory: this.generateMockHistory('@user_alpha_99')
    },
    {
      handle: '@spam_bot_001',
      name: 'Spam Bot 001',
      interactions: 0,
      affinityScore: '0%',
      firstSeen: '2026-06-01',
      lastSeen: '2026-06-01',
      coreProfile: '{}',
      status: UserStatus.BLOCKED,
      chatHistory: []
    }
  ];

  private generateMockHistory(handle: string): ChatMessage[] {
    const history: ChatMessage[] = [];
    const baseTime = new Date('2026-07-18T00:00:00.000Z');
    // Generate 50 messages (25 exchanges)
    for (let i = 25; i >= 1; i--) {
      const minutesAgo = i * 15;
      const userTime = new Date(baseTime.getTime() - minutesAgo * 60 * 1000 - 5 * 60 * 1000).toISOString();
      const rebeccaTime = new Date(baseTime.getTime() - minutesAgo * 60 * 1000).toISOString();
      history.push({
        from: 'user',
        text: `Message ${26 - i} from user on ${handle}`,
        time: userTime
      });
      history.push({
        from: 'rebecca',
        text: `Rebecca reply to message ${26 - i}`,
        time: rebeccaTime
      });
    }
    return history;
  }

  getAll(): Observable<UserDetail[]> {
    return of(this.users);
  }

  getById(id: string, beforeTimestamp?: string, limit?: number): Observable<UserDetail> {
    const user = this.users.find(u => u.handle === id);
    if (!user) {
      throw new Error('User not found');
    }

    let history = [...user.chatHistory];
    if (beforeTimestamp) {
      history = history.filter(msg => msg.time < beforeTimestamp);
    }
    if (limit) {
      // Get the last N messages (which are chronologically the latest in this filtered subset)
      history = history.slice(-limit);
    }

    return of({
      ...user,
      chatHistory: history
    });
  }

  updateMemory(id: string, coreProfile: string): Observable<any> {
    const user = this.users.find(u => u.handle === id);
    if (user) {
      user.coreProfile = coreProfile;
    }
    return of({ success: true });
  }

  bulkUpdateStatus(ids: string[], status: UserStatus): Observable<any> {
    this.users.forEach(u => {
      if (ids.includes(u.handle)) {
        u.status = status;
      }
    });
    return of({ success: true });
  }
}
