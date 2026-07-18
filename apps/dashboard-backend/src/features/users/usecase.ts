import { UsersRepository } from './repository';
import { UserDetail, UserStatus } from '@rebecca/types';

/**
 * Use case class for orchestrating user management operations.
 */
export class UsersUseCase {
  /**
   * Creates an instance of UsersUseCase.
   * 
   * @param repo - The users repository instance.
   */
  constructor(private repo: UsersRepository) {}

  /**
   * Retrieves all users, supporting pagination, custom ordering, and returning detailed user objects.
   * 
   * @returns A promise that resolves to an array of user details.
   */
  async getAllUsers(params?: { limit?: number; startAfterId?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; }): Promise<UserDetail[]> {
    return this.repo.getAll(params);
  }

  /**
   * Retrieves detailed user profile and stats by user ID.
   * 
   * @param id - The user ID/handle to lookup.
   * @returns A promise that resolves to the user detail, or null if not found.
   */
  async getUserById(id: string): Promise<UserDetail | null> {
    return this.repo.getById(id);
  }

  /**
   * Updates the core memory profile for a specific user.
   * 
   * @param id - The user ID/handle.
   * @param coreProfile - The JSON string representing the user's core profile.
   * @returns A promise that resolves when the update is complete.
   */
  async updateUserMemory(id: string, coreProfile: string): Promise<void> {
    await this.repo.updateMemory(id, coreProfile);
  }

  /**
   * Performs bulk status update for multiple users.
   * 
   * @param ids - The array of user IDs/handles.
   * @param status - The new status (Active, Blocked, Muted) to apply.
   * @returns A promise that resolves when the update is complete.
   */
  async bulkUpdateStatus(ids: string[], status: UserStatus): Promise<void> {
    await this.repo.updateStatusBulk(ids, status);
  }
}
