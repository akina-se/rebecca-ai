import { SystemMemoryRepository } from './repository';
import { MemoryLayer, MemoryContent } from '@rebecca/types';

export class SystemMemoryUseCase {
  constructor(private repo: SystemMemoryRepository) {}

  async getLayers(): Promise<MemoryLayer[]> {
    return this.repo.getLayers();
  }

  async getCoreMemory(): Promise<MemoryContent> {
    return this.repo.getCoreMemory();
  }

  async getGlobalMemory(): Promise<MemoryContent> {
    return this.repo.getGlobalMemory();
  }

  async updateGlobalMemory(content: string): Promise<void> {
    await this.repo.updateGlobalMemory(content);
  }

  async triggerDreaming(): Promise<void> {
    await this.repo.triggerDreaming();
  }
}
