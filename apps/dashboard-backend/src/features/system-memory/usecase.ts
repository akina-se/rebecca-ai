import { SystemMemoryRepository } from './repository';
import { MemoryLayer, MemoryContent } from '@rebecca/types';

/**
 * Use case class for orchestrating Rebecca's system memory operations.
 */
export class SystemMemoryUseCase {
  /**
   * Creates an instance of SystemMemoryUseCase.
   * 
   * @param repo - The system memory repository instance.
   */
  constructor(private repo: SystemMemoryRepository) {}

  /**
   * Retrieves the metadata for all memory layers.
   * 
   * @returns A promise that resolves to an array of memory layers.
   */
  async getLayers(): Promise<MemoryLayer[]> {
    return this.repo.getLayers();
  }

  /**
   * Retrieves the core memory content (Layer 0).
   * 
   * @returns A promise that resolves to the core memory content.
   */
  async getCoreMemory(): Promise<MemoryContent> {
    return this.repo.getCoreMemory();
  }

  /**
   * Retrieves the global memory content (Layer 2).
   * 
   * @returns A promise that resolves to the global memory content.
   */
  async getGlobalMemory(): Promise<MemoryContent> {
    return this.repo.getGlobalMemory();
  }

  /**
   * Updates the global memory content (Layer 2).
   * 
   * @param content - The new global memory summary content.
   * @returns A promise that resolves when the update is complete.
   */
  async updateGlobalMemory(content: string): Promise<void> {
    await this.repo.updateGlobalMemory(content);
  }

  /**
   * Triggers the dreaming evolution process.
   * 
   * @returns A promise that resolves when the trigger process is complete.
   */
  async triggerDreaming(): Promise<void> {
    await this.repo.triggerDreaming();
  }
}
