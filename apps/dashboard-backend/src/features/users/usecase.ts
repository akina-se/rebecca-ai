import { UsersRepository } from './repository';
import { UserDetail, UserLeaderboard } from '@rebecca/types';

export class UsersUseCase {
  constructor(private repo: UsersRepository) {}

  async getAllUsers(): Promise<UserLeaderboard[]> {
    return this.repo.getAll();
  }

  async getUserById(id: string): Promise<UserDetail | null> {
    return this.repo.getById(id);
  }

  async updateUserMemory(id: string, coreProfile: string): Promise<void> {
    await this.repo.updateMemory(id, coreProfile);
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<void> {
    await this.repo.updateStatusBulk(ids, status);
  }
}
